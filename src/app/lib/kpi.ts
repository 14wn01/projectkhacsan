/**
 * CHỈ SỐ VẬN HÀNH KHÁCH SẠN (KPI)
 *
 * Bộ ba Occupancy – ADR – RevPAR là chuẩn bắt buộc trên mọi dashboard PMS
 * (Cloudbeds, Mews, Stayntouch, Apaleo). File này chỉ chứa hàm thuần (pure),
 * không phụ thuộc React nên dễ unit-test và tái sử dụng ở trang Thống kê.
 */
import { addDays, dateRangesOverlap, toISODate } from "./format";
import { buildSeries, occupiedOn } from "./analytics";
import type { DayPoint } from "./analytics";
import type { Booking, BookingSource, Room } from "./types";

/** Doanh thu TIỀN PHÒNG của một ngày (không gồm dịch vụ phát sinh) */
export function roomRevenueOn(bookings: Booking[], iso: string): number {
  const next = addDays(iso, 1);
  let total = 0;
  for (const b of bookings) {
    if (b.status === "cancelled" || b.status === "pending") continue;
    if (dateRangesOverlap(b.checkIn, b.checkOut, iso, next)) total += b.roomPricePerNight;
  }
  return total;
}

/** ADR (Average Daily Rate) — giá bán bình quân trên mỗi phòng ĐÃ BÁN */
export function adrOn(bookings: Booking[], iso: string): number {
  const sold = occupiedOn(bookings, iso);
  if (sold === 0) return 0;
  return Math.round(roomRevenueOn(bookings, iso) / sold);
}

/** RevPAR — doanh thu phòng bình quân trên mỗi phòng CÓ THỂ BÁN */
export function revparOn(bookings: Booking[], rooms: Room[], iso: string): number {
  return Math.round(roomRevenueOn(bookings, iso) / Math.max(rooms.length, 1));
}

export interface ForecastPoint {
  date: string;
  label: string;
  weekday: string;
  occupancy: number;
  arrivals: number;
  departures: number;
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/**
 * Dự báo công suất N ngày tới dựa trên các đặt phòng đã nằm trong hệ thống.
 * Đây là "on the books" — không phải dự báo AI, nên luôn đúng với dữ liệu thật.
 */
export function buildForecast(
  bookings: Booking[],
  rooms: Room[],
  days = 7,
  fromIso = toISODate(new Date()),
): ForecastPoint[] {
  const total = Math.max(rooms.length, 1);
  const out: ForecastPoint[] = [];
  for (let i = 0; i < days; i++) {
    const iso = addDays(fromIso, i);
    const d = new Date(iso);
    const occ = occupiedOn(bookings, iso);
    out.push({
      date: iso,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      weekday: WEEKDAYS[d.getDay()],
      occupancy: Math.round((occ / total) * 100),
      arrivals: bookings.filter((b) => b.checkIn === iso && b.status !== "cancelled" && b.status !== "pending").length,
      departures: bookings.filter((b) => b.checkOut === iso && b.status !== "cancelled" && b.status !== "pending").length,
    });
  }
  return out;
}

export interface SourceSlice {
  source: BookingSource;
  count: number;
  share: number;
}

/** Tỷ trọng kênh đặt phòng trong N ngày gần nhất (tính theo ngày tạo booking) */
export function sourceMix(bookings: Booking[], days = 30, endIso = toISODate(new Date())): SourceSlice[] {
  const from = addDays(endIso, -(days - 1));
  const counter = new Map<BookingSource, number>();
  let total = 0;
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const created = (b.createdAt ?? "").slice(0, 10);
    if (!created || created < from || created > endIso) continue;
    const key: BookingSource = b.source ?? "walk_in";
    counter.set(key, (counter.get(key) ?? 0) + 1);
    total += 1;
  }
  return Array.from(counter.entries())
    .map(([source, count]) => ({ source, count, share: total === 0 ? 0 : Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

export interface PeriodCompare {
  revenue: number;
  revenuePrev: number;
  revenueDeltaPct: number;
  occupancyAvg: number;
  occupancyAvgPrev: number;
  occupancyDelta: number;
}

/** So sánh kỳ hiện tại với kỳ liền trước cùng độ dài — trả lời "có tốt hơn không?" */
export function comparePeriods(
  bookings: Booking[],
  rooms: Room[],
  days: number,
  endIso = toISODate(new Date()),
): PeriodCompare {
  const cur = buildSeries(bookings, rooms, days, endIso);
  const prev = buildSeries(bookings, rooms, days, addDays(endIso, -days));
  const sumRevenue = (points: DayPoint[]) => points.reduce((s, x) => s + x.revenue, 0);
  const avgOccupancy = (points: DayPoint[]) =>
    points.length === 0 ? 0 : Math.round(points.reduce((s, x) => s + x.occupancy, 0) / points.length);

  const revenue = sumRevenue(cur);
  const revenuePrev = sumRevenue(prev);
  const occupancyAvg = avgOccupancy(cur);
  const occupancyAvgPrev = avgOccupancy(prev);

  return {
    revenue,
    revenuePrev,
    revenueDeltaPct: revenuePrev === 0 ? 0 : Math.round(((revenue - revenuePrev) / revenuePrev) * 100),
    occupancyAvg,
    occupancyAvgPrev,
    occupancyDelta: occupancyAvg - occupancyAvgPrev,
  };
}

/** Xuất chuỗi ngày ra CSV (có BOM để Excel không lỗi tiếng Việt) */
export function seriesToCsv(points: DayPoint[]): string {
  const head = ["Ngay", "Cong suat (%)", "So phong ban", "Doanh thu (VND)"];
  const rows = points.map((p) => [p.date, String(p.occupancy), String(p.occupied), String(p.revenue)]);
  return "\uFEFF" + [head, ...rows].map((r) => r.join(",")).join("\n");
}
