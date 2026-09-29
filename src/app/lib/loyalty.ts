/**
 * CHƯƠNG TRÌNH KHÁCH HÀNG THÂN THIẾT (LOYALTY)
 *
 * Quy tắc được tách riêng khỏi UI để kế toán/quản lý có thể điều chỉnh 1 chỗ:
 *  - Tích điểm theo số tiền thực chi
 *  - Hạng xét theo tổng chi tiêu trọn đời (lifetime spend)
 *  - Điểm quy đổi thành tiền giảm trừ hóa đơn
 */
import { uid } from "./format";
import { logger } from "./logger";
import type { LoyaltyAccount, LoyaltyTier, LoyaltyTxn } from "./types";

/** 10.000đ chi tiêu = 1 điểm */
export const VND_PER_POINT = 10_000;
/** 1 điểm = 100đ khi quy đổi (tỷ lệ hoàn ~1%) */
export const POINT_VALUE_VND = 100;
/** Tối thiểu phải có 100 điểm mới được dùng */
export const MIN_REDEEM_POINTS = 100;
/** Không cho giảm quá 30% hóa đơn bằng điểm */
export const MAX_REDEEM_RATIO = 0.3;

export interface TierConfig {
  tier: LoyaltyTier;
  label: string;
  /** Ngưỡng tổng chi tiêu để đạt hạng */
  threshold: number;
  /** Hệ số tích điểm */
  earnMultiplier: number;
  /** Giảm giá phòng tự động */
  roomDiscount: number;
  perks: string[];
}

export const TIERS: TierConfig[] = [
  {
    tier: "member",
    label: "Thành viên",
    threshold: 0,
    earnMultiplier: 1,
    roomDiscount: 0,
    perks: ["Tích điểm mọi đơn", "Nhận ưu đãi qua email"],
  },
  {
    tier: "silver",
    label: "Bạc",
    threshold: 5_000_000,
    earnMultiplier: 1.2,
    roomDiscount: 0.03,
    perks: ["Giảm 3% giá phòng", "Nhận phòng sớm nếu còn trống"],
  },
  {
    tier: "gold",
    label: "Vàng",
    threshold: 20_000_000,
    earnMultiplier: 1.5,
    roomDiscount: 0.07,
    perks: ["Giảm 7% giá phòng", "Trả phòng muộn 14h", "1 bữa sáng miễn phí / đêm"],
  },
  {
    tier: "platinum",
    label: "Bạch kim",
    threshold: 50_000_000,
    earnMultiplier: 2,
    roomDiscount: 0.12,
    perks: ["Giảm 12% giá phòng", "Nâng hạng miễn phí nếu còn trống", "Đưa đón sân bay 1 chiều"],
  },
];

export function tierFor(lifetimeSpend: number): TierConfig {
  return [...TIERS].reverse().find((t) => lifetimeSpend >= t.threshold) ?? TIERS[0];
}

export function tierConfig(tier: LoyaltyTier): TierConfig {
  return TIERS.find((t) => t.tier === tier) ?? TIERS[0];
}

/** Còn bao nhiêu tiền nữa thì lên hạng — dùng để hiển thị động lực cho khách. */
export function nextTierProgress(lifetimeSpend: number): {
  current: TierConfig;
  next: TierConfig | null;
  remaining: number;
  percent: number;
} {
  const current = tierFor(lifetimeSpend);
  const idx = TIERS.findIndex((t) => t.tier === current.tier);
  const next = TIERS[idx + 1] ?? null;
  if (!next) return { current, next: null, remaining: 0, percent: 100 };
  const span = next.threshold - current.threshold;
  const done = lifetimeSpend - current.threshold;
  return {
    current,
    next,
    remaining: Math.max(0, next.threshold - lifetimeSpend),
    percent: span > 0 ? Math.min(100, Math.round((done / span) * 100)) : 0,
  };
}

export function emptyAccount(customerId: string): LoyaltyAccount {
  return {
    customerId,
    points: 0,
    tier: "member",
    lifetimeSpend: 0,
    stays: 0,
    updatedAt: new Date().toISOString(),
  };
}

