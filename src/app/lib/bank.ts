import type { BankAccount, PaymentPurpose } from "./types";

/** Danh sách BIN thông dụng — dùng cho VietQR / NAPAS. */
export const VN_BANKS: Array<{ bin: string; name: string }> = [
  { bin: "970436", name: "Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970432", name: "VPBank" },
  { bin: "970416", name: "ACB" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970443", name: "SHB" },
  { bin: "970454", name: "VietCapitalBank" },
  { bin: "970448", name: "OCB" },
  { bin: "970429", name: "SCB" },
  { bin: "970441", name: "VIB" },
  { bin: "970449", name: "LienVietPostBank" },
  { bin: "970437", name: "HDBank" },
  { bin: "970431", name: "Eximbank" },
  { bin: "970426", name: "MSB" },
  { bin: "970414", name: "OceanBank" },
];

function env(name: string) {
  const v = (import.meta.env as Record<string, string | undefined>)[name];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

/** Tài khoản mặc định — sửa trong Sao lưu & nhật ký hoặc biến môi trường VITE_BANK_*. */
export const DEFAULT_BANK_ACCOUNT: BankAccount = {
  bankName: env("VITE_BANK_NAME") || "Vietcombank",
  bankBin: env("VITE_BANK_BIN") || "970436",
  accountNo: env("VITE_BANK_ACCOUNT") || "1034567890",
  accountName: env("VITE_BANK_HOLDER") || "SAO MAI HOTEL AND RESIDENCES",
  branch: env("VITE_BANK_BRANCH") || "Chi nhánh TP.HCM",
};

export function bankLabel(bin: string) {
  return VN_BANKS.find((b) => b.bin === bin)?.name ?? bin;
}

export function transferContent(bookingCode: string, purpose: PaymentPurpose = "deposit") {
  const prefix = purpose === "deposit" ? "COC" : purpose === "refund" ? "HOAN" : "TT";
  return `${prefix} ${bookingCode}`.replace(/\s+/g, " ").trim().slice(0, 50);
}

/** Ảnh QR VietQR — app ngân hàng VN quét được và điền sẵn STK / số tiền / nội dung. */
export function vietQrImageUrl(account: BankAccount, amount: number, addInfo: string) {
  const acc = account.accountNo.replace(/\s+/g, "");
  const q = new URLSearchParams({
    amount: String(Math.max(0, Math.round(amount))),
    addInfo,
    accountName: account.accountName,
  });
  return `https://img.vietqr.io/image/${account.bankBin}-${acc}-compact2.png?${q.toString()}`;
}

export function isBankConfigured(account: BankAccount) {
  const acc = account.accountNo.replace(/\s+/g, "");
  return acc.length >= 6 && account.accountName.trim().length >= 3 && /^\d{6}$/.test(account.bankBin);
}

/** Lấy mã đơn từ nội dung CK: "COC BK-1001" / "TT BK1001" / "BK-1001". */
export function extractBookingCode(memo: string): string | null {
  const t = memo.toUpperCase().replace(/\s+/g, " ");
  const tagged = t.match(/\b(?:COC|TT|HOAN)\s+BK-?(\d{3,})\b/);
  if (tagged) return `BK-${tagged[1]}`;
  const bare = t.match(/\bBK-?(\d{3,})\b/);
  if (bare) return `BK-${bare[1]}`;
  return null;
}
