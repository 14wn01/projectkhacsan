import { useEffect, useRef, useState } from "react";
import { CalendarDays, Minus, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { addDays, formatDate, nightsBetween, parseLocalDate, toISODate } from "../../lib/format";
import type { DateRange } from "react-day-picker";

/**
 * Thanh đặt phòng. `inline` = form mảnh trong luồng trang, không đè hero.
 * Lịch chọn dải đêm; cuối tuần đánh dấu champagne.
 */
export function BookingBar({
  checkIn,
  checkOut,
  guests,
  minDate,
  rateHint,
  availableCount,
  inline = false,
  ctaLabel = "Đặt residences",
  onCheckIn,
  onCheckOut,
  onGuests,
  onSearch,
}: {
  checkIn: string;
  checkOut: string;
  guests: number;
  minDate: string;
  rateHint?: { deltaPercent: number; avgPerNight: number };
  availableCount?: number;
  /** Form mảnh trong luồng trang — không đè hero, không dính mép. */
  inline?: boolean;
  ctaLabel?: string;
  onCheckIn: (v: string) => void;
  onCheckOut: (v: string) => void;
  onGuests: (v: number) => void;
  onSearch: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [docked, setDocked] = useState(false);
  const [holdHeight, setHoldHeight] = useState<number | undefined>(undefined);
  const [mobileDock, setMobileDock] = useState(false);
  const nights = Math.max(nightsBetween(checkIn, checkOut), 1);

  useEffect(() => {
    if (inline) {
      setDocked(false);
      setHoldHeight(undefined);
      setMobileDock(false);
      return;
    }
    const el = wrapRef.current;
    if (!el) return;

    const evaluate = () => {
      const mobile = window.innerWidth <= 900;
      if (mobile) {
        setDocked(false);
        setHoldHeight(undefined);
        setMobileDock(el.getBoundingClientRect().bottom < 8);
        return;
      }
      setMobileDock(false);
      const top = el.getBoundingClientRect().top;
      setDocked((prev) => {
        const next = top <= 68;
        if (next && !prev) setHoldHeight(el.offsetHeight);
        if (!next && prev) setHoldHeight(undefined);
        return next;
      });
    };

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(evaluate);
    };
    evaluate();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [inline]);

  useEffect(() => {
    document.documentElement.classList.toggle("lux-has-dock", mobileDock);
    return () => document.documentElement.classList.remove("lux-has-dock");
  }, [mobileDock]);

  const hint = !inline && rateHint && Math.abs(rateHint.deltaPercent) >= 1
    ? `${nights} đêm · ${rateHint.deltaPercent > 0 ? `cuối tuần / cao điểm +${rateHint.deltaPercent}%` : `thấp điểm ${rateHint.deltaPercent}%`}`
    : `${nights} đêm`;

  const form = (
          <form
            className={["lux-bookbar", docked ? "lux-bookbar--docked" : "", inline ? "lux-bookbar--inline" : ""].filter(Boolean).join(" ")}
            onSubmit={(e) => { e.preventDefault(); onSearch(); }}
          >
            <div className="lux-bookbar__field">
              <RangeField
                label="Nhận — trả"
                checkIn={checkIn}
                checkOut={checkOut}
                min={minDate}
                onRange={(a, b) => { onCheckIn(a); onCheckOut(b); }}
              />
              <span className="lux-bookbar__nights">{nights} đêm</span>
            </div>

            <div className="lux-bookbar__field">
              <span className="lux-field__label" id="lux-guests-label">Số khách</span>
              <div className="lux-stepper" role="group" aria-labelledby="lux-guests-label">
                <button type="button" aria-label="Giảm số khách" disabled={guests <= 1} onClick={() => onGuests(Math.max(1, guests - 1))}>
                  <Minus className="size-4" />
                </button>
                <output aria-live="polite">{guests} khách</output>
                <button type="button" aria-label="Tăng số khách" disabled={guests >= 10} onClick={() => onGuests(Math.min(10, guests + 1))}>
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            <div className="lux-bookbar__cta">
              <button type="submit" className="lux-btn lux-btn--ink lux-btn--block">
                {ctaLabel}
              </button>
            </div>

            <p className="lux-bookbar__hint" role="status">
              {hint}
            </p>
          </form>
  );

  return (
    <>
      <div
        className={["lux-bookbar-wrap", inline ? "lux-bookbar-wrap--inline" : ""].filter(Boolean).join(" ")}
        ref={wrapRef}
        style={holdHeight ? { minHeight: holdHeight } : undefined}
      >
        {inline || docked ? form : <div className="lux-shell lux-shell--wide">{form}</div>}
      </div>

      {mobileDock && (
        <div className="lux-stay-dock">
          <div className="lux-stay-dock__meta">
            <b>{formatDate(checkIn)} → {formatDate(checkOut)}</b>
            <div className="lux-stay-dock__sub">
              {guests} khách · {nights} đêm
            </div>
          </div>
          <button type="button" className="lux-btn lux-btn--ink lux-btn--sm" onClick={onSearch}>
            Đặt
          </button>
        </div>
      )}
    </>
  );
}

function RangeField({
  label,
  checkIn,
  checkOut,
  min,
  onRange,
}: {
  label: string;
  checkIn: string;
  checkOut: string;
  min?: string;
  onRange: (checkIn: string, checkOut: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected: DateRange = {
    from: parseLocalDate(checkIn),
    to: parseLocalDate(checkOut),
  };

  return (
    <>
      <span className="lux-field__label">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="lux-field__control" aria-label={`${label}: ${formatDate(checkIn)} đến ${formatDate(checkOut)}`}>
          <CalendarDays className="size-4" />
          {formatDate(checkIn)} – {formatDate(checkOut)}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={selected}
            numberOfMonths={1}
            onSelect={(range) => {
              if (!range?.from) return;
              const a = toISODate(range.from);
              const b = range.to && range.to > range.from ? toISODate(range.to) : addDays(a, 1);
              onRange(a, b);
              if (range.to && range.to > range.from) setOpen(false);
            }}
            disabled={min ? { before: parseLocalDate(min) } : undefined}
            modifiers={{
              weekend: (d) => d.getDay() === 0 || d.getDay() === 6,
            }}
            modifiersClassNames={{ weekend: "lux-cal-weekend" }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
