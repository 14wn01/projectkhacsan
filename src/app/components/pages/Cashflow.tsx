import { useMemo, useState } from "react";
import { ArrowDownToLine, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../../lib/store";
import { draftsFromText } from "../../lib/bankFeed";
import { formatVND, toISODate, uid } from "../../lib/format";
import type { BankInflow, BankInflowMatch } from "../../lib/types";
import { Button } from "../ui/button";
import { BankFeedSettings } from "../admin/BankFeedSettings";
import { BankTransferQueue } from "../admin/BankTransferQueue";

type Filter = "all" | BankInflowMatch;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "unmatched", label: "Chưa gắn" },
  { key: "matched", label: "Đã khớp" },
  { key: "amount_mismatch", label: "Lệch tiền" },
  { key: "ignored", label: "Bỏ qua" },
];

const MATCH_STYLE: Record<BankInflowMatch, string> = {
  matched: "bg-emerald-100 text-emerald-800",
  unmatched: "bg-amber-100 text-amber-800",
  amount_mismatch: "bg-rose-100 text-rose-800",
  ignored: "bg-slate-200 text-slate-600",
};

const MATCH_LABEL: Record<BankInflowMatch, string> = {
  matched: "Đã khớp",
  unmatched: "Chưa gắn",
  amount_mismatch: "Lệch số tiền",
  ignored: "Bỏ qua",
};

function whenLabel(iso: string) {
  const d = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN", { hour12: false });
}

