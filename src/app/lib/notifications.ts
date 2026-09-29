/**
 * THÔNG BÁO TỰ ĐỘNG QUA EMAIL / SMS
 *
 * Gồm 3 phần:
 *  1. Mẫu nội dung (template) — tách riêng để marketing sửa không cần lập trình
 *  2. Bộ định lịch (scheduler) — tính xem đến lúc phải gửi cái gì
 *  3. Transport — hiện là mock; production thay bằng SendGrid/SES + Twilio/eSMS
 *
 * Backend thật: đưa vào queue (BullMQ/SQS) và chạy cron — KHÔNG gửi từ trình
 * duyệt vì khách đóng tab là mất lịch gửi.
 */
import { formatDate, formatVND, uid } from "./format";
import { logger } from "./logger";
import { supabase } from "./supabase";
import type { Booking, Customer, NotificationChannel, NotificationKind, NotificationLog } from "./types";

export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  booking_confirmation: "Xác nhận đặt phòng",
  deposit_reminder: "Nhắc đặt cọc",
  pre_arrival: "Nhắc trước ngày đến",
  post_stay: "Cảm ơn & xin đánh giá",
  cancellation: "Thông báo hủy phòng",
  payment_receipt: "Biên nhận thanh toán",
};

/* ---------------------------------------------------------- TEMPLATES --*/

export interface TemplateContext {
  hotelName: string;
  booking: Booking;
  customer: Customer;
  roomLabel: string;
  roomTypeName: string;
  total: number;
  hotline?: string;
}

export interface RenderedMessage {
  subject: string;
  body: string;
  /** SMS phải ngắn — tính phí theo 160 ký tự */
  sms: string;
}

const HOTLINE_FALLBACK = "0900 000 000";

