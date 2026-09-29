/**
 * GHI LOG, THEO DÕI LỖI & GIÁM SÁT HIỆU NĂNG
 *
 * Mục tiêu: production-grade observability ở phía client.
 *  - Log có cấp độ, giữ trong ring buffer để xem ngay trong app (trang Vận hành)
 *  - Tự bắt lỗi không xử lý (window.onerror, unhandledrejection)
 *  - Đo Core Web Vitals (LCP, CLS, TTFB) qua PerformanceObserver
 *  - `sink` cho phép đẩy sang Sentry/Datadog thật mà không sửa code gọi log
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  at: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

export interface VitalSample {
  name: "LCP" | "CLS" | "TTFB" | "FCP" | "INP";
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  at: string;
}

const MAX_ENTRIES = 400;
const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Dưới mức này sẽ không ghi. Production nên dùng "info". */
let minLevel: LogLevel = import.meta.env?.MODE === "production" ? "info" : "debug";

const entries: LogEntry[] = [];
const vitals: VitalSample[] = [];
type Listener = () => void;
const listeners = new Set<Listener>();

/** Đích gửi log bên ngoài (Sentry…). Gán bằng `setLogSink`. */
type Sink = (entry: LogEntry) => void;
let sink: Sink | null = null;

let seq = 0;
const nextId = () => `log_${Date.now().toString(36)}_${++seq}`;

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* listener lỗi không được làm sụp logger */
    }
  });
}

/** Chuẩn hóa lỗi thành dữ liệu serialize được (Error không JSON.stringify được). */
function normalize(data: unknown): unknown {
  if (data instanceof Error) {
    return { name: data.name, message: data.message, stack: data.stack?.split("\n").slice(0, 6).join("\n") };
  }
  return data;
}

function write(level: LogLevel, scope: string, message: string, data?: unknown) {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) return;
  const entry: LogEntry = {
    id: nextId(),
    at: new Date().toISOString(),
    level,
    scope,
    message,
    data: data === undefined ? undefined : normalize(data),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);

  // In ra console để dev debug
  const tag = `[${scope}]`;
  if (level === "error") console.error(tag, message, data ?? "");
  else if (level === "warn") console.warn(tag, message, data ?? "");
  else if (level === "info") console.info(tag, message, data ?? "");
  else console.debug(tag, message, data ?? "");

  try {
    sink?.(entry);
  } catch {
    /* không để sink lỗi làm vỡ luồng chính */
  }
  notify();
}

export const logger = {
  debug: (scope: string, message: string, data?: unknown) => write("debug", scope, message, data),
  info: (scope: string, message: string, data?: unknown) => write("info", scope, message, data),
  warn: (scope: string, message: string, data?: unknown) => write("warn", scope, message, data),
  error: (scope: string, message: string, data?: unknown) => write("error", scope, message, data),

  /** Đo thời gian một tác vụ; trả về hàm kết thúc. */
  time: (scope: string, label: string) => {
    const t0 = performance.now();
    return () => {
      const ms = Math.round(performance.now() - t0);
      write(ms > 1000 ? "warn" : "debug", scope, `${label} — ${ms}ms`, { ms });
      return ms;
    };
  },
};

export function setLogLevel(level: LogLevel) {
  minLevel = level;
}

/** Nối logger với hệ thống theo dõi lỗi thật (Sentry, Datadog…). */
export function setLogSink(fn: Sink | null) {
  sink = fn;
}

export function getLogs(filter?: { level?: LogLevel; scope?: string }): LogEntry[] {
  let out = [...entries].reverse();
  if (filter?.level) out = out.filter((e) => LEVEL_WEIGHT[e.level] >= LEVEL_WEIGHT[filter.level!]);
  if (filter?.scope) out = out.filter((e) => e.scope === filter.scope);
  return out;
}

export function getVitals(): VitalSample[] {
  return [...vitals];
}

export function clearLogs() {
  entries.length = 0;
  notify();
}

/** Đăng ký nghe thay đổi để UI tự refresh. Trả về hàm hủy. */
export function subscribeLogs(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getErrorCount(): number {
  return entries.filter((e) => e.level === "error").length;
}

/* ===========================================================================
 * TỰ ĐỘNG BẮT LỖI & ĐO HIỆU NĂNG
 * =========================================================================*/

function rate(name: VitalSample["name"], value: number): VitalSample["rating"] {
  // Ngưỡng theo khuyến nghị Core Web Vitals của Google
  const t: Record<VitalSample["name"], [number, number]> = {
    LCP: [2500, 4000],
    CLS: [0.1, 0.25],
    TTFB: [800, 1800],
    FCP: [1800, 3000],
    INP: [200, 500],
  };
  const [good, poor] = t[name];
  return value <= good ? "good" : value <= poor ? "needs-improvement" : "poor";
}

function pushVital(name: VitalSample["name"], value: number) {
  const sample: VitalSample = { name, value, rating: rate(name, value), at: new Date().toISOString() };
  const i = vitals.findIndex((v) => v.name === name);
  if (i >= 0) vitals[i] = sample;
  else vitals.push(sample);
  if (sample.rating === "poor") {
    write("warn", "vitals", `${name} kém: ${Math.round(value)}`, sample);
  }
  notify();
}

let installed = false;

/** Gọi 1 lần khi app khởi động (trong main.tsx). */
export function installMonitoring() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (ev) => {
    logger.error("window", ev.message || "Lỗi không xác định", {
      source: ev.filename,
      line: ev.lineno,
      col: ev.colno,
      error: ev.error instanceof Error ? ev.error.message : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    logger.error("promise", "Promise bị reject mà không xử lý", ev.reason);
  });

  // Mạng: cảnh báo khi mất kết nối (ảnh hưởng luồng đặt phòng)
  window.addEventListener("offline", () => logger.warn("network", "Mất kết nối mạng"));
  window.addEventListener("online", () => logger.info("network", "Đã có kết nối mạng"));

  // Core Web Vitals
  try {
    if ("PerformanceObserver" in window) {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) pushVital("LCP", last.startTime);
      }).observe({ type: "largest-contentful-paint", buffered: true });

      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as Array<{ name: string; startTime: number }>) {
          if (e.name === "first-contentful-paint") pushVital("FCP", e.startTime);
        }
      }).observe({ type: "paint", buffered: true });

      let cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
          if (!e.hadRecentInput) cls += e.value;
        }
        pushVital("CLS", cls);
      }).observe({ type: "layout-shift", buffered: true });

      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav) pushVital("TTFB", nav.responseStart);
    }
  } catch (err) {
    logger.debug("vitals", "Trình duyệt không hỗ trợ đầy đủ PerformanceObserver", err);
  }

  logger.info("app", "Hệ thống giám sát đã kích hoạt");
}
