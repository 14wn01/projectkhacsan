import { useMemo, useState } from "react";
import { LogIn, LogOut, Plus, Search, XCircle, ConciergeBell, ClipboardList, ArrowRight, BedDouble, CalendarClock, Wallet, DoorOpen, Check, FileDown, Repeat, Sparkles, ArrowUpCircle } from "lucide-react";
import { PageHeader, EmptyState } from "../PageHeader";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { useStore } from "../../lib/store";
import { Booking, BookingStatus } from "../../lib/types";
import { formatDate, formatVND, nightsBetween, toISODate } from "../../lib/format";
import { bookingTotal } from "../../lib/analytics";
import { recommendUpsells } from "../../lib/recommender";
import { BookingStatusBadge } from "../status";
import { useTable } from "../../lib/useTable";
import { Pagination } from "../Pagination";
import { BookingForm } from "../BookingForm";
import { toast } from "sonner";
import { CheckInSheet } from "../admin/CheckInSheet";
import { CheckOutSheet } from "../admin/CheckOutSheet";
import { ChangeRoomDialog } from "../admin/ChangeRoomDialog";
import { BookingVoucher } from "../BookingVoucher";

const FILTERS: { key: BookingStatus | "all"; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Chờ duyệt" },
  { key: "reserved", label: "Đã đặt" },
  { key: "checked_in", label: "Đang ở" },
  { key: "checked_out", label: "Đã trả" },
  { key: "cancelled", label: "Đã hủy" },
];

const AVATAR_COLORS = ["#4f46e5", "#059669", "#0284c7", "#d97706", "#db2777", "#7c3aed", "#0d9488"];
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function Mini({ icon: Icon, label, value, accent }: { icon: typeof BedDouble; label: string; value: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="grid place-items-center size-9 shrink-0 rounded-lg" style={{ backgroundColor: `${accent}1a`, color: accent }}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="text-xl font-semibold tracking-tight truncate">{value}</div>
      </div>
    </div>
  );
}

