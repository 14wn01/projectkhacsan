import { ReactNode, useMemo, useState } from "react";
import {
  Inbox, Plus, ArrowRight, Users2, Check, X, AlertTriangle, Clock, StickyNote, Swords, Trophy,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { useStore } from "../../lib/store";
import { dateRangesOverlap, formatDate, formatVND } from "../../lib/format";
import { bookingTotal } from "../../lib/analytics";
import { BookingSourceBadge } from "../status";
import { PageHeader, EmptyState } from "../PageHeader";
import { BookingForm } from "../BookingForm";
import { BankTransferQueue } from "../admin/BankTransferQueue";
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
function fromNow(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}

export function Requests() {
  const { bookings, customer, roomLabel, findConflict, approveBooking, rejectBooking, notify } = useStore();
  const [creating, setCreating] = useState(false);

  const pending = useMemo(
    () => bookings.filter((b) => b.status === "pending"),
    [bookings],
  );

  // Với mỗi yêu cầu: tìm các yêu cầu khác tranh cùng phòng + trùng khoảng ngày, xếp hạng theo giờ gửi (đến trước ưu tiên trước)
  const withMeta = useMemo(() => {
    return pending
      .map((b) => {
        const competitors = pending.filter(
          (x) => x.id !== b.id && x.roomId === b.roomId && dateRangesOverlap(b.checkIn, b.checkOut, x.checkIn, x.checkOut),
        );
        const group = [b, ...competitors].sort((a, c) => (a.createdAt < c.createdAt ? -1 : 1));
        const rank = group.findIndex((x) => x.id === b.id) + 1;
        return { b, competitors, rank, groupSize: group.length };
      })
      // sắp xếp: phòng bị tranh lên trước, trong nhóm thì đến trước lên trên; còn lại theo giờ gửi mới nhất
      .sort((a, c) => {
        if (a.b.roomId !== c.b.roomId) {
          if (c.groupSize !== a.groupSize) return c.groupSize - a.groupSize;
          return a.b.createdAt < c.b.createdAt ? 1 : -1;
        }
        return a.rank - c.rank;
      });
  }, [pending]);

  const approve = (id: string) => {
    const target = pending.find((x) => x.id === id);
    const res = approveBooking(id);
    if (!res.ok) return toast.error(res.message);
    toast.success(res.message);
    notify(id, "booking_confirmation", "email");
    // Tự động từ chối các yêu cầu trùng phòng còn lại
    if (target) {
      const losers = pending.filter(
        (x) => x.id !== id && x.roomId === target.roomId && dateRangesOverlap(target.checkIn, target.checkOut, x.checkIn, x.checkOut),
      );
      if (losers.length) {
        losers.forEach((x) => {
          rejectBooking(x.id);
          notify(x.id, "cancellation", "email");
        });
        toast(`Đã tự động từ chối ${losers.length} yêu cầu trùng phòng.`);
      }
    }
  };
  const reject = (id: string, code: string) => {
    rejectBooking(id);
    toast.success(`Đã từ chối yêu cầu ${code}.`);
    notify(id, "cancellation", "email");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Inbox}
        title="Yêu cầu đặt phòng"
        description="Hàng đợi yêu cầu từ khách (website/OTA/điện thoại) chờ lễ tân duyệt. Duyệt để giữ phòng, từ chối nếu không đáp ứng."
        actions={<Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> Tạo yêu cầu</Button>}
      />

      <div className="rounded-md border border-[#e3ddd2] bg-[#fcfaf7] p-4">
        <BankTransferQueue />
      </div>

      {pending.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState icon={Inbox} title="Không có yêu cầu chờ duyệt" description="Mọi yêu cầu đã được xử lý. Yêu cầu mới từ cổng đặt phòng sẽ xuất hiện tại đây." /></CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {withMeta.map(({ b, competitors, rank }) => {
            const c = customer(b.customerId);
            const conflict = findConflict(b.roomId, b.checkIn, b.checkOut, b.id);
            const color = avatarColor(b.customerId);
            const contested = competitors.length > 0;
            const isFirst = rank === 1;
            return (
              <Card key={b.id} className={`overflow-hidden ${contested && isFirst ? "ring-2 ring-emerald-400" : ""}`}>
                <div className={`h-1 w-full ${contested ? "bg-rose-400" : "bg-amber-400"}`} />
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid place-items-center size-11 shrink-0 rounded-xl text-white font-medium" style={{ backgroundColor: color }}>{initials(c?.name ?? "?")}</span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{c?.phone} · {c?.email || "—"}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm">{b.code}</div>
                      <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Clock className="size-3" /> {fromNow(b.createdAt)}</div>
                      {contested && (
                        <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${isFirst ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {isFirst ? <><Trophy className="size-3" /> Đến trước · nên duyệt</> : <>Thứ {rank} · gửi sau</>}
                        </div>
                      )}
                    </div>
                  </div>

                  {contested && (
                    <div className="flex items-start gap-2 text-sm rounded-lg bg-rose-50 text-rose-700 p-2.5">
                      <Swords className="size-4 shrink-0 mt-0.5" />
                      <span>Có <b>{competitors.length}</b> yêu cầu khác cùng tranh phòng này trong khoảng ngày trùng nhau. Ưu tiên khách gửi trước — duyệt 1 yêu cầu sẽ tự động từ chối các yêu cầu còn lại.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                    <Info label="Phòng yêu cầu" value={roomLabel(b.roomId)} />
                    <Info label="Số khách" value={<span className="inline-flex items-center gap-1"><Users2 className="size-3.5" /> {b.guests} khách</span>} />
                    <div className="col-span-2">
                      <div className="text-[11px] text-muted-foreground mb-0.5">Thời gian lưu trú</div>
                      <div className="flex items-center gap-1.5">
                        <span>{formatDate(b.checkIn)}</span>
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                        <span>{formatDate(b.checkOut)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <BookingSourceBadge source={b.source} />
                    <div className="text-right"><span className="text-muted-foreground text-xs mr-1">Tạm tính</span><span className="font-semibold">{formatVND(bookingTotal(b))}</span></div>
                  </div>

                  {b.note && (
                    <div className="flex gap-2 text-sm rounded-lg border border-dashed p-2.5 text-muted-foreground">
                      <StickyNote className="size-4 shrink-0 mt-0.5" /> <span>{b.note}</span>
                    </div>
                  )}

                  {conflict && (
                    <div className="flex items-center gap-2 text-sm rounded-lg bg-rose-50 text-rose-700 p-2.5">
                      <AlertTriangle className="size-4 shrink-0" /> Phòng đã bị đặt trùng lịch ({conflict.code}). Cần đổi phòng trước khi duyệt.
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => approve(b.id)} disabled={!!conflict}>
                      <Check className="size-4" /> Duyệt & giữ phòng
                    </Button>
                    <Button variant="outline" className="flex-1 text-rose-600 hover:text-rose-700" onClick={() => reject(b.id, b.code)}>
                      <X className="size-4" /> Từ chối
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {creating && <BookingForm request onClose={() => setCreating(false)} />}
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground mb-0.5">{label}</div>
      <div>{value}</div>
    </div>
  );
}
