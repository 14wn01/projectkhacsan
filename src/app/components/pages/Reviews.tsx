import { useMemo, useState } from "react";
import { AlertTriangle, Copy, Info, MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";
import { HOTEL_NAME, useStore } from "../../lib/store";
import { formatDate } from "../../lib/format";
import {
  PLATFORM_LABELS, SENTIMENT_LABELS, analyzeReviews, draftReviewReply,
  qualityAlerts, summarizeReviews,
} from "../../lib/sentiment";
import { ReviewPlatform, Sentiment } from "../../lib/types";
import { Button } from "../ui/button";

const SENTIMENT_STYLE: Record<Sentiment, string> = {
  positive: "bg-emerald-100 text-emerald-700",
  neutral: "bg-slate-200 text-slate-600",
  negative: "bg-red-100 text-red-700",
};

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`size-3.5 ${i <= n ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
      ))}
    </span>
  );
}

export function Reviews() {
  const { reviews, addReview, replyToReview, overrideSentiment } = useStore();

  const [platform, setPlatform] = useState<"all" | ReviewPlatform>("all");
  const [onlyNegative, setOnlyNegative] = useState(false);
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);
  const [form, setForm] = useState({
    platform: "website" as ReviewPlatform,
    customerName: "",
    rating: 5,
    text: "",
  });

  const analyzed = useMemo(() => analyzeReviews(reviews), [reviews]);
  const summary = useMemo(() => summarizeReviews(analyzed), [analyzed]);
  const alerts = useMemo(() => qualityAlerts(summary), [summary]);

  const visible = useMemo(
    () =>
      analyzed
        .filter((r) => platform === "all" || r.platform === platform)
        .filter((r) => !onlyNegative || r.sentiment === "negative")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [analyzed, platform, onlyNegative],
  );

  const submit = () => {
    if (!form.customerName.trim() || !form.text.trim()) {
      toast.error("Cần nhập tên khách và nội dung đánh giá.");
      return;
    }
    addReview({
      platform: form.platform,
      customerName: form.customerName.trim(),
      rating: form.rating,
      text: form.text.trim(),
      replied: false,
    });
    setForm({ platform: form.platform, customerName: "", rating: 5, text: "" });
    toast.success("Đã thêm đánh giá và phân tích cảm xúc.");
  };

  return (
    <div className="space-y-5">
      {/* Tổng quan */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Điểm trung bình</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{summary.avgRating.toFixed(1)}</span>
            <Stars n={Math.round(summary.avgRating)} />
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{summary.total} đánh giá</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Tỷ lệ hài lòng</div>
          <div className="mt-1 text-2xl font-semibold">{Math.round(summary.satisfactionRate * 100)}%</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {summary.positive} tích cực · {summary.neutral} trung tính · {summary.negative} tiêu cực
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Xu hướng 30 ngày</div>
          <div className="mt-1 flex items-baseline gap-2 text-2xl font-semibold">
            {summary.trend.current.toFixed(1)}
            <span className={`text-sm ${summary.trend.delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {summary.trend.delta >= 0 ? "+" : ""}{summary.trend.delta.toFixed(1)}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">30 ngày trước: {summary.trend.previous.toFixed(1)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Chưa trả lời</div>
          <div className="mt-1 text-2xl font-semibold text-red-600">{summary.unrepliedNegative}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">đánh giá tiêu cực cần phản hồi</div>
        </div>
      </div>

      {/* Cảnh báo chất lượng */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <AlertTriangle className="size-4" />
          <h3 className="text-sm font-semibold">Cảnh báo chất lượng ({alerts.length})</h3>
        </div>
        {alerts.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">
            Không có vấn đề lặp lại nào đáng báo động. Tiếp tục duy trì.
          </p>
        ) : (
          <ul className="divide-y">
            {alerts.map((a, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    a.severity === "critical" ? "bg-red-100 text-red-700"
                    : a.severity === "warning" ? "bg-amber-100 text-amber-700"
                    : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {a.severity === "critical" ? "Nghiêm trọng" : a.severity === "warning" ? "Cần lưu ý" : "Thông tin"}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium">{a.title}</div>
                  <p className="text-muted-foreground">{a.detail}</p>
                  <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                    <b>Hành động:</b> {a.action}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Chủ đề */}
        <div className="overflow-hidden rounded-xl border bg-white lg:col-span-1">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Khách nói nhiều về gì</h3>
          </div>
          <ul className="divide-y">
            {summary.topics.length === 0 && (
              <li className="px-4 py-5 text-sm text-muted-foreground">Chưa đủ dữ liệu.</li>
            )}
            {summary.topics.map((t) => (
              <li key={t.topic} className="px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground">{t.mentions} lần nhắc</span>
                </div>
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="bg-emerald-500" style={{ width: `${(t.positive / t.mentions) * 100}%` }} />
                  <div className="bg-red-500" style={{ width: `${(t.negative / t.mentions) * 100}%` }} />
                </div>
                {t.sampleComplaint && (
                  <p className="mt-1.5 line-clamp-2 text-xs italic text-muted-foreground">“{t.sampleComplaint}”</p>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Theo nền tảng + thêm đánh giá */}
        <div className="space-y-4 lg:col-span-2">
          <div className="overflow-hidden rounded-xl border bg-white">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Tổng hợp theo nền tảng</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Nền tảng</th>
                  <th className="px-4 py-2">Số lượng</th>
                  <th className="px-4 py-2">Điểm TB</th>
                  <th className="px-4 py-2">Tỷ lệ tiêu cực</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.byPlatform.map((p) => (
                  <tr key={p.platform}>
                    <td className="px-4 py-2 font-medium">{p.label}</td>
                    <td className="px-4 py-2 tabular-nums">{p.count}</td>
                    <td className="px-4 py-2 tabular-nums">{p.avgRating.toFixed(1)}</td>
                    <td className="px-4 py-2">
                      <span className={p.negativeRate >= 0.4 ? "font-medium text-red-600" : ""}>
                        {Math.round(p.negativeRate * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h3 className="text-sm font-semibold">Nhập đánh giá từ nền tảng khác</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Dán đánh giá từ Booking.com / Agoda / Google vào đây để gộp vào báo cáo chung.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value as ReviewPlatform })}
                className="rounded-lg border px-2.5 py-2 text-sm"
              >
                {(Object.keys(PLATFORM_LABELS) as ReviewPlatform[]).map((p) => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
              <input
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="Tên khách"
                className="rounded-lg border px-2.5 py-2 text-sm"
              />
              <select
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                className="rounded-lg border px-2.5 py-2 text-sm"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n} sao</option>
                ))}
              </select>
            </div>
            <textarea
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              rows={3}
              placeholder="Nội dung đánh giá của khách..."
              className="mt-2 w-full rounded-lg border px-2.5 py-2 text-sm"
            />
            <Button size="sm" className="mt-2" onClick={submit}>Thêm & phân tích</Button>
          </div>
        </div>
      </div>

      {/* Danh sách đánh giá */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <MessageSquare className="size-4" />
          <h3 className="text-sm font-semibold">Chi tiết đánh giá ({visible.length})</h3>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as "all" | ReviewPlatform)}
              className="rounded-lg border px-2 py-1 text-sm"
            >
              <option value="all">Tất cả nền tảng</option>
              {(Object.keys(PLATFORM_LABELS) as ReviewPlatform[]).map((p) => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={onlyNegative} onChange={(e) => setOnlyNegative(e.target.checked)} />
              Chỉ tiêu cực
            </label>
          </div>
        </div>

        <ul className="divide-y">
          {visible.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{r.customerName}</span>
                <Stars n={r.rating} />
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">{PLATFORM_LABELS[r.platform]}</span>
                {r.sentiment && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SENTIMENT_STYLE[r.sentiment]}`}>
                    {SENTIMENT_LABELS[r.sentiment]}
                    {r.sentimentConfidence !== undefined && ` ${Math.round(r.sentimentConfidence * 100)}%`}
                  </span>
                )}
                {r.sentimentOverriddenBy && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-blue-600">
                    <Info className="size-3" /> {r.sentimentOverriddenBy} đã sửa
                  </span>
                )}
                {r.replied && <span className="text-[11px] text-emerald-600">Đã trả lời</span>}
                <span className="ml-auto text-xs text-muted-foreground">{formatDate(r.createdAt.slice(0, 10))}</span>
              </div>

              <p className="mt-1.5 text-sm text-slate-700">{r.text}</p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {!r.replied && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDraft({ id: r.id, text: draftReviewReply(r, HOTEL_NAME) })}
                  >
                    Soạn phản hồi
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">Sửa nhãn AI:</span>
                {(Object.keys(SENTIMENT_LABELS) as Sentiment[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      overrideSentiment(r.id, s);
                      toast.success(`Đã đặt nhãn “${SENTIMENT_LABELS[s]}”`);
                    }}
                    className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                      r.sentiment === s ? SENTIMENT_STYLE[s] : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {SENTIMENT_LABELS[s]}
                  </button>
                ))}
              </div>

              {draft?.id === r.id && (
                <div className="mt-2 rounded-lg border bg-slate-50 p-3">
                  <textarea
                    value={draft.text}
                    onChange={(e) => setDraft({ id: r.id, text: e.target.value })}
                    rows={7}
                    className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    AI chỉ soạn nháp. Vui lòng đọc lại và sửa cho đúng tình huống trước khi đăng.
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(draft.text);
                          toast.success("Đã copy — dán vào nền tảng để đăng.");
                        } catch {
                          toast.error("Trình duyệt chặn copy. Vui lòng chọn và copy tay.");
                        }
                        replyToReview(r.id);
                        setDraft(null);
                      }}
                    >
                      <Copy className="size-4" /> Copy & đánh dấu đã trả lời
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Đóng</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {visible.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">Không có đánh giá nào khứp bộ lọc.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
