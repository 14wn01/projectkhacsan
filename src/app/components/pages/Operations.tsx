import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bell, Download, RotateCcw, ScrollText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../../lib/store";
import { VN_BANKS, isBankConfigured, vietQrImageUrl } from "../../lib/bank";
import { LogEntry, clearLogs, getLogs, getVitals, subscribeLogs } from "../../lib/logger";
import { NOTIFICATION_LABELS } from "../../lib/notifications";
import { Button } from "../ui/button";
import { BankFeedSettings } from "../admin/BankFeedSettings";

type Tab = "health" | "bank" | "logs" | "notifications" | "audit" | "backup";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "health", label: "Tình trạng hệ thống" },
  { key: "bank", label: "Tài khoản nhận CK" },
  { key: "logs", label: "Nhật ký lỗi" },
  { key: "notifications", label: "Email / SMS" },
  { key: "audit", label: "Nhật ký kiểm toán" },
  { key: "backup", label: "Sao lưu & Phục hồi" },
];

const LEVEL_STYLE: Record<string, string> = {
  error: "bg-red-100 text-red-700",
  warn: "bg-amber-100 text-amber-700",
  info: "bg-blue-100 text-blue-700",
  debug: "bg-slate-200 text-slate-600",
};

const RATING_STYLE: Record<string, string> = {
  good: "text-emerald-600",
  "needs-improvement": "text-amber-600",
  poor: "text-red-600",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { hour12: false });
}

