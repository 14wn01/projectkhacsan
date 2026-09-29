import { Bath, BedDouble, Briefcase, Check, Tv, Users2, Waves, Wifi, Wind, Wine } from "lucide-react";
import type { LegalDoc } from "./LegalPages";
import type { Room, RoomType } from "../../lib/types";
import { addDays, formatVND, isISODate, nightsBetween, toISODate } from "../../lib/format";

/** Sao Mai Residence — không niêm yết số trên mặt khách. */
export function isOnRequestRate(type: { id: string; name?: string }) {
  return type.id === "rt6" || /sao mai residence/i.test(type.name ?? "");
}

/** Nhãn giá cho mặt khách: “Từ … / đêm” hoặc “Theo yêu cầu”. */
export function guestNightlyLabel(type: { id: string; name?: string; basePrice: number }, nightly?: number) {
  if (isOnRequestRate(type)) return "Theo yêu cầu";
  return `Từ ${formatVND(nightly ?? type.basePrice)} / đêm`;
}

const AMENITY_ICONS: Array<{ match: RegExp; Icon: typeof Wifi }> = [
  { match: /wifi|internet|mạng/i, Icon: Wifi },
  { match: /ăn sáng|breakfast|cà phê/i, Icon: Check },
  { match: /ban công|view|biển|balcony|hướng/i, Icon: Waves },
  { match: /điều hòa|máy lạnh|air/i, Icon: Wind },
  { match: /tv|truyền hình|netflix/i, Icon: Tv },
  { match: /bồn tắm|tắm|bath|spa/i, Icon: Bath },
  { match: /minibar|tủ lạnh|rượu/i, Icon: Wine },
  { match: /bàn làm việc|desk|công tác/i, Icon: Briefcase },
  { match: /giường|bed/i, Icon: BedDouble },
  { match: /khách|guest|sức chứa/i, Icon: Users2 },
];

export const amenityIcon = (label: string) =>
  AMENITY_ICONS.find((a) => a.match.test(label))?.Icon ?? Check;

export type SunsetSlot = "18:30" | "19:30";

export type GuestView =
  | "home"
  | "residences"
  | "experiences"
  | "stay"
  | "story"
  | "contact"
  | "room"
  | "my-bookings"
  | "legal";

/** Garden → Ocean → Family → Horizon → Sky → Sao Mai. Không ghép hạng thấp với hạng lớn nhất. */
export const STAY_ORDER = ["rt1", "rt2", "rt4", "rt3", "rt5", "rt6"];

/** 3 hạng ở cùng hàng; Suite ảnh lớn; Residence full-width. */
export function stayPresentation(id: string): "trio" | "suite" | "residence" {
  if (id === "rt3") return "suite";
  if (id === "rt5" || id === "rt6") return "residence";
  return "trio";
}

const GUEST_PAGES: GuestView[] = ["residences", "experiences", "stay", "story", "contact"];

export type GuestRoute = {
  view: GuestView;
  section?: string;
  typeId?: string;
  doc?: LegalDoc;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
};

export const CANCEL_FREE_DAYS = 7;

export function cancelRefundFor(checkIn: string, today = toISODate(new Date())): {
  days: number;
  label: string;
  tone: "ok" | "warn" | "danger";
} {
  const days = nightsBetween(today, checkIn);
  if (days >= 7) return { days, label: "Huỷ hôm nay: hoàn 100% tiền cọc", tone: "ok" };
  if (days >= 3) return { days, label: "Huỷ hôm nay: hoàn 50% tiền cọc", tone: "warn" };
  return { days, label: "Huỷ hôm nay: không hoàn cọc (dưới 3 ngày)", tone: "danger" };
}

export function daysUntil(iso: string, today = toISODate(new Date())): number {
  return nightsBetween(today, iso);
}

const LEGAL: LegalDoc[] = ["privacy", "terms", "rights"];

