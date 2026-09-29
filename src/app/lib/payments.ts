/**
 * CỔNG THANH TOÁN (VNPay / Momo / Stripe / Chuyển khoản / Tiền mặt)
 *
 * Kiến trúc: mọi cổng đều cài interface `PaymentGateway`. Toàn bộ app chỉ gọi
 * qua `charge()` / `refund()` nên khi thay cổng thật, chỉ cần viết lại một adapter
 * mà KHÔNG sửa UI hay store.
 *
 * ⚠️ BẢO MẬT — ĐỌC TRƯỚC KHI ĐƯA LÊN PRODUCTION:
 *  - Ở đây là MOCK chạy trên trình duyệt. Thực tế BẮT BUỘC tạo phiên thanh toán
 *    ở BACKEND: secret key không bao giờ được có trong bundle frontend.
 *  - Trạng thái "đã thanh toán" chỉ được chủt qua WEBHOOK có xác thực chữ ký
 *    (VNPay: vnp_SecureHash HMAC-SHA512; Momo: signature; Stripe: Stripe-Signature).
 *    KHÔNG tin returnUrl vì người dùng có thể tự gọi.
 *  - PCI-DSS: không nhận/lưu số thẻ trên hệ thống của mình. Dùng Stripe Elements /
 *    trang thanh toán của cổng. Chỉ lưu 4 số cuối (`cardLast4`).
 */
import { uid } from "./format";
import { logger } from "./logger";
import { withRetry, withTimeout } from "./concurrency";
import type { Booking, ChannelAccount, Payment, PaymentMethod, PaymentPurpose } from "./types";

/* ------------------------------------------------------------- INTERFACE --*/

export interface ChargeRequest {
  bookingId: string;
  amount: number;
  purpose: PaymentPurpose;
  description: string;
  /** Email/SDT khách — cổng thật dùng để gửi biên nhận */
  customerContact?: string;
  invoiceId?: string;
  recordedBy?: string;
}

export interface ChargeResult {
  gatewayRef: string;
  /** Thành công ngay (tiền mặt) hay cần khách xác nhận tiếp (ví điện tử) */
  state: "succeeded" | "pending" | "failed";
  /** URL chuyển hướng tới cổng (cổng thật sẽ trả về) */
  redirectUrl?: string;
  /** Mã QR cho chuyển khoản / ví */
  qrPayload?: string;
  failureReason?: string;
  cardLast4?: string;
}

export interface PaymentGateway {
  id: PaymentMethod;
  name: string;
  /** Mô tả ngắn hiển thị cho khách */
  hint: string;
  supportsRefund: boolean;
  /** Cần khách rời trang để xác nhận? */
  redirects: boolean;
  charge: (req: ChargeRequest) => Promise<ChargeResult>;
  refund: (gatewayRef: string, amount: number) => Promise<{ ok: boolean; refundRef?: string; error?: string }>;
}

/* ----------------------------------------------------------- MOCK ENGINE --*/

/** Đặt false trong unit test để không phụ thuộc ngẫu nhiên/thời gian. */
export const DEMO_PAYMENTS = import.meta.env.VITE_DEMO_PAYMENTS === "true";
export const paymentSimulation = { enabled: true, failureRate: 0.06, latencyMs: 700 };

async function simulate<T>(value: T, failMsg: string): Promise<T> {
  if (!paymentSimulation.enabled) return value;
  await new Promise((r) => setTimeout(r, paymentSimulation.latencyMs));
  if (Math.random() < paymentSimulation.failureRate) {
    throw new Error(failMsg);
  }
  return value;
}

