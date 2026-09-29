/**
 * GIÁ ĐỘNG (DYNAMIC PRICING)
 *
 * Bài toán thật: giá phòng cố định làm mất doanh thu mùa cao điểm và mất khách
 * mùa thấp điểm. Module này tính giá từng đêm theo 4 yếu tố:
 *
 *   giá = giá_gốc × hệ_số_mùa × hệ_số_cuối_tuần × hệ_số_lấp_đầy × (1 + sự_kiện)
 *
 * Nguyên tắc an toàn (rất quan trọng với doanh thu thật):
 *  1. Luôn clamp trong [floor, ceiling] — thuật toán không bao giờ được ra giá vô lý.
 *  2. Giá chốt thủ công (PriceOverride) LUÔN đè lên kết quả tính toán — đây là
 *     đường thoát (fallback) khi thuật toán/AI sai.
 *  3. Mọi con số đều trả kèm `reasons` để nhân viên hiểu vì sao giá như vậy
 *     (không phải hộp đen).
 */
import { addDays } from "./format";
import type { Booking, LocalEvent, PriceOverride, RatePlan, Room, RoomType, SeasonKind } from "./types";

/* ------------------------------------------------------------------ MÙA --*/

/** Ngày lễ / cao điểm cố định theo tháng-ngày (áp dụng mọi năm). */
const PEAK_RANGES: Array<[string, string, string]> = [
  ["12-24", "01-02", "Giáng sinh & Tết dương lịch"],
  ["04-28", "05-03", "Lễ 30/4 – 1/5"],
  ["08-31", "09-03", "Lễ Quốc khánh 2/9"],
];

/**
 * Xác định mùa của một ngày.
 * Chuẩn du lịch biển Việt Nam: hè 6–8 cao điểm, 11–2 thấp điểm.
 */
export function seasonFor(dateISO: string): SeasonKind {
  const d = new Date(`${dateISO}T00:00:00`);
  const md = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  for (const [from, to, _label] of PEAK_RANGES) {
    // Khoảng vắt qua giao năm (12-24 → 01-02)
    if (from <= to ? md >= from && md <= to : md >= from || md <= to) return "peak";
  }

  const m = d.getMonth() + 1;
  if (m >= 6 && m <= 8) return "high";
  if (m === 3 || m === 4 || m === 5 || m === 9) return "shoulder";
  return "low";
}

export const SEASON_LABELS: Record<SeasonKind, string> = {
  low: "Thấp điểm",
  shoulder: "Chuyển mùa",
  high: "Cao điểm",
  peak: "Lễ / Tết",
};

/** Cuối tuần tính theo đêm lưu trú: tối thứ 6 và tối thứ 7. */
export function isWeekendNight(dateISO: string): boolean {
  const day = new Date(`${dateISO}T00:00:00`).getDay(); // 0=CN
  return day === 5 || day === 6;
}

/* ------------------------------------------------------- BẢNG GIÁ MẶC ĐỊNH --*/

export const DEFAULT_RATE_PLAN: RatePlan = {
  id: "rp_default",
  name: "Bảng giá linh hoạt (mặc định)",
  weekendMultiplier: 1.15,
  seasonMultipliers: { low: 0.85, shoulder: 1, high: 1.2, peak: 1.45 },
  occupancySteps: [
    { from: 0, multiplier: 0.92 }, // vắng → giảm nhẹ để kích cầu
    { from: 0.5, multiplier: 1 },
    { from: 0.7, multiplier: 1.1 },
    { from: 0.85, multiplier: 1.22 },
    { from: 0.95, multiplier: 1.35 }, // gần full → giữ giá cao
  ],
  floorMultiplier: 0.75, // không bao giờ bán dưới 75% giá niêm yết
  ceilingMultiplier: 1.8, // không bao giờ vượt 180% giá niêm yết
  active: true,
};

/** Làm tròn lên hàng nghìn để giá trông "sạch" khi hiển thị. */
function roundVND(n: number): number {
  return Math.round(n / 1000) * 1000;
}

function occupancyMultiplier(plan: RatePlan, occupancy: number): number {
  const steps = [...plan.occupancySteps].sort((a, b) => a.from - b.from);
  let m = 1;
  for (const s of steps) if (occupancy >= s.from) m = s.multiplier;
  return m;
}

/** Tổng mức tăng nhu cầu từ các sự kiện địa phương trùng ngày. */
export function eventLiftFor(dateISO: string, events: LocalEvent[]): { lift: number; names: string[] } {
  let lift = 0;
  const names: string[] = [];
  for (const e of events) {
    if (dateISO >= e.startDate && dateISO <= e.endDate) {
      lift += e.demandLift;
      names.push(e.name);
    }
  }
  return { lift: Math.min(lift, 0.6), names }; // chặn trên để tránh cộng dồn vô lý
}

/* ------------------------------------------------------- TÍNH GIÁ 1 ĐÊM --*/

export interface NightlyRate {
  date: string;
  /** Giá niêm yết của loại phòng */
  basePrice: number;
  /** Giá bán cuối cùng */
  price: number;
  season: SeasonKind;
  weekend: boolean;
  occupancy: number;
  eventLift: number;
  /** True nếu nhân viên đã chốt giá thủ công cho ngày này */
  overridden: boolean;
  /** Diễn giải cho người dùng hiểu vì sao ra giá này */
  reasons: string[];
}

export interface PricingContext {
  roomType: RoomType;
  /** Tỷ lệ lấp đầy dự kiến của ngày đó (0..1) */
  occupancy?: number;
  plan?: RatePlan;
  events?: LocalEvent[];
  overrides?: PriceOverride[];
}

