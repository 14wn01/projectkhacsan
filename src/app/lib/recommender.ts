/**
 * AI GỢI Ý BÁN THÊM (UPSELL / CROSS-SELL RECOMMENDATION ENGINE)
 *
 * Bài toán thật: doanh thu ngoài tiền phòng (spa, tour, đưa đón, nâng hạng)
 * thường chiếm 15–30% tổng doanh thu nhưng bị bán theo cảm tính. Module này
 * xếp hạng gợi ý theo xác suất mua × giá trị, kèm câu chào sẵn cho lễ tân.
 *
 * PHƯƠNG PHÁP (hybrid, giải thích được):
 *  1. Content-based: đặc điểm kỳ lưu trú (số đêm, số khách, hạng phòng, mùa)
 *  2. Collaborative-lite: dịch vụ hay được mua cùng nhau trong lịch sử
 *  3. Cá nhân hóa: sở thích đã lưu + hạng thân thiết
 *
 * Đường thoát: gợi ý LUÔN chỉ là gợi ý — có `confidence` và lễ tân có thể
 * bỏ qua hoàn toàn. Không bao giờ tự động thêm dịch vụ vào hóa đơn.
 */
import { nightsBetween } from "./format";
import { seasonFor } from "./pricing";
import { tierConfig } from "./loyalty";
import type {
  Booking,
  Customer,
  LoyaltyAccount,
  RoomType,
  ServiceCatalogItem,
} from "./types";

export interface UpsellSuggestion {
  /** Dịch vụ hoặc "upgrade:<typeId>" */
  kind: "service" | "upgrade";
  id: string;
  title: string;
  /** Giá gợi ý (đã tính số lượng hợp lý) */
  price: number;
  /** Xác suất khách đồng ý (0..1) */
  probability: number;
  /** Giá trị kỳ vọng = giá × xác suất */
  expectedValue: number;
  reasons: string[];
  /** Câu chào sẵn cho lễ tân đọc */
  pitch: string;
  confidence: number;
}

/** Từ khóa nhận diện nhóm dịch vụ từ tên — không phụ thuộc ID cứng. */
const CATEGORY_HINTS: Array<{ re: RegExp; tag: string }> = [
  { re: /sáng|breakfast|buffet/i, tag: "breakfast" },
  { re: /tối|dinner|nhà hàng/i, tag: "dinner" },
  { re: /spa|massage|xông/i, tag: "spa" },
  { re: /tour|tham quan|du thuyền/i, tag: "tour" },
  { re: /đưa đón|sân bay|airport|shuttle/i, tag: "transfer" },
  { re: /xe máy|xe đạp|thuê xe|rental/i, tag: "rental" },
  { re: /giặt|laundry/i, tag: "laundry" },
  { re: /minibar|đồ uống|bia|nước/i, tag: "minibar" },
];

function tagOf(name: string): string {
  return CATEGORY_HINTS.find((h) => h.re.test(name))?.tag ?? "other";
}

export interface RecommendInput {
  booking: Booking;
  customer?: Customer;
  services: ServiceCatalogItem[];
  roomTypes: RoomType[];
  currentRoomTypeId?: string;
  /** Lịch sử toàn hệ thống để học luật đi kèm */
  allBookings?: Booking[];
  loyalty?: LoyaltyAccount;
  /** Số phòng trống theo loại — chỉ gợi nâng hạng khi còn phòng */
  availableByType?: Record<string, number>;
  limit?: number;
}

/**
 * Học "dịch vụ hay được mua cùng nhau" từ lịch sử (lift đơn giản).
 * Trả về tỷ lệ đơn có dịch vụ X trên tổng đơn.
 */
