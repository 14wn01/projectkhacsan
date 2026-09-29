/**
 * DỮ LIỆU MẪU CHO CÁC TÍNH NĂNG MỞ RỘNG
 *
 * Tách riêng khỏi seed.ts để dễ xóa khi đưa vào chạy thật:
 * chỉ cần thay các hàm ở đây bằng lời gọi API backend.
 */
import { addDays, toISODate, uid } from "./format";
import { DEFAULT_RATE_PLAN } from "./pricing";
import type {
  ChannelAccount,
  LocalEvent,
  LoyaltyAccount,
  PriceOverride,
  RatePlan,
  Review,
} from "./types";

const today = toISODate(new Date());

/* ------------------------------------------------------------ BẢNG GIÁ --*/

export const seedRatePlans: RatePlan[] = [
  DEFAULT_RATE_PLAN,
  {
    id: "rp_conservative",
    name: "Bảng giá thận trọng (biên độ hẹp)",
    weekendMultiplier: 1.08,
    seasonMultipliers: { low: 0.92, shoulder: 1, high: 1.1, peak: 1.2 },
    occupancySteps: [
      { from: 0, multiplier: 0.96 },
      { from: 0.6, multiplier: 1 },
      { from: 0.85, multiplier: 1.08 },
    ],
    floorMultiplier: 0.85,
    ceilingMultiplier: 1.35,
    active: false,
  },
];

export const seedPriceOverrides: PriceOverride[] = [
  {
    id: "po1",
    typeId: "rt3",
    date: addDays(today, 5),
    price: 1800000,
    reason: "Đã chốt giá với đoàn khách công ty",
    createdBy: "Nguyễn Quản Trị",
    createdAt: addDays(today, -2),
  },
];

/* --------------------------------------------------- SỰ KIỆN ĐỊA PHƯƠNG --*/

export const seedLocalEvents: LocalEvent[] = [
  {
    id: "ev1",
    name: "Lễ hội pháo hoa quốc tế",
    startDate: addDays(today, 6),
    endDate: addDays(today, 8),
    demandLift: 0.35,
    note: "Khu vực trung tâm kín phòng từ 2 tuần trước",
  },
  {
    id: "ev2",
    name: "Hội chợ triển lãm thương mại",
    startDate: addDays(today, 14),
    endDate: addDays(today, 16),
    demandLift: 0.22,
    note: "Khách công tác, thường đặt sát ngày",
  },
  {
    id: "ev3",
    name: "Concert ca nhạc lớn",
    startDate: addDays(today, 21),
    endDate: addDays(today, 22),
    demandLift: 0.28,
  },
];

/* -------------------------------------------------------- KÊNH BÁN OTA --*/

export const seedChannels: ChannelAccount[] = [
  {
    id: "ch_web",
    channel: "website",
    name: "Website khách sạn",
    commissionRate: 0,
    connected: true,
    lastSyncAt: new Date().toISOString(),
    allotment: 999,
  },
  {
    id: "ch_booking",
    channel: "ota",
    name: "Booking.com",
    commissionRate: 0.15,
    connected: true,
    lastSyncAt: addDays(today, -1),
    allotment: 4,
  },
  {
    id: "ch_agoda",
    channel: "ota",
    name: "Agoda",
    commissionRate: 0.18,
    connected: true,
    lastSyncAt: addDays(today, -1),
    allotment: 3,
  },
  {
    id: "ch_traveloka",
    channel: "ota",
    name: "Traveloka",
    commissionRate: 0.16,
    connected: false,
    allotment: 2,
  },
  {
    id: "ch_phone",
    channel: "phone",
    name: "Điện thoại / Zalo",
    commissionRate: 0,
    connected: true,
    allotment: 999,
  },
  {
    id: "ch_walkin",
    channel: "walk_in",
    name: "Khách vào trực tiếp",
    commissionRate: 0,
    connected: true,
    allotment: 999,
  },
];

/* ------------------------------------------------------------- LOYALTY --*/

export const seedLoyaltyAccounts: LoyaltyAccount[] = [
  { customerId: "c1", points: 1850, tier: "gold", lifetimeSpend: 24500000, stays: 7, updatedAt: addDays(today, -2) },
  { customerId: "c2", points: 620, tier: "silver", lifetimeSpend: 8200000, stays: 3, updatedAt: addDays(today, -5) },
  { customerId: "c3", points: 140, tier: "member", lifetimeSpend: 3400000, stays: 2, updatedAt: addDays(today, -9) },
  { customerId: "c4", points: 0, tier: "member", lifetimeSpend: 1700000, stays: 1, updatedAt: addDays(today, -10) },
  { customerId: "c5", points: 3200, tier: "platinum", lifetimeSpend: 56000000, stays: 14, updatedAt: addDays(today, -3) },
];

