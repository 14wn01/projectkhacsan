import { useMemo, useState } from "react";
import { History, Plus, Search, Users, Mail, Phone, IdCard, Crown, CalendarClock, Wallet, BedDouble } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { useStore } from "../../lib/store";
import { Booking, Customer } from "../../lib/types";
import { formatDate, formatVND, toISODate, uid } from "../../lib/format";
import { bookingTotal } from "../../lib/analytics";
import { BookingStatusBadge } from "../status";
import { PageHeader, EmptyState } from "../PageHeader";
import { toast } from "sonner";

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

interface CustStats {
  stays: number;
  spent: number;
  lastStay?: string;
  upcoming: boolean;
  active: boolean;
}

export function Customers() {
  const { customers, bookings, saveCustomer, roomLabel } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [historyOf, setHistoryOf] = useState<Customer | null>(null);
  const [query, setQuery] = useState("");

  const statsFor = useMemo(() => {
    const map = new Map<string, CustStats>();
    customers.forEach((c) => {
      const bs = bookings.filter((b) => b.customerId === c.id && b.status !== "cancelled");
      map.set(c.id, {
        stays: bs.length,
        spent: bs.reduce((s, b) => s + bookingTotal(b), 0),
        lastStay: bs.map((b) => b.checkOut).sort().pop(),
        upcoming: bs.some((b) => b.status === "reserved"),
        active: bs.some((b) => b.status === "checked_in"),
      });
    });
    return map;
  }, [customers, bookings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? customers.filter((c) => `${c.name} ${c.phone} ${c.email} ${c.idNumber}`.toLowerCase().includes(q))
      : customers;
    return [...list].sort((a, b) => (statsFor.get(b.id)?.spent ?? 0) - (statsFor.get(a.id)?.spent ?? 0));
  }, [customers, query, statsFor]);

  const totalStays = bookings.filter((b) => b.status !== "cancelled").length;
  const totalSpent = [...statsFor.values()].reduce((s, v) => s + v.spent, 0);
  const repeat = [...statsFor.values()].filter((v) => v.stays >= 2).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users}
        title="Khách hàng"
        description="Hồ sơ & lịch sử lưu trú, xếp theo mức chi tiêu."
        actions={
          <>
            <div className="relative">
              <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, SĐT, email…" className="pl-8 w-56" />
            </div>
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Thêm</Button>
          </>
        }
      />

      {/* Dải tổng quan */}
      <div className="rounded-xl border bg-border shadow-sm grid gap-px overflow-hidden sm:grid-cols-2 xl:grid-cols-4 [&>*]:bg-card">
        <Mini icon={Users} label="Tổng khách" value={String(customers.length)} accent="#4f46e5" />
        <Mini icon={Crown} label="Khách quay lại" value={String(repeat)} accent="#d97706" />
        <Mini icon={BedDouble} label="Tổng lượt lưu trú" value={String(totalStays)} accent="#0284c7" />
        <Mini icon={Wallet} label="Tổng chi tiêu" value={formatVND(totalSpent)} accent="#059669" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState icon={Users} title="Không tìm thấy khách hàng" description="Thử từ khóa khác hoặc thêm khách hàng mới." /></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const s = statsFor.get(c.id)!;
            const color = avatarColor(c.id);
            return (
              <Card key={c.id} className="group transition-all hover:shadow-md hover:-translate-y-0.5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="grid place-items-center size-11 shrink-0 rounded-xl text-white font-medium" style={{ backgroundColor: color }}>
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{c.name}</span>
                        {s.stays >= 3 && <Badge className="bg-amber-100 text-amber-700 gap-1 border-0"><Crown className="size-3" /> VIP</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {s.active && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><span className="size-1.5 rounded-full bg-emerald-500" /> Đang lưu trú</span>}
                        {!s.active && s.upcoming && <span className="inline-flex items-center gap-1 text-xs text-sky-600"><span className="size-1.5 rounded-full bg-sky-500" /> Sắp đến</span>}
                        {s.stays >= 2 && !s.active && !s.upcoming && <span className="text-xs text-muted-foreground">Khách quen</span>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground"><Phone className="size-3.5 shrink-0" /> <span className="text-foreground">{c.phone}</span></div>
                    <div className="flex items-center gap-2 text-muted-foreground"><Mail className="size-3.5 shrink-0" /> <span className="truncate">{c.email || "—"}</span></div>
                    <div className="flex items-center gap-2 text-muted-foreground"><IdCard className="size-3.5 shrink-0" /> <span>{c.idNumber || "—"}</span></div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2 text-center">
                    <Stat label="Lượt ở" value={String(s.stays)} />
                    <Stat label="Chi tiêu" value={s.spent >= 1_000_000 ? `${(s.spent / 1_000_000).toFixed(1)}tr` : formatVND(s.spent)} />
                    <Stat label="Gần nhất" value={s.lastStay ? formatDate(s.lastStay) : "—"} />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setHistoryOf(c)}><History className="size-4" /> Lịch sử</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setOpen(true); }}>Sửa</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {open && (
        <CustomerDialog
          customer={editing}
          onClose={() => setOpen(false)}
          onSave={(c) => { saveCustomer(c); toast.success("Đã lưu khách hàng"); setOpen(false); }}
        />
      )}

      {historyOf && (
        <HistoryDialog customer={historyOf} bookings={bookings.filter((b) => b.customerId === historyOf.id)} roomLabel={roomLabel} onClose={() => setHistoryOf(null)} />
      )}
    </div>
  );
}

