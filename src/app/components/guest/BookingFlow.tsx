import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ClipboardList, Clock } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { DEPOSIT_PERCENT, useStore } from "../../lib/store";
import { Booking, RoomHold, RoomType } from "../../lib/types";
import { formatDate, formatVND, toISODate } from "../../lib/format";
import { formatRemaining } from "../../lib/holds";
import { RoomPreview } from "./RoomPreview";
import { GuestAuthForm } from "./GuestAuth";
import { DepositPanel } from "./DepositDialog";
import { toast } from "sonner";
import type { SunsetSlot } from "./stay";
import { UtensilsCrossed } from "lucide-react";

type Step = "auth" | "confirm" | "deposit" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "auth", label: "Tài khoản" },
  { id: "confirm", label: "Xác nhận" },
  { id: "deposit", label: "Đặt cọc" },
  { id: "done", label: "Hoàn tất" },
];

const STEP_META: Record<Step, (t: RoomType, ci: string, co: string, n: number, g: number) => { title: string; desc: string }> = {
  auth: (t, ci, co) => ({
    title: "Đăng nhập để đặt phòng",
    desc: `${t.name} · ${formatDate(ci)} → ${formatDate(co)}`,
  }),
  confirm: (t, ci, co, n, g) => ({
    title: `Xác nhận ${t.name}`,
    desc: `${formatDate(ci)} → ${formatDate(co)} · ${n} đêm · ${g} khách`,
  }),
  deposit: () => ({
    title: "Đặt cọc giữ phòng",
    desc: `Cọc ${Math.round(DEPOSIT_PERCENT * 100)}% để giữ chỗ — phần còn lại thanh toán khi nhận phòng.`,
  }),
  done: () => ({
    title: "Đặt phòng đã ghi nhận",
    desc: "Yêu cầu của bạn đã vào hệ thống lễ tân.",
  }),
};

function stepState(id: Step, current: Step, loggedIn: boolean): "done" | "current" | "todo" {
  const order: Step[] = ["auth", "confirm", "deposit", "done"];
  const i = order.indexOf(id);
  const c = order.indexOf(current);
  if (id === "auth" && loggedIn && current !== "auth") return "done";
  if (i < c) return "done";
  if (i === c) return "current";
  return "todo";
}

/**
 * Flow đặt phòng của khách:
 * chọn phòng → [đăng nhập/đăng ký nếu chưa] → giữ phòng tạm 15 phút + xác nhận → cọc → hoàn tất.
 * Hold chống 2 khách cùng chốt 1 phòng trong lúc đang nhập thông tin.
 */
