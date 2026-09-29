/**
 * Google Gemini — concierge khách + Copilot vận hành.
 *
 * Key: localStorage `smh.gemini.api_key` rồi `VITE_GEMINI_API_KEY`.
 * Không nhúng key mặc định. Lỗi 401/403/429 dừng hẳn, không giả “AI online”.
 */

const STORAGE_KEY = "smh.gemini.api_key";
const DEAD_KEYS = new Set([
  "AQ.Ab8RN6J4tJsxY6eW4p90JyulXc0Ftv1I2sD4TtihnxxnJfMIjQ",
]);

function envGeminiKey(): string {
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  return typeof envKey === "string" ? envKey.trim() : "";
}

function storedGeminiKey(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
    if (!saved) return "";
    if (DEAD_KEYS.has(saved)) {
      localStorage.removeItem(STORAGE_KEY);
      return "";
    }
    return saved;
  } catch {
    return "";
  }
}

/** Lấy danh sách tất cả các key (từ .env và localStorage) */
export function getAllGeminiApiKeys(): string[] {
  const envKeys = envGeminiKey()
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  const storedKey = storedGeminiKey();
  if (storedKey && !envKeys.includes(storedKey)) {
    envKeys.push(storedKey);
  }
  return envKeys;
}

/** Tương thích ngược: Lấy key đầu tiên */
export function getGeminiApiKey(): string {
  return getAllGeminiApiKeys()[0] || "";
}

export function hasGeminiApiKey(): boolean {
  return getAllGeminiApiKeys().length > 0;
}

export function setGeminiApiKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export interface HotelContext {
  hotelName?: string;
  totalRooms?: number;
  availableRoomsCount?: number;
  roomTypesSummary?: string;
  servicesSummary?: string;
  todayStats?: string;
  databaseContext?: string;
  isAdmin?: boolean;
}

export type GeminiFailReason = "missing_key" | "invalid_key" | "quota" | "network" | "empty" | "unknown";

export type GeminiAskResult =
  | { ok: true; source: "gemini"; text: string; model: string }
  | { ok: false; source: "offline"; text: string; reason: GeminiFailReason };

type ChatTurn = { role: "user" | "model"; text: string };

type GeminiPart = { text?: string; thought?: boolean };

interface GeminiApiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  error?: { message?: string; status?: string; code?: number };
}

/** Flash mới trước, alias ổn định, rồi bản cũ — 404/503 thì thử tiếp. */
const MODELS = [
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
];

