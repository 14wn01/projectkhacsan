/**
 * AI PHÂN TÍCH CẢM XÚC ĐÁNH GIÁ (SENTIMENT ANALYSIS)
 *
 * Bài toán thật: đánh giá nằm rải rác trên Booking.com, Agoda, Traveloka, Google.
 * Quản lý không đủ thời gian đọc hết → vấn đề lặp lại (điều hòa ồn, wifi yếu)
 * bị phát hiện quá muộn, khi điểm sao đã tụt.
 *
 * PHƯƠNG PHÁP: từ điển có trọng số (lexicon) cho tiếng Việt + tiếng Anh, xử lý
 * phủ định ("không sạch") và từ tăng cường ("rất bẩn"), cộng thêm số sao làm
 * tín hiệu mạnh. Chạy HOÀN TOÀN OFFLINE nên không tốn tiền API và không gửi
 * dữ liệu khách ra ngoài.
 *
 * ĐƯỜNG THOÁT: mọi kết quả có `confidence`. Nhân viên có thể sửa nhãn
 * (`sentimentOverriddenBy`) và bản sửa tay luôn thắng AI.
 */
import { logger } from "./logger";
import type { Review, ReviewPlatform, Sentiment } from "./types";

export const PLATFORM_LABELS: Record<ReviewPlatform, string> = {
  website: "Website",
  booking_com: "Booking.com",
  agoda: "Agoda",
  traveloka: "Traveloka",
  google: "Google Maps",
};

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: "Tích cực",
  neutral: "Trung tính",
  negative: "Tiêu cực",
};

/* ------------------------------------------------------------ TỪ ĐIỂN --*/

const POSITIVE: Record<string, number> = {
  "tuyệt vời": 3, "tuyệt": 2, "xuất sắc": 3, "hoàn hảo": 3, "thoải mái": 2,
  "sạch sẽ": 2, "sạch": 2, "thơm": 1, "mới": 1, "rộng": 1, "yên tĩnh": 2,
  "nhiệt tình": 2, "thân thiện": 2, "chu đáo": 2, "lịch sự": 2, "nhanh": 1,
  "đáng tiền": 2, "hợp lý": 1, "rẻ": 1, "ngon": 2, "phong phú": 1, "đẹp": 2,
  "hài lòng": 2, "sẽ quay lại": 3, "giới thiệu": 2, "vị trí tốt": 2, "tiện": 1,
  "chuyên nghiệp": 2, "ấn tượng": 2, "vượt mong đợi": 3, "tốt": 1, "ok": 1,
  great: 2, excellent: 3, perfect: 3, clean: 2, friendly: 2, comfortable: 2,
  amazing: 3, lovely: 2, helpful: 2, spacious: 1, quiet: 2, recommend: 2, good: 1,
};

const NEGATIVE: Record<string, number> = {
  "tệ": 3, "tồi": 3, "thất vọng": 3, "kinh khủng": 3, "bẩn": 3, "hôi": 3,
  "mùi": 2, "ẩm": 2, "mốc": 3, "cũ": 2, "hỏng": 2, "không hoạt động": 3,
  "ồn": 2, "ồn ào": 3, "nhỏ": 1, "chật": 2, "nóng": 2, "yếu": 2, "chậm": 2,
  "thái độ": 2, "khó chịu": 2, "thô lỗ": 3, "cục": 2, "lâu": 1, "chờ": 1,
  "đắt": 2, "không đáng": 3, "chém": 3, "phụ thu": 2, "luộm thuộm": 2,
  "khó ngủ": 2, "gián": 3, "muỗi": 2, "đục": 2, "không đúng": 2, "lừa": 3,
  bad: 2, terrible: 3, awful: 3, dirty: 3, rude: 3, noisy: 2, broken: 2,
  smell: 2, expensive: 2, disappointed: 3, worst: 3, slow: 2, old: 1, small: 1,
};

