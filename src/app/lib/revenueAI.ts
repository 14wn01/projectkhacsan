/**
 * AI QUẢN TRỊ DOANH THU (REVENUE MANAGEMENT)
 *
 * Giải 3 bài toán tiền thật, không phải chatbot trang trí:
 *  1. DỰ BÁO NHU CẦU — 7–90 ngày tới sẽ lấp đầy bao nhiêu %?
 *  2. ĐỀ XUẤT GIÁ — nên bán giá nào để tối đa RevPAR?
 *  3. DỰ ĐOÁN NO-SHOW/HỦY — nên nhận overbooking bao nhiêu phòng?
 *
 * PHƯƠNG PHÁP: hồi quy có trọng số trên dữ liệu lịch sử + mùa vụ + sự kiện
 * địa phương. Cố ý dùng thuật toán GIẢI THÍCH ĐƯỢC thay vì một mô hình hộp
 * đen, vì quản lý khách sạn sẽ không bao giờ đổi giá theo một con số không rõ
 * lý do.
 *
 * BẮT BUỘC CÓ ĐƯỜNG THOÁT:
 *  - Mọi kết quả trả kèm `confidence` + `dataPoints`. Ít dữ liệu → confidence thấp
 *    → UI phải cảnh báo và KHÔNG tự động áp dụng.
 *  - Nhân viên luôn có thể chốt giá thủ công (PriceOverride) đè lên AI.
 *  - Overbooking mặc định TẮT. Phải bật có ý thức.
 */
import { addDays, toISODate } from "./format";
import { logger } from "./logger";
import { DEFAULT_RATE_PLAN, SEASON_LABELS, eventLiftFor, isWeekendNight, seasonFor } from "./pricing";
import type { Booking, LocalEvent, RatePlan, Room, RoomType, SeasonKind } from "./types";

/* ======================================================================
 * 1. DỰ BÁO NHU CẦU
 * ==================================================================== */

export interface DemandForecast {
  date: string;
  /** Tỷ lệ lấp đầy dự báo (0..1) */
  forecastOccupancy: number;
  /** Đã đặt thực tế tính đến hôm nay */
  bookedOccupancy: number;
  /** Số phòng kỳ vọng bán thêm */
  expectedPickup: number;
  season: SeasonKind;
  weekend: boolean;
  events: string[];
  /** 0..1 — dưới 0.5 thì chỉ nên tham khảo */
  confidence: number;
  /** Số mẫu lịch sử dùng để dự báo ngày này */
  dataPoints: number;
  reasons: string[];
}

const BLOCKING = new Set(["reserved", "checked_in", "checked_out"]);

/** Đếm số phòng bị chiếm trong một ngày. */
function occupiedCount(dateISO: string, bookings: Booking[]): number {
  return bookings.filter((b) => BLOCKING.has(b.status) && b.checkIn <= dateISO && dateISO < b.checkOut).length;
}

/**
 * Dự báo nhu cầu cho `days` ngày tới.
 *
 * Mô hình: lấp đầy nền theo mùa/thứ (học từ lịch sử cùng loại ngày)
 *          + pickup còn lại theo số ngày tới ngày đó (booking curve)
 *          + ảnh hưởng sự kiện địa phương
 */
