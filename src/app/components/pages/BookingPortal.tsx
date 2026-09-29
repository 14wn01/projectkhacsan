import { useMemo, useState } from "react";
import { CalendarIcon, Users2, Wifi, BedDouble, Check, Sparkles, Search } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { useStore } from "../../lib/store";
import { RoomType } from "../../lib/types";
import { addDays, formatDate, formatVND, nightsBetween, toISODate } from "../../lib/format";
import { HOTEL_NAME } from "../../lib/store";
import { toast } from "sonner";

export function BookingPortal() {
  const { roomTypes, getAvailableRooms } = useStore();
  const today = toISODate(new Date());
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [guests, setGuests] = useState("2");
  const [picking, setPicking] = useState<RoomType | null>(null);

  const nights = Math.max(nightsBetween(checkIn, checkOut), 1);
  const available = useMemo(
    () => getAvailableRooms(checkIn, checkOut, Number(guests) || 1),
    [getAvailableRooms, checkIn, checkOut, guests],
  );
  const availByType = useMemo(() => {
    const m = new Map<string, string[]>();
    available.forEach((r) => m.set(r.typeId, [...(m.get(r.typeId) ?? []), r.id]));
    return m;
  }, [available]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-sidebar text-white">
        <div className="pointer-events-none absolute -top-20 -right-10 size-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative px-6 py-8 md:px-10 md:py-12">
          <Badge variant="secondary" className="gap-1 mb-3 bg-white/15 text-white border-0"><Sparkles className="size-3" /> Cổng đặt phòng trực tuyến</Badge>
          <h1 className="text-white max-w-xl leading-tight">Đặt phòng tại {HOTEL_NAME}</h1>
          <p className="text-white/70 mt-2 max-w-lg text-sm">Chọn ngày và số khách, xem phòng còn trống và gửi yêu cầu. Lễ tân sẽ xác nhận và giữ phòng cho bạn.</p>
        </div>
      </div>

      {/* Thanh tìm kiếm */}
      <Card className="shadow-sm">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <DatePick label="Nhận phòng" value={checkIn} onChange={(v) => { setCheckIn(v); if (v >= checkOut) setCheckOut(addDays(v, 1)); }} min={today} />
          <DatePick label="Trả phòng" value={checkOut} onChange={setCheckOut} min={addDays(checkIn, 1)} />
          <div className="space-y-2">
            <Label>Số khách</Label>
            <Input type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} className="w-24" />
          </div>
          <div className="text-sm text-muted-foreground inline-flex items-center gap-2 h-9">
            <Search className="size-4" /> {nights} đêm · {available.length} phòng trống
          </div>
        </CardContent>
      </Card>

      {/* Danh sách loại phòng */}
      <div id="rooms" className="grid scroll-mt-20 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {roomTypes.map((t) => {
          const count = availByType.get(t.id)?.length ?? 0;
          const soldOut = count === 0;
          return (
            <Card key={t.id} className="overflow-hidden flex flex-col transition-all hover:shadow-lg">
              <div className="relative aspect-[4/3] bg-muted">
                <ImageWithFallback src={t.image ?? ""} alt={`Phòng ${t.name}`} className="size-full object-cover" />
                <Badge className={`absolute top-3 left-3 border-0 ${soldOut ? "bg-rose-500 text-white" : "bg-white/90 text-foreground"}`}>
                  {soldOut ? "Hết phòng" : `Còn ${count} phòng`}
                </Badge>
              </div>
              <CardContent className="p-4 flex flex-col flex-1 gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3>{t.name}</h3>
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5"><Users2 className="size-3.5" /> Tối đa {t.capacity} khách</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-primary">{formatVND(t.basePrice)}</div>
                    <div className="text-[11px] text-muted-foreground">/ đêm</div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{t.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {t.amenities.slice(0, 4).map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"><Wifi className="size-3" /> {a}</span>
                  ))}
                  {t.amenities.length > 4 && <span className="text-[11px] text-muted-foreground px-1 py-0.5">+{t.amenities.length - 4}</span>}
                </div>
                <div className="mt-auto pt-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{nights} đêm ≈ <span className="font-medium text-foreground">{formatVND(t.basePrice * nights)}</span></span>
                  <Button size="sm" disabled={soldOut} onClick={() => setPicking(t)}><BedDouble className="size-4" /> Đặt ngay</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {picking && (
        <RequestDialog
          type={picking}
          roomId={availByType.get(picking.id)![0]}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={Number(guests) || 1}
          nights={nights}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

function RequestDialog({ type, roomId, checkIn, checkOut, guests, nights, onClose }: {
  type: RoomType; roomId: string; checkIn: string; checkOut: string; guests: number; nights: number; onClose: () => void;
}) {
  const { customers, saveCustomer, createBooking } = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const submit = () => {
    if (!name.trim()) return toast.error("Vui lòng nhập họ tên.");
    if (!phone.trim()) return toast.error("Vui lòng nhập số điện thoại.");
    // Tìm khách theo SĐT, nếu chưa có thì tạo mới
    const existing = customers.find((c) => c.phone.trim() === phone.trim());
    const cust = existing ?? saveCustomer({
      id: "", name: name.trim(), phone: phone.trim(), email: email.trim(),
      idNumber: "", address: "", createdAt: toISODate(new Date()),
    });
    const res = createBooking({
      roomId, customerId: cust.id, checkIn, checkOut, guests,
      note: note.trim() || undefined, status: "pending", source: "website",
    });
    if (res.ok) {
      toast.success("Đã gửi yêu cầu đặt phòng! Lễ tân sẽ sớm xác nhận.");
      onClose();
    } else toast.error(res.message);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yêu cầu đặt phòng {type.name}</DialogTitle>
          <DialogDescription>{formatDate(checkIn)} → {formatDate(checkOut)} · {nights} đêm · {guests} khách</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2"><Label>Họ tên</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Số điện thoại</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@…" /></div>
          </div>
          <div className="space-y-2"><Label>Yêu cầu đặc biệt</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Phòng tầng cao, giường đôi…" /></div>
          <div className="rounded-lg bg-muted p-3 text-sm flex items-center justify-between">
            <span>{nights} đêm × {formatVND(type.basePrice)}</span>
            <span className="font-semibold text-primary">Tạm tính: {formatVND(type.basePrice * nights)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={submit}><Check className="size-4" /> Gửi yêu cầu</Button>
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