/** Từ phủ định — đảo dấu của từ cảm xúc đi sau. */
const NEGATORS = ["không", "chẳng", "chưa", "đâu có", "khó", "thiếu", "not", "no", "never", "lack"];
/** Từ tăng cường — nhân đôi điểm. */
const INTENSIFIERS = ["rất", "cực", "quá", "siêu", "vô cùng", "hết sức", "very", "extremely", "so"];

/* ------------------------------------------------------------ CHỦ ĐỀ --*/

export const TOPIC_DEFS: Array<{ topic: string; label: string; re: RegExp }> = [
  { topic: "cleanliness", label: "Vệ sinh", re: /sạch|bẩn|hôi|mùi|mốc|ẩm|gián|muỗi|dirty|clean|smell/i },
  { topic: "staff", label: "Nhân viên", re: /nhân viên|lễ tân|thái độ|phục vụ|staff|reception|service|nhiệt tình|thân thiện|thô lỗ|rude/i },
  { topic: "room", label: "Phòng", re: /phòng|giường|đệm|room|bed|chật|rộng|nhỏ|cũ|mới/i },
  { topic: "noise", label: "Tiếng ồn", re: /ồn|yên tĩnh|ồn ào|noise|noisy|quiet|khó ngủ/i },
  { topic: "ac", label: "Điều hòa", re: /điều hòa|máy lạnh|nóng|air ?con|ac\b|aircon/i },
  { topic: "wifi", label: "Wifi / Mạng", re: /wifi|mạng|internet|3g|4g/i },
  { topic: "food", label: "Ăn uống", re: /ăn|bữa sáng|buffet|nhà hàng|ngon|food|breakfast|restaurant|dở/i },
  { topic: "price", label: "Giá cả", re: /giá|đắt|rẻ|đáng tiền|phụ thu|price|expensive|value|chém/i },
  { topic: "location", label: "Vị trí", re: /vị trí|trung tâm|gần|xa|biển|location|central|far/i },
  { topic: "checkin", label: "Nhận / trả phòng", re: /check ?in|check ?out|nhận phòng|trả phòng|thủ tục|chờ|đợi/i },
  { topic: "facilities", label: "Tiện ích", re: /hồ bơi|bể bơi|gym|spa|thang máy|bãi đậu|pool|elevator|parking/i },
];

export function topicLabel(topic: string): string {
  return TOPIC_DEFS.find((t) => t.topic === topic)?.label ?? topic;
}

/* ---------------------------------------------------------- PHÂN TÍCH --*/

export interface SentimentResult {
  sentiment: Sentiment;
  /** Điểm thô — âm là tiêu cực */
  score: number;
  confidence: number;
  topics: string[];
  /** Cụm từ đã khiến mô hình quyết định — minh bạch cho người kiểm tra */
  matchedTerms: Array<{ term: string; weight: number }>;
}

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:()\[\]"'—–]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Tìm cụm 2 từ trước, rồi từ đơn — để "sạch sẽ" thắng "sạch". */
function lookup(dict: Record<string, number>, words: string[], i: number): { term: string; weight: number } | null {
  const bigram = `${words[i]} ${words[i + 1] ?? ""}`.trim();
  if (dict[bigram] !== undefined) return { term: bigram, weight: dict[bigram] };
  if (dict[words[i]] !== undefined) return { term: words[i], weight: dict[words[i]] };
  return null;
}

/**
 * Phân tích 1 đánh giá. `rating` (1..5) là tín hiệu mạnh nhất nên được
 * trọng số cao; văn bản giúp xác định CHỦ ĐỀ (quan trọng hơn nhãn).
 */
