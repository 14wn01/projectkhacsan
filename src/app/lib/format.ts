export function formatVND(n: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseLocalDate(value: string): Date {
  return isISODate(value) ? new Date(value + "T00:00:00") : new Date(NaN);
}

export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? (isISODate(d) ? parseLocalDate(d) : new Date(d)) : d;
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function toISODate(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!isISODate(checkIn) || !isISODate(checkOut)) return 0;
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  const diff = Math.round((b - a) / 86400000);
  return Math.max(diff, 0);
}

/** Kiểm tra 2 khoảng ngày [aIn,aOut) và [bIn,bOut) có giao nhau không */
export function dateRangesOverlap(
  aIn: string,
  aOut: string,
  bIn: string,
  bOut: string,
): boolean {
  return new Date(aIn) < new Date(bOut) && new Date(bIn) < new Date(aOut);
}

export function addDays(iso: string, days: number): string {
  if (!isISODate(iso) || !Number.isInteger(days)) return "";
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