export function Bookings() {
  const { bookings, customer, roomLabel, updateBookingStatus, approveBooking, rejectBooking, notify } = useStore();
  const today = toISODate(new Date());
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [creating, setCreating] = useState(false);
  const [serviceOf, setServiceOf] = useState<Booking | null>(null);
  const [checkInOf, setCheckInOf] = useState<Booking | null>(null);
  const [checkOutOf, setCheckOutOf] = useState<Booking | null>(null);
  const [moveOf, setMoveOf] = useState<Booking | null>(null);
  const [voucherOf, setVoucherOf] = useState<Booking | null>(null);

  const filtered = useMemo(
    () => bookings.filter((b) => filter === "all" || b.status === filter)
      .sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1)),
    [bookings, filter],
  );
  const t = useTable(filtered, (b) => `${b.code} ${roomLabel(b.roomId)} ${customer(b.customerId)?.name ?? ""}`);

  // Nhận phòng nhanh: mở hộp quét CCCD/Passport để vừa lưu giấy tờ vừa đổi trạng thái
  const doCheckIn = (b: Booking) => {
    if (b.checkIn > toISODate(new Date())) return toast.error("Chưa tới ngày nhận phòng.");
    setCheckInOf(b);
  };
  const doCheckOut = (b: Booking) => {
    setCheckOutOf(b);
  };
  const doCancel = (b: Booking) => { updateBookingStatus(b.id, "cancelled"); toast.success(`${b.code}: đã hủy đặt phòng.`); notify(b.id, "cancellation", "email"); };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ClipboardList}
        title="Đặt phòng"
        description="Quản lý lượt đặt, nhận/trả phòng và dịch vụ kèm theo."
        actions={
          <>
            <div className="relative">
              <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={t.query} onChange={(e) => t.setQuery(e.target.value)} placeholder="Tìm mã, phòng, khách…" className="pl-8 w-52" />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as BookingStatus | "all")}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{FILTERS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> Đặt phòng</Button>
          </>
        }
      />

      {/* Dải chỉ số */}
      <div className="rounded-xl border bg-border shadow-sm grid gap-px overflow-hidden sm:grid-cols-2 xl:grid-cols-4 [&>*]:bg-card">
        <Mini icon={DoorOpen} label="Đang lưu trú" value={String(bookings.filter((b) => b.status === "checked_in").length)} accent="#059669" />
        <Mini icon={CalendarClock} label="Sắp nhận phòng" value={String(bookings.filter((b) => b.status === "reserved" && b.checkIn >= today).length)} accent="#0284c7" />
        <Mini icon={BedDouble} label="Tổng lượt đặt" value={String(bookings.filter((b) => b.status !== "cancelled").length)} accent="#4f46e5" />
        <Mini icon={Wallet} label="Tổng giá trị" value={formatVND(bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + bookingTotal(b), 0))} accent="#d97706" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Mã</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Phòng</TableHead>
                <TableHead>Thời gian lưu trú</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Tổng</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {t.rows.map((b) => {
                const c = customer(b.customerId);
                const nights = nightsBetween(b.checkIn, b.checkOut);
                return (
                <TableRow key={b.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="font-medium">{b.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="grid place-items-center size-8 shrink-0 rounded-lg text-white text-xs font-medium" style={{ backgroundColor: avatarColor(b.customerId) }}>{initials(c?.name ?? "?")}</span>
                      <div className="min-w-0">
                        <div className="truncate">{c?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{c?.phone ?? ""}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{roomLabel(b.roomId)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <span>{formatDate(b.checkIn)}</span>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                      <span>{formatDate(b.checkOut)}</span>
                      <Badge variant="secondary" className="ml-1">{nights} đêm</Badge>
                    </div>
                  </TableCell>
                  <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                  <TableCell className="text-right">{formatVND(bookingTotal(b))}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {b.status === "pending" && (
                      <>
                        <Button variant="ghost" size="icon" title="Duyệt" onClick={() => { const r = approveBooking(b.id); if(r.ok) { toast.success(r.message); notify(b.id, "booking_confirmation", "email"); } else toast.error(r.message); }}><Check className="size-4 text-emerald-600" /></Button>
                        <Button variant="ghost" size="icon" title="Từ chối" onClick={() => { rejectBooking(b.id); toast.success(`${b.code}: đã từ chối.`); notify(b.id, "cancellation", "email"); }}><XCircle className="size-4 text-rose-500" /></Button>
                      </>
                    )}
                    {b.status !== "cancelled" && (
                      <Button variant="ghost" size="icon" title="Phiếu xác nhận PDF" onClick={() => setVoucherOf(b)}><FileDown className="size-4" /></Button>
                    )}
                    {(b.status === "reserved" || b.status === "checked_in") && (
                      <>
                        <Button variant="ghost" size="icon" title="Đổi / nâng phòng" onClick={() => setMoveOf(b)}><Repeat className="size-4" /></Button>
                        <Button variant="ghost" size="icon" title="Thêm dịch vụ" onClick={() => setServiceOf(b)}><ConciergeBell className="size-4" /></Button>
                      </>
                    )}
                    {b.status === "reserved" && (
                      <>
                        <Button variant="ghost" size="icon" title="Nhận phòng" onClick={() => doCheckIn(b)}><LogIn className="size-4 text-sky-600" /></Button>
                        <Button variant="ghost" size="icon" title="Hủy" onClick={() => doCancel(b)}><XCircle className="size-4 text-rose-500" /></Button>
                      </>
                    )}
                    {b.status === "checked_in" && (
                      <Button variant="ghost" size="icon" title="Trả phòng" onClick={() => doCheckOut(b)}><LogOut className="size-4 text-emerald-600" /></Button>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
              {t.rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="p-0"><EmptyState icon={ClipboardList} title="Chưa có đặt phòng" description="Tạo lượt đặt mới hoặc đổi bộ lọc để xem kết quả khác." /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <div className="px-4 pb-2">
            <Pagination page={t.page} totalPages={t.totalPages} total={t.total} onChange={t.setPage} />
          </div>
        </CardContent>
      </Card>

      {creating && <BookingForm onClose={() => setCreating(false)} />}
      {serviceOf && <ServiceDialog booking={serviceOf} onClose={() => setServiceOf(null)} />}
      {checkInOf && <CheckInSheet booking={checkInOf} onClose={() => setCheckInOf(null)} />}
      {checkOutOf && <CheckOutSheet booking={checkOutOf} onClose={() => setCheckOutOf(null)} />}
      {moveOf && <ChangeRoomDialog booking={moveOf} onClose={() => setMoveOf(null)} />}
      {voucherOf && <BookingVoucher booking={voucherOf} onClose={() => setVoucherOf(null)} />}
    </div>
  );
}

function ServiceDialog({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { services, bookings, addServiceToBooking, removeServiceFromBooking } = useStore();
  const live = bookings.find((b) => b.id === booking.id)!;
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [qty, setQty] = useState("1");

  const add = () => {
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;
    addServiceToBooking(booking.id, { serviceId: s.id, name: s.name, price: s.price, qty: Number(qty) || 1, date: toISODate(new Date()) });
    toast.success(`Đã thêm ${s.name}`);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dịch vụ — {booking.code}</DialogTitle>
          <DialogDescription>Thêm hoặc gỡ dịch vụ đi kèm cho lượt đặt phòng này.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label>Dịch vụ</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {formatVND(s.price)}/{s.unit}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="w-20 space-y-2"><Label>SL</Label><Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <Button onClick={add}>Thêm</Button>
          </div>
          <div className="rounded-lg border divide-y">
            {live.services.length === 0 && <div className="p-3 text-sm text-muted-foreground text-center">Chưa có dịch vụ.</div>}
            {live.services.map((s, i) => (
              <div key={`${s.serviceId}-${i}`} className="flex items-center justify-between p-3 text-sm">
                <span>{s.name} × {s.qty}</span>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatVND(s.price * s.qty)}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeServiceFromBooking(booking.id, i)}>Xóa</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <UpsellPanel booking={live} />
        <DialogFooter><Button variant="outline" onClick={onClose}>Đóng</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Gợi ý bán thêm (AI #3): xếp hạng dịch vụ / nâng hạng theo xác suất khách đồng ý.
 * Lễ tân thấy sẵn câu mời và lý do — không phải đoán.
 */
function UpsellPanel({ booking }: { booking: Booking }) {
  const { rooms, services, roomTypes, bookings, customer, loyaltyOf, addServiceToBooking } = useStore();
  const cust = customer(booking.customerId);

  const suggestions = useMemo(
    () =>
      recommendUpsells({
        booking,
        currentRoomTypeId: rooms.find((r) => r.id === booking.roomId)?.typeId,
        customer: cust,
        services,
        roomTypes,
        allBookings: bookings,
        loyalty: cust ? loyaltyOf(cust.id) : undefined,
        limit: 3,
      }),
    [booking, cust, rooms, services, roomTypes, bookings, loyaltyOf],
  );

  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-xl border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-primary" /> Gợi ý bán thêm
      </div>
      <div className="mt-2 space-y-2">
        {suggestions.map((s) => (
          <div key={s.kind + s.id} className="rounded-lg border bg-card p-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {s.kind === "upgrade" ? (
                <ArrowUpCircle className="size-4 shrink-0 text-amber-600" />
              ) : (
                <ConciergeBell className="size-4 shrink-0 text-sky-600" />
              )}
              <span className="font-medium">{s.title}</span>
              <span className="text-muted-foreground">{formatVND(s.price)}</span>
              <Badge variant="secondary" className="ml-auto">
                {Math.round(s.probability * 100)}% khả năng chốt
              </Badge>
            </div>
            <p className="mt-1 text-xs italic text-muted-foreground">“{s.pitch}”</p>
            <div className="mt-1 text-[11px] text-muted-foreground">{s.reasons.join(" · ")}</div>
            {s.kind === "service" && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  const svc = services.find((x) => x.id === s.id);
                  if (!svc) return toast.error("Không tìm thấy dịch vụ này.");
                  addServiceToBooking(booking.id, {
                    serviceId: svc.id,
                    name: svc.name,
                    price: svc.price,
                    qty: 1,
                    date: toISODate(new Date()),
                  });
                  toast.success(`Đã thêm ${svc.name}`);
                }}
              >
                <Plus className="size-3.5" /> Thêm vào đặt phòng
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