export function analyzeSentiment(text: string, rating?: number): SentimentResult {
  const words = normalize(text);
  const matchedTerms: Array<{ term: string; weight: number }> = [];
  let score = 0;

  for (let i = 0; i < words.length; i++) {
    const pos = lookup(POSITIVE, words, i);
    const neg = lookup(NEGATIVE, words, i);
    const hit = pos ?? neg;
    if (!hit) continue;

    let weight = pos ? hit.weight : -hit.weight;

    // Kiểm tra 2 từ trước đó có phủ định / tăng cường
    const before = [words[i - 1], words[i - 2]].filter(Boolean);
    if (before.some((w) => NEGATORS.includes(w))) {
      weight = -weight * 0.9; // "không sạch" → tiêu cực
      matchedTerms.push({ term: `không + ${hit.term}`, weight });
    } else {
      if (before.some((w) => INTENSIFIERS.includes(w))) weight *= 1.6;
      matchedTerms.push({ term: hit.term, weight });
    }
    score += weight;
  }

  // Kết hợp điểm sao (tín hiệu đáng tin nhất)
  let combined = score;
  if (typeof rating === "number") {
    const ratingScore = (rating - 3) * 2.5; // 1★ → -5, 5★ → +5
    combined = score * 0.45 + ratingScore * 0.55;
  }

  const sentiment: Sentiment = combined > 1.2 ? "positive" : combined < -1.2 ? "negative" : "neutral";

  // Tìm chủ đề
  const topics = TOPIC_DEFS.filter((t) => t.re.test(text)).map((t) => t.topic);

  // Độ tin cậy: nhiều từ khớp + có số sao + văn bản đủ dài = tin hơn
  let confidence = 0.35;
  confidence += Math.min(0.3, matchedTerms.length * 0.07);
  if (typeof rating === "number") confidence += 0.25;
  if (words.length >= 12) confidence += 0.1;
  if (Math.abs(combined) < 0.8) confidence -= 0.15; // gần ranh giới → bớt tự tin
  confidence = Math.max(0.2, Math.min(0.95, confidence));

  return {
    sentiment,
    score: Math.round(combined * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    topics,
    matchedTerms: matchedTerms.slice(0, 8),
  };
}

/** Gán nhãn cho cả danh sách. KHÔNG ghi đè nhãn đã được người sửa tay. */
export function analyzeReviews(reviews: Review[]): Review[] {
  const out = reviews.map((r) => {
    if (r.sentimentOverriddenBy) return r; // tôn trọng quyết định của người
    const res = analyzeSentiment(r.text, r.rating);
    return { ...r, sentiment: res.sentiment, topics: res.topics, sentimentConfidence: res.confidence };
  });
  logger.info("sentiment", `Đã phân tích ${out.length} đánh giá`);
  return out;
}

/* --------------------------------------------------------- TỔNG HỢP --*/

export interface TopicInsight {
  topic: string;
  label: string;
  mentions: number;
  positive: number;
  negative: number;
  /** -1..1 */
  netScore: number;
  /** Đánh giá tiêu cực tiêu biểu để quản lý đọc trực tiếp */
  sampleComplaint?: string;
}

export interface SentimentSummary {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  avgRating: number;
  /** Tỷ lệ hài lòng */
  satisfactionRate: number;
  byPlatform: Array<{ platform: ReviewPlatform; label: string; count: number; avgRating: number; negativeRate: number }>;
  topics: TopicInsight[];
  /** Xu hướng 30 ngày so với 30 ngày trước đó */
  trend: { current: number; previous: number; delta: number };
  unrepliedNegative: number;
}

export function summarizeReviews(reviews: Review[], now: Date = new Date()): SentimentSummary {
  const analyzed = reviews.map((r) =>
    r.sentiment ? r : { ...r, ...analyzeSentiment(r.text, r.rating) },
  ) as Review[];

  const total = analyzed.length || 1;
  const positive = analyzed.filter((r) => r.sentiment === "positive").length;
  const negative = analyzed.filter((r) => r.sentiment === "negative").length;
  const neutral = analyzed.length - positive - negative;
  const avgRating = analyzed.reduce((s, r) => s + r.rating, 0) / total;

  // Theo nền tảng
  const platforms = [...new Set(analyzed.map((r) => r.platform))];
  const byPlatform = platforms.map((p) => {
    const list = analyzed.filter((r) => r.platform === p);
    return {
      platform: p,
      label: PLATFORM_LABELS[p],
      count: list.length,
      avgRating: Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 10) / 10,
      negativeRate: Math.round((list.filter((r) => r.sentiment === "negative").length / list.length) * 100) / 100,
    };
  });

  // Theo chủ đề
  const topics: TopicInsight[] = TOPIC_DEFS.map((def) => {
    const list = analyzed.filter((r) => r.topics?.includes(def.topic));
    const pos = list.filter((r) => r.sentiment === "positive").length;
    const neg = list.filter((r) => r.sentiment === "negative").length;
    return {
      topic: def.topic,
      label: def.label,
      mentions: list.length,
      positive: pos,
      negative: neg,
      netScore: list.length ? Math.round(((pos - neg) / list.length) * 100) / 100 : 0,
      sampleComplaint: list.find((r) => r.sentiment === "negative")?.text,
    };
  })
    .filter((t) => t.mentions > 0)
    .sort((a, b) => a.netScore - b.netScore);

  // Xu hướng
  const d30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const d60 = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const cur = analyzed.filter((r) => r.createdAt >= d30);
  const prev = analyzed.filter((r) => r.createdAt >= d60 && r.createdAt < d30);
  const curAvg = cur.length ? cur.reduce((s, r) => s + r.rating, 0) / cur.length : 0;
  const prevAvg = prev.length ? prev.reduce((s, r) => s + r.rating, 0) / prev.length : 0;

  return {
    total: analyzed.length,
    positive,
    neutral,
    negative,
    avgRating: Math.round(avgRating * 10) / 10,
    satisfactionRate: Math.round((positive / total) * 100) / 100,
    byPlatform,
    topics,
    trend: {
      current: Math.round(curAvg * 10) / 10,
      previous: Math.round(prevAvg * 10) / 10,
      delta: Math.round((curAvg - prevAvg) * 10) / 10,
    },
    unrepliedNegative: analyzed.filter((r) => r.sentiment === "negative" && !r.replied).length,
  };
}