export function forecastDemand(args: {
  rooms: Room[];
  bookings: Booking[];
  events?: LocalEvent[];
  days?: number;
  from?: Date;
}): DemandForecast[] {
  const { rooms, bookings, events = [] } = args;
  const days = args.days ?? 30;
  const from = args.from ?? new Date();
  const totalRooms = rooms.length || 1;
  const todayISO = toISODate(from);

  // --- Học từ lịch sử: lấp đầy trung bình theo (mùa, cuối tuần) ---
  const buckets = new Map<string, number[]>();
  for (let i = 1; i <= 180; i++) {
    const d = addDays(todayISO, -i);
    const key = `${seasonFor(d)}|${isWeekendNight(d) ? "we" : "wd"}`;
    const rate = occupiedCount(d, bookings) / totalRooms;
    // Chỉ học từ ngày có dữ liệu thật
    if (rate > 0) {
      const arr = buckets.get(key) ?? [];
      arr.push(rate);
      buckets.set(key, arr);
    }
  }

  const globalSamples = [...buckets.values()].flat();
  const globalAvg = globalSamples.length
    ? globalSamples.reduce((s, v) => s + v, 0) / globalSamples.length
    : 0.45; // mặc định thận trọng khi chưa có dữ liệu

  const out: DemandForecast[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(todayISO, i);
    const season = seasonFor(date);
    const weekend = isWeekendNight(date);
    const key = `${season}|${weekend ? "we" : "wd"}`;
    const samples = buckets.get(key) ?? [];
    const dataPoints = samples.length;
    const reasons: string[] = [];

    // 1) Lấp đầy nền
    let baseline: number;
    if (dataPoints >= 3) {
      baseline = samples.reduce((s, v) => s + v, 0) / dataPoints;
      reasons.push(`Lịch sử ${dataPoints} ngày tương tự: ${Math.round(baseline * 100)}%`);
    } else {
      // Ít dữ liệu → dùng trung bình chung điều chỉnh theo hệ số mùa
      const sm = DEFAULT_RATE_PLAN.seasonMultipliers[season] ?? 1;
      baseline = Math.min(0.95, globalAvg * sm);
      reasons.push(`Chưa đủ lịch sử — ước theo mùa ${SEASON_LABELS[season]}`);
    }

    // 2) Pickup: càng gần ngày, số đặt thêm càng ít
    const booked = occupiedCount(date, bookings) / totalRooms;
    const leadDays = i;
    // Đường cong đặt phòng: ~65% đơn về trong 14 ngày cuối
    const pickupRatio = leadDays <= 1 ? 0.05 : leadDays <= 3 ? 0.15 : leadDays <= 7 ? 0.3 : leadDays <= 14 ? 0.5 : 0.7;
    const headroom = Math.max(0, baseline - booked);
    let forecast = booked + headroom * pickupRatio + (baseline - booked > 0 ? 0 : 0);

    // Nếu đã đặt vượt baseline → tin số thật, cộng thêm pickup nhỏ
    if (booked >= baseline) {
      forecast = Math.min(1, booked + (1 - booked) * pickupRatio * 0.4);
      reasons.push(`Đã đặt ${Math.round(booked * 100)}% — cao hơn cùng kỳ`);
    }

    // 3) Sự kiện
    const { lift, names } = eventLiftFor(date, events);
    if (lift > 0) {
      forecast = Math.min(1, forecast * (1 + lift));
      reasons.push(`${names.join(", ")} → +${Math.round(lift * 100)}% nhu cầu`);
    }

    if (weekend) reasons.push("Cuối tuần");

    // 4) Độ tin cậy: nhiều dữ liệu + gần ngày = tin hơn
    const dataScore = Math.min(1, dataPoints / 10);
    const horizonScore = leadDays <= 7 ? 1 : leadDays <= 30 ? 0.75 : 0.5;
    const confidence = Math.round(Math.max(0.2, dataScore * 0.6 + horizonScore * 0.4) * 100) / 100;

    out.push({
      date,
      forecastOccupancy: Math.round(Math.min(1, forecast) * 100) / 100,
      bookedOccupancy: Math.round(booked * 100) / 100,
      expectedPickup: Math.max(0, Math.round((forecast - booked) * totalRooms)),
      season,
      weekend,
      events: names,
      confidence,
      dataPoints,
      reasons,
    });
  }

  logger.info("revenueAI", `Dự báo ${days} ngày từ ${todayISO}`, {
    avgConfidence: out.reduce((s, f) => s + f.confidence, 0) / out.length,
  });

  return out;
}

/* ======================================================================
 * 2. ĐỀ XUẤT GIÁ
 * ==================================================================== */

export interface PriceRecommendation {
  date: string;
  typeId: string;
  typeName: string;
  currentPrice: number;
  recommendedPrice: number;
  deltaPercent: number;
  forecastOccupancy: number;
  /** RevPAR dự kiến nếu áp giá đề xuất */
  expectedRevPar: number;
  currentRevPar: number;
  confidence: number;
  action: "increase" | "decrease" | "hold";
  reasons: string[];
  /** Cần người duyệt trước khi áp dụng? */
  requiresApproval: boolean;
}

