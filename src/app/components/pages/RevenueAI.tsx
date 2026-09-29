import { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, Check, Minus, ShieldAlert, Sparkles, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../../lib/store";
import { formatDate, formatVND } from "../../lib/format";
import { SEASON_LABELS } from "../../lib/pricing";
import {
  adviseOverbooking, forecastDemand, predictNoShow, recommendPrices, summarizeUplift,
} from "../../lib/revenueAI";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

type Tab = "forecast" | "pricing" | "noshow";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "forecast", label: "Dự báo nhu cầu" },
  { key: "pricing", label: "Đề xuất giá" },
  { key: "noshow", label: "Rủi ro no-show" },
];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const cls =
    value >= 0.7 ? "bg-emerald-100 text-emerald-700"
    : value >= 0.5 ? "bg-amber-100 text-amber-700"
    : "bg-slate-200 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>Tin cậy {pct}%</span>;
}

export function RevenueAI() {
  const {
    rooms, bookings, roomTypes, localEvents, activeRatePlan,
    addPriceOverride, priceOverrides, markNoShow, can, notify,
  } = useStore();

  const [tab, setTab] = useState<Tab>("forecast");
  const [horizon, setHorizon] = useState(30);
  const [elasticity, setElasticity] = useState(-0.6);
  /** Tắt AI → quay về bảng giá thủ công. Bắt buộc phải có để không phụ thuộc AI. */
  const [aiEnabled, setAiEnabled] = useState(true);

  const forecasts = useMemo(
    () => forecastDemand({ rooms, bookings, events: localEvents, days: horizon }),
    [rooms, bookings, localEvents, horizon],
  );

  const recs = useMemo(
    () => recommendPrices({ roomTypes, rooms, forecasts, plan: activeRatePlan, elasticity }),
    [roomTypes, rooms, forecasts, activeRatePlan, elasticity],
  );

  const uplift = useMemo(() => summarizeUplift(recs, rooms), [recs, rooms]);

  const upcoming = useMemo(
    () => bookings.filter((b) => b.status === "reserved" || b.status === "pending"),
    [bookings],
  );
  const preds = useMemo(
    () => predictNoShow({ bookings: upcoming, allBookings: bookings }),
    [upcoming, bookings],
  );

  const avgRate = useMemo(
    () => (roomTypes.length ? Math.round(roomTypes.reduce((s, t) => s + t.basePrice, 0) / roomTypes.length) : 0),
    [roomTypes],
  );

  const advice = useMemo(
    () => adviseOverbooking({ forecasts, predictions: preds, bookings, rooms, avgRoomRate: avgRate }),
    [forecasts, preds, bookings, rooms, avgRate],
  );

  const actionable = recs.filter((r) => r.action !== "hold");
  const overriddenKeys = useMemo(
    () => new Set(priceOverrides.map((o) => `${o.typeId}|${o.date}`)),
    [priceOverrides],
  );

  const applyPrice = (r: (typeof recs)[number]) => {
    if (r.requiresApproval && !can("edit_price")) {
      toast.error("Đề xuất này vượt ngưỡng cho phép, cần Quản lý duyệt.");
      return;
    }
    addPriceOverride({
      typeId: r.typeId,
      date: r.date,
      price: r.recommendedPrice,
      reason: `Áp theo đề xuất AI (${r.deltaPercent > 0 ? "+" : ""}${r.deltaPercent}%, tin cậy ${Math.round(r.confidence * 100)}%)`,
    });
    toast.success(`Đã chốt giá ${formatVND(r.recommendedPrice)} cho ${r.typeName} ngày ${formatDate(r.date)}`);
  };

  return (
    <div className="space-y-5">
      {/* Thanh điều khiển */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                tab === t.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Tầm dự báo</span>
            <select
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="rounded-lg border px-2 py-1"
            >
              {[14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>{d} ngày</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Độ co giãn</span>
            <input
              type="range" min={-1.2} max={-0.2} step={0.1}
              value={elasticity}
              onChange={(e) => setElasticity(Number(e.target.value))}
              className="w-24"
            />
            <span className="w-9 tabular-nums">{elasticity.toFixed(1)}</span>
          </label>
          <Button size="sm" variant={aiEnabled ? "outline" : "default"} onClick={() => setAiEnabled((v) => !v)}>
            {aiEnabled ? "Tắt gợi ý AI" : "Bật gợi ý AI"}
          </Button>
        </div>
      </div>

      {!aiEnabled && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <div className="font-medium text-amber-900">Đang dùng bảng giá thủ công</div>
            <p className="text-amber-800">
              Gợi ý AI đã tắt. Hệ thống áp giá theo bảng giá “{activeRatePlan.name}”.
              Mọi đặt phòng vẫn hoạt động bình thường.
            </p>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- DỰ BÁO ------*/}
      {tab === "forecast" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Lấp đầy dự báo 7 ngày"
              value={`${Math.round((forecasts.slice(0, 7).reduce((s, f) => s + f.forecastOccupancy, 0) / Math.max(1, forecasts.slice(0, 7).length)) * 100)}%`}
              hint={`Đã đặt: ${Math.round((forecasts.slice(0, 7).reduce((s, f) => s + f.bookedOccupancy, 0) / Math.max(1, forecasts.slice(0, 7).length)) * 100)}%`}
            />
            <Stat
              label="Phòng kỳ vọng bán thêm"
              value={String(Math.round(forecasts.slice(0, 7).reduce((s, f) => s + f.expectedPickup, 0)))}
              hint="trong 7 ngày tới"
            />
            <Stat
              label="Ngày gần kín phòng"
              value={String(forecasts.filter((f) => f.forecastOccupancy >= 0.9).length)}
              hint="nên tăng giá / cân nhắc overbooking"
            />
            <Stat
              label="Sự kiện ảnh hưởng"
              value={String(new Set(forecasts.flatMap((f) => f.events)).size)}
              hint="đang được tính vào dự báo"
            />
          </div>

          <div className="overflow-hidden rounded-xl border bg-white">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <TrendingUp className="size-4" />
              <h3 className="text-sm font-semibold">Dự báo tỷ lệ lấp đầy theo ngày</h3>
            </div>
            <div className="max-h-[26rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Ngày</th>
                    <th className="px-4 py-2">Dự báo</th>
                    <th className="px-4 py-2">Đã đặt</th>
                    <th className="px-4 py-2">Mùa</th>
                    <th className="px-4 py-2">Lý do</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {forecasts.map((f) => (
                    <tr key={f.date} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-2">
                        {formatDate(f.date)}
                        {f.weekend && <span className="ml-1.5 text-[11px] text-amber-600">CT</span>}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full ${f.forecastOccupancy >= 0.9 ? "bg-red-500" : f.forecastOccupancy >= 0.7 ? "bg-amber-500" : "bg-emerald-500"}`}
                              style={{ width: `${Math.min(100, f.forecastOccupancy * 100)}%` }}
                            />
                          </div>
                          <span className="tabular-nums">{Math.round(f.forecastOccupancy * 100)}%</span>
                          <ConfidenceBadge value={f.confidence} />
                        </div>
                      </td>
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">
                        {Math.round(f.bookedOccupancy * 100)}%
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary">{SEASON_LABELS[f.season]}</Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {f.reasons.slice(0, 2).join(" · ") || "—"}
                        {f.dataPoints < 3 && (
                          <span className="ml-1 text-amber-600">(ít dữ liệu lịch sử)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overbooking */}
          <div className="overflow-hidden rounded-xl border bg-white">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Khuyến nghị overbooking</h3>
              <p className="text-xs text-muted-foreground">
                Chỉ hiện những ngày gần kín phòng. Chưa bật tự động — cần người quyết định.
              </p>
            </div>
            {advice.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Không có ngày nào đủ đông để cần overbooking. An toàn — không cần làm gì.
              </p>
            ) : (
              <ul className="divide-y">
                {advice.map((a) => (
                  <li key={a.date} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
                    <div className="w-28 shrink-0 font-medium">{formatDate(a.date)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${a.safe ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {a.safe ? "Trong ngưỡng an toàn" : "Rủi ro cao"}
                        </span>
                        <span className="text-muted-foreground">
                          No-show kỳ vọng {a.expectedNoShows.toFixed(1)} phòng
                        </span>
                      </div>
                      <p className="mt-1">{a.recommendation}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Lợi kỳ vọng {formatVND(a.expectedGain)} · chi phí đền bù nếu trời trụ {formatVND(a.estimatedWalkCost)} · xác suất phải đền bù {Math.round(a.walkRisk * 100)}%
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold tabular-nums">+{a.suggestedOverbook}</div>
                      <div className="text-[11px] text-muted-foreground">phòng</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- GIÁ ---------*/}
      {tab === "pricing" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Doanh thu theo giá hiện tại" value={formatVND(uplift.currentRevenue)} hint={`${horizon} ngày tới`} />
            <Stat label="Nếu áp giá đề xuất" value={formatVND(uplift.projectedRevenue)} />
            <Stat
              label="Mức tăng kỳ vọng"
              value={`${uplift.upliftPercent > 0 ? "+" : ""}${uplift.upliftPercent}%`}
              hint={`${uplift.daysAffected} ngày bị ảnh hưởng`}
            />
            <Stat label="Cần duyệt" value={String(recs.filter((r) => r.requiresApproval).length)} hint="đề xuất biến động lớn" />
          </div>

          {!aiEnabled ? (
            <div className="rounded-xl border bg-white p-6 text-sm text-muted-foreground">
              Gợi ý giá AI đang tắt. Bạn vẫn có thể chốt giá thủ công tại mục <b>Phòng &amp; Loại phòng</b>.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-white">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <Sparkles className="size-4" />
                <h3 className="text-sm font-semibold">Đề xuất điều chỉnh giá ({actionable.length})</h3>
                <span className="ml-auto text-xs text-muted-foreground">
                  Mọi đề xuất đều phải bấm áp dụng — không tự động đổi giá
                </span>
              </div>
              <div className="max-h-[28rem] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Ngày</th>
                      <th className="px-4 py-2">Loại phòng</th>
                      <th className="px-4 py-2">Giá hiện tại</th>
                      <th className="px-4 py-2">Đề xuất</th>
                      <th className="px-4 py-2">RevPAR</th>
                      <th className="px-4 py-2">Lý do</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {actionable.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                          Giá hiện tại đang hợp lý, không cần điều chỉnh.
                        </td>
                      </tr>
                    )}
                    {actionable.map((r) => {
                      const key = `${r.typeId}|${r.date}`;
                      const done = overriddenKeys.has(key);
                      return (
                        <tr key={key} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-2">{formatDate(r.date)}</td>
                          <td className="px-4 py-2">{r.typeName}</td>
                          <td className="px-4 py-2 tabular-nums text-muted-foreground">{formatVND(r.currentPrice)}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5 font-medium tabular-nums">
                              {r.action === "increase" ? (
                                <ArrowUp className="size-3.5 text-emerald-600" />
                              ) : r.action === "decrease" ? (
                                <ArrowDown className="size-3.5 text-blue-600" />
                              ) : (
                                <Minus className="size-3.5 text-slate-400" />
                              )}
                              {formatVND(r.recommendedPrice)}
                              <span className={r.deltaPercent > 0 ? "text-emerald-600" : "text-blue-600"}>
                                ({r.deltaPercent > 0 ? "+" : ""}{r.deltaPercent}%)
                              </span>
                            </div>
                            <ConfidenceBadge value={r.confidence} />
                          </td>
                          <td className="px-4 py-2 text-xs tabular-nums">
                            {formatVND(r.currentRevPar)} → <b>{formatVND(r.expectedRevPar)}</b>
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{r.reasons.slice(0, 2).join(" · ")}</td>
                          <td className="px-4 py-2 text-right">
                            {done ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                <Check className="size-3.5" /> Đã áp
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant={r.requiresApproval ? "outline" : "default"}
                                onClick={() => applyPrice(r)}
                                title={r.requiresApproval ? "Biến động lớn — cần quyền sửa giá" : undefined}
                              >
                                {r.requiresApproval ? "Duyệt & áp" : "Áp dụng"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- NO-SHOW -----*/}
      {tab === "noshow" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Rủi ro cao" value={String(preds.filter((p) => p.level === "high").length)} hint="nên gọi xác nhận ngay" />
            <Stat label="Rủi ro trung bình" value={String(preds.filter((p) => p.level === "medium").length)} />
            <Stat label="Đơn đang theo dõi" value={String(preds.length)} />
          </div>

          <div className="overflow-hidden rounded-xl border bg-white">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <AlertTriangle className="size-4" />
              <h3 className="text-sm font-semibold">Dự đoán khách không đến</h3>
            </div>
            <div className="max-h-[30rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Mã</th>
                    <th className="px-4 py-2">Rủi ro</th>
                    <th className="px-4 py-2">Yếu tố</th>
                    <th className="px-4 py-2">Nên làm gì</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preds.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        Không có đơn sắp tới cần theo dõi.
                      </td>
                    </tr>
                  )}
                  {preds.map((p) => (
                    <tr key={p.bookingId} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-2 font-medium">{p.code}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            p.level === "high" ? "bg-red-100 text-red-700"
                            : p.level === "medium" ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {Math.round(p.risk * 100)}%
                        </span>
                        <ConfidenceBadge value={p.confidence} />
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{p.factors.join(" · ")}</td>
                      <td className="px-4 py-2 text-xs">{p.suggestedAction}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void notify(p.bookingId, "pre_arrival", "sms");
                              toast.info(`Đã ghi nhắc nhận phòng cho ${p.code} (SMS demo, chưa gửi mạng thật).`);
                            }}
                          >
                            Nhắc khách
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              markNoShow(p.bookingId);
                              toast.success(`Đã đánh dấu ${p.code} không đến`);
                            }}
                          >
                            No-show
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