/* ------------------------------------------------------- CẢNH BÁO --*/

export interface QualityAlert {
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  /** Hành động cụ thể, không chung chung */
  action: string;
}

/**
 * Sinh cảnh báo chất lượng — phần giá trị nhất của module này.
 * Mục tiêu: phát hiện vấn đề TRƯỚC khi điểm sao tụt.
 */
export function qualityAlerts(summary: SentimentSummary, minMentions = 2): QualityAlert[] {
  const alerts: QualityAlert[] = [];

  // 1. Điểm tụt
  if (summary.trend.previous > 0 && summary.trend.delta <= -0.4) {
    alerts.push({
      severity: "critical",
      title: `Điểm đánh giá đang tụt (${summary.trend.previous} → ${summary.trend.current})`,
      detail: `Trung bình 30 ngày qua giảm ${Math.abs(summary.trend.delta)} sao so với tháng trước.`,
      action: "Họp với trưởng bộ phận trong tuần này để xác định nguyên nhân theo từng chủ đề bên dưới.",
    });
  }

  // 2. Chủ đề bị phàn nàn lặp lại
  for (const t of summary.topics) {
    if (t.mentions >= minMentions && t.netScore <= -0.4) {
      alerts.push({
        severity: t.negative >= 3 ? "critical" : "warning",
        title: `"${t.label}" bị phàn nàn ${t.negative}/${t.mentions} lần`,
        detail: t.sampleComplaint ? `Ví dụ: “${t.sampleComplaint.slice(0, 140)}…”` : "Nhiều đánh giá tiêu cực cùng chủ đề.",
        action: topicAction(t.topic),
      });
    }
  }

  // 3. Nền tảng có vấn đề riêng
  for (const p of summary.byPlatform) {
    if (p.count >= 3 && p.negativeRate >= 0.4) {
      alerts.push({
        severity: "warning",
        title: `${p.label}: ${Math.round(p.negativeRate * 100)}% đánh giá tiêu cực`
          ,
        detail: `Điểm trung bình trên ${p.label} chỉ ${p.avgRating}/5 — thấp hơn các kênh khác.`,
        action: `Kiểm tra nội dung đăng trên ${p.label}: ảnh có đúng thực tế không, mô tả có hứa quá không?`,
      });
    }
  }

  // 4. Chưa trả lời đánh giá xấu
  if (summary.unrepliedNegative > 0) {
    alerts.push({
      severity: summary.unrepliedNegative >= 3 ? "warning" : "info",
      title: `${summary.unrepliedNegative} đánh giá tiêu cực chưa được phản hồi`,
      detail: "Khách đọc phản hồi của khách sạn trước khi quyết định đặt phòng.",
      action: "Trả lời trong 24–48 giờ: xin lỗi cụ thể, nêu việc đã sửa, mời khách quay lại.",
    });
  }

  return alerts.sort((a, b) => {
    const w = { critical: 0, warning: 1, info: 2 };
    return w[a.severity] - w[b.severity];
  });
}