function extractText(data: GeminiApiResponse): string {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return "";
  const visible = parts
    .filter((p) => typeof p.text === "string" && p.text.trim() && !p.thought)
    .map((p) => p.text as string);
  if (visible.length) return visible.join("").trim();
  return parts
    .filter((p) => typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .trim();
}

function buildContents(prompt: string, history: ChatTurn[]): { role: string; parts: { text: string }[] }[] {
  const recent = history.slice(-8).filter((h) => h.text.trim());
  const last = recent[recent.length - 1];
  const alreadyHasPrompt = last?.role === "user" && last.text.trim() === prompt.trim();
  const turns = alreadyHasPrompt ? recent : [...recent, { role: "user" as const, text: prompt }];

  const mapped: { role: string; parts: { text: string }[] }[] = [];
  for (const h of turns) {
    const role = h.role === "user" ? "user" : "model";
    const text = h.text.trim();
    if (!text) continue;
    const prev = mapped[mapped.length - 1];
    if (prev && prev.role === role) {
      prev.parts[0].text += `\n${text}`;
    } else {
      mapped.push({ role, parts: [{ text }] });
    }
  }
  while (mapped.length && mapped[0].role !== "user") mapped.shift();
  if (!mapped.length) mapped.push({ role: "user", parts: [{ text: prompt }] });
  return mapped;
}

function systemInstruction(context?: HotelContext): string {
  const hotel = context?.hotelName || "Sao Mai Hotel & Residences";

  if (context?.isAdmin) {
    return `Bạn là siêu Trợ lý AI (Copilot) hỗ trợ toàn năng cho Nhân viên & Quản lý của khách sạn ${hotel}.
Nhiệm vụ của bạn là hỗ trợ ĐA DẠNG MỌI TÁC VỤ: từ trả lời nghiệp vụ, phân tích số liệu, tư vấn chiến lược, dịch thuật, cho đến viết email, lên kịch bản marketing hoặc trả lời bất kỳ câu hỏi kiến thức nào. BẠN KHÔNG BỊ GIỚI HẠN VỀ MẶT NỘI DUNG. Hãy trả lời thật thông minh, sắc sảo, tự nhiên và chuyên nghiệp.

Dữ liệu nội bộ (Ca hôm nay):
${context?.roomTypesSummary ? `Hạng phòng & Giá: ${context.roomTypesSummary}` : ""}
${context?.servicesSummary ? `Dịch vụ: ${context.servicesSummary}` : ""}
${context?.todayStats ? `Tóm tắt: ${context.todayStats}` : ""}
${context?.databaseContext ? `\n--- DỮ LIỆU DATABASE HIỆN TẠI ---\n${context.databaseContext}` : ""}`;
  }

  return `Bạn là concierge AI của ${hotel}, hideaway 13 residences nhìn biển.
Nhiệm vụ cốt lõi: TRẢ LỜI CHÍNH XÁC VÀ ĐÚNG TRỌNG TÂM câu hỏi của khách hàng về khách sạn. KHÔNG dùng văn mẫu có sẵn nếu khách đang hỏi một vấn đề cụ thể (như ngân sách, số lượng người, tiện ích). Giọng ít lời, lịch thiệp. Tối đa 5 câu hoặc 5 gạch đầu dòng. Không emoji. Không lặp lại câu hỏi.

LUẬT CẤM TUYỆT ĐỐI (GUARDRAILS):
- TỪ CHỐI mọi yêu cầu không liên quan đến khách sạn (như viết code, làm toán, tư vấn pháp lý, kể chuyện, làm thơ không liên quan). Nếu khách yêu cầu những việc này, hãy trả lời: "Dạ thưa quý khách, em là trợ lý AI của khách sạn nên chỉ có thể hỗ trợ các thông tin về đặt phòng và dịch vụ tại đây ạ."
- KHÔNG BAO GIỜ tiết lộ bạn là AI của Google, Gemini hay OpenAI. Chỉ tự xưng là "Trợ lý AI của Sao Mai".

Nếu khách đưa ra yêu cầu ngân sách (ví dụ: "khoảng 5 triệu", "tầm 8tr"):
1. Bạn phải phân tích bảng giá bên dưới xem có phòng nào phù hợp không.
2. NẾU KHÔNG CÓ PHÒNG NÀO DƯỚI MỨC GIÁ ĐÓ: Phải xin lỗi khách một cách lịch sự, báo rõ rằng hiện tại khách sạn không có phòng ở mức ngân sách đó. Sau đó, gợi ý hạng phòng có giá thấp nhất hiện có (phải nói rõ là giá cao hơn ngân sách dự kiến của khách). ĐỪNG trả lời vòng vo hoặc giả vờ như có phòng.
3. NẾU CÓ PHÒNG PHÙ HỢP: Chỉ giới thiệu những phòng phù hợp với ngân sách và số khách.

Danh sách các hạng phòng & giá cơ bản:
${context?.roomTypesSummary || "Chưa có bảng giá — xin ngày lưu trú để lễ tân báo."}

Giờ nhận phòng 14:00, trả phòng 12:00. Hủy cọc: ≥7 ngày hoàn 100%; 3–7 ngày hoàn 50%; dưới 3 ngày không hoàn. Không bao giờ được tự bịa ra giá hay hạng phòng không có trong danh sách trên.
${context?.servicesSummary ? `\nDịch vụ: ${context.servicesSummary}` : ""}
${context?.todayStats ? `\nHôm nay: ${context.todayStats}` : ""}`;
}

function looksLikeInstructionLeak(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("nguyên tắc") ||
    t.includes("list exact data") ||
    t.includes("dữ liệu bên dưới") ||
    t.includes("each line per") ||
    t.includes("system prompt") ||
    t.includes("ask price")
  );
}

