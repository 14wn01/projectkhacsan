import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Loader2,
  Send,
  X,
  RotateCcw,
  BedDouble,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";
import { HOTEL_FULL_NAME, useStore } from "../../lib/store";
import { RoomType } from "../../lib/types";
import { addDays, formatVND, nightsBetween, toISODate } from "../../lib/format";
import { BookingFlow } from "./BookingFlow";
import { askGeminiResult, hasGeminiApiKey, HotelContext } from "../../lib/gemini";
import { trapTab } from "../../lib/a11y";

/** Đề xuất phòng kèm theo một tin nhắn của bot. */
interface Offer {
  typeId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  perNight: number;
  total: number;
  nights: number;
}

interface Msg {
  id: string;
  role: "user" | "bot";
  text: string;
  offers?: Offer[];
  time?: string;
}

const SUGGESTIONS = [
  "Báo giá residences",
  "Bàn 12 vị trí",
  "Một ngày tại Sao Mai",
  "Residences dài hạn",
];

let seq = 0;
const nid = () => `c${++seq}`;
const getTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

/** Bỏ dấu tiếng Việt để so khớp tự nhiên hơn. */
function noAccent(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0111/gi, "d").toLowerCase();
}

/**
 * Chỉ hiện thẻ đề xuất phòng khi câu hỏi THỰC SỰ liên quan tới đặt phòng /
 * giá / tình trạng phòng trống — tránh việc bot gắn thẻ phòng vào mọi câu
 * trả lời (VD: hỏi giờ ăn sáng thì không cần thẻ phòng đi kèm).
 */
function isRoomIntent(t: string): boolean {
  return /\b(phong|dat phong|book|booking|gia phong|hang phong|loai phong|phong trong|con phong|trong khong|available|nhan phong|check ?in|dem|nights?)\b/.test(
    t,
  );
}

/** Đọc số khách từ câu nói: "2 người", "gia đình 4 khách". */
function parseGuests(t: string): number | null {
  const m = t.match(/(\d+)\s*(nguoi|khach|khách|guest|pax)/);
  if (m) return Math.min(Math.max(Number(m[1]), 1), 10);
  if (/\b(mot minh|solo|di mot nguoi)\b/.test(t)) return 1;
  if (/\b(cap doi|honeymoon|vo chong)\b/.test(t)) return 2;
  return null;
}

/** Đọc số đêm: "3 đêm", "2 ngày 1 đêm". */
function parseNights(t: string): number | null {
  const m = t.match(/(\d+)\s*(dem|night)/);
  return m ? Math.min(Math.max(Number(m[1]), 1), 30) : null;
}

/** Đọc ngân sách: "dưới 800k", "khoảng 1 triệu", "1tr5". */
function parseBudget(t: string): number | null {
  const tr = t.match(/(\d+(?:[.,]\d+)?)\s*(tr|trieu)/);
  if (tr) return Math.round(Number(tr[1].replace(",", ".")) * 1_000_000);
  const k = t.match(/(\d{2,4})\s*(k|nghin|ngan)/);
  if (k) return Number(k[1]) * 1000;
  const raw = t.match(/(\d{6,9})/);
  return raw ? Number(raw[1]) : null;
}

/** Đọc ngày nhận phòng: "tối nay", "mai", "cuối tuần", "20/9". */
function parseCheckIn(t: string): string {
  const today = toISODate(new Date());
  if (/\b(mai|ngay mai|tomorrow)\b/.test(t)) return addDays(today, 1);
  if (/\b(mot ngay|ngay mot|hai ngay nua)\b/.test(t)) return addDays(today, 2);
  if (/\b(cuoi tuan|weekend|thu 7|thu bay|sat)\b/.test(t)) {
    const d = new Date();
    const delta = (6 - d.getDay() + 7) % 7 || 7;
    return addDays(today, delta);
  }
  const dm = t.match(/(\d{1,2})[/\-](\d{1,2})/);
  if (dm) {
    const now = new Date();
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const year = month < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear();
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return iso >= today ? iso : today;
    }
  }
  return today;
}

const INITIAL_MSG: Msg = {
  id: nid(),
  role: "bot",
  text: "Kính chào Quý khách. Em là concierge của **Sao Mai**. 13 residences — một khoảng trời riêng. Em có thể giúp gì?",
  time: getTime(),
};

/**
 * Chatbot hỗ trợ & đặt phòng 24/7 — cùng hệ token Maison Atelier.
 */
