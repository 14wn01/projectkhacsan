export type Role = "admin" | "manager" | "reception" | "accountant" | "guest";

export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: Role;
  /** SĐT liên hệ (tài khoản khách) */
  phone?: string;
  email?: string;
  /** Hồ sơ khách hàng gắn với tài khoản khách */
  customerId?: string;
  /** Ảnh đại diện dạng data URL (đã nén 256px) — trang Tài khoản của tôi */
  avatar?: string;
  /** Chức danh hiển thị, ví dụ "Trưởng ca lễ tân" */
  jobTitle?: string;
}

export interface RoomType {
  id: string;
  name: string;
  basePrice: number; // giá / đêm (VND)
  capacity: number;
  amenities: string[];
  description: string;
  image?: string; // ảnh minh họa (cổng đặt phòng)
  size?: number; // m², optional for existing saved room types
}

export type RoomStatus = "available" | "occupied" | "cleaning" | "maintenance";

export interface Room {
  id: string;
  number: string;
  floor: number;
  typeId: string;
  status: RoomStatus;
  note?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  idNumber: string; // CCCD/Passport
  address?: string;
  createdAt: string;
  /** CRM: sở thích / ghi chú cá nhân hóa (dùng cho AI upsell) */
  preferences?: string[];
  nationality?: string;
  dob?: string;
  /** Đánh dấu đã đồng ý chính sách bảo vệ dữ liệu cá nhân */
  consentAt?: string;
  marketingOptIn?: boolean;
}

export type BookingStatus =
  | "pending" // chờ duyệt (yêu cầu từ khách)
  | "reserved" // đã đặt (đã duyệt)
  | "checked_in" // đang ở
  | "checked_out" // đã trả
  | "cancelled"; // đã hủy / từ chối

/** Kênh tiếp nhận yêu cầu đặt phòng */
export type BookingSource = "website" | "phone" | "walk_in" | "ota";

export interface BookingService {
  serviceId: string;
  name: string;
  price: number;
  qty: number;
  date: string;
}

/** Nhật ký đổi / nâng phòng — đơn gốc không bị hủy. */
export interface RoomMove {
  at: string;
  fromRoomId: string;
  toRoomId: string;
  keepRate: boolean;
  surcharge: number;
  note?: string;
}

export interface Booking {
  id: string;
  code: string;
  roomId: string;
  customerId: string;
  checkIn: string; // yyyy-mm-dd
  checkOut: string; // yyyy-mm-dd
  guests: number;
  status: BookingStatus;
  roomPricePerNight: number;
  services: BookingService[];
  createdAt: string;
  note?: string;
  source?: BookingSource; // kênh đặt (với yêu cầu từ khách)
  reviewedAt?: string; // thời điểm lễ tân duyệt/từ chối
  /** Đặt cọc giữ phòng (20–30% giá trị đặt phòng) */
  depositPercent?: number;
  depositAmount?: number;
  depositPaid?: boolean;
  depositPaidAt?: string;
  /** Giá từng đêm sau khi áp dụng giá động (dynamic pricing) */
  nightlyRates?: Array<{ date: string; price: number }>;
  /** Mã tham chiếu từ kênh OTA để đối soát */
  channelRef?: string;
  channelCommission?: number;
  /** Điểm rủi ro no-show do AI dự đoán (0..1) — chỉ mang tính tham khảo */
  noShowRisk?: number;
  cancelReason?: string;
  /** Phiên giữ chỗ đã chuyển thành đặt phòng này */
  holdId?: string;
  /** Khách đã nhận phòng thật hay không đến (no-show) */
  noShow?: boolean;
  /** Phiên bản bản ghi — dùng cho optimistic locking chống race condition */
  version?: number;
  /** Lịch sử đổi / nâng phòng */
  roomMoves?: RoomMove[];
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  category: "laundry" | "food" | "transport" | "other";
  price: number;
  unit: string;
}

export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface Invoice {
  id: string;
  code: string;
  bookingId: string;
  issuedAt: string;
  roomTotal: number;
  serviceTotal: number;
  discount: number;
  total: number;
  paid: number;
  status: PaymentStatus;
  /** Hóa đơn điện tử: mã tra cứu & thông tin phát hành */
  eInvoiceNo?: string;
  eInvoiceIssuedAt?: string;
  taxRate?: number;
  /** Điểm loyalty đã dùng để giảm trừ */
  pointsRedeemed?: number;
}

/* ===========================================================================
 * GIỮ CHỖ TẠM THỜI (HOLD) — chống double-booking khi nhiều người đặt cùng lúc
 * =========================================================================*/
export interface RoomHold {
  id: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  /** Phiên trình duyệt/thiết bị đang giữ chỗ */
  sessionId: string;
  createdAt: string;
  /** Hết hạn tự động nhả phòng (ISO) */
  expiresAt: string;
  customerId?: string;
  releasedAt?: string;
  convertedBookingId?: string;
}

/* ===========================================================================
 * GIÁ ĐỘNG (DYNAMIC PRICING)
 * =========================================================================*/
export type SeasonKind = "low" | "shoulder" | "high" | "peak";

export interface RatePlan {
  id: string;
  name: string;
  /** Áp dụng cho loại phòng nào; bỏ trống = toàn bộ */
  typeId?: string;
  weekendMultiplier: number;
  seasonMultipliers: Record<SeasonKind, number>;
  /** Hệ số theo tỷ lệ lấp đầy: mức lấp đầy → hệ số */
  occupancySteps: Array<{ from: number; multiplier: number }>;
  /** Chặn trên/dưới để giá AI không bao giờ vượt kiểm soát */
  floorMultiplier: number;
  ceilingMultiplier: number;
  active: boolean;
}

