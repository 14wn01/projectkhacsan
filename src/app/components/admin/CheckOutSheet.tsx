import { LogOut, Receipt } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { useStore } from "../../lib/store";
import { Booking } from "../../lib/types";
import { formatVND } from "../../lib/format";
import { toast } from "sonner";

/** Trả phòng: hiện còn thu, rồi mới checkout + tạo hóa đơn. */
export function CheckOutSheet({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { customer, roomLabel, bookingTotalOf, amountPaid, updateBookingStatus, ensureInvoice } = useStore();
  const c = customer(booking.customerId);
  const total = bookingTotalOf(booking);
  const paid = amountPaid(booking.id);
  const due = Math.max(0, total - paid);

  const submit = () => {
    const res = updateBookingStatus(booking.id, "checked_out");
    if (!res.ok) return toast.error(res.message);
    ensureInvoice(booking.id);
    toast.success(
      due > 0
        ? `${booking.code}: đã trả phòng. Còn thu ${formatVND(due)} — hóa đơn đã tạo.`
        : `${booking.code}: đã trả phòng, hóa đơn đã tạo.`,
    );
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trả phòng — {booking.code}</DialogTitle>
          <DialogDescription>
            {roomLabel(booking.roomId)} · {c?.name ?? "Khách"} · trả trước 12:00.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-xl border p-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Tổng kỳ lưu trú</span>
            <span className="tabular-nums font-medium">{formatVND(total)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Đã thu (kể cả cọc)</span>
            <span className="tabular-nums">{formatVND(paid)}</span>
          </div>
          <div className={`flex justify-between gap-3 border-t pt-2 ${due > 0 ? "text-rose-700" : "text-emerald-700"}`}>
            <span className="font-medium">{due > 0 ? "Còn thu tại quầy" : "Đã thu đủ"}</span>
            <span className="tabular-nums font-semibold">{formatVND(due)}</span>
          </div>
        </div>

        {due > 0 && (
          <p className="text-xs text-muted-foreground">
            Trả phòng vẫn được — hóa đơn ghi số còn lại để kế toán đối soát.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={submit}>
            {due > 0 ? <Receipt className="size-4" /> : <LogOut className="size-4" />}
            {due > 0 ? `Trả phòng · còn ${formatVND(due)}` : "Xác nhận trả phòng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