/**
 * Đề xuất giá tối ưu.
 *
 * Nguyên lý: RevPAR = ADR × tỷ lệ lấp đầy. Tăng giá làm giảm lấp đầy (độ co
 * giãn cầu ~ -0.6 với khách sạn tầm trung). Ta dò các mức giá và chọn mức
 * cho RevPAR cao nhất, sau đó clamp bằng floor/ceiling của bảng giá.
 */
export function recommendPrices(args: {
  roomTypes: RoomType[];
  rooms: Room[];
  forecasts: DemandForecast[];
  plan?: RatePlan;
  /** Độ co giãn cầu theo giá (âm) */
  elasticity?: number;
}): PriceRecommendation[] {
  const { roomTypes, rooms, forecasts } = args;
  const plan = args.plan ?? DEFAULT_RATE_PLAN;
  const elasticity = args.elasticity ?? -0.6;
  const out: PriceRecommendation[] = [];

  for (const f of forecasts) {
    for (const rt of roomTypes) {
      const roomsOfType = rooms.filter((r) => r.typeId === rt.id).length || 1;
      const base = rt.basePrice;
      const floor = base * plan.floorMultiplier;
      const ceiling = base * plan.ceilingMultiplier;

      let best = { price: base, revpar: base * f.forecastOccupancy };
      const currentRevPar = base * f.forecastOccupancy;

      // Dò từ -25% đến +80% theo bước 5%
      for (let pct = -0.25; pct <= 0.8; pct += 0.05) {
        const price = base * (1 + pct);
        if (price < floor || price > ceiling) continue;
        // Lấp đầy ước tính khi đổi giá
        const occ = Math.max(0, Math.min(1, f.forecastOccupancy * (1 + elasticity * pct)));
        const revpar = price * occ;
        if (revpar > best.revpar) best = { price, revpar };
      }

      const recommended = Math.round(best.price / 1000) * 1000;
      const deltaPercent = Math.round(((recommended - base) / base) * 100);
      const reasons: string[] = [];

      if (f.events.length) reasons.push(`Sự kiện: ${f.events.join(", ")}`);
      reasons.push(`Dự báo lấp đầy ${Math.round(f.forecastOccupancy * 100)}%`);
      if (f.weekend) reasons.push("Cuối tuần");
      reasons.push(SEASON_LABELS[f.season]);
      if (Math.abs(deltaPercent) >= 20) reasons.push("Biên độ lớn — nên có người duyệt");

      out.push({
        date: f.date,
        typeId: rt.id,
        typeName: rt.name,
        currentPrice: base,
        recommendedPrice: recommended,
        deltaPercent,
        forecastOccupancy: f.forecastOccupancy,
        expectedRevPar: Math.round(best.revpar),
        currentRevPar: Math.round(currentRevPar),
        confidence: f.confidence,
        action: deltaPercent > 2 ? "increase" : deltaPercent < -2 ? "decrease" : "hold",
        reasons,
        // An toàn: giảm giá mạnh hoặc tăng mạnh hoặc ít dữ liệu → phải có người duyệt
        requiresApproval: Math.abs(deltaPercent) >= 20 || f.confidence < 0.5,
      });
    }
  }

  return out;
}

/** Tóm tắt tác động doanh thu để hiển thị 1 dòng cho quản lý. */
export function summarizeUplift(recs: PriceRecommendation[], rooms: Room[]): {
  currentRevenue: number;
  projectedRevenue: number;
  upliftPercent: number;
  daysAffected: number;
} {
  const roomCount = rooms.length || 1;
  const byDate = new Map<string, PriceRecommendation[]>();
  for (const r of recs) {
    const arr = byDate.get(r.date) ?? [];
    arr.push(r);
    byDate.set(r.date, arr);
  }

  let current = 0;
  let projected = 0;
  let daysAffected = 0;

  for (const [, list] of byDate) {
    const c = list.reduce((s, r) => s + r.currentRevPar, 0) / list.length;
    const p = list.reduce((s, r) => s + r.expectedRevPar, 0) / list.length;
    current += c * roomCount;
    projected += p * roomCount;
    if (list.some((r) => r.action !== "hold")) daysAffected++;
  }

  return {
    currentRevenue: Math.round(current),
    projectedRevenue: Math.round(projected),
    upliftPercent: current ? Math.round(((projected - current) / current) * 100) : 0,
    daysAffected,
  };
}

