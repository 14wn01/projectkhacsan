/**
 * QUÉT CCCD / PASSPORT (OCR) ĐỂ CHECK-IN NHANH
 *
 * Bài toán thật: lễ tân nhập tay 8 trường thông tin mỗi khách, giờ cao điểm
 * xếp hàng dài và hay sai số CCCD. OCR giảm thời gian check-in xuống ~15 giây.
 *
 * NGUYÊN TẮC AN TOÀN (bắt buộc):
 *  - OCR LUÔN có thể sai → trả về `confidence` và `needsReview`.
 *  - Dưới ngưỡng tin cậy → UI BẮT BUỘC lễ tân xác nhận/sửa tay từng trường.
 *  - Không bao giờ tự động lưu mà không cho người xem lại.
 *  - Ảnh giấy tờ là dữ liệu cá nhân nhạy cảm: KHÔNG lưu ảnh gốc sau khi trích
 *    xuất xong (Nghị định 13/2023 về bảo vệ dữ liệu cá nhân — nguyên tắc tối thiểu hóa).
 *
 * Production: gỬI ẢNH LÊN BACKEND rồi gọi FPT.AI Vision / VNPT eKYC / Google
 * Document AI. Không để API key trong frontend.
 */
import { logger } from "./logger";
import { withTimeout } from "./concurrency";
import type { IdDocumentData } from "./types";

/** Dưới mức này bắt buộc người kiểm tra lại. */
export const OCR_CONFIDENCE_THRESHOLD = 0.75;

export interface OcrResult {
  data: IdDocumentData;
  /** Tất cả trường có độ tin cậy riêng — UI tô vàng trường đáng nghi */
  fieldConfidence: Partial<Record<keyof IdDocumentData, number>>;
  needsReview: boolean;
  warnings: string[];
}

/* -------------------------------------------------------- KIỂM TRA DỮ LIỆU --*/

/** CCCD Việt Nam: 12 chữ số. CMND cũ: 9 chữ số. */
export function validateCccd(v: string): { ok: boolean; message?: string } {
  const digits = v.replace(/\D/g, "");
  if (digits.length === 12) return { ok: true };
  if (digits.length === 9) return { ok: true, message: "Số CMND cũ (9 số) — nên đề nghị khách dùng CCCD mới." };
  return { ok: false, message: "Số CCCD phải có 12 chữ số." };
}

/** Hộ chiếu phổ thông: 1 chữ + 7 số (ví dụ C1234567). */
export function validatePassport(v: string): { ok: boolean; message?: string } {
  return /^[A-Z][0-9]{7}$/i.test(v.trim())
    ? { ok: true }
    : { ok: false, message: "Số hộ chiếu thường có dạng 1 chữ cái + 7 chữ số." };
}

export function validateIdDocument(d: IdDocumentData): string[] {
  const errors: string[] = [];
  if (!d.fullName || d.fullName.trim().length < 3) errors.push("Họ tên không hợp lệ.");
  const idCheck = d.docType === "cccd" ? validateCccd(d.idNumber) : validatePassport(d.idNumber);
  if (!idCheck.ok) errors.push(idCheck.message ?? "Số giấy tờ không hợp lệ.");
  if (d.dob) {
    const age = (Date.now() - new Date(d.dob).getTime()) / (365.25 * 86_400_000);
    if (Number.isNaN(age)) errors.push("Ngày sinh không đọc được.");
    else if (age < 0 || age > 120) errors.push("Ngày sinh không hợp lý.");
    else if (age < 18) errors.push("Khách dưới 18 tuổi — cần người bảo hộ đứng tên.");
  }
  return errors;
}

/* ------------------------------------------------------------- QUÉT ẢNH --*/

/** Đặt false trong unit test. */
export const ocrSimulation = { enabled: true, latencyMs: 1200 };

const SAMPLE_NAMES = [
  "NGUYỄN VĂN HÙNG",
  "TRẦN THỊ MAI",
  "LÊ HOÀNG NAM",
  "PHẠM MINH CHÂU",
  "VÕ QUỐC BẢO",
];

function randomDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
}

/**
 * Mô phỏng OCR. Thay thân hàm này bằng lời gọi API thật là xong — phần
 * validate/needsReview ở trên vẫn dùng nguyên.
 */
async function runOcrEngine(file: File, docType: "cccd" | "passport"): Promise<OcrResult> {
  if (ocrSimulation.enabled) {
    await new Promise((r) => setTimeout(r, ocrSimulation.latencyMs));
  }

  // Ảnh mờ/nhỏ thường cho kết quả tệ — mô phỏng theo kích thước file
  const sizeKb = file.size / 1024;
  const quality = sizeKb < 80 ? 0.55 : sizeKb < 250 ? 0.78 : 0.93;
  const jitter = (Math.random() - 0.5) * 0.1;
  const confidence = Math.max(0.35, Math.min(0.99, quality + jitter));

  const data: IdDocumentData = {
    fullName: SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)],
    idNumber: docType === "cccd" ? randomDigits(12) : `C${randomDigits(7)}`,
    dob: `19${80 + Math.floor(Math.random() * 20)}-0${1 + Math.floor(Math.random() * 9)}-1${Math.floor(Math.random() * 9)}`,
    address: "Số 12, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    nationality: docType === "cccd" ? "Việt Nam" : "Khác",
    docType,
    confidence,
  };

  const warnings: string[] = [];
  if (sizeKb < 80) warnings.push("Ảnh có độ phân giải thấp — nên chụp lại rõ hơn.");
  if (confidence < OCR_CONFIDENCE_THRESHOLD) warnings.push("Độ tin cậy thấp — vui lòng kiểm tra từng trường.");

  return {
    data,
    fieldConfidence: {
      fullName: confidence,
      idNumber: Math.max(0.3, confidence - 0.05),
      dob: Math.max(0.3, confidence - 0.12),
      address: Math.max(0.3, confidence - 0.2),
    },
    needsReview: confidence < OCR_CONFIDENCE_THRESHOLD,
    warnings,
  };
}

/**
 * Quét giấy tờ. Luôn có timeout — không để lễ tân chể vò võ trước mặt khách.
 * Nếu lỗi → ném lỗi có thông điệp rõ để UI chuyển sang nhập tay ngay.
 */
export async function scanIdDocument(file: File, docType: "cccd" | "passport" = "cccd"): Promise<OcrResult> {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (file.type && !allowed.includes(file.type)) {
    throw new Error("Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc HEIC.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Ảnh lớn hơn 8MB. Vui lòng chụp lại hoặc giảm dung lượng.");
  }

  const done = logger.time("ocr", `Quét ${docType}`);
  try {
    const result = await withTimeout(runOcrEngine(file, docType), 15_000, "Quét giấy tờ");
    done();
    logger.info("ocr", "Quét xong", { confidence: result.data.confidence, needsReview: result.needsReview });
    return result;
  } catch (err) {
    done();
    logger.error("ocr", "Quét giấy tờ thất bại — chuyển sang nhập tay", err);
    throw new Error(
      err instanceof Error && err.name === "TimeoutError"
        ? "Quét giấy tờ quá lâu. Vui lòng nhập thông tin bằng tay để không làm khách phải chờ."
        : "Không đọc được giấy tờ. Vui lòng nhập thông tin bằng tay.",
    );
  }
}

/** Chuẩn hóa tên sang dạng hiển thị (OCR thường trả về CHỮ IN). */
export function titleCaseName(v: string): string {
  return v
    .toLocaleLowerCase("vi-VN")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("vi-VN") + w.slice(1))
    .join(" ");
}

/** Che bớt số giấy tờ khi hiển thị/log — giảm rủi ro lọt dữ liệu cá nhân. */
export function maskIdNumber(v: string): string {
  if (v.length <= 4) return "•".repeat(v.length);
  return "•".repeat(v.length - 4) + v.slice(-4);
}