function Mini({ icon: Icon, label, value, accent }: { icon: typeof Users; label: string; value: string; accent: string }) {
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-medium truncate">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function HistoryDialog({ customer, bookings, roomLabel, onClose }: {
  customer: Customer; bookings: Booking[]; roomLabel: (id: string) => string; onClose: () => void;
}) {
  const active = bookings.filter((b) => b.status !== "cancelled");
  const total = active.reduce((s, b) => s + bookingTotal(b), 0);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="grid place-items-center size-9 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: avatarColor(customer.id) }}>{initials(customer.name)}</span>
            <div>
              <div>{customer.name}</div>
              <div className="text-xs text-muted-foreground font-normal">{active.length} lượt lưu trú · tổng {formatVND(total)}</div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">Lịch sử lưu trú của khách hàng {customer.name}.</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50"><TableHead>Mã</TableHead><TableHead>Phòng</TableHead><TableHead>Nhận</TableHead><TableHead>Trả</TableHead><TableHead>Trạng thái</TableHead><TableHead className="text-right">Tổng</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">{b.code}</TableCell>
                  <TableCell>{roomLabel(b.roomId)}</TableCell>
                  <TableCell>{formatDate(b.checkIn)}</TableCell>
                  <TableCell>{formatDate(b.checkOut)}</TableCell>
                  <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                  <TableCell className="text-right">{formatVND(bookingTotal(b))}</TableCell>
                </TableRow>
              ))}
              {bookings.length === 0 && (
                <TableRow><TableCell colSpan={6} className="p-0"><EmptyState icon={CalendarClock} title="Chưa có lượt lưu trú" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomerDialog({ customer, onClose, onSave }: {
  customer: Customer | null; onClose: () => void; onSave: (c: Customer) => void;
}) {
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [idNumber, setIdNumber] = useState(customer?.idNumber ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");

  const submit = () => {
    if (!name.trim()) return toast.error("Vui lòng nhập họ tên.");
    if (!phone.trim()) return toast.error("Vui lòng nhập số điện thoại.");
    onSave({
      id: customer?.id ?? uid("c"),
      name: name.trim(), phone: phone.trim(), email: email.trim(),
      idNumber: idNumber.trim(), address: address.trim(),
      createdAt: customer?.createdAt ?? toISODate(new Date()),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? "Sửa khách hàng" : "Thêm khách hàng"}</DialogTitle>
          <DialogDescription>Nhập thông tin liên hệ và giấy tờ của khách hàng.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2"><Label>Họ tên</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Số điện thoại</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="space-y-2"><Label>CCCD/Passport</Label><Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label>Địa chỉ</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={submit}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
