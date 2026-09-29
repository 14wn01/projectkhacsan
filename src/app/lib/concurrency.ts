/**
 * XỬ LÝ ĐỒNG THỜI, LỖI MẠNG & TIMEOUT
 *
 * Những thứ hệ thống thật luôn gặp mà bản demo thường bỏ qua:
 *  - Hai người ghi cùng một bản ghi → optimistic locking (version)
 *  - Người dùng bấm 2 lần → idempotency key
 *  - Nhiều luồng vào cùng vùng nguy hiểm → mutex
 *  - Mạng chậm/lỗi tạm thời → timeout + retry có backoff
 */
import { logger } from "./logger";

/* ------------------------------------------------- OPTIMISTIC LOCKING --*/

export class ConflictError extends Error {
  readonly code = "CONFLICT";
  constructor(message = "Dữ liệu đã bị người khác thay đổi. Vui lòng tải lại và thực hiện lại.") {
    super(message);
    this.name = "ConflictError";
  }
}

export class TimeoutError extends Error {
  readonly code = "TIMEOUT";
  constructor(message = "Thao tác quá thời gian chờ. Kiểm tra kết nối mạng rồi thử lại.") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Kiểm tra phiên bản trước khi ghi. Nếu khác → có người đã sửa ở giữa.
 * Dùng cho mọi thao tác sửa booking từ 2 mán hình khác nhau.
 */
export function assertVersion(current: number | undefined, expected: number | undefined, label = "bản ghi") {
  const c = current ?? 0;
  const e = expected ?? 0;
  if (c !== e) {
    logger.warn("concurrency", `Xung đột phiên bản trên ${label}`, { current: c, expected: e });
    throw new ConflictError(
      `${label} vừa được người khác cập nhật (phiên bản ${c}, bạn đang xem ${e}). Hãy tải lại.`,
    );
  }
}

export function nextVersion(v: number | undefined): number {
  return (v ?? 0) + 1;
}

/* ------------------------------------------------------------- MUTEX --*/

/**
 * Khóa tuần tự hóa vùng nguy hiểm. Trong trình duyệt JS đơn luồng, nhưng
 * các hàm `async` vẫn có thể chèn nhau tại mỗi `await` → vẫn cần mutex.
 *
 * Dùng cho: tạo booking, thu tiền, phát hành hóa đơn.
 */
export class Mutex {
  private queue: Promise<unknown> = Promise.resolve();

  runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const run = this.queue.then(fn, fn);
    // Giữ chuỗi không bị vỡ khi một tác vụ lỗi
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run as Promise<T>;
  }
}

/** Khóa dùng chung cho toàn bộ nghiệp vụ đặt phòng. */
export const bookingMutex = new Mutex();

/* --------------------------------------------------------- IDEMPOTENCY --*/

const seen = new Map<string, { at: number; result: unknown }>();
const IDEMPOTENCY_TTL_MS = 5 * 60_000;

/**
 * Chạy `fn` tối đa 1 lần cho mỗi `key` trong 5 phút.
 * Chống: double-click nút "Xác nhận đặt phòng", webhook thanh toán gọi lại 2 lần.
 */
export async function runOnce<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
  const now = Date.now();
  for (const [k, v] of seen) if (now - v.at > IDEMPOTENCY_TTL_MS) seen.delete(k);

  const hit = seen.get(key);
  if (hit) {
    logger.info("concurrency", "Bỏ qua yêu cầu trùng lặp (idempotency)", { key });
    return hit.result as T;
  }

  // Ghi nhận NGAY promise đang chạy: các lời gọi đồng thời (double-click,
  // webhook bắn lại) sẽ nhận chung một kết quả thay vì chạy fn hai lần.
  const promise = Promise.resolve().then(fn);
  seen.set(key, { at: now, result: promise });
  try {
    return await promise;
  } catch (err) {
    // Thất bại thì mở lại khóa để người dùng có thể thử lại
    seen.delete(key);
    throw err;
  }
}

/* -------------------------------------------------------- TIMEOUT/RETRY --*/

/** Giới hạn thời gian chờ. Luôn bọc mọi lời gọi mạng/AI bằng hàm này. */
export function withTimeout<T>(p: Promise<T>, ms = 8000, label = "Thao tác"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(`${label} quá ${ms}ms không phản hồi.`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  label?: string;
  /** Không retry với lỗi nghiệp vụ (ví dụ phòng đã có khách) */
  shouldRetry?: (err: unknown) => boolean;
}

/**
 * Thử lại với exponential backoff + jitter.
 * Mặc định KHÔNG retry lỗi xung đột — retry chỉ làm tệ hơn.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 3, baseDelayMs = 300, label = "Thao tác" } = opts;
  const shouldRetry = opts.shouldRetry ?? ((e: unknown) => !(e instanceof ConflictError));

  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts || !shouldRetry(err)) break;
      const delay = baseDelayMs * 2 ** (i - 1) + Math.random() * 100;
      logger.warn("concurrency", `${label} lỗi, thử lại lần ${i + 1}/${attempts} sau ${Math.round(delay)}ms`, err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  logger.error("concurrency", `${label} thất bại sau ${attempts} lần thử`, lastErr);
  throw lastErr;
}

/** Chuyển lỗi bất kỳ thành thông điệp tiếng Việt dễ hiểu cho người dùng cuối. */
export function friendlyError(err: unknown): string {
  if (err instanceof ConflictError || err instanceof TimeoutError) return err.message;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Thiết bị đang mất kết nối mạng. Thao tác sẽ được thực hiện lại khi có mạng.";
  }
  if (err instanceof Error) return err.message;
  return "Có lỗi không xác định. Vui lòng thử lại hoặc liên hệ quản trị viên.";
}
