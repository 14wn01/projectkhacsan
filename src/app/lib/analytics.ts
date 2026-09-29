import { Booking, Room } from "./types";
import { addDays, dateRangesOverlap, nightsBetween, toISODate } from "./format";

/** Số phòng có khách (reserved/checked_in) trong 1 ngày cụ thể */
export function occupiedOn(bookings: Booking[], iso: string): number {
  const next = addDays(iso, 1);
  return bookings.filter(
    (b) =>
      (b.status === "reserved" || b.status === "checked_in" || b.status === "checked_out") &&
      dateRangesOverlap(b.checkIn, b.checkOut, iso, next),
  ).length;
}

/** Doanh thu ghi nhận cho 1 ngày (tiền phòng phân bổ theo đêm + dịch vụ theo ngày) */
export function revenueOn(bookings: Booking[], iso: string): number {
  let total = 0;
  for (const b of bookings) {
    if (b.status === "cancelled" || b.status === "pending") continue;
    const next = addDays(iso, 1);
    if (dateRangesOverlap(b.checkIn, b.checkOut, iso, next)) total += b.roomPricePerNight;
    for (const s of b.services) if (s.date === iso) total += s.price * s.qty;
  }
  return total;
}

export interface DayPoint {
  date: string;
  label: string;
  occupancy: number; // %
  revenue: number;
  occupied: number;
}

export function buildSeries(
  bookings: Booking[],
  rooms: Room[],
  days: number,
  endIso = toISODate(new Date()),
): DayPoint[] {
  const out: DayPoint[] = [];
  const total = Math.max(rooms.length, 1);
  for (let i = days - 1; i >= 0; i--) {
    const iso = addDays(endIso, -i);
    const occ = occupiedOn(bookings, iso);
    const d = new Date(iso);
    out.push({
      date: iso,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      occupancy: Math.round((occ / total) * 100),
      revenue: revenueOn(bookings, iso),
      occupied: occ,
    });
  }
  return out;
}

export function bookingTotal(b: Booking): number {
  const room = nightsBetween(b.checkIn, b.checkOut) * b.roomPricePerNight;
  const svc = b.services.reduce((s, x) => s + x.price * x.qty, 0);
  return room + svc;
}