export function renderTemplate(kind: NotificationKind, ctx: TemplateContext): RenderedMessage {
  const { hotelName, booking: b, customer: c, roomLabel, roomTypeName, total } = ctx;
  const hotline = ctx.hotline ?? HOTLINE_FALLBACK;
  const inD = formatDate(b.checkIn);
  const outD = formatDate(b.checkOut);
  const deposit = b.depositAmount ?? 0;
  const remaining = Math.max(0, total - (b.depositPaid ? deposit : 0));

  switch (kind) {
    case "booking_confirmation":
      return {
        subject: `[${hotelName}] Xác nhận đặt phòng ${b.code}`,
        body: `Kính gửi ${c.name},

${hotelName} đã nhận được đặt phòng của Quý khách.

• Mã đặt phòng: ${b.code}
• Phòng: ${roomLabel} (${roomTypeName})
• Nhận phòng: ${inD} từ 14:00
• Trả phòng: ${outD} trước 12:00
• Số khách: ${b.guests}
• Tổng tiền dự kiến: ${formatVND(total)}
• Đã cọc: ${b.depositPaid ? formatVND(deposit) : "chưa thanh toán"}
• Còn lại thanh toán khi nhận phòng: ${formatVND(remaining)}

Vui lòng mang theo CCCD/Passport khi nhận phòng.
Mọi thay đổi xin liên hệ hotline ${hotline}.

Trân trọng,
${hotelName}`,
        sms: `${hotelName}: Da xac nhan dat phong ${b.code}, phong ${roomLabel}, ${inD}-${outD}. Tong ${formatVND(total)}. LH ${hotline}`,
      };

    case "deposit_reminder":
      return {
        subject: `[${hotelName}] Nhắc thanh toán đặt cọc — ${b.code}`,
        body: `Kính gửi ${c.name},

Đặt phòng ${b.code} của Quý khách chưa hoàn tất đặt cọc.

• Số tiền cần cọc: ${formatVND(deposit)}
• Nội dung chuyển khoản: COC ${b.code}

Phòng chỉ được giữ sau khi chúng tôi nhận được tiền cọc. Nếu Quý khách đã
chuyển, vui lòng bỏ qua email này.

Trân trọng,
${hotelName}`,
        sms: `${hotelName}: Dat phong ${b.code} chua coc ${formatVND(deposit)}. Vui long chuyen khoan noi dung COC ${b.code} de giu phong.`,
      };

    case "pre_arrival":
      return {
        subject: `[${hotelName}] Chúng tôi đã sẵn sàng đón Quý khách ngày ${inD}`,
        body: `Kính gửi ${c.name},

Chỉ còn 1 ngày nữa là tới kỳ nghỉ của Quý khách tại ${hotelName}.

• Mã đặt phòng: ${b.code}
• Phòng: ${roomLabel} (${roomTypeName})
• Nhận phòng: ${inD} từ 14:00

Quý khách có muốn đặt thêm đưa đón sân bay hoặc bữa sáng? Chỉ cần phản hồi
email này hoặc gọi ${hotline}.

Hẹn gặp lại Quý khách!
${hotelName}`,
        sms: `${hotelName}: Hen gap Quy khach ngay mai ${inD}, phong ${roomLabel}, ma ${b.code}. Nhan phong tu 14:00. LH ${hotline}`,
      };

    case "post_stay":
      return {
        subject: `[${hotelName}] Cảm ơn Quý khách — xin 1 phút đánh giá`,
        body: `Kính gửi ${c.name},

Cảm ơn Quý khách đã lưu trú tại ${hotelName} từ ${inD} đến ${outD}.

Nếu có 1 phút, xin Quý khách đánh giá để chúng tôi phục vụ tốt hơn. Góp ý của
Quý khách được đọc trực tiếp bởi quản lý khách sạn.

Lần sau quay lại, Quý khách được ưu tiên nâng hạng phòng nếu còn trống.

Trân trọng,
${hotelName}`,
        sms: `${hotelName}: Cam on Quy khach da luu tru. Xin danh gia giup chung toi phuc vu tot hon. Tran trong!`,
      };

    case "cancellation":
      return {
        subject: `[${hotelName}] Đã hủy đặt phòng ${b.code}`,
        body: `Kính gửi ${c.name},

Đặt phòng ${b.code} (${inD} – ${outD}) đã được hủy.
${b.cancelReason ? `Lý do: ${b.cancelReason}\n` : ""}
Nếu Quý khách đã đặt cọc, khoản hoàn lại sẽ được xử lý theo chính sách hủy
phòng trong 3–7 ngày làm việc.

Mọi thắc mắc xin liên hệ ${hotline}.

Trân trọng,
${hotelName}`,
        sms: `${hotelName}: Dat phong ${b.code} da huy. Hoan coc theo chinh sach trong 3-7 ngay lam viec. LH ${hotline}`,
      };

    case "payment_receipt":
      return {
        subject: `[${hotelName}] Biên nhận thanh toán — ${b.code}`,
        body: `Kính gửi ${c.name},

Chúng tôi đã nhận được thanh toán cho đặt phòng ${b.code}.

• Số tiền đã nhận: ${formatVND(b.depositPaid ? deposit : total)}
• Còn lại: ${formatVND(remaining)}

Hóa đơn điện tử sẽ được gửi sau khi Quý khách trả phòng.

Trân trọng,
${hotelName}`,
        sms: `${hotelName}: Da nhan thanh toan cho ${b.code}. Con lai ${formatVND(remaining)}. Cam on Quy khach!`,
      };
  }
}

/* --------------------------------------------------------- TRANSPORT --*/

export interface NotificationTransport {
  send: (msg: { channel: NotificationChannel; to: string; subject?: string; body: string }) => Promise<void>;
}

/** Edge Function Transport — Gửi mail qua Supabase Edge Function */
const edgeFunctionTransport: NotificationTransport = {
  async send(msg) {
    if (!msg.to) throw new Error("Thiếu địa chỉ người nhận");
    
    if (msg.channel === "email") {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: msg.to,
          subject: msg.subject,
          body: msg.body
        }
      });

      if (error) {
        logger.error("notify", "Lỗi gửi email qua Edge Function", error);
        throw error;
      }
      
      logger.info("notify", `Đã gửi email → ${msg.to}`, { subject: msg.subject });
    } else {
      // SMS tạm thời mock (có thể tích hợp Twilio/eSMS sau)
      await new Promise((r) => setTimeout(r, 250));
      logger.info("notify", `[MOCK] Gửi SMS → ${msg.to}`, { subject: msg.subject });
    }
  },
};

