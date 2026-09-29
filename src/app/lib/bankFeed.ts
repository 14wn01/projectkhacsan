import type { BankFeedConfig, BankFeedProvider, BankInflow, Booking, Payment } from "./types";
import { extractBookingCode } from "./bank";
import { uid } from "./format";

export type BankInflowDraft = Omit<BankInflow, "id" | "ingestedAt" | "match" | "matchedBookingId" | "matchedPaymentId" | "bookingCode"> & {
  bookingCode?: string;
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function fromCassoRecord(r: Record<string, unknown>, source: BankFeedProvider): BankInflowDraft | null {
  const amount = num(r.amount);
  if (amount <= 0) return null;
  const description = String(r.description ?? r.content ?? "");
  return {
    source,
    amount,
    when: String(r.when ?? r.transactionDate ?? new Date().toISOString()),
    description,
    tid: String(r.tid ?? r.id ?? uid("tid")),
    accountNo:
      r.bank_sub_acc_id != null
        ? String(r.bank_sub_acc_id)
        : r.subAccId != null
          ? String(r.subAccId)
          : r.accountNumber != null
            ? String(r.accountNumber)
            : undefined,
    balanceAfter: r.cusum_balance != null ? num(r.cusum_balance) : undefined,
    bookingCode: extractBookingCode(description) ?? undefined,
  };
}

function fromSepayRecord(r: Record<string, unknown>): BankInflowDraft | null {
  const type = String(r.transferType ?? r.transfer_type ?? "in").toLowerCase();
  if (type && type !== "in") return null;
  const amount = num(r.transferAmount ?? r.transfer_amount ?? r.amount);
  if (amount <= 0) return null;
  const description = String(r.content ?? r.description ?? "");
  return {
    source: "sepay",
    amount,
    when: String(r.transactionDate ?? r.transaction_date ?? r.when ?? new Date().toISOString()),
    description,
    tid: String(r.referenceCode ?? r.id ?? uid("tid")),
    accountNo: r.accountNumber != null ? String(r.accountNumber) : undefined,
    balanceAfter: r.accumulated != null ? num(r.accumulated) : undefined,
    bookingCode: extractBookingCode(description) ?? undefined,
  };
}

/** Nhận JSON webhook/API Casso, SePay, mảng giao dịch, hoặc 1 object. */
export function parseBankPayload(raw: unknown): BankInflowDraft[] {
  if (Array.isArray(raw)) return parseBankPayload({ transactions: raw });
  const root = asRecord(raw);
  if (!root) return [];

  const data = root.data ?? raw;
  const dataRec = asRecord(data);
  const records =
    (dataRec && Array.isArray(dataRec.records) && dataRec.records) ||
    (Array.isArray(root.transactions) && root.transactions) ||
    (Array.isArray(data) && data) ||
    (dataRec && (dataRec.tid != null || dataRec.description != null) && [data]) ||
    (root.transferAmount != null && [root]) ||
    (root.amount != null && root.description != null && [root]) ||
    [];

  const out: BankInflowDraft[] = [];
  for (const item of records) {
    const r = asRecord(item);
    if (!r) continue;
    const row =
      r.transferAmount != null || r.transfer_amount != null || r.content != null && r.gateway != null
        ? fromSepayRecord(r)
        : fromCassoRecord(r, r.gateway != null ? "sepay" : "casso");
    if (row) out.push(row);
  }
  return out;
}

export function matchInflow(
  draft: BankInflowDraft,
  bookings: Booking[],
  payments: Payment[],
): Pick<BankInflow, "bookingCode" | "matchedBookingId" | "matchedPaymentId" | "match"> {
  const code = draft.bookingCode ?? extractBookingCode(draft.description) ?? undefined;
  const booking = code ? bookings.find((b) => b.code.toUpperCase() === code.toUpperCase()) : undefined;
  const pending = payments.filter(
    (p) =>
      p.method === "bank_transfer" &&
      p.state === "pending" &&
      (booking ? p.bookingId === booking.id : code ? (p.transferContent ?? "").toUpperCase().includes(code.toUpperCase()) : false),
  );
  const byAmount = pending.find((p) => p.amount === draft.amount) ?? (booking ? pending[0] : undefined);
  const pay = byAmount ?? pending[0];

  if (booking && pay && pay.amount === draft.amount) {
    return { bookingCode: code, matchedBookingId: booking.id, matchedPaymentId: pay.id, match: "matched" };
  }
  if (booking && (pay || draft.amount > 0) && pay && pay.amount !== draft.amount) {
    return { bookingCode: code, matchedBookingId: booking.id, matchedPaymentId: pay.id, match: "amount_mismatch" };
  }
  if (booking) {
    return { bookingCode: code, matchedBookingId: booking.id, match: "unmatched" };
  }
  return { bookingCode: code, match: "unmatched" };
}

export function toBankInflow(draft: BankInflowDraft, extra: ReturnType<typeof matchInflow>): BankInflow {
  return {
    id: uid("in"),
    source: draft.source,
    amount: draft.amount,
    when: draft.when,
    description: draft.description,
    tid: draft.tid,
    accountNo: draft.accountNo,
    balanceAfter: draft.balanceAfter,
    ingestedAt: new Date().toISOString(),
    ...extra,
  };
}

export async function fetchCassoTransactions(apiKey: string): Promise<BankInflowDraft[]> {
  const from = new Date();
  from.setDate(from.getDate() - 7);
  const fromDate = from.toISOString().slice(0, 10);
  const url = `/api/casso/v2/transactions?fromDate=${fromDate}&page=1&pageSize=50&sort=DESC`;
  const res = await fetch(url, {
    headers: { Authorization: `Apikey ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      res.status === 404
        ? "Máy này chưa proxy được Casso. Chạy `npm run dev` hoặc dán JSON webhook."
        : `Casso trả ${res.status}. ${text.slice(0, 180)}`,
    );
  }
  const json = await res.json();
  if (json && typeof json === "object" && json.error && json.error !== 0) {
    throw new Error(String(json.message ?? "Casso từ chối API key."));
  }
  return parseBankPayload(json).map((r) => ({ ...r, source: "casso" as const }));
}

export async function fetchSepayTransactions(token: string): Promise<BankInflowDraft[]> {
  const url = `/api/sepay/userapi/transactions/list?limit=50&transfer_type=in`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Máy này chưa proxy được SePay. Chạy `npm run dev` hoặc dán JSON webhook."
        : `SePay trả ${res.status}.`,
    );
  }
  const json = await res.json();
  const drafts = Array.isArray(json) ? parseBankPayload({ transactions: json }) : parseBankPayload(json);
  return drafts.map((r) => ({ ...r, source: "sepay" as const }));
}

/** Dán JSON webhook / sao kê. Chuỗi không phải JSON thì trả mảng rỗng. */
export function draftsFromText(text: string): BankInflowDraft[] {
  const t = text.trim();
  if (!t) return [];
  try {
    return parseBankPayload(JSON.parse(t) as unknown);
  } catch {
    return [];
  }
}

export function defaultBankFeed(): BankFeedConfig {
  const env = import.meta.env as Record<string, string | undefined>;
  const sepay = typeof env.VITE_SEPAY_TOKEN === "string" ? env.VITE_SEPAY_TOKEN.trim() : "";
  const casso = typeof env.VITE_CASSO_API_KEY === "string" ? env.VITE_CASSO_API_KEY.trim() : "";
  if (sepay) return { provider: "sepay", apiKey: sepay };
  if (casso) return { provider: "casso", apiKey: casso };
  return { provider: "none", apiKey: "" };
}
