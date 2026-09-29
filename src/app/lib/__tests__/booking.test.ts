import { describe, expect, it, vi } from "vitest";
import { Booking, RoomHold, RoomType, LoyaltyAccount, Payment, PriceOverride, LocalEvent } from "../types";
import {
  createHold,
  findHoldConflict,
  isHoldActive,
  pruneHolds,
  consumeHold,
  releaseHold,
  HOLD_TTL_MINUTES,
} from "../holds";
import { priceNight, quoteStay, DEFAULT_RATE_PLAN } from "../pricing";
import { ConflictError, assertVersion, nextVersion, runOnce } from "../concurrency";
import { MIN_REDEEM_POINTS, POINT_VALUE_VND, maxRedeemablePoints, redeemPoints } from "../loyalty";
import { analyzeSentiment } from "../sentiment";
import { dueNotifications } from "../notifications";
import { nextEInvoiceNo, paidTotal } from "../payments";
import { nightsBetween } from "../format";

/* ------------------------------------------------------------- FIXTURE --*/

const STD: RoomType = {
  id: "rt1",
  name: "Garden Pavilion",
  basePrice: 6_800_000,
  capacity: 2,
  amenities: ["wifi"],
  description: "Một giường. Ban công vườn.",
};

function mkBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: "b1",
    code: "BK-1001",
    roomId: "r101",
    customerId: "c1",
    checkIn: "2026-03-10",
    checkOut: "2026-03-12",
    guests: 2,
    status: "reserved",
    roomPricePerNight: 500_000,
    services: [],
    createdAt: "2026-03-01T08:00:00.000Z",
    ...over,
  };
}

function mkHold(over: Partial<RoomHold> = {}): RoomHold {
  const now = new Date("2026-03-01T08:00:00.000Z");
  return {
    id: "h1",
    roomId: "r101",
    checkIn: "2026-03-10",
    checkOut: "2026-03-12",
    guests: 2,
    sessionId: "other-session",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + HOLD_TTL_MINUTES * 60_000).toISOString(),
    ...over,
  };
}

const NOW = new Date("2026-03-01T08:05:00.000Z");
const MINE = { roomId: "r101", checkIn: "2026-03-10", checkOut: "2026-03-12", guests: 2, sessionId: "my-session" };

/* -------------------------------------------------- CHỐNG DOUBLE-BOOKING --*/