/* ======================================================================
 * 3. DỰ ĐOÁN NO-SHOW / HỦY PHÒNG
 * ==================================================================== */

export interface NoShowPrediction {
  bookingId: string;
  code: string;
  /** 0..1 */
  risk: number;
  level: "low" | "medium" | "high";
  factors: string[];
  /** Hành động đề xuất cho lễ tân */
  suggestedAction: string;
  confidence: number;
}

/**
 * Điểm rủi ro no-show dựa trên các yếu tố đã được chứng minh trong ngành:
 *  - Chưa đặt cọc → rủi ro cao nhất (yếu tố mạnh nhất)
 *  - Đặt qua OTA rẻ, miễn phí hủy → rủi ro cao hơn đặt trực tiếp
 *  - Đặt sờm hàng tháng → dễ đổi kế hoạch
 *  - Khách mới (chưa từng ở) → rủi ro cao hơn khách quen
 *  - Ở 1 đêm → dễ bỏ hơn ở dài
 */
export function predictNoShow(args: {
  bookings: Booking[];
  /** Lịch sử để biết khách quen hay mới */
  allBookings?: Booking[];
  now?: Date;
}): NoShowPrediction[] {
  const now = args.now ?? new Date();
  const history = args.allBookings ?? args.bookings;
  const todayISO = toISODate(now);

  const staysByCustomer = new Map<string, number>();
  for (const b of history) {
    if (b.status === "checked_out") {
      staysByCustomer.set(b.customerId, (staysByCustomer.get(b.customerId) ?? 0) + 1);
    }
  }

  const out: NoShowPrediction[] = [];

  for (const b of args.bookings) {
    if (b.status !== "reserved" && b.status !== "pending") continue;
    if (b.checkIn < todayISO) continue;

    let risk = 0.08; // nền ~8% cho ngành
    const factors: string[] = [];

    if (!b.depositPaid) {
      risk += 0.28;
      factors.push("Chưa đặt cọc (+28%)");
    } else {
      risk -= 0.04;
      factors.push("Đã đặt cọc (−4%)");
    }

    if (b.source === "ota") {
      risk += 0.1;
      factors.push("Đặt qua OTA (+10%)");
    }
    if (b.source === "phone") {
      risk += 0.06;
      factors.push("Đặt qua điện thoại (+6%)");
    }

    const leadDays = Math.round((new Date(b.checkIn).getTime() - now.getTime()) / 86_400_000);
    if (leadDays > 45) {
      risk += 0.09;
      factors.push(`Đặt trước ${leadDays} ngày (+9%)`);
    } else if (leadDays <= 2) {
      risk -= 0.05;
      factors.push("Sắp đến (−5%)");
    }

    const stays = staysByCustomer.get(b.customerId) ?? 0;
    if (stays === 0) {
      risk += 0.07;
      factors.push("Khách mới (+7%)");
    } else if (stays >= 3) {
      risk -= 0.08;
      factors.push(`Khách quen ${stays} lần (−8%)`);
    }

    const nights = Math.round(
      (new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / 86_400_000,
    );
    if (nights <= 1) {
      risk += 0.05;
      factors.push("Chỉ 1 đêm (+5%)");
    }

    if (b.status === "pending") {
      risk += 0.12;
      factors.push("Chưa được duyệt (+12%)");
    }

    risk = Math.max(0.02, Math.min(0.92, risk));
    const level = risk >= 0.4 ? "high" : risk >= 0.2 ? "medium" : "low";

    const suggestedAction =
      level === "high"
        ? !b.depositPaid
          ? "Gọi xác nhận và yêu cầu đặt cọc trong 24h, nếu không thì nhả phòng bán lại."
          : "Gọi xác nhận giờ đến trước 1 ngày."
        : level === "medium"
          ? "Gửi SMS/email nhắc xác nhận trước 1 ngày."
          : "Không cần hành động thêm.";

    // Ít thông tin → độ tin cậy thấp hơn
    const confidence = Math.round((0.55 + Math.min(0.35, stays * 0.1) + (b.source ? 0.05 : 0)) * 100) / 100;

    out.push({ bookingId: b.id, code: b.code, risk: Math.round(risk * 100) / 100, level, factors, suggestedAction, confidence });
  }

  return out.sort((a, b) => b.risk - a.risk);
}

/* ---------------------------------------------------------- OVERBOOKING --*/

export interface OverbookingAdvice {
  date: string;
  /** Số phòng nên nhận vượt sức chứa */
  suggestedOverbook: number;
  expectedNoShows: number;
  /** Xác suất phải đền bù (walk guest sang khách sạn khác) */
  walkRisk: number;
  /** Chi phí dự kiến nếu phải đền bù */
  estimatedWalkCost: number;
  /** Doanh thu thêm kỳ vọng */
  expectedGain: number;
  recommendation: string;
  safe: boolean;
}

/**
 * Tính mức overbooking an toàn.
 *
 * CÓ CHỦ Ý BẢO THỦ: chỉ đề xuất khi lợi ích kỳ vọng > 2× chi phí đền bù. Đuổi
 * khách đã đặt phòng là thảm họa thương hiệu, không phải bài toán số học thuần.
 */
export function adviseOverbooking(args: {
  forecasts: DemandForecast[];
  predictions: NoShowPrediction[];
  bookings: Booking[];
  rooms: Room[];
  avgRoomRate: number;
  /** Chi phí đền bù 1 khách (phòng khách sạn khác + taxi + xin lỗi) */
  walkCostPerGuest?: number;
}): OverbookingAdvice[] {
  const { forecasts, predictions, bookings, rooms, avgRoomRate } = args;
  const walkCost = args.walkCostPerGuest ?? avgRoomRate * 2.5;
  const total = rooms.length || 1;
  const riskByBooking = new Map(predictions.map((p) => [p.bookingId, p.risk]));

  return forecasts.map((f) => {
    const arriving = bookings.filter((b) => b.status === "reserved" && b.checkIn === f.date);
    const expectedNoShows = arriving.reduce((s, b) => s + (riskByBooking.get(b.id) ?? 0.08), 0);

    // Chỉ overbook khi gần full — vắng thì không có lý do
    const nearFull = f.forecastOccupancy >= 0.9;
    const raw = nearFull ? Math.floor(expectedNoShows * 0.6) : 0; // chỉ nhận 60% kỳ vọng
    const suggested = Math.max(0, Math.min(raw, Math.ceil(total * 0.05))); // tối đa 5% số phòng

    // Xác suất phải đền bù: nếu số no-show thực < số overbook
    const walkRisk = suggested === 0 ? 0 : Math.max(0, Math.min(1, 1 - expectedNoShows / (suggested + 1)));
    const estimatedWalkCost = Math.round(walkRisk * suggested * walkCost);
    const expectedGain = Math.round(suggested * avgRoomRate * (1 - walkRisk));
    const safe = suggested > 0 && expectedGain > estimatedWalkCost * 2 && f.confidence >= 0.5;

    return {
      date: f.date,
      suggestedOverbook: safe ? suggested : 0,
      expectedNoShows: Math.round(expectedNoShows * 10) / 10,
      walkRisk: Math.round(walkRisk * 100) / 100,
      estimatedWalkCost,
      expectedGain,
      safe,
      recommendation: !nearFull
        ? "Không cần overbooking — còn phòng trống."
        : f.confidence < 0.5
          ? "Không đủ dữ liệu để overbooking an toàn. Nên giữ nguyên."
          : safe
            ? `Có thể nhận thêm ${suggested} phòng. Chuẩn bị sẵn phương án chuyển khách sạn đối tác.`
            : "Lợi ích không bù đủ rủi ro đền bù — không nên overbooking.",
    };
  });
}