function topicAction(topic: string): string {
  const map: Record<string, string> = {
    cleanliness: "Tăng tần suất kiểm tra buồng phòng, chụp ảnh nghiệm thu trước khi bán phòng.",
    staff: "Đào tạo lại kịch bản đón khách; xem lại lịch ca giờ cao điểm có thiếu người không.",
    room: "Lập danh sách phòng cần cải tạo, tạm ngừng bán phòng tệ nhất để sửa.",
    noise: "Xét cách âm phòng mặt đường; ưu tiên xếp khách nhạy cảm tiếng ồn vào phòng trong.",
    ac: "Kiểm tra bảo dưỡng điều hòa toàn bộ; lập lịch vệ sinh lưới định kỳ.",
    wifi: "Đo tốc độ từng tầng, bổ sung bộ phát ở điểm yếu, nâng băng thông nếu cần.",
    food: "Làm việc với bếp về thực đơn và độ tươi; khảo sát nhanh khách ăn sáng.",
    price: "So sánh giá và tiện ích với đối thủ cùng khu; làm rõ phụ thu trước khi khách đặt.",
    location: "Bổ sung hướng dẩn đường và ảnh thực tế, tránh khách kỳ vọng sai về vị trí.",
    checkin: "Rút ngắn thủ tục bằng quét CCCD; tăng người trực giờ 14–16h.",
    facilities: "Kiểm tra tình trạng tiện ích được nhắc tên; cập nhật đúng trạng thái trên OTA.",
  };
  return map[topic] ?? "Phân công người phụ trách xác minh và báo cáo lại trong 7 ngày.";
}

/** Gợi ý câu trả lời đánh giá — nhân viên sửa lại rồi đăng. */
export function draftReviewReply(review: Review, hotelName: string): string {
  const name = review.customerName || "Quý khách";
  if (review.sentiment === "negative") {
    const topics = (review.topics ?? []).map(topicLabel).join(", ");
    return `Kính gửi ${name},

Thay mặt ${hotelName}, chúng tôi thành thật xin lỗi vì trải nghiệm chưa tốt${topics ? ` liên quan đến ${topics}` : ""}. Đây không phải tiêu chuẩn chúng tôi muốn mang lại.

Chúng tôi đã chuyển phản hồi này tới bộ phận liên quan để kiểm tra và khắc phục ngay. Rất mong được đón ${name} lần sau để chứng minh sự thay đổi.

Trân trọng,
Quản lý ${hotelName}`;
  }
  if (review.sentiment === "positive") {
    return `Kính gửi ${name},

Cảm ơn ${name} đã dành thời gian chia sẻ. Toàn bộ đội ngũ ${hotelName} rất vui khi biết Quý khách đã có kỳ nghỉ trọn vẹn.

Chúng tôi luôn sẵn sàng chào đón Quý khách trở lại.

Trân trọng,
${hotelName}`;
  }
  return `Kính gửi ${name},

Cảm ơn Quý khách đã góp ý. Chúng tôi ghi nhận và sẽ tiếp tục cải thiện để lần sau phục vụ Quý khách tốt hơn.

Trân trọng,
${hotelName}`;
}
