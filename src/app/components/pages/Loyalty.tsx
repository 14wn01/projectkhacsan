import { useMemo, useState } from "react";
import { Award, Gift, History, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../../lib/store";
import { formatDate, formatVND } from "../../lib/format";
import {
  TIERS, maxRedeemablePoints, nextTierProgress, pointsToVND, tierConfig,
} from "../../lib/loyalty";
import { LoyaltyTier } from "../../lib/types";
import { Button } from "../ui/button";

const TIER_STYLE: Record<LoyaltyTier, string> = {
  member: "bg-slate-200 text-slate-700",
  silver: "bg-slate-300 text-slate-800",
  gold: "bg-amber-100 text-amber-800",
  platinum: "bg-violet-100 text-violet-800",
};

export function Loyalty() {
  const { customers, loyaltyAccounts, loyaltyTxns, invoices, bookings, loyaltyOf, redeemLoyalty, can } = useStore();

  const [selected, setSelected] = useState<string | null>(null);
  const [redeemInput, setRedeemInput] = useState(0);
  const [invoiceId, setInvoiceId] = useState("");

  const ranked = useMemo(
    () =>
      customers
        .map((c) => ({ customer: c, account: loyaltyOf(c.id) }))
        .sort((a, b) => b.account.lifetimeSpend - a.account.lifetimeSpend),
    [customers, loyaltyAccounts, loyaltyOf],
  );

  const stats = useMemo(() => {
    const totalPoints = loyaltyAccounts.reduce((s, a) => s + a.points, 0);
    const byTier = TIERS.map((t) => ({
      tier: t.tier,
      label: t.label,
      count: loyaltyAccounts.filter((a) => a.tier === t.tier).length,
    }));
    return { totalPoints, liability: pointsToVND(totalPoints), byTier };
  }, [loyaltyAccounts]);

  const active = selected ? ranked.find((r) => r.customer.id === selected) : null;

  /** Hóa đơn còn nợ của khách đó — chỉ cho tiêu điểm vào hóa đơn chưa thanh toán xong */
  const openInvoices = useMemo(() => {
    if (!active) return [];
    const ids = new Set(bookings.filter((b) => b.customerId === active.customer.id).map((b) => b.id));
    return invoices.filter((i) => ids.has(i.bookingId) && i.status !== "paid");
  }, [active, bookings, invoices]);

  const chosenInvoice = openInvoices.find((i) => i.id === invoiceId) ?? openInvoices[0];
  const maxPoints = active && chosenInvoice ? maxRedeemablePoints(active.account, chosenInvoice.total) : 0;
  const txns = useMemo(
    () => (active ? loyaltyTxns.filter((t) => t.customerId === active.customer.id).slice().reverse() : []),
    [active, loyaltyTxns],
  );

  const doRedeem = () => {
    if (!active || !chosenInvoice) return;
    const res = redeemLoyalty(active.customer.id, redeemInput, chosenInvoice.id);
    if (res.ok) {
      toast.success(res.message);
      setRedeemInput(0);
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Tổng quan */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Thành viên</div>
          <div className="mt-1 text-xl font-semibold">{loyaltyAccounts.length}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Tổng điểm lưu hành</div>
          <div className="mt-1 text-xl font-semibold">{stats.totalPoints.toLocaleString("vi-VN")}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Giá trị phải trả ước tính</div>
          <div className="mt-1 text-xl font-semibold text-amber-600">{formatVND(stats.liability)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">nếu khách tiêu hết điểm</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Phân bổ hạng</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {stats.byTier.map((t) => (
              <span key={t.tier} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIER_STYLE[t.tier]}`}>
                {t.label} {t.count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Quy định hạng */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Award className="size-4" />
          <h3 className="text-sm font-semibold">Chính sách hạng thành viên</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Hạng</th>
                <th className="px-4 py-2">Điều kiện chi tiêu</th>
                <th className="px-4 py-2">Tốc độ tích điểm</th>
                <th className="px-4 py-2">Giảm giá phòng</th>
                <th className="px-4 py-2">Quyền lợi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {TIERS.map((t) => (
                <tr key={t.tier}>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIER_STYLE[t.tier]}`}>{t.label}</span>
                  </td>
                  <td className="px-4 py-2 tabular-nums">{t.threshold === 0 ? "Mặc định" : `từ ${formatVND(t.threshold)}`}</td>
                  <td className="px-4 py-2">×{t.earnMultiplier}</td>
                  <td className="px-4 py-2">{Math.round(t.roomDiscount * 100)}%</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{t.perks.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Danh sách khách */}
        <div className="overflow-hidden rounded-xl border bg-white lg:col-span-3">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <TrendingUp className="size-4" />
            <h3 className="text-sm font-semibold">Khách hàng theo giá trị</h3>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Khách</th>
                  <th className="px-4 py-2">Hạng</th>
                  <th className="px-4 py-2">Điểm</th>
                  <th className="px-4 py-2">Chi tiêu</th>
                  <th className="px-4 py-2">Lưu trú</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ranked.map(({ customer, account }) => {
                  const cfg = tierConfig(account.tier);
                  return (
                    <tr
                      key={customer.id}
                      onClick={() => { setSelected(customer.id); setRedeemInput(0); setInvoiceId(""); }}
                      className={`cursor-pointer hover:bg-slate-50 ${selected === customer.id ? "bg-slate-50" : ""}`}
                    >
                      <td className="px-4 py-2">
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-xs text-muted-foreground">{customer.phone}</div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIER_STYLE[account.tier]}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 tabular-nums font-medium">{account.points.toLocaleString("vi-VN")}</td>
                      <td className="px-4 py-2 tabular-nums">{formatVND(account.lifetimeSpend)}</td>
                      <td className="px-4 py-2 tabular-nums">{account.stays}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chi tiết khách */}
        <div className="space-y-4 lg:col-span-2">
          {!active ? (
            <div className="rounded-xl border bg-white p-6 text-sm text-muted-foreground">
              Chọn một khách ở bảng bên để xem điểm và đổi điểm.
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{active.customer.name}</div>
                    <div className="text-xs text-muted-foreground">{active.customer.phone}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIER_STYLE[active.account.tier]}`}>
                    {tierConfig(active.account.tier).label}
                  </span>
                </div>

                {(() => {
                  const p = nextTierProgress(active.account.lifetimeSpend);
                  return (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{p.current.label}</span>
                        <span>{p.next ? p.next.label : "Hạng cao nhất"}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-slate-900" style={{ width: `${Math.min(100, p.percent)}%` }} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p.next
                          ? `Cần chi thêm ${formatVND(p.remaining)} để lên ${p.next.label}`
                          : "Khách đã ở hạng cao nhất — ưu tiên chăm sóc riêng."}
                      </div>
                    </div>
                  );
                })()}

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="text-xs text-muted-foreground">Điểm khả dụng</div>
                    <div className="font-semibold tabular-nums">{active.account.points.toLocaleString("vi-VN")}</div>
                    <div className="text-[11px] text-muted-foreground">≈ {formatVND(pointsToVND(active.account.points))}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="text-xs text-muted-foreground">Số lần lưu trú</div>
                    <div className="font-semibold tabular-nums">{active.account.stays}</div>
                  </div>
                </div>
              </div>

              {/* Đổi điểm */}
              <div className="rounded-xl border bg-white p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Gift className="size-4" /> Đổi điểm trừ vào hóa đơn
                </h3>
                {!can("invoices") ? (
                  <p className="mt-2 text-sm text-muted-foreground">Bạn không có quyền điều chỉnh hóa đơn.</p>
                ) : openInvoices.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Khách này không có hóa đơn nào còn nợ. Chỉ đổi được điểm khi có hóa đơn chưa thanh toán xong.
                  </p>
                ) : (
                  <>
                    <label className="mt-2 block text-sm">
                      <span className="text-muted-foreground">Hóa đơn</span>
                      <select
                        value={chosenInvoice?.id ?? ""}
                        onChange={(e) => { setInvoiceId(e.target.value); setRedeemInput(0); }}
                        className="mt-1 w-full rounded-lg border px-2.5 py-2"
                      >
                        {openInvoices.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.code} — còn {formatVND(i.total - i.paid)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="mt-2 block text-sm">
                      <span className="text-muted-foreground">Số điểm muốn dùng (tối đa {maxPoints.toLocaleString("vi-VN")})</span>
                      <input
                        type="number"
                        min={0}
                        max={maxPoints}
                        value={redeemInput}
                        onChange={(e) => setRedeemInput(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border px-2.5 py-2 tabular-nums"
                      />
                    </label>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Giảm tương ứng: <b>{formatVND(pointsToVND(Math.min(redeemInput, maxPoints)))}</b>
                      {maxPoints < active.account.points && " · Giới hạn 50% giá trị hóa đơn"}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <Button size="sm" disabled={redeemInput <= 0 || redeemInput > maxPoints} onClick={doRedeem}>
                        Đổi điểm
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRedeemInput(maxPoints)}>Dùng tối đa</Button>
                    </div>
                  </>
                )}
              </div>

              {/* Lịch sử */}
              <div className="overflow-hidden rounded-xl border bg-white">
                <div className="flex items-center gap-2 border-b px-4 py-3">
                  <History className="size-4" />
                  <h3 className="text-sm font-semibold">Lịch sử điểm</h3>
                </div>
                <ul className="max-h-64 divide-y overflow-auto">
                  {txns.length === 0 && (
                    <li className="px-4 py-4 text-sm text-muted-foreground">Chưa có giao dịch điểm nào.</li>
                  )}
                  {txns.map((t) => (
                    <li key={t.id} className="flex items-start gap-2 px-4 py-2 text-sm">
                      <span className={`font-semibold tabular-nums ${t.points >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {t.points >= 0 ? "+" : ""}{t.points.toLocaleString("vi-VN")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block">{t.reason}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(t.createdAt.slice(0, 10))}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