export function Operations() {
  const {
    notifications, auditLog, retryFailedNotifications, runDueNotifications,
    backupNow, restoreFromFile, resetAll, storageInfo, can, bankAccount, saveBankAccount,
  } = useStore();

  const [tab, setTab] = useState<Tab>("health");
  const [bankForm, setBankForm] = useState(bankAccount);
  const [logs, setLogs] = useState<LogEntry[]>(() => getLogs());
  const [level, setLevel] = useState<"all" | "error" | "warn" | "info">("all");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeLogs(() => setLogs(getLogs())), []);
  useEffect(() => setBankForm(bankAccount), [bankAccount]);

  const vitals = getVitals();
  const info = storageInfo();
  const visibleLogs = useMemo(
    () => (level === "all" ? logs : logs.filter((l) => l.level === level)),
    [logs, level],
  );

  const failedCount = notifications.filter((n) => n.state === "failed").length;
  const errorCount = logs.filter((l) => l.level === "error").length;

  const onRestore = async (file: File) => {
    setBusy(true);
    try {
      const res = await restoreFromFile(file);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 rounded-xl border bg-white p-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "rounded-lg px-3 py-1.5 text-sm transition-colors " +
              (tab === t.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")
            }
          >
            {t.label}
            {t.key === "logs" && errorCount > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[10px] text-white">{errorCount}</span>
            )}
            {t.key === "notifications" && failedCount > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[10px] text-white">{failedCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "bank" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border bg-white p-4">
            <h3 className="text-sm font-semibold">Tài khoản nhận chuyển khoản</h3>
            <p className="text-xs text-muted-foreground">
              Số này hiện trên phiếu cọc của khách (VietQR). Điền STK thật của Sao Mai — khách chuyển là tiền vào đúng tài khoản.
            </p>
            <label className="block text-xs font-medium">Ngân hàng
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={bankForm.bankBin}
                onChange={(e) => {
                  const bin = e.target.value;
                  const name = VN_BANKS.find((b) => b.bin === bin)?.name ?? bankForm.bankName;
                  setBankForm({ ...bankForm, bankBin: bin, bankName: name });
                }}
              >
                {VN_BANKS.map((b) => (
                  <option key={b.bin} value={b.bin}>{b.name} ({b.bin})</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">Số tài khoản
              <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm tabular-nums" value={bankForm.accountNo} onChange={(e) => setBankForm({ ...bankForm, accountNo: e.target.value.replace(/\s/g, "") })} />
            </label>
            <label className="block text-xs font-medium">Chủ tài khoản (không dấu, in hoa)
              <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={bankForm.accountName} onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value.toUpperCase() })} />
            </label>
            <label className="block text-xs font-medium">Chi nhánh
              <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={bankForm.branch ?? ""} onChange={(e) => setBankForm({ ...bankForm, branch: e.target.value })} />
            </label>
            <Button
              onClick={() => {
                if (!isBankConfigured(bankForm)) {
                  toast.error("Thiếu số TK hoặc mã ngân hàng.");
                  return;
                }
                saveBankAccount(bankForm);
                toast.success("Đã lưu tài khoản nhận tiền. VietQR trên trang khách dùng số này.");
              }}
            >
              Lưu tài khoản
            </Button>
          </div>
          <div className="rounded-xl border bg-[#fcfaf7] p-4 text-center">
            <p className="mb-2 text-xs uppercase tracking-wide text-[#8a6d33]">Xem thử QR cọc 1.000.000đ</p>
            {isBankConfigured(bankForm) ? (
              <img
                src={vietQrImageUrl(bankForm, 1_000_000, "COC BK-DEMO")}
                alt="VietQR thử"
                className="mx-auto bg-white"
                width={220}
                height={220}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Điền đủ STK để xem QR.</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{bankForm.bankName} · {bankForm.accountNo} · {bankForm.accountName}</p>
          </div>
          <div className="lg:col-span-2">
            <BankFeedSettings />
          </div>
        </div>
      )}

      {tab === "health" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Lưu trữ</div>
              <div className={"mt-1 text-lg font-semibold " + (info.available ? "text-emerald-700" : "text-red-600")}>
                {info.available ? "Hoạt động" : "Không khả dụng"}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {info.savedAt ? "Lưu lúc " + fmt(info.savedAt) : "Chưa lưu lần nào"}
              </div>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Lỗi ghi nhận</div>
              <div className={"mt-1 text-lg font-semibold " + (errorCount > 0 ? "text-red-600" : "text-emerald-700")}>
                {errorCount}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">tổng {logs.length} dòng</div>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Email/SMS lỗi</div>
              <div className={"mt-1 text-lg font-semibold " + (failedCount > 0 ? "text-amber-600" : "text-emerald-700")}>
                {failedCount}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">đã gửi {notifications.length} tin</div>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Thao tác được ghi</div>
              <div className="mt-1 text-lg font-semibold">{auditLog.length}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-white">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Activity className="size-4" />
              <h3 className="text-sm font-semibold">Hiệu năng trải nghiệm (Core Web Vitals)</h3>
            </div>
            {vitals.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted-foreground">
                Chưa thu được số đo. Hãy tải lại trang và quay lại sau vài giây.
              </p>
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
                {vitals.map((v) => (
                  <div key={v.name + v.at} className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs font-medium text-muted-foreground">{v.name}</div>
                    <div className={"mt-0.5 text-lg font-semibold " + RATING_STYLE[v.rating]}>
                      {v.name === "CLS" ? v.value.toFixed(3) : Math.round(v.value) + "ms"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {v.rating === "good" ? "Tốt" : v.rating === "needs-improvement" ? "Cần cải thiện" : "Kém"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <ScrollText className="size-4" />
            <h3 className="text-sm font-semibold">Nhật ký lỗi ({visibleLogs.length})</h3>
            <div className="ml-auto flex items-center gap-2">
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as "all" | "error" | "warn" | "info")}
                className="rounded-lg border px-2 py-1 text-sm"
              >
                <option value="all">Tất cả</option>
                <option value="error">Chỉ lỗi</option>
                <option value="warn">Cảnh báo</option>
                <option value="info">Thông tin</option>
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const text = visibleLogs
                    .map((l) => "[" + fmt(l.at) + "] " + l.level.toUpperCase() + " (" + l.scope + ") " + l.message)
                    .join("\n");
                  try {
                    await navigator.clipboard.writeText(text);
                    toast.success("Đã copy nhật ký — gửi cho kỹ thuật khi cần.");
                  } catch {
                    toast.error("Trình duyệt chặn copy.");
                  }
                }}
              >
                Copy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  clearLogs();
                  setLogs([]);
                }}
              >
                <Trash2 className="size-4" /> Xóa
              </Button>
            </div>
          </div>
          <div className="max-h-[32rem] overflow-auto">
            {visibleLogs.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Không có dòng nhật ký nào — dấu hiệu tốt.</p>
            ) : (
              <ul className="divide-y font-mono text-xs">
                {visibleLogs.map((l) => (
                  <li key={l.id} className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase " + (LEVEL_STYLE[l.level] || "")
                        }
                      >
                        {l.level}
                      </span>
                      <span className="text-slate-400">{fmt(l.at)}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{l.scope}</span>
                    </div>
                    <div className="mt-1 break-words text-slate-700">{l.message}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "notifications" && (
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <Bell className="size-4" />
            <h3 className="text-sm font-semibold">Lịch sử gửi ({notifications.length})</h3>
            <div className="ml-auto flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const n = await runDueNotifications();
                    toast.success(n > 0 ? "Đã gửi " + n + " tin đến hạn" : "Không có tin nào đến hạn.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Gửi tin đến hạn
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || failedCount === 0}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await retryFailedNotifications();
                    toast.success("Đã gửi lại các tin thất bại.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Gửi lại tin lỗi ({failedCount})
              </Button>
            </div>
          </div>
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Thời điểm</th>
                  <th className="px-4 py-2">Loại</th>
                  <th className="px-4 py-2">Kênh</th>
                  <th className="px-4 py-2">Gửi tới</th>
                  <th className="px-4 py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...notifications].reverse().map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{fmt(n.createdAt)}</td>
                    <td className="px-4 py-2">{NOTIFICATION_LABELS[n.kind] || n.kind}</td>
                    <td className="px-4 py-2 text-xs uppercase">{n.channel}</td>
                    <td className="px-4 py-2">{n.to}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[11px] font-medium " +
                          (n.state === "sent"
                            ? "bg-emerald-100 text-emerald-700"
                            : n.state === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-200 text-slate-600")
                        }
                      >
                        {n.state === "sent" ? "Đã gửi" : n.state === "failed" ? "Thất bại" : "Đang chờ"}
                      </span>
                    </td>
                  </tr>
                ))}
                {notifications.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      Chưa gửi tin nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Nhật ký kiểm toán ({auditLog.length})</h3>
            <p className="text-xs text-muted-foreground">
              Ghi lại ai làm gì, lúc nào — dùng khi cần truy trách nhiệm hoặc đối chẩn lệch tiền.
            </p>
          </div>
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Thời điểm</th>
                  <th className="px-4 py-2">Người thực hiện</th>
                  <th className="px-4 py-2">Hành động</th>
                  <th className="px-4 py-2">Đối tượng</th>
                  <th className="px-4 py-2">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...auditLog].reverse().map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{fmt(a.at)}</td>
                    <td className="px-4 py-2">{a.actor}</td>
                    <td className="px-4 py-2 font-medium">{a.action}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{a.target || "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{a.detail || "—"}</td>
                  </tr>
                ))}
                {auditLog.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      Chưa có thao tác nào được ghi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "backup" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4">
            <h3 className="text-sm font-semibold">Sao lưu dữ liệu</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tải về 1 file chứa toàn bộ dữ liệu hiện tại (phòng, khách, đặt phòng, hóa đơn, thanh toán).
              <b> Nên làm mỗi cuối ngày</b> và lưu sang ổ đĩa khác hoặc Google Drive.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  backupNow();
                  toast.success("Đang tải file sao lưu...");
                }}
              >
                <Download className="size-4" /> Tải bản sao lưu
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" /> Phục hồi từ file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onRestore(f);
                }}
              />
            </div>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <b>Hướng dẫn phục hồi (cho người không chuyên):</b>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>Bấm “Tải bản sao lưu” để giữ dữ liệu hiện tại trước (đường lùi).</li>
                <li>Bấm “Phục hồi từ file” và chọn file .json đã sao lưu.</li>
                <li>Nếu file sai định dạng, dữ liệu hiện tại <b>không bị thay đổi</b>.</li>
                <li>Tải lại trang để thấy dữ liệu mới.</li>
              </ol>
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <RotateCcw className="size-4" /> Khôi phục dữ liệu mẫu
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Xóa toàn bộ dữ liệu đang có và đưa hệ thống về trạng thái ban đầu.
              <b> Không thể hoàn tác.</b>
            </p>
            <Button
              size="sm"
              variant="destructive"
              className="mt-3"
              disabled={!can("ops")}
              onClick={() => {
                if (!window.confirm("Xóa toàn bộ dữ liệu và về mặc định? Hãy tải bản sao lưu trước.")) return;
                resetAll();
                toast.success("Đã khôi phục dữ liệu mẫu.");
              }}
            >
              Khôi phục mặc định
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