function makeGateway(
  id: PaymentMethod,
  name: string,
  hint: string,
  opts: { redirects: boolean; supportsRefund: boolean; instant?: boolean },
): PaymentGateway {
  return {
    id,
    name,
    hint,
    redirects: opts.redirects,
    supportsRefund: opts.supportsRefund,
    async charge(req) {
      const ref = `${id.toUpperCase()}-${uid("tx").slice(4).toUpperCase()}`;
      logger.info("payments", `Tạo giao dịch ${name}`, { ref, amount: req.amount, purpose: req.purpose });
      const result: ChargeResult = {
        gatewayRef: ref,
        state: opts.instant ? "succeeded" : "pending",
        redirectUrl: opts.redirects ? `https://sandbox.${id}.vn/pay?ref=${ref}` : undefined,
        qrPayload: opts.redirects || id === "bank_transfer" ? `${id}|${ref}|${req.amount}` : undefined,
      };
      return simulate(result, `Cổng ${name} tạm thời không phản hồi. Vui lòng thử lại.`);
    },
    async refund(gatewayRef, amount) {
      if (!opts.supportsRefund) {
        return { ok: false, error: `${name} không hỗ trợ hoàn tiền tự động — xử lý thủ công tại quầy.` };
      }
      logger.info("payments", `Hoàn tiền ${name}`, { gatewayRef, amount });
      return simulate({ ok: true, refundRef: `RF-${uid("rf").slice(4).toUpperCase()}` }, "Hoàn tiền thất bại.");
    },
  };
}

const bankTransferGateway: PaymentGateway = {
  id: "bank_transfer",
  name: "Chuyển khoản",
  hint: "VietQR / số tài khoản — lễ tân đối chiếu sao kê rồi ghi nhận",
  redirects: false,
  supportsRefund: false,
  async charge(req) {
    const ref = `CK-${uid("tx").slice(4).toUpperCase()}`;
    logger.info("payments", "Tạo lệnh chuyển khoản", { ref, amount: req.amount, purpose: req.purpose });
    return { gatewayRef: ref, state: "pending" };
  },
  async refund() {
    return { ok: false, error: "Hoàn chuyển khoản xử lý thủ công trên Internet Banking của khách sạn." };
  },
};

export const GATEWAYS: Record<PaymentMethod, PaymentGateway> = {
  vnpay: makeGateway("vnpay", "VNPay", "Thẻ ATM / Internet Banking / QR", { redirects: true, supportsRefund: true }),
  momo: makeGateway("momo", "MoMo", "Ví điện tử MoMo", { redirects: true, supportsRefund: true }),
  stripe: makeGateway("stripe", "Stripe", "Thẻ quốc tế Visa / Mastercard", { redirects: true, supportsRefund: true }),
  bank_transfer: bankTransferGateway,
  cash: makeGateway("cash", "Tiền mặt", "Thu tại quầy lễ tân", {
    redirects: false,
    supportsRefund: true,
    instant: true,
  }),
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  vnpay: "VNPay",
  momo: "MoMo",
  stripe: "Stripe",
  bank_transfer: "Chuyển khoản",
  cash: "Tiền mặt",
};

export const PAYMENT_PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  deposit: "Đặt cọc",
  balance: "Thanh toán phần còn lại",
  full: "Thanh toán toàn bộ",
  refund: "Hoàn tiền",
};

/* --------------------------------------------------------- LỚP NGHIỆP VỤ --*/

/**
 * Khởi tạo một giao dịch. Luôn bọc timeout + retry để mạng chậm không làm
 * khách mất đơn. Trả về bản ghi Payment để store lưu lại.
 */