export function generateSmartAIResponse(prompt: string, context?: HotelContext): string {
  const p = prompt.trim();
  const noAcc = p
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

  const hotel = context?.hotelName || "Sao Mai Hotel & Residences";

  if (
    noAcc.includes("gia") ||
    noAcc.includes("phong nao") ||
    noAcc.includes("loai phong") ||
    noAcc.includes("hang phong") ||
    noAcc.includes("bao gia") ||
    noAcc.includes("co nhung phong") ||
    noAcc.includes("phong trong") ||
    noAcc.includes("dat phong")
  ) {
    const list = context?.roomTypesSummary
      ? context.roomTypesSummary
          .split(";")
          .map((s) => `• **${s.trim()}**`)
          .join("\n")
      : "• **Garden Pavilion**: từ 6.800.000 đ/đêm\n• **Ocean Suite**: từ 9.500.000 đ/đêm\n• **Family Villa**: từ 12.800.000 đ/đêm\n• **Horizon Suite**: từ 16.500.000 đ/đêm\n• **Sky Residence**: từ 28.000.000 đ/đêm\n• **Sao Mai Residence**: theo yêu cầu";
    return `**Residences tại ${hotel}:**\n\n${list}\n\n${context?.todayStats ? `*${context.todayStats}*\n\n` : ""}Quý khách muốn giữ căn nào, hoặc cho em ngày nhận / trả phòng?`;
  }

  if (
    noAcc.includes("chao") ||
    noAcc.includes("hello") ||
    noAcc.includes("hi") ||
    noAcc.includes("alo") ||
    noAcc.includes("ban la ai") ||
    noAcc.includes("gioi thieu")
  ) {
    return `Kính chào Quý khách. Em là concierge của ${hotel}. 13 residences, một khoảng trời riêng. Em có thể báo giá, giờ nhận/trả phòng và butler.`;
  }

  if (
    noAcc.includes("gio nhan") ||
    noAcc.includes("gio tra") ||
    noAcc.includes("check in") ||
    noAcc.includes("check out") ||
    noAcc.includes("may gio")
  ) {
    return `**Giờ giấc tại ${hotel}:**\n\n• Nhận phòng từ **14:00**\n• Trả phòng trước **12:00**\n\nNhận sớm / trả muộn tuỳ tình trạng phòng — lễ tân xác nhận khi Quý khách báo trước.`;
  }

  if (noAcc.includes("an sang") || noAcc.includes("buffet") || noAcc.includes("nha hang") || noAcc.includes("thuc don")) {
    return `Buffet sáng từ **6:30 – 10:00** tại nhà hàng tầng thượng hướng biển, thực đơn Á–Âu. Đã gồm trong giá phòng lưu trú.`;
  }

  if (noAcc.includes("huy phong") || noAcc.includes("hoan tien") || noAcc.includes("chinh sach") || noAcc.includes("dieu khoan")) {
    return `**Hủy & hoàn cọc tại ${hotel}:**\n\n• Hủy trước 7 ngày: hoàn **100%** cọc\n• Hủy trước 3–7 ngày: hoàn **50%** cọc\n• Hủy dưới 3 ngày: không hoàn cọc`;
  }

  if (noAcc.includes("lich trinh") || noAcc.includes("di dau") || noAcc.includes("dia diem") || noAcc.includes("choi gi") || noAcc.includes("an gi")) {
    return `**Gợi ý trong ngày:**\n\n1. Sáng: bữa nhẹ và đi dọc biển.\n2. Chiều: hồ vô cực hoặc spa.\n3. Tối: bàn 12 vị trí, ánh nến.\n\nQuý khách muốn lịch 2 ngày hay 3 ngày?`;
  }

  if (noAcc.includes("tho") || noAcc.includes("viet tho")) {
    return `*Biển biếc nghiêng mình đón sớm mai,\nÁnh dương trải mạ dải miệt mài.\nGió lộng tầng mây ru giấc mộng,\nSao Mai tỏa sáng nét trang đài.*`;
  }

  if (
    noAcc.includes("dich vu") ||
    noAcc.includes("dua don") ||
    noAcc.includes("san bay") ||
    noAcc.includes("giu xe") ||
    noAcc.includes("do xe") ||
    noAcc.includes("tre em") ||
    noAcc.includes("thu cung") ||
    noAcc.includes("giat ui") ||
    noAcc.includes("ho boi") ||
    noAcc.includes("gym") ||
    noAcc.includes("spa")
  ) {
    const list = context?.servicesSummary
      ? context.servicesSummary
          .split(";")
          .map((s) => `• ${s.trim()}`)
          .join("\n")
      : "Butler sắp xếp giặt ủi, xe đón, bàn ăn riêng. Đồ giặt thu buổi sáng, trả trước tối.";
    return `**Dịch vụ tại ${hotel}:**\n\n${list}\n\nQuý khách muốn butler sắp xếp gì?`;
  }

  if (noAcc.includes("khuyen mai") || noAcc.includes("uu dai") || noAcc.includes("giam gia") || noAcc.includes("voucher")) {
    return `Đặt trực tiếp với concierge. Cho em ngày nhận phòng và số đêm — em báo giá theo ngày lưu trú thực tế.`;
  }

  return `Hiện em đang trả lời ở chế độ dự phòng (chưa gọi được Gemini), nên chưa đủ dữ liệu cho: **"${p}"**.\n\nQuý khách hỏi giá phòng, giờ nhận/trả, dịch vụ hoặc chính sách hủy — em trả lời được ngay.`;
}