export function parseGuestHash(hash: string): GuestRoute {
  const raw = (hash || "#/").replace(/^#/, "");
  const [pathPart, queryPart] = raw.split("?");
  const path = pathPart.replace(/^\//, "");
  const q = new URLSearchParams(queryPart ?? "");
  const checkIn = q.get("ci") && isISODate(q.get("ci")!) ? q.get("ci")! : undefined;
  const checkOut = q.get("co") && isISODate(q.get("co")!) ? q.get("co")! : undefined;
  const g = Number(q.get("g"));
  const guests = Number.isInteger(g) && g >= 1 && g <= 10 ? g : undefined;

  const segs = path.split("/").filter(Boolean);
  if (segs[0] === "room" && segs[1]) {
    return { view: "room", typeId: segs[1], checkIn, checkOut, guests };
  }
  if (segs[0] === "my-bookings") return { view: "my-bookings", checkIn, checkOut, guests };
  if (segs[0] === "legal") {
    const doc = (LEGAL.includes(segs[1] as LegalDoc) ? segs[1] : "privacy") as LegalDoc;
    return { view: "legal", doc, checkIn, checkOut, guests };
  }
  if (segs[0] === "rooms" || segs[0] === "residences") {
    return { view: "residences", checkIn, checkOut, guests };
  }
  if (segs[0] && GUEST_PAGES.includes(segs[0] as GuestView)) {
    return { view: segs[0] as GuestView, checkIn, checkOut, guests };
  }
  if (segs[0] === "booking") return { view: "home", section: "booking", checkIn, checkOut, guests };
  if (segs[0] === "services" || segs[0] === "offers") {
    return { view: "residences", checkIn, checkOut, guests };
  }
  return { view: "home", checkIn, checkOut, guests };
}

export function guestHash(route: GuestRoute, stay: { checkIn: string; checkOut: string; guests: number }): string {
  const q = new URLSearchParams();
  q.set("ci", stay.checkIn);
  q.set("co", stay.checkOut);
  q.set("g", String(stay.guests));
  let path = "/";
  if (route.view === "room" && route.typeId) path = `/room/${route.typeId}`;
  else if (route.view === "my-bookings") path = "/my-bookings";
  else if (route.view === "legal") path = `/legal/${route.doc ?? "privacy"}`;
  else if (route.view !== "home") path = `/${route.view}`;
  else if (route.section) path = `/${route.section}`;
  return `#${path}?${q.toString()}`;
}

export function nextOpenStay(
  getAvailable: (checkIn: string, checkOut: string, guests: number) => Room[],
  typeId: string,
  guests: number,
  from: string,
  nights: number,
  horizon = 45,
): { checkIn: string; checkOut: string; roomId: string } | null {
  const n = Math.max(nights, 1);
  for (let i = 0; i < horizon; i++) {
    const checkIn = addDays(from, i);
    const checkOut = addDays(checkIn, n);
    const room = getAvailable(checkIn, checkOut, guests).find((r) => r.typeId === typeId);
    if (room) return { checkIn, checkOut, roomId: room.id };
  }
  return null;
}

export type RoomShot = { src: string; label: string; alt: string };

export type RoomStory = {
  kicker: string;
  essay: string;
  view: string;
  beds: string;
  service: string;
  gallery: RoomShot[];
};

export const ROOM_STORY: Record<string, RoomStory> = {
  rt1: {
    kicker: "Garden Pavilion",
    essay: "Một giường. Ban công vườn. Yên, gọn, đủ cho hai người muốn tách khỏi sảnh.",
    view: "Hướng vườn / một phần vịnh",
    beds: "1 giường đôi",
    service: "Đồ giặt thu buổi sáng, trả trước tối. Lễ tân sắp xe đón khi cần.",
    gallery: [
      { src: "/media/room-garden.webp", label: "Phòng ngủ", alt: "Garden Pavilion — giường mây, cửa sổ hướng vườn cọ" },
      { src: "/media/room-garden-corner.jpg", label: "Góc phòng", alt: "Garden Pavilion — nhìn từ cửa kính vào giường mây" },
      { src: "/media/room-garden-bath.jpg", label: "Phòng tắm", alt: "Garden Pavilion — phòng tắm gỗ mây, sen cây, cửa sổ vườn" },
      { src: "/media/room-garden-balcony.jpg", label: "Ban công", alt: "Garden Pavilion — ban công đá, ghế mây, vườn cọ" },
    ],
  },
  rt2: {
    kicker: "Ocean Suite",
    essay: "View biển. Ban công rộng. Ánh sáng vào phòng suốt ngày.",
    view: "Ban công hướng vịnh",
    beds: "1 giường king",
    service: "Minibar. Đồ giặt trong ngày. Giữ bàn tối với concierge.",
    gallery: [
      { src: "/media/room-deluxe.webp", label: "Phòng ngủ", alt: "Ocean Suite — giường king, kính lớn nhìn vịnh" },
      { src: "/media/room-deluxe-corner.jpg", label: "Góc ngồi", alt: "Ocean Suite — ghế cạnh cửa kính hướng biển" },
      { src: "/media/room-deluxe-bath.jpg", label: "Phòng tắm", alt: "Ocean Suite — bồn tắm nhìn biển" },
      { src: "/media/room-deluxe-balcony.jpg", label: "Ban công", alt: "Ocean Suite — ban công gỗ, ghế dài, vịnh xanh" },
    ],
  },
  rt3: {
    kicker: "Horizon Suite",
    essay: "Suite nhìn chân trời. Bồn tắm. Chỗ làm việc kín. Ở lâu được.",
    view: "Nhìn chân trời, hướng vịnh",
    beds: "1 giường king + sofa",
    service: "Phòng khách riêng. Bồn tắm. Chỗ làm việc. Đồ giặt trong ngày.",
    gallery: [
      { src: "/media/room-suite.webp", label: "Phòng khách", alt: "Horizon Suite — phòng khách, cửa kính chân trời vịnh" },
      { src: "/media/room-suite-bedroom.jpg", label: "Phòng ngủ", alt: "Horizon Suite — phòng ngủ king nhìn biển" },
      { src: "/media/room-suite-bath.jpg", label: "Phòng tắm", alt: "Horizon Suite — bồn spa, cửa sổ hướng vịnh" },
      { src: "/media/room-suite-balcony.jpg", label: "Ban công", alt: "Horizon Suite — deck gỗ rộng, ghế dài, vịnh" },
    ],
  },
  rt4: {
    kicker: "Family Villa",
    essay: "Hai không gian ngủ. Bếp nhỏ. Cho gia đình muốn ở như nhà, không như khách sạn.",
    view: "Ban công hướng vườn",
    beds: "2 giường đôi",
    service: "Bếp nhỏ. Hai không gian ngủ. Đồ giặt gia đình theo yêu cầu.",
    gallery: [
      { src: "/media/room-family.webp", label: "Phòng ngủ", alt: "Family Villa — hai giường, cửa vườn râm bụt" },
      { src: "/media/room-family-living.jpg", label: "Bếp & khách", alt: "Family Villa — bếp nhỏ, bàn bốn ghế, vườn" },
      { src: "/media/room-family-bath.jpg", label: "Phòng tắm", alt: "Family Villa — phòng tắm, cửa sổ vườn" },
      { src: "/media/room-family-balcony.jpg", label: "Ban công", alt: "Family Villa — ban công vườn, hai ghế mây" },
    ],
  },
  rt5: {
    kicker: "Sky Residence",
    essay: "Nhiều tầng trong một căn. Hồ / view rộng. Bếp. Cho nhóm nhỏ hoặc ở dài ngày.",
    view: "Hồ riêng và vịnh",
    beds: "Phòng master + khách",
    service: "Bếp lớn. Hồ riêng. Giặt ủi và xe đón theo lịch butler.",
    gallery: [
      { src: "/media/room-penthouse.webp", label: "Phòng khách", alt: "Sky Residence — phòng khách cao, hồ vô cực, biển lúc chạng vạng" },
      { src: "/media/room-penthouse-bedroom.jpg", label: "Phòng ngủ", alt: "Sky Residence — phòng master nhìn hồ và biển" },
      { src: "/media/room-penthouse-kitchen.jpg", label: "Bếp", alt: "Sky Residence — bếp đá, bàn dài, nhìn ra hồ" },
      { src: "/media/room-penthouse-pool.jpg", label: "Hồ riêng", alt: "Sky Residence — hồ vô cực nhìn vào phòng khách" },
    ],
  },
  rt6: {
    kicker: "Sao Mai Residence",
    essay: "Căn lớn nhất. Check-in riêng. Butler. Đặt trực tiếp với concierge.",
    view: "Toàn vịnh, không chung hành lang",
    beds: "Master + phòng khách",
    service: "Butler riêng. Check-in tại căn. Xe đưa đón. Bàn ăn ngoài trời.",
    gallery: [
      { src: "/media/room-presidential.webp", label: "Căn & hồ", alt: "Sao Mai Residence — pavilion, hồ riêng, deck gỗ lúc hoàng hôn" },
      { src: "/media/room-presidential-living.jpg", label: "Phòng khách", alt: "Sao Mai Residence — nhìn từ trong pavilion ra hồ và biển" },
      { src: "/media/room-presidential-bedroom.jpg", label: "Phòng ngủ", alt: "Sao Mai Residence — phòng master mở ra hồ và biển" },
      { src: "/media/room-presidential-dining.jpg", label: "Bàn ngoài", alt: "Sao Mai Residence — bàn ăn trên deck cạnh hồ" },
    ],
  },
};

function storyKey(type: { id: string; name?: string }): string | undefined {
  if (ROOM_STORY[type.id]) return type.id;
  const n = (type.name ?? "").toLowerCase();
  if (/garden|pavilion/.test(n)) return "rt1";
  if (/ocean/.test(n)) return "rt2";
  if (/horizon/.test(n)) return "rt3";
  if (/family|gia đình/.test(n)) return "rt4";
  if (/sky/.test(n)) return "rt5";
  if (/sao mai residence|presidential|tổng thống/.test(n)) return "rt6";
  return undefined;
}

/** Luôn gắn gallery + mô tả đúng hạng đang mở — không trộn ảnh căn khác. */
export function storyFor(type: RoomType): RoomStory {
  const key = storyKey(type);
  const story = key ? ROOM_STORY[key] : undefined;
  const heroSrc = type.image?.trim() || story?.gallery[0]?.src || "/media/room-deluxe.webp";
  if (!story) {
    return {
      kicker: type.name,
      essay: type.description,
      view: "Hướng vịnh",
      beds: `${type.capacity} khách`,
      service: type.description,
      gallery: [{ src: heroSrc, label: "Phòng", alt: type.name }],
    };
  }
  const [hero, ...rest] = story.gallery;
  const shots = [
    { ...hero, src: heroSrc, alt: `${type.name} — ${hero.label}` },
    ...rest.filter((s) => s.src !== heroSrc),
  ];
  return {
    ...story,
    kicker: type.name || story.kicker,
    essay: type.description || story.essay,
    gallery: shots,
  };
}
