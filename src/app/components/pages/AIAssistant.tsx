import { useMemo, useState } from "react";
import { AlertTriangle, Copy, Loader2, Mail, Bot, TrendingUp, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { HOTEL_NAME, useStore } from "../../lib/store";
import { activeProvider, EmailKind, RoomSuggestionResult } from "../../lib/ai";
import { addDays, formatDate, nightsBetween, toISODate } from "../../lib/format";
import { occupiedOn, revenueOn } from "../../lib/analytics";
import { toast } from "sonner";

/** Bọc lời gọi AI với timeout + xử lý lỗi để UI có fallback rõ ràng */
async function withTimeout<T>(p: Promise<T>, ms = 30000): Promise<T> {
  const timeout = new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));
  return Promise.race([p, timeout]);
}

export function AIAssistant() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bot className="size-5 text-primary" />
        <p className="text-sm text-muted-foreground">
          Trợ lý AI dùng <Badge variant="secondary">{activeProvider.name}</Badge> — có thể thay provider trong <code>lib/ai.ts</code>.
        </p>
      </div>
      <Tabs defaultValue="advisor">
        <TabsList>
          <TabsTrigger value="advisor"><Wand2 className="size-4" /> Tư vấn phòng</TabsTrigger>
          <TabsTrigger value="email"><Mail className="size-4" /> Soạn email</TabsTrigger>
          <TabsTrigger value="insight"><TrendingUp className="size-4" /> Phân tích công suất</TabsTrigger>
        </TabsList>
        <TabsContent value="advisor" className="mt-4"><RoomAdvisor /></TabsContent>
        <TabsContent value="email" className="mt-4"><EmailDrafter /></TabsContent>
        <TabsContent value="insight" className="mt-4"><OccupancyInsight /></TabsContent>
      </Tabs>
    </div>
  );
}

