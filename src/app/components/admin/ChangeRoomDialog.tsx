import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Repeat } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useStore } from "../../lib/store";
import { Booking } from "../../lib/types";
import { formatVND, nightsBetween } from "../../lib/format";
import { toast } from "sonner";

export function ChangeRoomDialog({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { rooms, bookings, roomType, roomLabel, getAvailableRooms, changeRoom, quoteFor } = useStore();
  const live = bookings.find((b) => b.id === booking.id) ?? booking;
  const current = rooms.find((r) => r.id === live.roomId);
  const currentType = current ? roomType(current.typeId) : undefined;
  const nights = Math.max(nightsBetween(live.checkIn, live.checkOut), 1);
  const oldTotal = live.nightlyRates?.length
    ? live.nightlyRates.reduce((s, n) => s + n.price, 0)
    : live.roomPricePerNight * nights;

  const [roomId, setRoomId] = useState("");
  const [keepRate, setKeepRate] = useState(true);
  const [note, setNote] = useState("");

  const options = useMemo(() => {
    return getAvailableRooms(live.checkIn, live.checkOut, live.guests)
      .filter((r) => r.id !== live.roomId)
      .map((r) => {
        const t = roomType(r.typeId);
        const quote = t ? quoteFor(t.id, live.checkIn, live.checkOut) : null;
        const newTotal = quote?.total ?? (t?.basePrice ?? 0) * nights;
        const kind: "move" | "upgrade" | "downgrade" =
          (t?.basePrice ?? 0) > (currentType?.basePrice ?? 0) ? "upgrade"
            : (t?.basePrice ?? 0) < (currentType?.basePrice ?? 0) ? "downgrade" : "move";
        return { room: r, type: t, newTotal, kind, delta: newTotal - oldTotal };
      })
      .sort((a, b) => (a.type?.basePrice ?? 0) - (b.type?.basePrice ?? 0));
  }, [getAvailableRooms, live, roomType, quoteFor, nights, currentType, oldTotal]);

  const picked = options.find((o) => o.room.id === roomId);
  const surcharge = picked && !keepRate ? picked.delta : 0;

  const confirm = () => {
    if (!roomId) return toast.error("Chọn phòng muốn chuyển tới.");
    const res = changeRoom(live.id, roomId, { keepRate, note: note.trim() || undefined });
    if (res.ok) {
      toast.success(res.message);
      onClose();
    } else toast.error(res.message);
  };

  const kindLabel = (k: "move" | "upgrade" | "downgrade") =>
    k === "upgrade" ? "Nâng hạng" : k === "downgrade" ? "Hạ hạng" : "Cùng hạng";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Đổi / nâng phòng — {live.code}</DialogTitle>
          <DialogDescription>
            Đơn không bị hủy. Có thể giữ giá đang tính hoặc áp giá hạng mới.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-[#e3ddd2] bg-[#fcfaf7] px-3 py-2 text-sm">
          Hiện tại: <b>{roomLabel(live.roomId)}</b>
          {currentType ? ` · ${currentType.name}` : ""} · {formatVND(oldTotal)} / {nights} đêm
        </div>

        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không còn căn trống cùng ngày và đủ chỗ cho {live.guests} khách.</p>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {options.map((o) => {
              const Icon = o.kind === "upgrade" ? ArrowUpRight : o.kind === "downgrade" ? ArrowDownRight : Repeat;
              return (
                <label
                  key={o.room.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm ${
                    roomId === o.room.id ? "border-[#8a6d33] bg-[#f4efe7]" : "border-[#e3ddd2] bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="to-room"
                    className="mt-1"
                    checked={roomId === o.room.id}
                    onChange={() => {
                      setRoomId(o.room.id);
                      setKeepRate(o.kind !== "upgrade");
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">
                      P.{o.room.number} · {o.type?.name}
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-normal text-[#8a6d33]">
                        <Icon className="size-3" /> {kindLabel(o.kind)}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Giá hạng này {formatVND(o.newTotal)} / {nights} đêm
                      {o.delta > 0 ? ` · +${formatVND(o.delta)} nếu áp giá mới` : o.delta < 0 ? ` · ${formatVND(o.delta)} nếu áp giá mới` : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {picked && (
          <div className="space-y-2">
            <Label>Giá sau khi đổi</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setKeepRate(true)}
                className={`rounded-md border px-3 py-2 text-left text-sm ${keepRate ? "border-[#8a6d33] bg-[#f4efe7]" : "border-[#e3ddd2]"}`}
              >
                <div className="font-medium">Giữ giá cũ</div>
                <div className="text-xs text-muted-foreground">{formatVND(oldTotal)} — không phụ thu</div>
              </button>
              <button
                type="button"
                onClick={() => setKeepRate(false)}
                className={`rounded-md border px-3 py-2 text-left text-sm ${!keepRate ? "border-[#8a6d33] bg-[#f4efe7]" : "border-[#e3ddd2]"}`}
              >
                <div className="font-medium">Áp giá hạng mới</div>
                <div className="text-xs text-muted-foreground">
                  {formatVND(picked.newTotal)}
                  {surcharge > 0 ? ` · phụ thu ${formatVND(surcharge)}` : surcharge < 0 ? ` · giảm ${formatVND(-surcharge)}` : ""}
                </div>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="move-note">Ghi chú (tuỳ chọn)</Label>
          <Textarea id="move-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Khách muốn view biển, phòng cũ ồn…" rows={2} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={confirm} disabled={!roomId}>
            <ArrowRight className="size-4" /> Xác nhận đổi phòng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
