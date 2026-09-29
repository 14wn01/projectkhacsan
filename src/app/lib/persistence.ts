/**
 * LƯU TRỮ BỀN & SAO LƯU (Persistence / Backup)
 *
 * Frontend-only nên dùng localStorage làm "database tạm". Toàn bộ truy cập
 * được bọc try/catch để không bao giờ làm sụp app khi:
 *  - Trình duyệt chặn storage (Safari private mode)
 *  - Dữ liệu cũ sai schema (migration)
 *  - Vượt quota
 *
 * Khi chuyển sang backend thật: thay `loadState`/`saveState` bằng lời gọi API,
 * phần còn lại của app không cần đổi.
 */
import { logger } from "./logger";

const STORAGE_KEY = "smh.pms.state";
/** Tăng số này khi schema đổi không tương thích → dữ liệu cũ bị bỏ qua an toàn */
export const SCHEMA_VERSION = 3;

interface Envelope<T> {
  version: number;
  savedAt: string;
  data: T;
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    // Kiểm tra thật sự ghi được (Safari private mode ném lỗi khi setItem)
    const probe = "__probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isPersistenceAvailable(): boolean {
  return storage() !== null;
}

/** Đọc state đã lưu. Trả về null nếu chưa có / sai phiên bản / hỏng. */
export function loadState<T>(): T | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || typeof env !== "object" || env.version !== SCHEMA_VERSION) {
      logger.warn("persistence", "Bỏ qua dữ liệu cũ không tương thích schema", {
        found: (env as Envelope<T> | null)?.version,
        expected: SCHEMA_VERSION,
      });
      return null;
    }
    return env.data;
  } catch (err) {
    logger.error("persistence", "Không đọc được dữ liệu đã lưu", err);
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Ghi state (debounce 400ms để không ghi liên tục khi user thao tác nhanh). */
export function saveState<T>(data: T): void {
  const s = storage();
  if (!s) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const env: Envelope<T> = { version: SCHEMA_VERSION, savedAt: new Date().toISOString(), data };
      s.setItem(STORAGE_KEY, JSON.stringify(env));
    } catch (err) {
      // Thường là QuotaExceededError — không chặn luồng nghiệp vụ
      logger.error("persistence", "Ghi dữ liệu thất bại (có thể hết dung lượng)", err);
    }
  }, 400);
}

/** Xóa toàn bộ dữ liệu cục bộ — dùng cho nút "Reset dữ liệu demo". */
export function clearState(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch (err) {
    logger.error("persistence", "Xóa dữ liệu thất bại", err);
  }
}

/** Thời điểm sao lưu gần nhất (hiển thị trong trang Vận hành). */
export function lastSavedAt(): string | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as Envelope<unknown>).savedAt ?? null;
  } catch {
    return null;
  }
}

/* ===========================================================================
 * SAO LƯU / KHÔI PHỤC THỦ CÔNG (Disaster Recovery)
 * =========================================================================*/

/** Xuất toàn bộ dữ liệu thành file JSON cho người dùng tải về. */
export function exportBackup<T>(data: T, filename = `sao-mai-backup-${Date.now()}.json`): void {
  try {
    const env: Envelope<T> = { version: SCHEMA_VERSION, savedAt: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(env, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    logger.info("persistence", "Đã xuất bản sao lưu", { filename });
  } catch (err) {
    logger.error("persistence", "Xuất sao lưu thất bại", err);
    throw err;
  }
}

/** Đọc file sao lưu người dùng chọn. Ném lỗi có thông điệp rõ ràng nếu file sai. */
export async function importBackup<T>(file: File): Promise<T> {
  const text = await file.text();
  let env: Envelope<T>;
  try {
    env = JSON.parse(text) as Envelope<T>;
  } catch {
    throw new Error("File sao lưu không đúng định dạng JSON.");
  }
  if (!env || typeof env !== "object" || !("data" in env)) {
    throw new Error("File sao lưu thiếu dữ liệu.");
  }
  if (env.version !== SCHEMA_VERSION) {
    throw new Error(
      `File sao lưu thuộc phiên bản ${env.version}, hệ thống đang dùng phiên bản ${SCHEMA_VERSION}.`,
    );
  }
  logger.info("persistence", "Đã nạp bản sao lưu", { savedAt: env.savedAt });
  return env.data;
}