/* --------------------------------------------------------------- TÍCH --*/

export interface AccrualResult {
  account: LoyaltyAccount;
  txn: LoyaltyTxn;
  /** True nếu khách vừa lên hạng — UI nên chúc mừng */
  tierUpgraded: boolean;
}

/** Tích điểm khi khách trả phòng / thanh toán xong. */
export function accruePoints(
  account: LoyaltyAccount,
  amountSpent: number,
  bookingId?: string,
): AccrualResult {
  const cfg = tierConfig(account.tier);
  const earned = Math.floor((amountSpent / VND_PER_POINT) * cfg.earnMultiplier);
  const lifetimeSpend = account.lifetimeSpend + amountSpent;
  const newTier = tierFor(lifetimeSpend).tier;

  const updated: LoyaltyAccount = {
    ...account,
    points: account.points + earned,
    lifetimeSpend,
    tier: newTier,
    stays: account.stays + (bookingId ? 1 : 0),
    updatedAt: new Date().toISOString(),
  };

  const txn: LoyaltyTxn = {
    id: uid("lty"),
    customerId: account.customerId,
    bookingId,
    points: earned,
    reason: `Tích điểm từ chi tiêu (hạng ${cfg.label}, ×${cfg.earnMultiplier})`,
    createdAt: new Date().toISOString(),
  };

  const tierUpgraded = newTier !== account.tier;
  if (tierUpgraded) logger.info("loyalty", "Khách lên hạng", { customerId: account.customerId, newTier });

  return { account: updated, txn, tierUpgraded };
}

/* --------------------------------------------------------------- TIÊU --*/

/** Số điểm tối đa được dùng cho một hóa đơn. */
export function maxRedeemablePoints(account: LoyaltyAccount, invoiceTotal: number): number {
  const capByInvoice = Math.floor((invoiceTotal * MAX_REDEEM_RATIO) / POINT_VALUE_VND);
  const usable = Math.min(account.points, capByInvoice);
  return usable >= MIN_REDEEM_POINTS ? usable : 0;
}

export function pointsToVND(points: number): number {
  return points * POINT_VALUE_VND;
}

export type RedeemResult =
  | { ok: true; account: LoyaltyAccount; txn: LoyaltyTxn; discount: number }
  | { ok: false; message: string };

export function redeemPoints(
  account: LoyaltyAccount,
  points: number,
  invoiceTotal: number,
  bookingId?: string,
): RedeemResult {
  if (points < MIN_REDEEM_POINTS) {
    return { ok: false, message: `Cần tối thiểu ${MIN_REDEEM_POINTS} điểm để quy đổi.` };
  }
  if (points > account.points) {
    return { ok: false, message: `Khách chỉ có ${account.points} điểm.` };
  }
  const cap = maxRedeemablePoints(account, invoiceTotal);
  if (points > cap) {
    return {
      ok: false,
      message: `Chỉ được giảm tối đa ${Math.round(MAX_REDEEM_RATIO * 100)}% hóa đơn (${cap} điểm).`,
    };
  }

  return {
    ok: true,
    discount: pointsToVND(points),
    account: { ...account, points: account.points - points, updatedAt: new Date().toISOString() },
    txn: {
      id: uid("lty"),
      customerId: account.customerId,
      bookingId,
      points: -points,
      reason: "Quy đổi điểm giảm trừ hóa đơn",
      createdAt: new Date().toISOString(),
    },
  };
}

/** Tặng điểm thủ công (xin lỗi khách, khuyến mãi…) — luôn có lý do để kiểm toán. */
export function adjustPoints(
  account: LoyaltyAccount,
  points: number,
  reason: string,
): { account: LoyaltyAccount; txn: LoyaltyTxn } {
  return {
    account: { ...account, points: Math.max(0, account.points + points), updatedAt: new Date().toISOString() },
    txn: {
      id: uid("lty"),
      customerId: account.customerId,
      points,
      reason,
      createdAt: new Date().toISOString(),
    },
  };
}
