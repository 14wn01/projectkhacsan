import { useEffect, useRef, useState } from "react";
import { X, Send, Bot, ArrowRight, Loader2 } from "lucide-react";
import { HOTEL_NAME, useStore } from "../lib/store";
import { occupiedOn, revenueOn } from "../lib/analytics";
import { addDays, formatVND, toISODate } from "../lib/format";
import { askGeminiResult, HotelContext } from "../lib/gemini";

interface Action { label: string; page: string }
interface Msg { id: string; role: "user" | "bot"; text: string; actions?: Action[] }

const SUGGESTIONS = [
  "Còn phòng trống không?",
  "Giá các loại phòng?",
  "Doanh thu hôm nay?",
  "Chính sách nhận & trả phòng?",
  "Khách sạn có dịch vụ gì?",
];

function noAccent(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "d")
    .toLowerCase();
}

let idc = 0;
const nid = () => `m${++idc}`;

export function Copilot({ onNavigate }: { onNavigate: (page: string) => void }) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: nid(),
      role: "bot",
      text: "Xin chào. Tôi là trợ lý vận hành của **Sao Mai Hotel**.\n\nHỏi phòng trống, giá, doanh thu, công suất hoặc chính sách nhận/trả phòng — tôi trả lời trên dữ liệu ca hôm nay.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const asked = msgs.some((m) => m.role === "user");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, thinking, open]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const getActionButtons = (q: string, replyText: string): Action[] => {
    const t = (noAccent(q) + " " + noAccent(replyText)).toLowerCase();
    const actions: Action[] = [];
    if (t.includes("phong") || t.includes("trong") || t.includes("dat phong")) {
      actions.push({ label: "Tra phòng trống", page: "availability" }, { label: "Đặt phòng", page: "bookings" });
    }
    if (t.includes("doanh thu") || t.includes("thong ke") || t.includes("cong suat")) {
      actions.push({ label: "Xem thống kê", page: "stats" });
    }
    if (t.includes("cong no") || t.includes("hoa don") || t.includes("thanh toan")) {
      actions.push({ label: "Mở hóa đơn", page: "invoices" });
    }
    if (t.includes("dich vu") || t.includes("an sang") || t.includes("dua don")) {
      actions.push({ label: "Dịch vụ", page: "services" });
    }
    if (t.includes("khach hang") || t.includes("hoi vien")) {
      actions.push({ label: "Khách hàng", page: "customers" });
    }
    return actions.slice(0, 2);
  };

  const opsAnswer = (q: string): Msg | null => {
    const t = noAccent(q);
    const today = toISODate(new Date());
    const has = (...k: string[]) => k.some((x) => t.includes(x));

    if (has("gia", "loai phong", "hang phong", "bao gia", "cac loai", "bang gia")) {
      const list = store.roomTypes
        .map((rt) => `• **${rt.name}**: ${formatVND(rt.basePrice)}/đêm (${rt.capacity} khách${rt.size ? `, ${rt.size}m²` : ""})`)
        .join("\n");
      return {
        id: nid(),
        role: "bot",
        text: list
          ? `**Hạng phòng & giá:**\n\n${list}`
          : "Chưa có hạng phòng trong hệ thống.",
        actions: [{ label: "Tra phòng trống", page: "availability" }, { label: "Đặt phòng", page: "bookings" }],
      };
    }

    if (has("phong trong", "con phong", "trong khong", "availab")) {
      const avail = store.getAvailableRooms(today, addDays(today, 1));
      const sample = avail.slice(0, 4).map((r) => `Phòng ${r.number}`).join(", ");
      return {
        id: nid(), role: "bot",
        text: avail.length
          ? `Hiện có **${avail.length}/${store.rooms.length}** phòng trống đêm nay${sample ? `: ${sample}${avail.length > 4 ? "…" : ""}` : ""}.`
          : "Hiện không còn phòng trống cho đêm nay.",
        actions: [{ label: "Tra phòng trống", page: "availability" }, { label: "Đặt phòng", page: "bookings" }],
      };
    }

    if (has("chinh sach") || has("gio nhan") || has("gio tra") || (has("nhan") && has("tra") && has("phong"))) {
      return {
        id: nid(), role: "bot",
        text: "**Giờ giấc:** nhận phòng từ **14:00**, trả phòng trước **12:00**.\n\nNhận sớm / trả muộn theo tình trạng phòng — lễ tân xác nhận khi khách báo trước.",
        actions: [{ label: "Tới đặt phòng", page: "bookings" }],
      };
    }

    if (has("dich vu", "an sang", "buffet", "spa", "dua don", "san bay")) {
      const list = store.services.map((s) => `• ${s.name}: ${formatVND(s.price)}`).join("\n");
      return {
        id: nid(), role: "bot",
        text: list ? `**Dịch vụ:**\n\n${list}` : "Chưa có dịch vụ trong hệ thống.",
        actions: [{ label: "Dịch vụ", page: "services" }],
      };
    }

    if (has("doanh thu", "thu nhap", "revenue")) {
      const rvToday = revenueOn(store.bookings, today);
      let week = 0;
      for (let i = 0; i < 7; i++) week += revenueOn(store.bookings, addDays(today, -i));
      return {
        id: nid(), role: "bot",
        text: `Doanh thu hôm nay: **${formatVND(rvToday)}**.\n7 ngày gần nhất: **${formatVND(week)}**.`,
        actions: [{ label: "Xem thống kê", page: "stats" }],
      };
    }

    if (has("cong suat", "occupancy", "lap day")) {
      const occ = occupiedOn(store.bookings, today);
      const rate = Math.round((occ / Math.max(store.rooms.length, 1)) * 100);
      return {
        id: nid(), role: "bot",
        text: `Công suất hôm nay: **${rate}%** (${occ}/${store.rooms.length} phòng đang có khách).`,
        actions: [{ label: "Bảng thống kê", page: "stats" }],
      };
    }

    if (has("cong no", "chua thanh toan", "chua thu", "unpaid", "hoa don")) {
      const open = store.invoices.filter((i) => i.status !== "paid");
      const owed = open.reduce((s, i) => s + (i.total - i.paid), 0);
      return {
        id: nid(), role: "bot",
        text: open.length
          ? `Có **${open.length}** hóa đơn chưa tất toán, tổng còn nợ **${formatVND(owed)}**.`
          : "Không có công nợ đang treo.",
        actions: [{ label: "Mở hóa đơn", page: "invoices" }],
      };
    }

    if (has("khach den", "arrival") || (has("nhan phong", "check in", "check-in") && !has("chinh sach", "gio"))) {
      const arr = store.bookings.filter((b) => b.checkIn === today && b.status !== "cancelled");
      const names = arr.map((b) => store.customer(b.customerId)?.name).filter(Boolean).join(", ");
      return {
        id: nid(), role: "bot",
        text: arr.length ? `Hôm nay có **${arr.length}** lượt nhận phòng: ${names}.` : "Hôm nay không có khách nhận phòng.",
        actions: [{ label: "Tới đặt phòng", page: "bookings" }],
      };
    }

    if (has("khach di", "departure", "roi di") || (has("tra phong", "check out", "check-out") && !has("chinh sach", "gio"))) {
      const dep = store.bookings.filter((b) => b.checkOut === today && b.status !== "cancelled");
      const names = dep.map((b) => store.customer(b.customerId)?.name).filter(Boolean).join(", ");
      return {
        id: nid(), role: "bot",
        text: dep.length ? `Hôm nay có **${dep.length}** lượt trả phòng: ${names}.` : "Hôm nay không có khách trả phòng.",
        actions: [{ label: "Tới đặt phòng", page: "bookings" }],
      };
    }

    return null;
  };

  const send = async (raw?: string) => {
    const q = (raw ?? input).trim();
    if (!q || thinking) return;

    const userMsg: Msg = { id: nid(), role: "user", text: q };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);
    setInput("");
    setThinking(true);

    try {
      const today = toISODate(new Date());
      const avail = store.getAvailableRooms(today, addDays(today, 1));
      const occ = occupiedOn(store.bookings, today);
      const rate = Math.round((occ / Math.max(store.rooms.length, 1)) * 100);
      const rvToday = revenueOn(store.bookings, today);

      const dbRooms = store.rooms.map(r => `Phòng ${r.id} (${r.typeId}): ${r.status}`).join(", ");
      const dbBookings = store.bookings
        .filter(b => b.status !== "cancelled")
        .map(b => `Mã ${b.id}: Khách ${store.customers.find(c => c.id === b.customerId)?.name ?? "Không rõ"} ở phòng ${b.roomId || "chưa xếp"} (${b.checkIn} đến ${b.checkOut}, trạng thái: ${b.status})`)
        .join("; ");

      const hotelContext: HotelContext = {
        hotelName: HOTEL_NAME,
        totalRooms: store.rooms.length,
        availableRoomsCount: avail.length,
        roomTypesSummary: store.roomTypes.map((t) => `${t.name}: ${formatVND(t.basePrice)}/đêm (sức chứa ${t.capacity} khách)`).join("; "),
        servicesSummary: store.services.map((s) => `${s.name}: ${formatVND(s.price)}`).join("; "),
        todayStats: `Hôm nay có ${avail.length}/${store.rooms.length} phòng trống. Công suất ~${rate}%. Doanh thu ngày: ${formatVND(rvToday)}.`,
        databaseContext: `Tình trạng phòng: ${dbRooms}\nCác đặt phòng hiện tại: ${dbBookings}`,
        isAdmin: true,
      };

      const history = newMsgs
        .filter((m, i) => !(i === 0 && m.role === "bot"))
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("model" as const),
          text: m.text,
        }));

      const result = await askGeminiResult(q, history, hotelContext);

      if (result.ok) {
        const actions = getActionButtons(q, result.text);
        setMsgs((m) => [...m, { id: nid(), role: "bot", text: result.text, actions }]);
      } else {
        const ops = opsAnswer(q);
        if (ops) {
          setMsgs((m) => [...m, ops]);
        } else {
          const actions = getActionButtons(q, result.text);
          setMsgs((m) => [...m, { id: nid(), role: "bot", text: result.text, actions }]);
        }
      }
    } catch {
      const reply = opsAnswer(q);
      setMsgs((m) => [...m, reply ?? {
        id: nid(),
        role: "bot",
        text: "Hỏi giá phòng, phòng trống, doanh thu hoặc chính sách nhận/trả phòng — tôi trả lời từ dữ liệu ca hôm nay.",
        actions: [{ label: "Tra phòng trống", page: "availability" }, { label: "Xem thống kê", page: "stats" }],
      }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <>
      {/* Nút nổi */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 grid place-items-center size-14 rounded-full text-white shadow-xl bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 hover:scale-105 active:scale-95 transition-transform"
        aria-label="Trợ lý AI"
        aria-expanded={open}
      >
        {open ? <X className="size-6" /> : <Bot className="size-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[92vw] max-w-sm rounded-2xl border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[72vh] min-h-[420px]">
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-white">
            <div className="grid place-items-center size-8 rounded-lg bg-white/20"><Bot className="size-4" /></div>
            <div className="leading-tight flex-1 min-w-0">
              <div className="font-medium text-sm">Trợ lý</div>
              <div className="text-[11px] opacity-90">Hỏi nhanh về ca hôm nay</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid place-items-center size-9 rounded-md hover:bg-white/15" aria-label="Đóng">
              <X className="size-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/30">
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"
                }`}>
                  <RichText text={m.text} />
                  {m.actions && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.actions.map((a) => (
                        <button
                          key={a.label}
                          onClick={() => { onNavigate(a.page); setOpen(false); }}
                          className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-accent transition-colors"
                        >
                          {a.label} <ArrowRight className="size-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="rounded-xl border bg-card px-3 py-2.5 text-sm text-muted-foreground flex items-center gap-1.5" aria-live="polite">
                  <span className="size-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.2s]" />
                  <span className="size-1.5 rounded-full bg-amber-500 animate-bounce" />
                  <span className="size-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            )}
          </div>

          {!asked && (
            <div className="px-3 pt-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={thinking}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 border-t p-2.5 bg-card">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hỏi giá phòng, phòng trống…"
              className="flex-1 bg-muted/40 px-3 py-2 text-sm outline-none min-h-11"
              aria-label="Tin nhắn tới trợ lý"
            />
            <button type="submit" disabled={!input.trim() || thinking} aria-label="Gửi"
              className="grid place-items-center size-11 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity">
              {thinking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

// Hiển thị **đậm** đơn giản và xuống dòng.
function RichText({ text }: { text: string }) {
  return (
    <span className="whitespace-pre-wrap">
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>,
      )}
    </span>
  );
}
