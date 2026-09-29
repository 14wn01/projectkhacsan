import { Globe, Phone, DoorOpen, Building2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { BookingSource, BookingStatus, PaymentStatus, RoomStatus } from "../lib/types";

export const ROOM_STATUS_META: Record<RoomStatus, { label: string; dot: string; badge: string }> = {
  available: { label: "Trống", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  occupied: { label: "Đang ở", dot: "bg-amber-800", badge: "bg-amber-50 text-amber-900 border-amber-200" },
  cleaning: { label: "Đang dọn", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  maintenance: { label: "Bảo trì", dot: "bg-rose-500", badge: "bg-rose-100 text-rose-700 border-rose-200" },
};

const BOOKING_STATUS_META: Record<BookingStatus, { label: string; badge: string }> = {
  pending: { label: "Chờ duyệt", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  reserved: { label: "Đã đặt", badge: "bg-amber-50 text-amber-900 border-amber-200" },
  checked_in: { label: "Đang ở", badge: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  checked_out: { label: "Đã trả", badge: "bg-[#f4efe7] text-[#6e675e] border-[#e3ddd2]" },
  cancelled: { label: "Đã hủy", badge: "bg-rose-100 text-rose-700 border-rose-200" },
};

const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; badge: string }> = {
  unpaid: { label: "Chưa thanh toán", badge: "bg-rose-100 text-rose-700 border-rose-200" },
  partial: { label: "Thanh toán 1 phần", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  paid: { label: "Đã thanh toán", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const m = ROOM_STATUS_META[status];
  return (
    <Badge variant="outline" className={m.badge}>
      <span className={`mr-1.5 inline-block size-2 rounded-full ${m.dot}`} />
      {m.label}
    </Badge>
  );
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const m = BOOKING_STATUS_META[status];
  return <Badge variant="outline" className={m.badge}>{m.label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const m = PAYMENT_STATUS_META[status];
  return <Badge variant="outline" className={m.badge}>{m.label}</Badge>;
}

export const BOOKING_SOURCE_META: Record<BookingSource, { label: string; icon: typeof Globe }> = {
  website: { label: "Website", icon: Globe },
  phone: { label: "Điện thoại", icon: Phone },
  walk_in: { label: "Tại quầy", icon: DoorOpen },
  ota: { label: "OTA (Booking/Agoda)", icon: Building2 },
};

export function BookingSourceBadge({ source }: { source?: BookingSource }) {
  const m = BOOKING_SOURCE_META[source ?? "walk_in"];
  const Icon = m.icon;
  return (
    <Badge variant="secondary" className="gap-1">
      <Icon className="size-3" /> {m.label}
    </Badge>
  );
}