function RoomAdvisor() {
  const { getAvailableRooms, roomType, roomLabel } = useStore();
  const today = toISODate(new Date());
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 2));
  const [guests, setGuests] = useState("2");
  const [budget, setBudget] = useState("");
  const [prefs, setPrefs] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoomSuggestionResult | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const available = getAvailableRooms(checkIn, checkOut, Number(guests) || 1)
        .map((room) => ({ room, type: roomType(room.typeId)! }))
        .filter((x) => x.type);
      const res = await withTimeout(activeProvider.suggestRooms({
        budgetPerNight: budget ? Number(budget) : undefined,
        guests: Number(guests) || 1,
        nights: nightsBetween(checkIn, checkOut),
        preferences: prefs,
        availableRooms: available,
      }));
      setResult(res);
    } catch {
      setError("AI xử lý quá lâu hoặc gặp lỗi. Vui lòng thử lại.");
    } finally { setLoading(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Tiêu chí</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Nhận phòng</Label><Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></div>
            <div className="space-y-2"><Label>Trả phòng</Label><Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Số khách</Label><Input type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} /></div>
            <div className="space-y-2"><Label>Ngân sách/đêm (VND)</Label><Input type="number" placeholder="Tùy chọn" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Ưu tiên (tiện ích…)</Label><Input placeholder="VD: ban công, bồn tắm" value={prefs} onChange={(e) => setPrefs(e.target.value)} /></div>
          <Button onClick={run} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="size-4 animate-spin" /> Đang tư vấn…</> : <><Wand2 className="size-4" /> Gợi ý phòng</>}
          </Button>
          <p className="text-xs text-muted-foreground">AI chỉ gợi ý trong danh sách phòng trống thực tế theo ngày & số khách đã chọn.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Kết quả</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading && <SkeletonLines />}
          {error && <Fallback text={error} />}
          {!loading && !error && !result && <p className="text-sm text-muted-foreground">Nhập tiêu chí và bấm “Gợi ý phòng”.</p>}
          {result && (
            <>
              <p className="text-sm">{result.intro}</p>
              {result.suggestions.map((s) => (
                <div key={s.roomId} className="rounded-lg border p-3">
                  <div className="font-medium mb-1">Phòng {roomLabel(s.roomId)}</div>
                  <p className="text-sm text-muted-foreground">{s.reason}</p>
                </div>
              ))}
              {result.fallback && <Fallback text={result.fallback} />}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmailDrafter() {
  const { bookings, customer, roomLabel } = useStore();
  const active = bookings.filter((b) => b.status !== "cancelled" || true);
  const [bookingId, setBookingId] = useState(active[0]?.id ?? "");
  const [kind, setKind] = useState<EmailKind>("confirmation");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const b = useMemo(() => bookings.find((x) => x.id === bookingId), [bookings, bookingId]);

  const run = async () => {
    if (!b) return toast.error("Chọn một đặt phòng.");
    setLoading(true); setError(""); setText("");
    try {
      const roomTotal = nightsBetween(b.checkIn, b.checkOut) * b.roomPricePerNight;
      const serviceTotal = b.services.reduce((s, x) => s + x.price * x.qty, 0);
      const amountDue = roomTotal + serviceTotal - (b.depositPaid ? (b.depositAmount ?? 0) : 0);

      const res = await withTimeout(activeProvider.draftEmail({
        kind, customerName: customer(b.customerId)?.name ?? "Quý khách",
        hotelName: HOTEL_NAME, bookingCode: b.code, roomLabel: roomLabel(b.roomId),
        checkIn: formatDate(b.checkIn), checkOut: formatDate(b.checkOut), 
        amountDue, guests: b.guests, services: b.services, 
        depositPaid: b.depositPaid, depositAmount: b.depositAmount, note: note.trim()
      }));
      setText(res);
    } catch { setError("Không soạn được email (timeout/lỗi). Thử lại sau."); }
    finally { setLoading(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Thông tin</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Đặt phòng</Label>
            <Select value={bookingId} onValueChange={setBookingId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{bookings.map((x) => <SelectItem key={x.id} value={x.id}>{x.code} · {customer(x.customerId)?.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Loại email</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as EmailKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmation">Xác nhận đặt phòng</SelectItem>
                <SelectItem value="cancellation">Xác nhận hủy</SelectItem>
                <SelectItem value="payment_reminder">Nhắc thanh toán</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ghi chú cho AI (Tùy chọn)</Label>
            <Textarea 
              placeholder="VD: Nhắc khách mang CCCD, dặn khách hồ bơi đang bảo trì..." 
              value={note} 
              onChange={(e) => setNote(e.target.value)} 
              className="resize-none h-20"
            />
          </div>
          <Button onClick={run} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="size-4 animate-spin" /> Đang soạn…</> : <><Mail className="size-4" /> Soạn email</>}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Nội dung</CardTitle>
          {text && <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(text); toast.success("Đã sao chép"); }}><Copy className="size-4" /> Sao chép</Button>}
        </CardHeader>
        <CardContent>
          {loading && <SkeletonLines />}
          {error && <Fallback text={error} />}
          {!loading && !error && (text
            ? <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-80 font-mono text-sm" />
            : <p className="text-sm text-muted-foreground">Chọn đặt phòng & loại email rồi bấm “Soạn email”.</p>)}
        </CardContent>
      </Card>
    </div>
  );
}

function OccupancyInsight() {
  const { bookings, rooms } = useStore();
  const today = toISODate(new Date());
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true); setError(""); setText("");
    try {
      const occToday = occupiedOn(bookings, today);
      const yesterday = occupiedOn(bookings, addDays(today, -1));
      const trend = occToday > yesterday ? "up" : occToday < yesterday ? "down" : "flat";
      const res = await withTimeout(activeProvider.occupancyInsight({
        occupancyRate: occToday / Math.max(rooms.length, 1),
        revenueToday: revenueOn(bookings, today),
        availableRooms: rooms.filter((r) => r.status === "available").length,
        totalRooms: rooms.length, trend,
      }));
      setText(res);
    } catch { setError("Không tạo được nhận xét (timeout/lỗi)."); }
    finally { setLoading(false); }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Nhận xét công suất & gợi ý khuyến mãi</CardTitle>
        <Button onClick={run} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <><TrendingUp className="size-4" /> Phân tích</>}</Button>
      </CardHeader>
      <CardContent>
        {loading && <SkeletonLines />}
        {error && <Fallback text={error} />}
        {!loading && !error && (text ? <p className="text-sm whitespace-pre-wrap">{text}</p> : <p className="text-sm text-muted-foreground">Bấm “Phân tích” để AI đánh giá công suất hiện tại và gợi ý khuyến mãi.</p>)}
      </CardContent>
    </Card>
  );
}

function SkeletonLines() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-4 rounded bg-muted" style={{ width: `${90 - i * 12}%` }} />)}
    </div>
  );
}

function Fallback({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <AlertTriangle className="size-4 mt-0.5 shrink-0" /> <span>{text}</span>
    </div>
  );
}