export function BookingFlow({ type, roomId, checkIn, checkOut, guests, nights, sunset: sunsetPref = "", transfer: transferPref = false, onClose, onViewBookings, onOpenLegal }: {
  type: RoomType;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  sunset?: SunsetSlot | "";
  transfer?: boolean;
  onClose: () => void;
  onViewBookings?: () => void;
  onOpenLegal?: () => void;
}) {
  const { currentUser, customers, saveCustomer, createBookingSafe, holdRoom, dropHold, quoteFor } = useStore();
  const [sunset, setSunset] = useState<SunsetSlot | "">(sunsetPref);
  const [step, setStep] = useState<Step>(currentUser ? "confirm" : "auth");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [paid, setPaid] = useState(false);
  const [name, setName] = useState(currentUser?.name ?? "");
  const [phone, setPhone] = useState(currentUser?.phone ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [hold, setHold] = useState<RoomHold | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const consumedRef = useRef(false);
  const submitLock = useRef(false);
  const holdRef = useRef<RoomHold | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      setName((v) => v || currentUser.name);
      setPhone((v) => v || currentUser.phone || "");
      setEmail((v) => v || currentUser.email || "");
    }
  }, [currentUser]);

  useEffect(() => {
    if (step !== "confirm" || hold || holdError) return;
    const res = holdRoom({ roomId, checkIn, checkOut, guests, customerId: currentUser?.customerId });
    if (res.ok && res.hold) { holdRef.current = res.hold; setHold(res.hold); }
    else setHoldError(res.message);
  }, [step, hold, holdError, holdRoom, roomId, checkIn, checkOut, guests, currentUser]);

  useEffect(() => {
    if (!hold) return;
    const tick = () => {
      const ms = new Date(hold.expiresAt).getTime() - Date.now();
      setRemaining(ms);
      if (ms <= 0) {
        const id = holdRef.current?.id ?? hold.id;
        if (id) dropHold(id);
        holdRef.current = null;
        setHold(null);
        setHoldError("Hết thời gian giữ phòng. Bạn cần chọn lại để đảm bảo phòng còn trống.");
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [hold, dropHold]);

  const releaseIfUnused = useCallback(() => {
    if (holdRef.current && !consumedRef.current) {
      dropHold(holdRef.current.id);
      holdRef.current = null;
    }
  }, [dropHold]);

  useEffect(() => () => releaseIfUnused(), [releaseIfUnused]);

  const quote = quoteFor(type.id, checkIn, checkOut);
  const total = quote ? quote.total : type.basePrice * nights;
  const deposit = Math.round(total * DEPOSIT_PERCENT);
  const meta = STEP_META[step](type, checkIn, checkOut, nights, guests);
  const errorEntries = Object.entries(fieldErrors);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Nhập họ tên in trên giấy tờ.";
    if (!phone.trim()) next.phone = "Nhập số điện thoại để lễ tân liên hệ.";
    else if (!/^[+\d][\d\s().-]{7,19}$/.test(phone.trim())) next.phone = "Số điện thoại chưa đúng định dạng.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Email chưa hợp lệ — để trống nếu không dùng.";
    if (!hold || holdError || new Date(hold.expiresAt).getTime() <= Date.now()) {
      next.hold = "Phòng chưa được giữ. Đóng hộp thoại và chọn lại phòng.";
    }
    setFieldErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => {
        summaryRef.current?.focus();
        if (next.name) nameRef.current?.focus();
        else if (next.phone) phoneRef.current?.focus();
        else if (next.email) emailRef.current?.focus();
      });
      return;
    }
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const existing = currentUser?.customerId
        ? customers.find((c) => c.id === currentUser.customerId)
        : customers.find((c) => c.phone.trim() === phone.trim());
      const cust = saveCustomer({
        id: existing?.id ?? "",
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        idNumber: existing?.idNumber ?? "",
        address: existing?.address ?? "",
        createdAt: existing?.createdAt ?? toISODate(new Date()),
      });
      const extras: string[] = [];
      if (sunset) extras.push(`Bàn hoàng hôn ${sunset} (12 vị trí, giữ chỗ)`);
      const composedNote = [note.trim(), extras.join(" · ")].filter(Boolean).join(" — ");
      const res = await createBookingSafe({
        roomId, customerId: cust.id, checkIn, checkOut, guests,
        note: composedNote || undefined, status: "pending", source: "website",
        holdId: hold?.id,
        idempotencyKey: `web-${cust.id}-${roomId}-${checkIn}-${checkOut}`,
      });
      if (res.ok && res.booking) {
        consumedRef.current = true;
        setBooking(res.booking);
        setStep("deposit");
      } else toast.error(res.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu đặt phòng. Vui lòng thử lại.");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) { releaseIfUnused(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg booking-dialog lux-sheet" overlayClassName="lux-overlay">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>{meta.desc}</DialogDescription>
        </DialogHeader>

        <ol className="lux-progress" aria-label="Các bước đặt phòng">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className="lux-progress__step"
              data-state={stepState(s.id, step, Boolean(currentUser))}
              aria-current={step === s.id ? "step" : undefined}
            >
              <span className="lux-progress__idx">{String(i + 1).padStart(2, "0")}</span>
              <span className="lux-progress__label">{s.label}</span>
            </li>
          ))}
        </ol>

        {step === "auth" && (
          <div className="lux-form">
            <div className="lux-bill" role="status">
              <div className="lux-bill__row">
                <span>{type.name} · {nights} đêm</span>
                <span className="tabular-nums">{formatVND(total)}</span>
              </div>
            </div>
            <GuestAuthForm onDone={() => setStep("confirm")} />
          </div>
        )}

        {step === "confirm" && (
          <div className="lux-form">
            <div className="lux-preview">
              <RoomPreview type={type} image={type.image || "/media/room-deluxe.webp"} />
            </div>

            {hold && remaining > 0 && (
              <div className="lux-alert lux-alert--ok" role="status">
                <Clock className="size-4" aria-hidden />
                <span>
                  Phòng đang được giữ — còn{" "}
                  <b className="tabular-nums">{formatRemaining(remaining)}</b> để hoàn tất.
                </span>
              </div>
            )}
            {holdError && (
              <div className="lux-alert lux-alert--warn" role="alert">
                <AlertTriangle className="size-4" aria-hidden />
                <div>
                  {holdError}
                  <div className="lux-field-hint">Đóng hộp thoại và chọn lại phòng trước khi tiếp tục.</div>
                </div>
              </div>
            )}

            {errorEntries.length > 0 && (
              <div className="lux-alert lux-alert--danger" role="alert" tabIndex={-1} ref={summaryRef}>
                <div>
                  <p className="lux-alert__title">Chưa thể xác nhận</p>
                  <ul>
                    {errorEntries.map(([key, msg]) => (
                      <li key={key}><a href={`#booking-${key}`}>{msg}</a></li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="lux-form__row lux-form__row--2">
              <div className="sm:col-span-2" style={{ gridColumn: "1 / -1" }}>
                <label className="lux-label" htmlFor="booking-name">Họ tên <span className="lux-req" aria-hidden>*</span></label>
                <input
                  ref={nameRef}
                  id="booking-name"
                  className="lux-input"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setFieldErrors((f) => ({ ...f, name: "" })); }}
                  aria-invalid={Boolean(fieldErrors.name) || undefined}
                  aria-describedby={fieldErrors.name ? "booking-name-err" : undefined}
                />
                {fieldErrors.name && <p id="booking-name-err" className="lux-field-error">{fieldErrors.name}</p>}
              </div>
              <div>
                <label className="lux-label" htmlFor="booking-phone">Số điện thoại <span className="lux-req" aria-hidden>*</span></label>
                <input
                  ref={phoneRef}
                  id="booking-phone"
                  className="lux-input"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setFieldErrors((f) => ({ ...f, phone: "" })); }}
                  aria-invalid={Boolean(fieldErrors.phone) || undefined}
                  aria-describedby={fieldErrors.phone ? "booking-phone-err" : undefined}
                />
                {fieldErrors.phone && <p id="booking-phone-err" className="lux-field-error">{fieldErrors.phone}</p>}
              </div>
              <div>
                <label className="lux-label" htmlFor="booking-email">Email</label>
                <input
                  ref={emailRef}
                  id="booking-email"
                  className="lux-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: "" })); }}
                  aria-invalid={Boolean(fieldErrors.email) || undefined}
                  aria-describedby={fieldErrors.email ? "booking-email-err" : undefined}
                />
                {fieldErrors.email && <p id="booking-email-err" className="lux-field-error">{fieldErrors.email}</p>}
              </div>
            </div>
            <div>
              <label className="lux-label" htmlFor="booking-note">Yêu cầu đặc biệt</label>
              <textarea
                id="booking-note"
                className="lux-textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Phòng tầng cao, giường đôi…"
              />
            </div>

            <fieldset className="lux-form" style={{ border: 0, margin: 0, padding: 0 }}>
              <legend className="lux-label">Bàn tối</legend>
              <div className="lux-extras">
                <button type="button" aria-pressed={sunset === "18:30"} onClick={() => setSunset(sunset === "18:30" ? "" : "18:30")}>
                  <span><UtensilsCrossed className="size-4" aria-hidden /> Bàn hoàng hôn 18:30</span>
                  <span className="lux-field-hint">Giữ chỗ với concierge</span>
                </button>
                <button type="button" aria-pressed={sunset === "19:30"} onClick={() => setSunset(sunset === "19:30" ? "" : "19:30")}>
                  <span><UtensilsCrossed className="size-4" aria-hidden /> Bàn 19:30</span>
                  <span className="lux-field-hint">Giữ chỗ với concierge</span>
                </button>
              </div>
              <p className="lux-field-hint" style={{ marginTop: 12 }}>Butler sắp xếp giặt ủi, xe đón, bàn ăn riêng.</p>
            </fieldset>

            <div className="lux-bill">
              <div className="lux-bill__row lux-bill__row--total">
                <span>{nights} đêm · {quote ? formatVND(quote.avgPerNight) + "/đêm" : formatVND(type.basePrice) + "/đêm"}</span>
                <span className="tabular-nums">{formatVND(total)}</span>
              </div>
              <div className="lux-bill__row">
                <span>Cọc giữ chỗ ({Math.round(DEPOSIT_PERCENT * 100)}%) — bước tiếp</span>
                <span className="tabular-nums">{formatVND(deposit)}</span>
              </div>
              <div className="lux-bill__row">
                <span>Thanh toán tại nhà</span>
                <span className="tabular-nums">{formatVND(total - deposit)}</span>
              </div>
            </div>

            <div className="lux-actions">
              <button type="button" className="lux-btn lux-btn--outline" onClick={() => { releaseIfUnused(); onClose(); }}>
                Hủy
              </button>
              <button
                type="button"
                className="lux-btn lux-btn--ink"
                onClick={() => void submit()}
                disabled={submitting || !hold || !!holdError || remaining <= 0}
              >
                <Check className="lux-btn__icon" aria-hidden />
                {submitting ? "Đang lưu…" : "Xác nhận đặt phòng"}
              </button>
            </div>
          </div>
        )}

        {step === "deposit" && booking && (
          <div className="lux-form">
            <DepositPanel
              booking={booking}
              onOpenLegal={onOpenLegal}
              onPaid={() => {
                setPaid(true);
                setStep("done");
              }}
            />
            <button type="button" className="lux-ghost" onClick={() => setStep("done")}>
              Để cọc sau — phòng chưa được giữ cho đến khi cọc
            </button>
          </div>
        )}

        {step === "done" && booking && (
          <div className="lux-done">
            <hr className="lux-rule" />
            <div className="lux-eyebrow">Mã đặt phòng</div>
            <div className="lux-done__code">{booking.code}</div>
            <p className="lux-muted">
              {paid
                ? "Tiền cọc đã được ghi nhận — phòng đang được giữ. Lễ tân sẽ sớm xác nhận."
                : "Yêu cầu đã được ghi nhận. Bạn có thể cọc giữ phòng bất cứ lúc nào trong mục Đặt phòng của tôi."}
            </p>
            <div className="lux-actions">
              {onViewBookings && (
                <button
                  type="button"
                  className="lux-btn lux-btn--outline"
                  onClick={() => { onClose(); onViewBookings(); }}
                >
                  <ClipboardList className="lux-btn__icon" aria-hidden /> Đặt phòng của tôi
                </button>
              )}
              <button type="button" className="lux-btn lux-btn--ink" onClick={onClose}>
                Hoàn tất
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