export async function createPayment(method: PaymentMethod, req: ChargeRequest): Promise<Payment> {
  const gw = GATEWAYS[method];
  if (!gw) throw new Error(`Phương thức thanh toán không hợp lệ: ${method}`);
  if (!Number.isFinite(req.amount) || req.amount <= 0) throw new Error("Số tiền thanh toán phải lớn hơn 0.");

  const now = new Date().toISOString();
  const base: Omit<Payment, "state" | "gatewayRef"> = {
    id: uid("pay"),
    bookingId: req.bookingId,
    invoiceId: req.invoiceId,
    method,
    purpose: req.purpose,
    amount: req.amount,
    createdAt: now,
    recordedBy: req.recordedBy,
  };

  try {
    const res = await withRetry(() => withTimeout(gw.charge(req), 10000, `Thanh toán ${gw.name}`), {
      attempts: 2,
      label: `Thanh toán ${gw.name}`,
    });
    return {
      ...base,
      state: res.state === "failed" ? "failed" : res.state,
      gatewayRef: res.gatewayRef,
      completedAt: res.state === "succeeded" ? new Date().toISOString() : undefined,
      failureReason: res.failureReason,
      cardLast4: res.cardLast4,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi cổng thanh toán";
    logger.error("payments", "Giao dịch thất bại", err);
    // Không ném lỗi — vẫn trả bản ghi failed để có dấu vết đối soát
    return { ...base, state: "failed", gatewayRef: `FAILED-${uid("f").slice(2)}`, failureReason: message };
  }
}

/** Chứng thực webhook (mock). Backend thật phải verify HMAC. */
export function confirmPayment(p: Payment, succeeded: boolean, reason?: string): Payment {
  logger.info("payments", succeeded ? "Xác nhận thanh toán thành công" : "Thanh toán bị từ chối", {
    ref: p.gatewayRef,
  });
  return {
    ...p,
    state: succeeded ? "succeeded" : "failed",
    completedAt: new Date().toISOString(),
    failureReason: succeeded ? undefined : (reason ?? "Khách hủy giao dịch"),
  };
}

export async function refundPayment(p: Payment): Promise<Payment> {
  const gw = GATEWAYS[p.method];
  const res = await gw.refund(p.gatewayRef, p.amount);
  if (!res.ok) throw new Error(res.error ?? "Hoàn tiền thất bại");
  return { ...p, state: "refunded", completedAt: new Date().toISOString() };
}

/** Tổng đã thu thực tế cho một đặt phòng (chỉ tính giao dịch thành công). */
export function paidTotal(payments: Payment[], bookingId: string): number {
  return payments
    .filter((p) => p.bookingId === bookingId && p.state === "succeeded")
    .reduce((s, p) => s + (p.purpose === "refund" ? -p.amount : p.amount), 0);
}

/* ------------------------------------------------------- ĐỐI SOÁT OTA --*/

export interface ReconciliationRow {
  channel: string;
  bookings: number;
  grossRevenue: number;
  commissionRate: number;
  commission: number;
  netRevenue: number;
  /** Đơn chưa thu đủ tiền — cần kiểm tra */
  unsettled: number;
}

/**
 * Đối soát doanh thu theo kênh: tính hoa hồng OTA và số thực nhận.
 * Dùng cho trang Kênh OTA và báo cáo kế toán.
 */
export function reconcileChannels(
  bookings: Booking[],
  payments: Payment[],
  channels: ChannelAccount[],
  bookingTotalOf: (b: Booking) => number,
): ReconciliationRow[] {
  const rows: ReconciliationRow[] = [];

  for (const ch of channels) {
    const list = bookings.filter((b) => (b.source ?? "website") === ch.channel && b.status !== "cancelled");
    const gross = list.reduce((s, b) => s + bookingTotalOf(b), 0);
    const commission = Math.round(gross * ch.commissionRate);
    const unsettled = list.filter((b) => paidTotal(payments, b.id) < bookingTotalOf(b)).length;

    rows.push({
      channel: ch.name,
      bookings: list.length,
      grossRevenue: gross,
      commissionRate: ch.commissionRate,
      commission,
      netRevenue: gross - commission,
      unsettled,
    });
  }

  return rows.sort((a, b) => b.grossRevenue - a.grossRevenue);
}

/* ------------------------------------------------------ HÓA ĐƠN ĐIỆN TỬ --*/

export const VAT_RATE = 0.08; // Thuế GTGT dịch vụ lưu trú — sửa theo quy định hiện hành

/**
 * Sinh số hóa đơn điện tử theo mẫu phổ biến: Kýhiệu/Năm + số tuần tự.
 * Thực tế số này do nhà cung cấp hóa đơn điện tử (Viettel, VNPT, MISA…) cấp.
 */
export function nextEInvoiceNo(existingCount: number, date = new Date()): string {
  const yy = String(date.getFullYear()).slice(2);
  return `1C${yy}TSM-${String(existingCount + 1).padStart(6, "0")}`;
}

export function splitVat(total: number, rate = VAT_RATE): { net: number; vat: number; gross: number } {
  // Giá niêm yết ở VN thường đã gồm VAT → tách ngược
  const net = Math.round(total / (1 + rate));
  return { net, vat: total - net, gross: total };
}
