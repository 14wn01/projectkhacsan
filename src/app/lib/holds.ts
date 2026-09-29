/**
 * GIỮ CHỖ TẠM THỜI (HOLD) — CHỐNG DOUBLE-BOOKING
 *
 * Bài toán thật: hai khách cùng mở trang, cùng thấy "phòng 201 trống", cùng
 * bấm đặt. Nếu chỉ kiểm tra trùng lúc lưu → người sau bị từ chối sau khi đã
 * nhập hết thông tin và chuyển tiền cọc. Rất tệ.
 *
 * Cách giải: ngay khi khách chọn phòng → tạo HOLD có thời hạn (TTL 15 phút).
 * Trong thời gian đó phòng bị khóa với mọi phiên khác. Hết hạn → tự nhả.
 *
 * Phía backend thật, hold này nên là một dòng trong bảng `room_holds` có
 * UNIQUE constraint + `SELECT ... FOR UPDATE` (xem docs/API.md).
 */
import { uid, isISODate } from "./format";
import { logger } from "./logger";
import type { Booking, RoomHold } from "./types";

/** Thời gian giữ phòng để khách hoàn tất đặt cọc. */
export const HOLD_TTL_MINUTES = 15;

/** ID phiên trình duyệt — để phân biệt "hold của tôi" vs "hold của người khác". */
const SESSION_KEY = "smh.sessionId";

export function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uid("sess");
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // Trình duyệt chặn storage — vẫn hoạt động được trong phiên hiện tại
    return "sess_ephemeral";
  }
}

/* ------------------------------------------------------------ TRẠNG THÁI --*/

export function isHoldActive(h: RoomHold, now: Date = new Date()): boolean {
  if (h.releasedAt) return false;
  if (h.convertedBookingId) return false;
  return new Date(h.expiresAt).getTime() > now.getTime();
}

export function activeHolds(holds: RoomHold[], now: Date = new Date()): RoomHold[] {
  return holds.filter((h) => isHoldActive(h, now));
}

/** Thời gian còn lại (ms). Âm/0 = đã hết hạn. */
export function remainingMs(h: RoomHold, now: Date = new Date()): number {
  return Math.max(0, new Date(h.expiresAt).getTime() - now.getTime());
}

/** "04:37" — dùng cho đồng hồ đếm ngược trên UI. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Tách hold còn hiệu lực và hold đã hết hạn (dọn định kỳ). */
export function pruneHolds(
  holds: RoomHold[],
  now: Date = new Date(),
): { kept: RoomHold[]; expired: RoomHold[] } {
  const kept: RoomHold[] = [];
  const expired: RoomHold[] = [];
  for (const h of holds) {
    if (isHoldActive(h, now) || h.convertedBookingId) kept.push(h);
    else if (h.releasedAt) kept.push(h);
    else expired.push({ ...h, releasedAt: now.toISOString() });
  }
  if (expired.length) {
    logger.info("holds", `Tự động nhả ${expired.length} lượt giữ phòng hết hạn`, {
      ids: expired.map((h) => h.id),
    });
  }
  return { kept: [...kept, ...expired], expired };
}

/* ------------------------------------------------------------- TRÙNG LẶP --*/

function overlaps(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  // [checkIn, checkOut) — trả phòng cùng ngày người khác nhận là KHÔNG trùng
  return aIn < bOut && bIn < aOut;
}

/**
 * Tìm hold đang chặn một yêu cầu đặt phòng.
 * Bỏ qua hold của chính phiên đang hỏi (`ignoreSessionId`) — khách không tự chặn mình.
 */
export function findHoldConflict(
  holds: RoomHold[],
  roomId: string,
  checkIn: string,
  checkOut: string,
  ignoreSessionId?: string,
  now: Date = new Date(),
): RoomHold | null {
  return (
    activeHolds(holds, now).find(
      (h) =>
        h.roomId === roomId &&
        h.sessionId !== ignoreSessionId &&
        overlaps(checkIn, checkOut, h.checkIn, h.checkOut),
    ) ?? null
  );
}

