import { useState } from "react";
import { Download, Printer } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useStore } from "../lib/store";
import { Booking } from "../lib/types";
import { formatDate, formatVND, nightsBetween } from "../lib/format";
import { HOTEL_EMAIL, HOTEL_FULL_NAME, HOTEL_HOTLINE } from "../lib/store";
import { downloadVoucherPdf } from "../lib/voucherPdf";
import { toast } from "sonner";

export function BookingVoucher({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { customer, roomLabel, roomType, rooms, bookings } = useStore();
  const live = bookings.find((b) => b.id === booking.id) ?? booking;
  const c = customer(live.customerId);
  const room = rooms.find((r) => r.id === live.roomId);
  const type = room ? roomType(room.typeId) : undefined;
  const nights = Math.max(nightsBetween(live.checkIn, live.checkOut), 1);
  const roomTotal = live.nightlyRates?.length
    ? live.nightlyRates.reduce((s, n) => s + n.price, 0)
    : live.roomPricePerNight * nights;
  const serviceTotal = live.services.reduce((s, x) => s + x.price * x.qty, 0);
  const total = roomTotal + serviceTotal;
  const deposit = live.depositAmount ?? Math.round(total * (live.depositPercent ?? 0.25));
  const remaining = Math.max(0, total - (live.depositPaid ? deposit : 0));
  const [busy, setBusy] = useState(false);

  const payload = {
    booking: live,
    guestName: c?.name ?? "Khách",
    guestPhone: c?.phone,
    guestEmail: c?.email,
    roomLabel: roomLabel(live.roomId),
    typeName: type?.name ?? "Residence",
  };

  const savePdf = async () => {
    setBusy(true);
    try {
      await downloadVoucherPdf(payload);
      toast.success(`Đã tải ${live.code}.pdf`);
    } catch {
      toast.error("Không xuất được PDF. Hãy dùng In rồi chọn Lưu PDF.");
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    document.body.classList.add("printing-voucher");
    window.print();
    window.setTimeout(() => document.body.classList.remove("printing-voucher"), 400);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg print:max-w-none print:border-0 print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>Phiếu xác nhận — {live.code}</DialogTitle>
          <DialogDescription>Tải PDF gửi khách, hoặc in. Không phải hóa đơn GTGT.</DialogDescription>
        </DialogHeader>

        <article className="voucher-sheet space-y-4 rounded-md border border-[#e3ddd2] bg-[#fcfaf7] p-5 text-[#1c1917]">
          <header className="text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#8a6d33]">{HOTEL_FULL_NAME}</p>
            <h3 className="mt-1 font-serif text-2xl font-light italic">Phiếu xác nhận</h3>
            <p className="mt-1 text-lg font-semibold tracking-wide">{live.code}</p>
          </header>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-[11px] uppercase tracking-wide text-[#6e675e]">Khách</dt><dd>{c?.name ?? "—"}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-[#6e675e]">Căn</dt><dd>{type?.name} · {roomLabel(live.roomId)}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-[#6e675e]">Nhận</dt><dd>{formatDate(live.checkIn)} · 14:00</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-[#6e675e]">Trả</dt><dd>{formatDate(live.checkOut)} · 12:00</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-[#6e675e]">Đêm / khách</dt><dd>{nights} đêm · {live.guests} khách</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-[#6e675e]">Điện thoại</dt><dd>{c?.phone ?? "—"}</dd></div>
          </dl>
          <div className="border-t border-[#e3ddd2] pt-3 text-sm">
            <div className="flex justify-between"><span>Tiền phòng</span><span>{formatVND(roomTotal)}</span></div>
            {serviceTotal > 0 && <div className="flex justify-between"><span>Dịch vụ</span><span>{formatVND(serviceTotal)}</span></div>}
            <div className="mt-1 flex justify-between font-medium"><span>Tổng</span><span>{formatVND(total)}</span></div>
            <div className="flex justify-between text-[#6e675e]"><span>{live.depositPaid ? "Đã cọc" : "Cọc 25%"}</span><span>{formatVND(deposit)}</span></div>
            <div className="flex justify-between"><span>Còn lại khi nhận</span><span>{formatVND(remaining)}</span></div>
          </div>
          <p className="text-xs leading-relaxed text-[#6e675e]">
            Huỷ trước 7 ngày: hoàn 100% cọc. 3–6 ngày: 50%. Dưới 3 ngày: không hoàn.
            Nhận 14:00 · Trả 12:00. {HOTEL_HOTLINE} · {HOTEL_EMAIL}
          </p>
        </article>

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={print}><Printer className="size-4" /> In</Button>
          <Button onClick={savePdf} disabled={busy}>
            <Download className="size-4" /> {busy ? "Đang tạo…" : "Tải PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