/* ------------------------------------------------------------- ĐÁNH GIÁ --*/

/**
 * Đánh giá mẫu trải trên nhiều nền tảng, có chủ đề lặp lại (điều hòa, wifi)
 * để module cảnh báo chất lượng có gì thật mà phát hiện.
 */
export const seedReviews: Review[] = [
  {
    id: "rv1",
    platform: "booking_com",
    customerName: "Phạm Văn An",
    bookingId: "b5",
    rating: 5,
    text: "Phòng rất sạch sẽ và thơm, nhân viên lễ tân cực kỳ nhiệt tình. Vị trí tốt, đi bộ ra biển 5 phút. Chắc chắn sẽ quay lại.",
    createdAt: addDays(today, -4),
    replied: true,
  },
  {
    id: "rv2",
    platform: "agoda",
    customerName: "Nguyễn Thị Bình",
    rating: 2,
    text: "Điều hòa phòng 203 kêu rất to, cả đêm khó ngủ. Đã báo lễ tân nhưng phải chờ rất lâu mới có người lên xem.",
    createdAt: addDays(today, -6),
    replied: false,
  },
  {
    id: "rv3",
    platform: "google",
    customerName: "Trần Minh Châu",
    rating: 3,
    text: "Phòng ổn, bữa sáng ngon nhưng wifi khá yếu ở tầng 3, làm việc online hơi khó.",
    createdAt: addDays(today, -8),
    replied: false,
  },
  {
    id: "rv4",
    platform: "traveloka",
    customerName: "Lê Hoàng Dũng",
    rating: 4,
    text: "Đáng tiền so với giá. Nhân viên thân thiện, phòng rộng. Chỉ tiếc là điều hòa hơi cũ.",
    createdAt: addDays(today, -11),
    replied: true,
  },
  {
    id: "rv5",
    platform: "booking_com",
    customerName: "Võ Thị Em",
    rating: 1,
    text: "Rất thất vọng. Phòng có mùi ẩm mốc, thái độ nhân viên ca đêm thô lỗ khi tôi yêu cầu đổi phòng.",
    createdAt: addDays(today, -13),
    replied: false,
  },
  {
    id: "rv6",
    platform: "website",
    customerName: "Đặng Thu Hà",
    rating: 5,
    text: "Tuyệt vời! Check in nhanh, phòng đẹp hơn ảnh, view biển rất đáng. Sẽ giới thiệu cho bạn bè.",
    createdAt: addDays(today, -16),
    replied: true,
  },
  {
    id: "rv7",
    platform: "agoda",
    customerName: "Hoàng Minh Tuấn",
    rating: 2,
    text: "Wifi gần như không dùng được, điều hòa không lạnh. Giá này mà chất lượng vậy thì không đáng.",
    createdAt: addDays(today, -19),
    replied: false,
  },
  {
    id: "rv8",
    platform: "google",
    customerName: "Bùi Thị Lan",
    rating: 4,
    text: "Vị trí trung tâm rất tiện, phòng sạch. Buổi tối hơi ồn vì gần đường lớn.",
    createdAt: addDays(today, -24),
    replied: true,
  },
  {
    id: "rv9",
    platform: "booking_com",
    customerName: "Ngô Đức Thắng",
    rating: 5,
    text: "Nhân viên chu đáo, hỗ trợ đưa đón sân bay rất chuyên nghiệp. Bữa sáng buffet phong phú.",
    createdAt: addDays(today, -38),
    replied: true,
  },
  {
    id: "rv10",
    platform: "traveloka",
    customerName: "Lý Hồng Nhung",
    rating: 5,
    text: "Phòng suite rộng và yên tĩnh, hồ bơi sạch. Vượt mong đợi so với giá.",
    createdAt: addDays(today, -45),
    replied: true,
  },
  {
    id: "rv11",
    platform: "website",
    customerName: "Phan Quốc Huy",
    rating: 4,
    text: "Ổn, đáng tiền. Thủ tục nhận phòng nhanh gọn.",
    createdAt: addDays(today, -52),
    replied: true,
  },
  {
    id: "rv12",
    platform: "google",
    customerName: "Trịnh Bảo Ngọc",
    rating: 5,
    text: "Hoàn hảo cho gia đình. Phòng rộng, nhân viên lịch sự, khu vực trẻ em an toàn.",
    createdAt: addDays(today, -58),
    replied: true,
  },
];

/** Tạo id đánh giá mới ở phía client. */
export function newReviewId(): string {
  return uid("rv");
}