let transport: NotificationTransport = edgeFunctionTransport;
export function setTransport(t: NotificationTransport) {
  transport = t;
}

/** Đẩy vào hàng đợi. Không bao giờ ném lỗi ra ngoài — gửi thất bại không được chặn check-in. */
export async function sendNotification(args: {
  channel: NotificationChannel;
  kind: NotificationKind;
  to: string;
  message: RenderedMessage;
  bookingId?: string;
}): Promise<NotificationLog> {
  const { channel, kind, to, message, bookingId } = args;
  const body = channel === "sms" ? message.sms : message.body;

  const log: NotificationLog = {
    id: uid("ntf"),
    channel,
    kind,
    to,
    subject: channel === "email" ? message.subject : undefined,
    body,
    state: "queued",
    createdAt: new Date().toISOString(),
    bookingId,
  };

  try {
    await transport.send({ channel, to, subject: log.subject, body });
    return { ...log, state: "sent", sentAt: new Date().toISOString() };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Lỗi gửi không xác định";
    logger.warn("notify", "Gửi thông báo thất bại — sẽ thử lại", { channel, to, error });
    return { ...log, state: "failed", error };
  }
}

/** Gửi lại các thông báo đã thất bại (nút "Gửi lại" trong trang Vận hành). */
export async function retryFailed(logs: NotificationLog[]): Promise<NotificationLog[]> {
  const out: NotificationLog[] = [];
  for (const l of logs) {
    if (l.state !== "failed") {
      out.push(l);
      continue;
    }
    try {
      await transport.send({ channel: l.channel, to: l.to, subject: l.subject, body: l.body });
      out.push({ ...l, state: "sent", sentAt: new Date().toISOString(), error: undefined });
    } catch (err) {
      out.push({ ...l, error: err instanceof Error ? err.message : "Vẫn lỗi" });
    }
  }
  return out;
}

/* --------------------------------------------------------- SCHEDULER --*/

export interface DueNotification {
  bookingId: string;
  kind: NotificationKind;
  reason: string;
}

/** Nhắc cọc nếu quá số giờ này mà chưa thanh toán */
export const DEPOSIT_REMINDER_HOURS = 6;

/**
 * Tính danh sách thông báo đến hạn phải gửi.
 * `alreadySent` giúp không gửi trùng (quan trọng: khách rất ghét spam).
 */
export function dueNotifications(
  bookings: Booking[],
  alreadySent: NotificationLog[],
  now: Date = new Date(),
): DueNotification[] {
  const sentKeys = new Set(
    alreadySent.filter((l) => l.state !== "failed").map((l) => `${l.bookingId}|${l.kind}`),
  );
  const todayISO = now.toISOString().slice(0, 10);
  const tomorrowISO = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  const out: DueNotification[] = [];

  const push = (bookingId: string, kind: NotificationKind, reason: string) => {
    if (!sentKeys.has(`${bookingId}|${kind}`)) out.push({ bookingId, kind, reason });
  };

  for (const b of bookings) {
    if (b.status === "cancelled") continue;

    // Nhắc đặt cọc
    if (!b.depositPaid && (b.depositAmount ?? 0) > 0 && b.status !== "checked_out") {
      const ageH = (now.getTime() - new Date(b.createdAt).getTime()) / 3_600_000;
      if (ageH >= DEPOSIT_REMINDER_HOURS) {
        push(b.id, "deposit_reminder", `Đặt ${Math.round(ageH)} giờ trước, chưa cọc`);
      }
    }

    // Nhắc trước 1 ngày
    if (b.status === "reserved" && b.checkIn === tomorrowISO) {
      push(b.id, "pre_arrival", "Nhận phòng ngày mai");
    }

    // Xin đánh giá sau khi trả phòng
    if (b.status === "checked_out" && b.checkOut <= todayISO) {
      push(b.id, "post_stay", "Đã trả phòng");
    }
  }

  return out;
}