export function BookingChat({ onOpenLegal }: { onOpenLegal?: () => void }) {
  const { roomTypes, getAvailableRooms, quoteFor, rooms } = useStore();
  const [open, setOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<{ type: RoomType; offer: Offer } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([INITIAL_MSG]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const asked = msgs.some((m) => m.role === "user");
  const geminiReady = hasGeminiApiKey();

  const fitComposer = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [msgs, thinking, open]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (picked) return;
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (picked) return;
      if (panelRef.current) trapTab(panelRef.current, e);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, picked]);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      fabRef.current?.focus();
    }
  }, [open]);

  const resetChat = () => {
    setMsgs([{ ...INITIAL_MSG, id: nid(), time: getTime() }]);
  };

  const extractOffers = (q: string): Offer[] => {
    const t = noAccent(q);
    const guests = parseGuests(t) ?? 2;
    const nights = parseNights(t) ?? 1;
    const budget = parseBudget(t);
    const checkIn = parseCheckIn(t);
    const checkOut = addDays(checkIn, nights);

    const available = getAvailableRooms(checkIn, checkOut, guests);
    if (available.length === 0) return [];

    const byType = new Map<string, string>();
    available.forEach((r) => {
      if (!byType.has(r.typeId)) byType.set(r.typeId, r.id);
    });

    let offers = Array.from(byType.entries()).map(([typeId, roomId]) => {
      const type = roomTypes.find((x) => x.id === typeId);
      const quote = quoteFor(typeId, checkIn, checkOut);
      const perNight = quote ? quote.avgPerNight : (type?.basePrice ?? 0);
      return {
        typeId,
        roomId,
        perNight,
        total: quote ? quote.total : perNight * nights,
        checkIn,
        checkOut,
        guests,
        nights,
      };
    });

    if (budget) {
      const fit = offers.filter((o) => o.perNight <= budget * 1.05);
      // Nếu khách yêu cầu ngân sách nhưng không có phòng nào vừa, KHÔNG trả về các phòng đắt tiền.
      offers = fit; 
    }

    offers.sort((a, b) => a.perNight - b.perNight);
    return offers.slice(0, 3);
  };

  const send = async (raw?: string) => {
    const q = (raw ?? input).trim();
    if (!q || thinking) return;

    const userMsg: Msg = { id: nid(), role: "user", text: q, time: getTime() };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);
    setInput("");
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.style.height = "44px";
      }
    });
    setThinking(true);

    try {
      const today = toISODate(new Date());
      const avail = getAvailableRooms(today, addDays(today, 1));

      const hotelContext: HotelContext = {
        hotelName: HOTEL_FULL_NAME,
        totalRooms: rooms.length,
        availableRoomsCount: avail.length,
        roomTypesSummary: roomTypes
          .map((t) =>
            t.id === "rt6" || /sao mai residence/i.test(t.name)
              ? `${t.name} (Giá theo yêu cầu, Sức chứa: ${t.capacity} khách)`
              : `${t.name} (Từ ${formatVND(t.basePrice)}/đêm, Sức chứa: ${t.capacity} khách)`
          )
          .join("; "),
        servicesSummary: "Butler sắp xếp giặt ủi, xe đón, bàn ăn riêng. Đồ giặt thu buổi sáng, trả trước tối.",
        todayStats: `Hideaway 13 residences. Check-in riêng.`,
      };

      const history = newMsgs
        .filter((m, i) => !(i === 0 && m.role === "bot"))
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("model" as const),
          text: m.text,
        }));

      const result = await askGeminiResult(q, history, hotelContext);
      const offers = isRoomIntent(noAccent(q)) ? extractOffers(q) : [];

      setMsgs((m) => [...m, { id: nid(), role: "bot", text: result.text, offers, time: getTime() }]);
    } catch (err) {
      console.warn("[BookingChat] Lỗi:", err);
      const roomIntent = isRoomIntent(noAccent(q));
      const offers = roomIntent ? extractOffers(q) : [];
      setMsgs((m) => [
        ...m,
        {
          id: nid(),
          role: "bot",
          text:
            offers.length > 0
              ? "Dạ, em tìm thấy vài residences còn chỗ phù hợp với yêu cầu của Quý khách bên dưới ạ:"
              : roomIntent
                ? "Dạ rất tiếc hiện không còn căn khớp yêu cầu này. Quý khách thử đổi ngày hoặc số khách giúp em nhé."
                : `Dạ về câu hỏi "**${q}**", hiện kết nối của em đang chậm nên chưa trả lời chính xác được. Quý khách vui lòng thử gửi lại giúp em nhé.`,
          offers,
          time: getTime(),
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const choose = (o: Offer) => {
    const type = roomTypes.find((x) => x.id === o.typeId);
    if (type) setPicked({ type, offer: o });
  };

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className="lux-chat-fab"
        data-open={open ? "true" : "false"}
        aria-expanded={open}
        aria-controls="lux-chat-panel"
        aria-label={open ? "Đóng trợ lý" : "Mở trợ lý Sao Mai"}
        onClick={() => setOpen((v) => !v)}
      >
        {!open && (
          <>
            <span className="lux-chat-fab__ring" aria-hidden />
            <span className="lux-chat-fab__ring lux-chat-fab__ring--late" aria-hidden />
            <span className="lux-chat-fab__dot" aria-hidden />
          </>
        )}
        <span className="lux-chat-fab__icon">
          {open ? <X size={22} strokeWidth={2} /> : <MessageCircle size={22} strokeWidth={1.5} />}
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="lux-chat-scrim"
            aria-label="Đóng khung chat"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            id="lux-chat-panel"
            className="lux-chat-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lux-chat-title"
          >
            <div className="lux-chat-head">
              <div className="lux-chat-head__mark" aria-hidden>SM</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="lux-chat-head__kicker">Concierge</p>
                <div className="lux-chat-head__title" id="lux-chat-title">Sao Mai</div>
                <div className="lux-chat-head__sub">
                  <span className="lux-chat-head__live" data-mode={geminiReady ? "live" : "offline"} aria-hidden />
                  {geminiReady ? "Trợ lý AI" : "Chế độ dự phòng"}
                  <span aria-hidden>·</span>
                  <ShieldCheck size={11} aria-hidden />
                  {geminiReady ? "trực tuyến" : "nội bộ"}
                </div>
              </div>
              <button type="button" className="lux-chat-iconbtn" onClick={resetChat} title="Bắt đầu lại" aria-label="Bắt đầu lại">
                <RotateCcw size={16} />
              </button>
              <button type="button" className="lux-chat-iconbtn" onClick={() => setOpen(false)} title="Đóng" aria-label="Đóng hội thoại">
                <X size={16} />
              </button>
            </div>

            <div ref={scrollRef} className="lux-chat-stream">
              {msgs.map((m) => (
                <div key={m.id} className={`lux-chat-row lux-chat-row--${m.role}`}>
                  {m.role === "bot" && <div className="lux-chat-ava" aria-hidden>SM</div>}
                  <div className="lux-chat-col">
                    <div className={`lux-chat-bubble lux-chat-bubble--${m.role}`}>
                      <ChatText text={m.text} onInk={m.role === "user"} />
                    </div>
                    {m.offers && m.offers.length > 0 && (
                      <div style={{ width: "100%", display: "grid", gap: 8 }}>
                        <p className="lux-eyebrow">Residences phù hợp</p>
                        {m.offers.map((o) => (
                          <OfferCard
                            key={o.typeId}
                            offer={o}
                            type={roomTypes.find((x) => x.id === o.typeId)}
                            onChoose={() => choose(o)}
                          />
                        ))}
                      </div>
                    )}
                    {m.time && <span className="lux-chat-time">{m.time}</span>}
                  </div>
                </div>
              ))}

              {thinking && (
                <div className="lux-chat-row lux-chat-row--bot" aria-live="polite" aria-label="Đang soạn trả lời">
                  <div className="lux-chat-ava" aria-hidden>SM</div>
                  <div className="lux-chat-col">
                    <div className="lux-chat-bubble lux-chat-bubble--bot lux-chat-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="lux-chat-foot">
              {!asked && (
                <div className="lux-chat-chips">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} disabled={thinking}>
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <form
                className="lux-chat-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  rows={1}
                  onChange={(e) => {
                    setInput(e.target.value);
                    fitComposer();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Hỏi giá phòng, giờ nhận phòng…"
                  aria-label="Tin nhắn tới concierge"
                  autoComplete="off"
                />
                <button type="submit" disabled={!input.trim() || thinking} aria-label="Gửi tin nhắn">
                  {thinking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {picked && (
        <BookingFlow
          type={picked.type}
          roomId={picked.offer.roomId}
          checkIn={picked.offer.checkIn}
          checkOut={picked.offer.checkOut}
          guests={picked.offer.guests}
          nights={Math.max(nightsBetween(picked.offer.checkIn, picked.offer.checkOut), 1)}
          onClose={() => setPicked(null)}
          onOpenLegal={onOpenLegal}
        />
      )}
    </>
  );
}

function OfferCard({
  offer,
  type,
  onChoose,
}: {
  offer: Offer;
  type?: RoomType;
  onChoose: () => void;
}) {
  return (
    <div className="lux-offer">
      <div className="lux-offer__body">
        <div className="lux-offer__name">
          <BedDouble size={14} aria-hidden style={{ display: "inline", marginRight: 6, color: "var(--lux-gold-deep)" }} />
          {type?.name ?? "Residence"}
        </div>
        <div className="lux-offer__meta">
          {type?.capacity ?? offer.guests} khách · {type?.size ?? 35}m² · {offer.nights} đêm
        </div>
      </div>
      <div className="lux-offer__stub">
        <div className="lux-offer__price tabular-nums">
          {type && (type.id === "rt6" || /sao mai residence/i.test(type.name))
            ? "Theo yêu cầu"
            : formatVND(offer.perNight)}
        </div>
        {!(type && (type.id === "rt6" || /sao mai residence/i.test(type.name))) && (
          <span className="lux-field-hint">/ đêm</span>
        )}
        <button type="button" className="lux-btn lux-btn--ink lux-btn--sm" onClick={onChoose}>
          Giữ phòng <ArrowRight className="lux-btn__icon" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function ChatText({ text, onInk }: { text: string; onInk: boolean }) {
  return (
    <div>
      {text.split("\n").map((line, lineIdx) => {
        const isBullet = line.trim().startsWith("•") || line.trim().startsWith("-");
        const cleanLine = isBullet ? line.trim().replace(/^[•\-]\s*/, "") : line;
        return (
          <p key={lineIdx} style={{ margin: lineIdx === 0 ? 0 : "6px 0 0" }}>
            {isBullet && <span aria-hidden>{onInk ? "– " : "· "}</span>}
            {cleanLine.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={i}>{part.slice(2, -2)}</strong>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}