/** Giá chốt thủ công cho 1 ngày — luôn ưu tiên cao nhất (fallback cho AI) */
export interface PriceOverride {
  id: string;
  typeId: string;
  date: string;
  price: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

/** Sự kiện địa phương làm tăng nhu cầu (lễ, hội chợ, concert…) */
export interface LocalEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  /** Mức tăng nhu cầu kỳ vọng, 0.3 = +30% */
  demandLift: number;
  note?: string;
}

/* ===========================================================================
 * THANH TOÁN
 * =========================================================================*/
export type PaymentMethod = "vnpay" | "momo" | "stripe" | "bank_transfer" | "cash";
export type PaymentPurpose = "deposit" | "balance" | "full" | "refund";
export type PaymentState = "pending" | "succeeded" | "failed" | "refunded";

export interface Payment {
  id: string;
  bookingId: string;
  invoiceId?: string;
  method: PaymentMethod;
  purpose: PaymentPurpose;
  amount: number;
  state: PaymentState;
  /** Mã giao dịch tại cổng thanh toán — dùng để đối soát */
  gatewayRef: string;
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
  /** Ai thực hiện (khách tự thanh toán / nhân viên thu) */
  recordedBy?: string;
  /** Chỉ lưu 4 số cuối — tuân thủ PCI-DSS, KHÔNG lưu số thẻ đầy đủ */
  cardLast4?: string;
  /** Nội dung CK khách phải ghi — đối chiếu sao kê */
  transferContent?: string;
  /** Ghi chú khách khi báo đã chuyển */
  payerNote?: string;
}

/** Tài khoản nhận tiền chuyển khoản (VietQR). */
export interface BankAccount {
  bankName: string;
  /** Mã BIN NAPAS, ví dụ 970436 = Vietcombank */
  bankBin: string;
  accountNo: string;
  accountName: string;
  branch?: string;
}

/** Nguồn sao kê tiền vào. */
export type BankFeedProvider = "none" | "casso" | "sepay" | "manual";

export interface BankFeedConfig {
  provider: BankFeedProvider;
  /** API key Casso / token SePay — chỉ lưu trên máy, không commit. */
  apiKey: string;
  lastSyncAt?: string;
}

export type BankInflowMatch = "unmatched" | "matched" | "amount_mismatch" | "ignored";

/** Một dòng tiền vào (+) từ ngân hàng. */
export interface BankInflow {
  id: string;
  source: BankFeedProvider;
  amount: number;
  when: string;
  description: string;
  /** Mã giao dịch phía ngân hàng / Casso */
  tid: string;
  accountNo?: string;
  balanceAfter?: number;
  bookingCode?: string;
  matchedBookingId?: string;
  matchedPaymentId?: string;
  match: BankInflowMatch;
  ingestedAt: string;
}

/* ===========================================================================
 * KHÁCH HÀNG THÂN THIẾT (LOYALTY)
 * =========================================================================*/
export type LoyaltyTier = "member" | "silver" | "gold" | "platinum";

export interface LoyaltyAccount {
  customerId: string;
  points: number;
  tier: LoyaltyTier;
  lifetimeSpend: number;
  stays: number;
  updatedAt: string;
}

export interface LoyaltyTxn {
  id: string;
  customerId: string;
  bookingId?: string;
  /** Dương = tích điểm, âm = tiêu điểm */
  points: number;
  reason: string;
  createdAt: string;
}

/* ===========================================================================
 * ĐÁNH GIÁ & PHÂN TÍCH CẢM XÚC
 * =========================================================================*/
export type ReviewPlatform = "website" | "booking_com" | "agoda" | "traveloka" | "google";
export type Sentiment = "positive" | "neutral" | "negative";

export interface Review {
  id: string;
  platform: ReviewPlatform;
  customerName: string;
  bookingId?: string;
  rating: number; // 1..5
  text: string;
  createdAt: string;
  /** Kết quả AI — nhân viên có thể sửa lại (fallback thủ công) */
  sentiment?: Sentiment;
  topics?: string[];
  sentimentConfidence?: number;
  sentimentOverriddenBy?: string;
  replied?: boolean;
}

/* ===========================================================================
 * THÔNG BÁO EMAIL / SMS
 * =========================================================================*/
export type NotificationChannel = "email" | "sms";
export type NotificationKind =
  | "booking_confirmation"
  | "deposit_reminder"
  | "pre_arrival"
  | "post_stay"
  | "cancellation"
  | "payment_receipt";

export interface NotificationLog {
  id: string;
  channel: NotificationChannel;
  kind: NotificationKind;
  to: string;
  subject?: string;
  body: string;
  state: "queued" | "sent" | "failed";
  createdAt: string;
  sentAt?: string;
  error?: string;
  bookingId?: string;
}

/* ===========================================================================
 * KÊNH OTA & ĐỐI SOÁT
 * =========================================================================*/
export interface ChannelAccount {
  id: string;
  channel: BookingSource;
  name: string;
  /** Hoa hồng kênh, 0.15 = 15% */
  commissionRate: number;
  connected: boolean;
  lastSyncAt?: string;
  /** Số phòng phân bổ cho kênh (allotment) */
  allotment: number;
}

/* ===========================================================================
 * NHẬT KÝ KIỂM TOÁN (AUDIT LOG)
 * =========================================================================*/
export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
  detail?: string;
}

/* ===========================================================================
 * OCR GIẤY TỜ TÙY THÂN
 * =========================================================================*/
export interface IdDocumentData {
  fullName: string;
  idNumber: string;
  dob?: string;
  address?: string;
  nationality?: string;
  docType: "cccd" | "passport";
  /** Độ tin cậy OCR (0..1) — dưới ngưỡng phải nhập tay */
  confidence: number;
}