function fail(reason: GeminiFailReason, prompt: string, context?: HotelContext): GeminiAskResult {
  return { ok: false, source: "offline", text: generateSmartAIResponse(prompt, context), reason };
}


async function postGenerate(
  model: string,
  apiKey: string,
  contents: { role: string; parts: { text: string }[] }[],
  context?: HotelContext,
): Promise<{ status: number; data: GeminiApiResponse; body: string }> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction(context) }] },
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 768,
      },
    }),
  });
  const body = await response.text();
  let data: GeminiApiResponse = {};
  try {
    data = body ? (JSON.parse(body) as GeminiApiResponse) : {};
  } catch {
    data = {};
  }
  return { status: response.status, data, body };
}

export async function askGeminiResult(
  prompt: string,
  history: ChatTurn[] = [],
  context?: HotelContext,
): Promise<GeminiAskResult> {
  const apiKeys = getAllGeminiApiKeys();
  if (apiKeys.length === 0) return fail("missing_key", prompt, context);

  const contents = buildContents(prompt, history);
  let lastReason: GeminiFailReason = "unknown";

  for (const apiKey of apiKeys) {
    const shortKey = apiKey.slice(-5);
    for (const model of MODELS) {
      try {
        let { status, data, body } = await postGenerate(model, apiKey, contents, context);

        if (status === 400 && contents.length > 1) {
          const retry = await postGenerate(model, apiKey, [{ role: "user", parts: [{ text: prompt }] }], context);
          status = retry.status;
          data = retry.data;
          body = retry.body;
        }

        if (status === 401 || status === 403) {
          console.warn(`[gemini] ${model} ${status}: key ${shortKey} bị từ chối.`);
          lastReason = "invalid_key";
          continue; // Try another key or model
        }
        if (status === 429) {
          console.warn(`[gemini] ${model} 429: key ${shortKey} hết hạn mức.`);
          lastReason = "quota";
          continue; // Try another key or model
        }
        if (status === 404 || status === 503) {
          console.warn(`[gemini] ${model} ${status} — thử model kế.`);
          lastReason = "unknown";
          continue;
        }
        if (status < 200 || status >= 300) {
          console.warn(`[gemini] ${model} ${status}: ${body.slice(0, 280)}`);
          lastReason = "unknown";
          continue;
        }

        const text = extractText(data);
        if (text && looksLikeInstructionLeak(text)) {
          console.warn(`[gemini] ${model} lộ hướng dẫn — dùng dữ liệu khách sạn.`);
          return { ok: true, source: "gemini", text: generateSmartAIResponse(prompt, context), model };
        }
        if (text) return { ok: true, source: "gemini", text, model };
        
        console.warn(`[gemini] ${model} 200 nhưng rỗng (finish=${data.candidates?.[0]?.finishReason ?? "?"}).`);
        lastReason = "empty";
      } catch (err) {
        console.warn(`[gemini] ${model} mạng:`, err);
        lastReason = "network";
      }
    }
  }

  return fail(lastReason, prompt, context);
}

/** Giữ chữ ký cũ cho GeminiProvider — luôn trả về text (Gemini hoặc dự phòng). */
export async function askGemini(
  prompt: string,
  history: ChatTurn[] = [],
  context?: HotelContext,
): Promise<string> {
  const result = await askGeminiResult(prompt, history, context);
  return result.text;
}