function popularity(allBookings: Booking[]): Map<string, number> {
  const counts = new Map<string, number>();
  let totalBookings = 0;
  for (const b of allBookings) {
    if (!b.services?.length) continue;
    totalBookings++;
    const seen = new Set(b.services.map((s) => s.serviceId));
    for (const id of seen) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const out = new Map<string, number>();
  if (totalBookings === 0) return out;
  for (const [id, c] of counts) out.set(id, c / totalBookings);
  return out;
}

export function recommendUpsells(input: RecommendInput): UpsellSuggestion[] {
  const { booking: b, customer, services, roomTypes } = input;
  const nights = Math.max(1, nightsBetween(b.checkIn, b.checkOut));
  const guests = Math.max(1, b.guests);
  const already = new Set((b.services ?? []).map((s) => s.serviceId));
  const pop = popularity(input.allBookings ?? []);
  const season = seasonFor(b.checkIn);
  const prefs = (customer?.preferences ?? []).map((p) => p.toLowerCase());
  const tier = input.loyalty ? tierConfig(input.loyalty.tier) : null;
  const dataPoints = (input.allBookings ?? []).filter((x) => x.services?.length).length;

  const out: UpsellSuggestion[] = [];

  /* ------------------------------------------------ 1. DỊCH VỤ ---------*/
  for (const s of services) {
    if (already.has(s.id)) continue;

    const tag = tagOf(s.name);
    let p = 0.12; // xác suất nền
    const reasons: string[] = [];
    let qty = 1;

    switch (tag) {
      case "breakfast":
        qty = guests * nights;
        p = 0.55;
        reasons.push("Bữa sáng là dịch vụ được chọn nhiều nhất");
        if (nights >= 2) {
          p += 0.1;
          reasons.push(`Ở ${nights} đêm — tiện mua gói`);
        }
        break;
      case "transfer":
        qty = 1;
        p = 0.3;
        reasons.push("Khách đặt online thường cần đưa đón");
        if (b.source === "website" || b.source === "ota") {
          p += 0.12;
          reasons.push("Đặt từ xa — khả năng đi máy bay cao");
        }
        break;
      case "spa":
        qty = guests;
        p = 0.22;
        if (nights >= 3) {
          p += 0.15;
          reasons.push(`Kỳ nghỉ dài ${nights} đêm — nhu cầu thư giãn cao`);
        }
        if (guests === 2) {
          p += 0.1;
          reasons.push("Đi 2 người — gợi gói đôi");
        }
        break;
      case "tour":
        qty = guests;
        p = 0.18;
        if (nights >= 2) {
          p += 0.12;
          reasons.push("Đủ thời gian tham quan");
        }
        if (season === "high" || season === "peak") {
          p += 0.08;
          reasons.push("Mùa du lịch");
        }
        break;
      case "dinner":
        qty = guests;
        p = 0.2;
        if (guests >= 3) {
          p += 0.12;
          reasons.push(`Nhóm ${guests} khách — tiện ăn tại khách sạn`);
        }
        break;
      case "rental":
        qty = nights;
        p = 0.16;
        if (guests <= 2) {
          p += 0.08;
          reasons.push("Khách đi ít người — hay thuê xe tự khám phá");
        }
        break;
      case "laundry":
        qty = 2;
        p = nights >= 4 ? 0.28 : 0.08;
        if (nights >= 4) reasons.push(`Ở dài ${nights} đêm — cần giặt ủi`);
        break;
      default:
        p = 0.1;
    }

    // Collaborative: dịch vụ phổ biến trong lịch sử thật
    const popRate = pop.get(s.id);
    if (popRate !== undefined && dataPoints >= 3) {
      p = p * 0.6 + popRate * 0.4;
      reasons.push(`${Math.round(popRate * 100)}% khách trước đã chọn`);
    }

    // Cá nhân hóa từ sở thích đã lưu
    if (prefs.some((pf) => s.name.toLowerCase().includes(pf) || pf.includes(tag))) {
      p += 0.2;
      reasons.push("Khớp sở thích đã lưu của khách");
    }

    // Khách hạng cao chi tiêu mạnh hơn
    if (tier && tier.tier !== "member") {
      p += 0.06;
      reasons.push(`Khách hạng ${tier.label}`);
    }

    p = Math.max(0.03, Math.min(0.9, p));
    const price = s.price * qty;

    out.push({
      kind: "service",
      id: s.id,
      title: qty > 1 ? `${s.name} ×${qty}` : s.name,
      price,
      probability: Math.round(p * 100) / 100,
      expectedValue: Math.round(price * p),
      reasons: reasons.length ? reasons : ["Gợi ý chung"],
      pitch: buildPitch(tag, s.name, qty, nights, guests),
      confidence: Math.round(Math.min(0.9, 0.4 + Math.min(0.4, dataPoints * 0.05) + (prefs.length ? 0.1 : 0)) * 100) / 100,
    });
  }

  /* ------------------------------------------------ 2. NÂNG HẠNG -------*/
  const currentType = roomTypes.find((rt) => rt.id === input.currentRoomTypeId);
  if (currentType) {
    const better = roomTypes
      .filter((rt) => rt.basePrice > currentType.basePrice)
      .sort((a, c) => a.basePrice - c.basePrice)[0];

    const availableCount = input.availableByType?.[better?.id ?? ""] ?? 1;

    if (better && availableCount > 0) {
      // Giá nâng hạng ưu đãi: chỉ 60% chênh lệch — phòng trống thì bán rẻ vẫn lãi
      const diffPerNight = Math.round((better.basePrice - currentType.basePrice) * 0.6);
      const price = diffPerNight * nights;
      const reasons = [`Còn ${availableCount} phòng ${better.name} trống`, `Giá ưu đãi 60% chênh lệch`];
      let p = 0.16;

      if (guests >= currentType.capacity) {
        p += 0.22;
        reasons.push(`${guests} khách — phòng hiện tại đã tối đa ${currentType.capacity}`);
      }
      if (tier && (tier.tier === "gold" || tier.tier === "platinum")) {
        p += 0.18;
        reasons.push(`Khách ${tier.label} — nên ưu tiên nâng hạng`);
      }
      if (nights >= 3) {
        p += 0.08;
        reasons.push("Ở dài — giá trị cảm nhận cao hơn");
      }
      if (season === "low") {
        p += 0.1;
        reasons.push("Mùa thấp điểm — dễ chấp nhận nâng hạng giá tốt");
      }

      p = Math.min(0.85, p);
      out.push({
        kind: "upgrade",
        id: better.id,
        title: `Nâng hạng lên ${better.name}`,
        price,
        probability: Math.round(p * 100) / 100,
        expectedValue: Math.round(price * p),
        reasons,
        pitch: `Chỉ thêm ${diffPerNight.toLocaleString("vi-VN")}đ/đêm, Quý khách được chuyển sang ${better.name} rộng hơn (tối đa ${better.capacity} khách). Hiện còn phòng trống nên em giữ giá ưu đãi cho mình.`,
        confidence: 0.7,
      });
    }
  }

  return out
    .filter((s) => s.probability >= 0.1)
    .sort((a, c) => c.expectedValue - a.expectedValue)
    .slice(0, input.limit ?? 5);
}

function buildPitch(tag: string, name: string, qty: number, nights: number, guests: number): string {
  switch (tag) {
    case "breakfast":
      return `Quý khách có muốn thêm bữa sáng buffet cho ${guests} người trong ${nights} ngày không? Đặt trước sẽ rẻ hơn mua tại nhà hàng.`;
    case "transfer":
      return `Em sắp xếp xe đưa đón sân bay giúp mình nhé? Tài xế sẽ đứng chờ sẵn ở sảnh đến, không phải xếp hàng taxi.`;
    case "spa":
      return `Sau chuyến đi dài, Quý khách có muốn đặt gói massage thư giãn không? Buổi tối thường hết chỗ nên em giữ trước cho mình.`;
    case "tour":
      return `Mình có muốn em giới thiệu tour trong ngày không? Đi cùng đoàn của khách sạn sẽ tiện và an toàn hơn tự đi.`;
    case "dinner":
      return `Tối nay nhà hàng có suất ăn đặc biệt, Quý khách có muốn em giữ bàn cho ${guests} người không?`;
    case "rental":
      return `Quý khách có muốn thuê xe tự đi khám phá không? Thuê theo ngày rẻ hơn đi taxi nhiều lần.`;
    case "laundry":
      return `Mình ở ${nights} đêm, có cần em đăng ký dịch vụ giặt ủi không? Nhận sáng trả chiều trong ngày.`;
    default:
      return `Quý khách có muốn thêm ${name}${qty > 1 ? ` (${qty})` : ""} không?`;
  }
}

/** Tổng doanh thu tiềm năng — hiển thị trên dashboard quản lý. */
export function upsellPotential(suggestions: UpsellSuggestion[]): { max: number; expected: number } {
  return {
    max: suggestions.reduce((s, x) => s + x.price, 0),
    expected: suggestions.reduce((s, x) => s + x.expectedValue, 0),
  };
}