export function Cashflow() {
  const {
    bankInflows, bookings, payments, customer, roomLabel,
    ingestBankDrafts, ignoreBankInflow, linkBankInflow, syncBankFeed, bankFeed,
  } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [paste, setPaste] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);

  const today = toISODate(new Date());
  const pendingPays = payments.filter((p) => p.method === "bank_transfer" && p.state === "pending");

  const visible = useMemo(
    () => (filter === "all" ? bankInflows : bankInflows.filter((x) => x.match === filter)),
    [bankInflows, filter],
  );

  const todayRows = bankInflows.filter((x) => (x.when || x.ingestedAt).slice(0, 10) === today && x.match !== "ignored");
  const todaySum = todayRows.reduce((s, x) => s + x.amount, 0);
  const unmatched = bankInflows.filter((x) => x.match === "unmatched" || x.match === "amount_mismatch").length;
  const matchedN = bankInflows.filter((x) => x.match === "matched").length;

  const guestOf = (row: BankInflow) => {
    const b = row.matchedBookingId
      ? bookings.find((x) => x.id === row.matchedBookingId)
      : row.bookingCode
        ? bookings.find((x) => x.code.toUpperCase() === row.bookingCode!.toUpperCase())
        : undefined;
    if (!b) return { name: "—", room: "", code: row.bookingCode ?? "—" };
    return { name: customer(b.customerId)?.name ?? "Khách", room: roomLabel(b.roomId), code: b.code };
  };

  const pull = async () => {
    setBusy(true);
    try {
      const res = await syncBankFeed();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } finally {
      setBusy(false);
    }
  };

  const ingestPaste = () => {
    const drafts = draftsFromText(paste);
    if (!drafts.length) {
      toast.error("JSON không đọc được. Dán đúng payload Casso/SePay.");
      return;
    }
    const res = ingestBankDrafts(drafts);
    toast.success(`Nhập ${res.added} dòng, khớp ${res.matched} đơn.`);
    setPaste("");
  };

  const ingestManual = () => {
    const n = Number(String(amount).replace(/[^\d]/g, ""));
    if (!n) {
      toast.error("Nhập số tiền vừa vào tài khoản.");
      return;
    }
    const res = ingestBankDrafts([
      {
        source: "manual",
        amount: n,
        when: new Date().toISOString(),
        description: memo.trim() || "Nhập tay từ sao kê / SMS",
        tid: uid("man"),
      },
    ]);
    if (!res.added) toast.message("Dòng này đã có trong sổ.");
    else toast.success(res.matched ? "Đã khớp với đơn đang chờ." : "Đã ghi dòng tiền vào — gắn đơn nếu chưa khớp.");
    setAmount("");
    setMemo("");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Tiền vào hôm nay</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700">+{formatVND(todaySum)}</div>
          <div className="text-xs text-muted-foreground">{todayRows.length} dòng</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Chưa gắn / lệch</div>
          <div className={"mt-1 text-2xl font-semibold " + (unmatched ? "text-amber-700" : "text-emerald-700")}>{unmatched}</div>
          <div className="text-xs text-muted-foreground">cần lễ tân/kế toán xem</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Đã khớp đơn</div>
          <div className="mt-1 text-2xl font-semibold">{matchedN}</div>
          <div className="text-xs text-muted-foreground">tự ghi nhận cọc khi đúng số + mã</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BankFeedSettings />
        <div className="space-y-3 rounded-xl border bg-white p-4">
          <h3 className="text-sm font-semibold">Nhập tay / dán JSON</h3>
          <p className="text-xs text-muted-foreground">
            Không có API thì copy một dòng trên sao kê (hoặc JSON webhook Casso/SePay) rồi dán. Nội dung CK nên có <b>COC BK-1001</b>.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              className="w-40 rounded-md border px-3 py-2 text-sm tabular-nums"
              placeholder="Số tiền +"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              className="min-w-[12rem] flex-1 rounded-md border px-3 py-2 text-sm"
              placeholder="Nội dung CK — COC BK-1001"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={ingestManual}>Ghi dòng +</Button>
          </div>
          <textarea
            className="h-28 w-full rounded-md border px-3 py-2 font-mono text-xs"
            placeholder='{"data":{"records":[{"amount":1700000,"description":"COC BK-1001","tid":"..."}]}}'
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={ingestPaste}>Nhập JSON</Button>
            <Button size="sm" variant="outline" disabled={busy || bankFeed.provider === "none"} onClick={() => void pull()}>
              <RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")} /> Kéo từ API
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#e3ddd2] bg-[#fcfaf7] p-4">
        <div className="mb-2 text-sm font-medium">Khách báo đã chuyển — chờ thấy tiền</div>
        <BankTransferQueue />
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <ArrowDownToLine className="size-4 text-[#8a6d33]" />
          <h3 className="text-sm font-semibold">Sổ dòng tiền + ({visible.length})</h3>
          <div className="ml-auto flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={
                  "rounded-lg px-2.5 py-1 text-xs " +
                  (filter === f.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[40rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Thời điểm</th>
                <th className="px-4 py-2 text-right">Tiền vào</th>
                <th className="px-4 py-2">Khách / đơn</th>
                <th className="px-4 py-2">Nội dung CK</th>
                <th className="px-4 py-2">Khớp</th>
                <th className="px-4 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((row) => {
                const g = guestOf(row);
                return (
                  <tr key={row.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{whenLabel(row.when)}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums text-emerald-800">+{formatVND(row.amount)}</td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{g.name}</div>
                      <div className="text-[11px] text-muted-foreground">{g.code}{g.room ? ` · ${g.room}` : ""}</div>
                    </td>
                    <td className="max-w-[22rem] px-4 py-2 text-xs break-words">{row.description || "—"}</td>
                    <td className="px-4 py-2">
                      <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + MATCH_STYLE[row.match]}>
                        {MATCH_LABEL[row.match]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {(row.match === "unmatched" || row.match === "amount_mismatch") && (
                        <div className="flex flex-col items-end gap-1">
                          {pendingPays.length > 0 && (
                            <label className="flex items-center gap-1 text-[11px]">
                              <Link2 className="size-3" />
                              <select
                                className="max-w-[14rem] rounded border px-1 py-0.5"
                                defaultValue=""
                                onChange={(e) => {
                                  const id = e.target.value;
                                  if (!id) return;
                                  const res = linkBankInflow(row.id, id);
                                  if (res.ok) toast.success(res.message);
                                  else toast.error(res.message);
                                }}
                              >
                                <option value="">Gắn lệnh chờ…</option>
                                {pendingPays.map((p) => {
                                  const b = bookings.find((x) => x.id === p.bookingId);
                                  const name = b ? customer(b.customerId)?.name : "";
                                  return (
                                    <option key={p.id} value={p.id}>
                                      {b?.code ?? p.bookingId} · {formatVND(p.amount)} {name ? `· ${name}` : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            </label>
                          )}
                          <button
                            type="button"
                            className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => ignoreBankInflow(row.id)}
                          >
                            Không phải cọc — bỏ qua
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Chưa có dòng tiền vào. Kéo sao kê, dán JSON, hoặc ghi tay khi thấy SMS ngân hàng.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