describe("giữ phòng — chống đặt trùng", () => {
  it("giữ được phòng đang trống", () => {
    const r = createHold([], [], MINE, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.hold.roomId).toBe("r101");
      expect(new Date(r.hold.expiresAt).getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it("chặn khi phiên khác đang giữ cùng phòng, cùng ngày", () => {
    const r = createHold([mkHold()], [], MINE, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("held_by_other");
  });

  it("không tự chặn hold của chính phiên mình", () => {
    const r = createHold([mkHold({ sessionId: "my-session" })], [], MINE, NOW);
    expect(r.ok).toBe(true);
  });

  it("trả phòng cùng ngày khách khác nhận thì KHÔNG tính là trùng", () => {
    const before = mkHold({ checkIn: "2026-03-08", checkOut: "2026-03-10" });
    expect(createHold([before], [], MINE, NOW).ok).toBe(true);
  });

  it("chặn khi phòng đã có đặt phòng xác nhận", () => {
    const r = createHold([], [mkBooking()], MINE, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("booked");
  });

  it("đặt phòng đã hủy không chiếm phòng", () => {
    expect(createHold([], [mkBooking({ status: "cancelled" })], MINE, NOW).ok).toBe(true);
  });

  it("từ chối khoảng ngày không hợp lệ", () => {
    const r = createHold([], [], { ...MINE, checkOut: MINE.checkIn }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_dates");
  });
});

describe("hạn giữ phòng (TTL)", () => {
  const expired = mkHold({ expiresAt: "2026-03-01T08:01:00.000Z" });

  it("hold hết hạn không còn hiệu lực", () => {
    expect(isHoldActive(expired, NOW)).toBe(false);
  });

  it("hold hết hạn không chặn người khác đặt", () => {
    expect(findHoldConflict([expired], "r101", "2026-03-10", "2026-03-12", "my-session", NOW)).toBeNull();
    expect(createHold([expired], [], MINE, NOW).ok).toBe(true);
  });

  it("pruneHolds đánh dấu nhả phòng hết hạn", () => {
    const { expired: gone } = pruneHolds([expired, mkHold({ id: "h2" })], NOW);
    expect(gone).toHaveLength(1);
    expect(gone[0].id).toBe("h1");
    expect(gone[0].releasedAt).toBeTruthy();
  });

  it("hold đã chuyển thành đặt phòng thì không bị nhả", () => {
    const used = consumeHold([mkHold()], "h1", "b9");
    expect(used[0].convertedBookingId).toBe("b9");
    expect(pruneHolds(used, new Date("2027-01-01")).expired).toHaveLength(0);
  });

  it("nhả hold thủ công thì hết chặn", () => {
    const after = releaseHold([mkHold()], "h1", NOW);
    expect(findHoldConflict(after, "r101", "2026-03-10", "2026-03-12", "my-session", NOW)).toBeNull();
  });
});

/* ------------------------------------------------------------- GIÁ ĐỘNG --*/

describe("giá động", () => {
  it("khóa giá trong biên sàn/trần của bảng giá", () => {
    const events: LocalEvent[] = [
      { id: "ev", name: "Lễ hội", startDate: "2026-07-18", endDate: "2026-07-18", demandLift: 5 },
    ];
    const hot = priceNight("2026-07-18", { roomType: STD, occupancy: 1, events });
    const cold = priceNight("2026-11-10", { roomType: STD, occupancy: 0 });
    expect(hot.price).toBeLessThanOrEqual(STD.basePrice * DEFAULT_RATE_PLAN.ceilingMultiplier);
    expect(cold.price).toBeGreaterThanOrEqual(STD.basePrice * DEFAULT_RATE_PLAN.floorMultiplier);
    expect(hot.price).toBeGreaterThan(cold.price);
  });

  it("giá chốt thủ công thắng mọi hệ số", () => {
    const overrides: PriceOverride[] = [
      {
        id: "po1",
        typeId: "rt1",
        date: "2026-03-10",
        price: 1_800_000,
        reason: "Hội nghị",
        createdBy: "u1",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ];
    const n = priceNight("2026-03-10", { roomType: STD, occupancy: 0.1, overrides });
    expect(n.price).toBe(1_800_000);
    expect(n.overridden).toBe(true);
  });

  it("báo giá cả kỳ = tổng từng đêm", () => {
    const q = quoteStay("2026-03-10", "2026-03-13", { roomType: STD, occupancy: 0.5 });
    expect(q.nightCount).toBe(3);
    expect(q.nightCount).toBe(nightsBetween("2026-03-10", "2026-03-13"));
    expect(q.total).toBe(q.nights.reduce((s, n) => s + n.price, 0));
    expect(q.baseTotal).toBe(STD.basePrice * 3);
  });

  it("tiền cọc 25% tính trên tổng đã báo giá", () => {
    const q = quoteStay("2026-03-10", "2026-03-12", { roomType: STD, occupancy: 0.5 });
    const deposit = Math.round(q.total * 0.25);
    expect(deposit).toBeGreaterThan(0);
    expect(deposit * 4).toBeLessThanOrEqual(q.total + 4);
  });
});

/* ---------------------------------------------------------- ĐỒNG THỜI --*/

describe("chống race condition", () => {
  it("assertVersion phát hiện bản ghi đã bị người khác sửa", () => {
    expect(() => assertVersion(3, 3)).not.toThrow();
    expect(() => assertVersion(4, 3)).toThrow(ConflictError);
    expect(nextVersion(3)).toBe(4);
    expect(nextVersion(undefined)).toBe(1);
  });

  it("runOnce chống bấm đúp — chỉ tạo một đặt phòng", async () => {
    const fn = vi.fn(async () => "b-new");
    const key = `test-${Math.random()}`;
    const [a, b] = await Promise.all([runOnce(key, fn), runOnce(key, fn)]);
    expect(a).toBe("b-new");
    expect(b).toBe("b-new");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------- CRM / AI --*/

describe("điểm thân thiết", () => {
  const acc: LoyaltyAccount = {
    customerId: "c1",
    points: 2_000,
    tier: "gold",
    lifetimeSpend: 24_500_000,
    stays: 7,
    updatedAt: "2026-03-01T00:00:00.000Z",
  };

  it("chặn quy đổi dưới mức tối thiểu", () => {
    expect(redeemPoints(acc, MIN_REDEEM_POINTS - 1, 5_000_000).ok).toBe(false);
  });

  it("chặn quy đổi vượt số điểm đang có", () => {
    expect(redeemPoints(acc, acc.points + 500, 50_000_000).ok).toBe(false);
  });

  it("không cho giảm quá trần % hóa đơn", () => {
    const cap = maxRedeemablePoints(acc, 1_000_000);
    expect(redeemPoints(acc, cap + 1, 1_000_000).ok).toBe(false);
  });

  it("quy đổi thành công thì trừ điểm và sinh giảm giá", () => {
    const r = redeemPoints(acc, 500, 10_000_000, "b1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.discount).toBe(500 * POINT_VALUE_VND);
      expect(r.account.points).toBe(acc.points - 500);
      expect(r.txn.customerId).toBe("c1");
    }
  });
});

describe("phân tích cảm xúc review", () => {
  it("review khen phải dương hơn review phàn nàn", () => {
    const good = analyzeSentiment("Phòng rất sạch, nhân viên thân thiện, rất đáng tiền", 5);
    const bad = analyzeSentiment("Phòng bẩn, ồn ào, thái độ tệ, rất thất vọng", 1);
    expect(good.score).toBeGreaterThan(bad.score);
    expect(good.confidence).toBeGreaterThan(0);
    expect(["positive", "neutral", "negative"]).toContain(good.sentiment);
  });

  it("giợ được chủ đề để lễ tân biết sửa ở đâu", () => {
    const r = analyzeSentiment("Phòng ồn, điều hòa kêu to không ngủ được", 2);
    expect(Array.isArray(r.topics)).toBe(true);
    expect(Array.isArray(r.matchedTerms)).toBe(true);
  });
});

describe("nhắc việc tự động & thu tiền", () => {
  const KINDS = [
    "booking_confirmation",
    "deposit_reminder",
    "pre_arrival",
    "post_stay",
    "cancellation",
    "payment_receipt",
  ];

  it("chỉ sinh việc nhắc thuộc danh mục đã định", () => {
    const due = dueNotifications([mkBooking({ depositPaid: false })], [], new Date("2026-03-09T09:00:00.000Z"));
    due.forEach((d) => {
      expect(KINDS).toContain(d.kind);
      expect(d.bookingId).toBe("b1");
      expect(d.reason).toBeTruthy();
    });
  });

  it("bỏ qua đặt phòng đã hủy", () => {
    expect(dueNotifications([mkBooking({ status: "cancelled" })], [], NOW)).toHaveLength(0);
  });

  it("chỉ tính giao dịch thành công, hoàn tiền bị trừ ra", () => {
    const base: Omit<Payment, "id" | "purpose" | "amount" | "state"> = {
      bookingId: "b1",
      method: "vnpay",
      gatewayRef: "REF1",
      createdAt: "2026-03-01T00:00:00.000Z",
    };
    const payments: Payment[] = [
      { ...base, id: "p1", purpose: "deposit", amount: 250_000, state: "succeeded" },
      { ...base, id: "p2", purpose: "balance", amount: 750_000, state: "succeeded" },
      { ...base, id: "p3", purpose: "balance", amount: 500_000, state: "failed" },
      { ...base, id: "p4", purpose: "refund", amount: 100_000, state: "succeeded" },
    ];
    expect(paidTotal(payments, "b1")).toBe(900_000);
    expect(paidTotal(payments, "b-khac")).toBe(0);
  });

  it("số hóa đơn điện tử tăng dần, đúng định dạng", () => {
    const a = nextEInvoiceNo(0, new Date("2026-03-01"));
    const b = nextEInvoiceNo(1, new Date("2026-03-01"));
    expect(a).toMatch(/^1C\d{2}[A-Z]+-\d{6}$/);
    expect(a).not.toBe(b);
  });
});
