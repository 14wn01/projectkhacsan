import { useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import { useStore } from "../lib/store";
import { addDays, formatDate, formatVND, nightsBetween, toISODate } from "../lib/format";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
  defaultRoomId?: string;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultGuests?: number;
  request?: boolean; // true = tạo yêu cầu chờ duyệt (mô phỏng khách đặt)
  defaultSource?: "website" | "phone" | "walk_in" | "ota";
}

export function BookingForm({ onClose, defaultRoomId, defaultCheckIn, defaultCheckOut, defaultGuests, request, defaultSource }: Props) {
  const { customers, rooms, roomType, getAvailableRooms, createBooking } = useStore();
  const today = toISODate(new Date());

  const [checkIn, setCheckIn] = useState(defaultCheckIn ?? today);
  const [checkOut, setCheckOut] = useState(defaultCheckOut ?? addDays(today, 1));
  const [guests, setGuests] = useState(String(defaultGuests ?? 2));
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [roomId, setRoomId] = useState(defaultRoomId ?? "");
  const [note, setNote] = useState("");
  const [source, setSource] = useState<"website" | "phone" | "walk_in" | "ota">(
    defaultSource ?? (request ? "website" : "walk_in"),
  );

  const available = useMemo(
    () => getAvailableRooms(checkIn, checkOut, Number(guests) || 1),
    [getAvailableRooms, checkIn, checkOut, guests],
  );

  // Nếu phòng đang chọn không còn trống với ngày mới → bỏ chọn
  const roomStillValid = available.some((r) => r.id === roomId) || rooms.find((r) => r.id === roomId && r.id === defaultRoomId);
  const effectiveRoomId = roomStillValid ? roomId : "";

  const nights = nightsBetween(checkIn, checkOut);
  const selectedType = effectiveRoomId ? roomType(rooms.find((r) => r.id === effectiveRoomId)!.typeId) : undefined;
  const estTotal = selectedType ? selectedType.basePrice * nights : 0;

  const submit = () => {
    const res = createBooking({
      roomId: effectiveRoomId, customerId,
      checkIn, checkOut, guests: Number(guests) || 1, note,
      status: request ? "pending" : "reserved",
      source: request ? source : "walk_in",
    });
    if (res.ok) { toast.success(res.message); onClose(); }
    else toast.error(res.message);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{request ? "Tạo yêu cầu đặt phòng" : "Đặt phòng mới"}</DialogTitle>
          <DialogDescription>
            {request
              ? "Mô phỏng yêu cầu từ khách — yêu cầu sẽ chờ lễ tân duyệt trước khi giữ phòng."
              : "Chọn phòng trống, khách hàng và khoảng thời gian lưu trú."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <DatePick label="Nhận phòng" value={checkIn} onChange={(v) => { setCheckIn(v); if (v >= checkOut) setCheckOut(addDays(v, 1)); }} min={today} />
            <DatePick label="Trả phòng" value={checkOut} onChange={setCheckOut} min={addDays(checkIn, 1)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Số khách</Label>
              <Input type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Khách hàng</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Chọn khách" /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.phone}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Phòng trống ({available.length})</Label>
            <Select value={effectiveRoomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue placeholder={available.length ? "Chọn phòng trống" : "Không có phòng trống"} /></SelectTrigger>
              <SelectContent>
                {available.map((r) => {
                  const t = roomType(r.typeId);
                  return <SelectItem key={r.id} value={r.id}>Phòng {r.number} · {t?.name} · {formatVND(t?.basePrice ?? 0)}/đêm (tối đa {t?.capacity})</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          {request && (
            <div className="space-y-2">
              <Label>Kênh đặt</Label>
              <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="phone">Điện thoại</SelectItem>
                  <SelectItem value="ota">OTA (Booking/Agoda)</SelectItem>
                  <SelectItem value="walk_in">Tại quầy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2"><Label>Ghi chú</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Yêu cầu đặc biệt…" /></div>

          {effectiveRoomId && (
            <div className="rounded-lg bg-muted p-3 text-sm flex items-center justify-between">
              <span>{nights} đêm × {formatVND(selectedType?.basePrice ?? 0)}</span>
              <span className="font-semibold text-primary">Tạm tính: {formatVND(estTotal)}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={submit} disabled={!effectiveRoomId || !customerId}>{request ? "Gửi yêu cầu" : "Xác nhận đặt"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DatePick({ label, value, onChange, min }: {
  label: string; value: string; onChange: (v: string) => void; min?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex h-9 w-full items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-accent hover:text-accent-foreground">
          <CalendarIcon className="size-4" /> {formatDate(value)}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={new Date(value)}
            onSelect={(d) => { if (d) { onChange(toISODate(d)); setOpen(false); } }}
            disabled={min ? { before: new Date(min) } : undefined}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