export function priceNight(dateISO: string, ctx: PricingContext): NightlyRate {
  const plan = ctx.plan ?? DEFAULT_RATE_PLAN;
  const base = ctx.roomType.basePrice;
  const season = seasonFor(dateISO);
  const weekend = isWeekendNight(dateISO);
  const occupancy = Math.max(0, Math.min(1, ctx.occupancy ?? 0.5));
  const { lift, names } = eventLiftFor(dateISO, ctx.events ?? []);
  const reasons: string[] = [];

  // 1) Giá chốt thủ công thắng tất cả
  const ov = (ctx.overrides ?? []).find((o) => o.typeId === ctx.roomType.id && o.date === dateISO);
  if (ov) {
    return {
      date: dateISO,
      basePrice: base,
      price: ov.price,
      season,
      weekend,
      occupancy,
      eventLift: lift,
      overridden: true,
      reasons: [`Giá chốt thủ công: ${ov.reason || "không ghi lý do"}`],
    };
  }

  // 2) Bảng giá bị tắt → trả nguyên giá niêm yết (fallback an toàn)
  if (!plan.active) {
    return {
      date: dateISO,
      basePrice: base,
      price: base,
      season,
      weekend,
      occupancy,
      eventLift: 0,
      overridden: false,
      reasons: ["Giá linh hoạt đang tắt — dùng giá niêm yết"],
    };
  }

  const sm = plan.seasonMultipliers[season] ?? 1;
  const wm = weekend ? plan.weekendMultiplier : 1;
  const om = occupancyMultiplier(plan, occupancy);

  if (sm !== 1) reasons.push(`${SEASON_LABELS[season]} ×${sm.toFixed(2)}`);
  if (weekend) reasons.push(`Cuối tuần ×${wm.toFixed(2)}`);
  if (om !== 1) reasons.push(`Lấp đầy ${Math.round(occupancy * 100)}% ×${om.toFixed(2)}`);
  if (lift > 0) reasons.push(`Sự kiện: ${names.join(", ")} +${Math.round(lift * 100)}%`);

  let price = base * sm * wm * om * (1 + lift);

  // 3) Clamp — lớp bảo hiểm cuối cùng
  const floor = base * plan.floorMultiplier;
  const ceiling = base * plan.ceilingMultiplier;
  if (price < floor) {
    price = floor;
    reasons.push(`Chặn sàn ${Math.round(plan.floorMultiplier * 100)}%`);
  }
  if (price > ceiling) {
    price = ceiling;
    reasons.push(`Chặn trần ${Math.round(plan.ceilingMultiplier * 100)}%`);
  }

  if (reasons.length === 0) reasons.push("Giá niêm yết");

  return {
    date: dateISO,
    basePrice: base,
    price: roundVND(price),
    season,
    weekend,
    occupancy,
    eventLift: lift,
    overridden: false,
    reasons,
  };
}

/* ------------------------------------------------- BÁO GIÁ CẢ KỲ LƯU TRÚ --*/

export interface StayQuote {
  nights: NightlyRate[];
  /** Tổng tiền phòng theo giá động */
  total: number;
  /** Tổng tiền nếu dùng giá niêm yết — để so sánh */
  baseTotal: number;
  avgPerNight: number;
  /** Chênh lệch % so với giá niêm yết */
  deltaPercent: number;
  nightCount: number;
}

/**
 * Báo giá toàn bộ kỳ lưu trú [checkIn, checkOut).
 * `occupancyByDate` cho phép truyền tỷ lệ lấp đầy thật từng ngày.
 */
export function quoteStay(
  checkIn: string,
  checkOut: string,
  ctx: PricingContext & { occupancyByDate?: Record<string, number> },
): StayQuote {
  const nights: NightlyRate[] = [];
  let cursor = checkIn;
  let guard = 0;

  while (cursor < checkOut && guard < 365) {
    nights.push(
      priceNight(cursor, {
        ...ctx,
        occupancy: ctx.occupancyByDate?.[cursor] ?? ctx.occupancy,
      }),
    );
    // addDays nhận và trả về ISO string — không quấn thêm toISODate/new Date
    cursor = addDays(cursor, 1);
    guard++;
  }

  const total = nights.reduce((s, n) => s + n.price, 0);
  const baseTotal = nights.reduce((s, n) => s + n.basePrice, 0);

  return {
    nights,
    total,
    baseTotal,
    avgPerNight: nights.length ? Math.round(total / nights.length) : 0,
    deltaPercent: baseTotal ? Math.round(((total - baseTotal) / baseTotal) * 100) : 0,
    nightCount: nights.length,
  };
}

/* ----------------------------------------------------- TỶ LỆ LẤP ĐẦY THẬT --*/

const BLOCKING = new Set(["reserved", "checked_in"]);

/** Tỷ lệ lấp đầy thực tế của một ngày, dùng làm đầu vào cho giá động. */
export function occupancyOn(dateISO: string, rooms: Room[], bookings: Booking[]): number {
  if (rooms.length === 0) return 0;
  const busy = bookings.filter(
    (b) => BLOCKING.has(b.status) && b.checkIn <= dateISO && dateISO < b.checkOut,
  ).length;
  return Math.min(1, busy / rooms.length);
}

/** Tính sẵn tỷ lệ lấp đầy cho một khoảng ngày (tránh tính lại trong vòng lặp). */
export function occupancyMap(
  fromISO: string,
  days: number,
  rooms: Room[],
  bookings: Booking[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = addDays(fromISO, i);
    map[d] = occupancyOn(d, rooms, bookings);
  }
  return map;
}
