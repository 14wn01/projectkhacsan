import { useState } from "react";
import { CalendarIcon, Search, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { useStore } from "../../lib/store";
import { addDays, formatDate, formatVND, nightsBetween, toISODate } from "../../lib/format";
import { BookingForm } from "../BookingForm";
import { EmptyState } from "../PageHeader";

export function Availability() {
  const { roomType, getAvailableRooms } = useStore();
  const today = toISODate(new Date());
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [guests, setGuests] = useState("2");
  const [results, setResults] = useState<ReturnType<typeof getAvailableRooms> | null>(null);
  const [booking, setBooking] = useState<{ roomId: string } | null>(null);

  const search = () => setResults(getAvailableRooms(checkIn, checkOut, Number(guests) || 1));
  const nights = nightsBetween(checkIn, checkOut);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Tra cứu phòng trống</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4 items-end">
            <DatePick label="Nhận phòng" value={checkIn} onChange={(v) => { setCheckIn(v); if (v >= checkOut) setCheckOut(addDays(v, 1)); }} min={today} />
            <DatePick label="Trả phòng" value={checkOut} onChange={setCheckOut} min={addDays(checkIn, 1)} />
            <div className="space-y-2">
              <Label>Số khách</Label>
              <div className="relative">
                <Users className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} className="pl-8" />
              </div>
            </div>
            <Button onClick={search}><Search className="size-4" /> Tìm phòng</Button>
          </div>
        </CardContent>
      </Card>

      {results && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            {results.length} phòng trống cho {guests} khách · {nights} đêm ({formatDate(checkIn)} → {formatDate(checkOut)})
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.map((r) => {
              const t = roomType(r.typeId);
              return (
                <Card key={r.id} className="transition-all hover:shadow-lg hover:-translate-y-0.5 border-t-2 border-t-primary/60">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4>Phòng {r.number}</h4>
                      <Badge variant="secondary">{t?.name}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">Tầng {r.floor} · tối đa {t?.capacity} khách</div>
                    <div className="flex flex-wrap gap-1">{t?.amenities.slice(0, 4).map((a) => <Badge key={a} variant="outline">{a}</Badge>)}</div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <div className="text-primary font-semibold">{formatVND(t?.basePrice ?? 0)}/đêm</div>
                        <div className="text-xs text-muted-foreground">≈ {formatVND((t?.basePrice ?? 0) * nights)} / {nights} đêm</div>
                      </div>
                      <Button size="sm" onClick={() => setBooking({ roomId: r.id })}>Đặt ngay</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {results.length === 0 && (
              <Card className="md:col-span-2 xl:col-span-3"><CardContent className="p-0"><EmptyState icon={Search} title="Không có phòng trống phù hợp" description="Hãy thử đổi ngày nhận/trả hoặc giảm số khách rồi tìm lại." /></CardContent></Card>
            )}
          </div>
        </div>
      )}

      {booking && (
        <BookingForm
          onClose={() => setBooking(null)}
          defaultRoomId={booking.roomId}
          defaultCheckIn={checkIn}
          defaultCheckOut={checkOut}
          defaultGuests={Number(guests) || 1}
        />
      )}
    </div>
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
          <Calendar mode="single" selected={new Date(value)} onSelect={(d) => { if (d) { onChange(toISODate(d)); setOpen(false); } }} disabled={min ? { before: new Date(min) } : undefined} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