/** Lọc ra các phòng đang bị phiên khác giữ — dùng khi hiển thị phòng trống. */
export function heldRoomIds(
  holds: RoomHold[],
  checkIn: string,
  checkOut: string,
  ignoreSessionId?: string,
  now: Date = new Date(),
): Set<string> {
  const out = new Set<string>();
  for (const h of activeHolds(holds, now)) {
    if (h.sessionId === ignoreSessionId) continue;
    if (overlaps(checkIn, checkOut, h.checkIn, h.checkOut)) out.add(h.roomId);
  }
  return out;
}

/* -------------------------------------------------------------- TẠO/NHẢ --*/

export interface CreateHoldInput {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  sessionId?: string;
  customerId?: string;
  ttlMinutes?: number;
}

export type HoldResult =
  | { ok: true; hold: RoomHold }
  | { ok: false; reason: "held_by_other" | "booked" | "invalid_dates"; message: string };

/**
 * Tạo hold sau khi kiểm tra đủ 2 lớp: booking đã xác nhận VÀ hold của phiên khác.
 * Trả về kết quả có kiểu rõ ràng thay vì ném lỗi — UI dễ hiển thị thông điệp.
 */
export function createHold(
  holds: RoomHold[],
  bookings: Booking[],
  input: CreateHoldInput,
  now: Date = new Date(),
): HoldResult {
  const { roomId, checkIn, checkOut, guests } = input;

  if (!isISODate(checkIn) || !isISODate(checkOut) || checkIn >= checkOut || !Number.isInteger(guests) || guests < 1) {
    return { ok: false, reason: "invalid_dates", message: "Ngày trả phòng phải sau ngày nhận phòng." };
  }

  const blocking = new Set(["reserved", "checked_in"]);
  const booked = bookings.find(
    (b) => b.roomId === roomId && (blocking.has(b.status) || (b.status === "pending" && b.depositPaid)) && overlaps(checkIn, checkOut, b.checkIn, b.checkOut),
  );
  if (booked) {
    return { ok: false, reason: "booked", message: "Phòng này đã có khách trong khoảng ngày bạn chọn." };
  }

  const sessionId = input.sessionId ?? getSessionId();
  const conflict = findHoldConflict(holds, roomId, checkIn, checkOut, sessionId, now);
  if (conflict) {
    const mins = Math.ceil(remainingMs(conflict, now) / 60000);
    return {
      ok: false,
      reason: "held_by_other",
      message: `Khách khác đang giữ phòng này. Vui lòng thử lại sau ${mins} phút hoặc chọn phòng khác.`,
    };
  }

  const ttl = input.ttlMinutes ?? HOLD_TTL_MINUTES;
  const hold: RoomHold = {
    id: uid("hold"),
    roomId,
    checkIn,
    checkOut,
    guests,
    sessionId,
    customerId: input.customerId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttl * 60_000).toISOString(),
  };

  logger.info("holds", "Đã giữ phòng tạm thời", { roomId, checkIn, checkOut, ttl });
  return { ok: true, hold };
}

/** Nhả hold (khách bấm hủy hoặc đóng dialog). */
export function releaseHold(holds: RoomHold[], holdId: string, now: Date = new Date()): RoomHold[] {
  return holds.map((h) => (h.id === holdId && !h.releasedAt ? { ...h, releasedAt: now.toISOString() } : h));
}

/** Đánh dấu hold đã chuyển thành booking thật. */
export function consumeHold(holds: RoomHold[], holdId: string, bookingId: string): RoomHold[] {
  return holds.map((h) => (h.id === holdId ? { ...h, convertedBookingId: bookingId } : h));
}

/** Nhả toàn bộ hold của một phiên (khi khách rời trang). */
export function releaseSessionHolds(
  holds: RoomHold[],
  sessionId: string,
  now: Date = new Date(),
): RoomHold[] {
  return holds.map((h) =>
    h.sessionId === sessionId && !h.releasedAt && !h.convertedBookingId
      ? { ...h, releasedAt: now.toISOString() }
      : h,
  );
}
