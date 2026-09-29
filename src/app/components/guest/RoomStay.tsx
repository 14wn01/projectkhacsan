import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BedDouble, Clock, UtensilsCrossed } from "lucide-react";
import { DEPOSIT_PERCENT, HOTEL_EMAIL, useStore } from "../../lib/store";
import { RoomType } from "../../lib/types";
import { formatDate, formatVND, nightsBetween } from "../../lib/format";
import { BookingFlow } from "./BookingFlow";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { RoomPreview } from "./RoomPreview";
import { amenityIcon, guestNightlyLabel, isOnRequestRate, nextOpenStay, storyFor, type SunsetSlot } from "./stay";

export function RoomStay({
  type,
  checkIn,
  checkOut,
  guests,
  sunset,
  transfer,
  onSunset,
  onTransfer,
  onBack,
  onStayChange,
  onOpenLegal,
  onViewBookings,
}: {
  type: RoomType;
  checkIn: string;
  checkOut: string;
  guests: number;
  sunset: SunsetSlot | "";
  transfer: boolean;
  onSunset: (v: SunsetSlot | "") => void;
  onTransfer: (v: boolean) => void;
  onBack: () => void;
  onStayChange: (next: { checkIn: string; checkOut: string }) => void;
  onOpenLegal?: () => void;
  onViewBookings?: () => void;
}) {
  const { getAvailableRooms, quoteFor } = useStore();
  const [picking, setPicking] = useState(false);
  const [shot, setShot] = useState(0);
  const nights = Math.max(nightsBetween(checkIn, checkOut), 1);
  const story = storyFor(type);
  const gallery = story.gallery;
  const current = gallery[shot] ?? gallery[0];

  useEffect(() => {
    setShot(0);
    setPicking(false);
  }, [type.id]);
  const onRequest = isOnRequestRate(type);
  const available = useMemo(
    () => getAvailableRooms(checkIn, checkOut, guests).filter((r) => r.typeId === type.id),
    [getAvailableRooms, checkIn, checkOut, guests, type.id],
  );
  const roomId = available[0]?.id;
  const soldOut = !roomId;
  const alt = soldOut ? nextOpenStay(getAvailableRooms, type.id, guests, checkIn, nights) : null;
  const quote = quoteFor(type.id, checkIn, checkOut);
  const total = quote?.total ?? type.basePrice * nights;
  const nightly = quote?.avgPerNight ?? type.basePrice;

  useEffect(() => {
    const sync = () => document.documentElement.classList.toggle("lux-has-dock", window.innerWidth <= 900);
    sync();
    window.addEventListener("resize", sync);
    return () => {
      document.documentElement.classList.remove("lux-has-dock");
      window.removeEventListener("resize", sync);
    };
  }, []);

  return (
    <article className="lux-shell lux-shell--wide lux-page">
      <button type="button" className="lux-btn lux-btn--outline lux-btn--sm" onClick={onBack} style={{ marginBottom: 28 }}>
        <ArrowLeft className="lux-btn__icon" aria-hidden /> Tất cả residences
      </button>

      <h1 className="lux-title">{type.name}</h1>
      <p className="lux-lede" style={{ marginTop: 10, maxWidth: "48ch" }}>{story.essay}</p>

      <div className="lux-gallery" style={{ marginTop: 36 }}>
        <div className="lux-gallery__hero">
          {shot === 0 ? (
            <RoomPreview key={type.id} type={type} image={current?.src || type.image || "/media/room-garden.webp"} />
          ) : current ? (
            <ImageWithFallback
              src={current.src}
              alt={current.alt}
              loading="eager"
              className="size-full object-cover"
            />
          ) : null}
        </div>
        {gallery.length > 1 && (
          <div className="lux-gallery__thumbs" role="tablist" aria-label={`Ảnh ${type.name}`}>
            {gallery.map((g, i) => (
              <button
                key={g.src}
                type="button"
                role="tab"
                aria-selected={i === shot}
                aria-label={g.alt}
                onClick={() => setShot(i)}
              >
                <ImageWithFallback src={g.src} alt="" loading="lazy" />
                <span>{g.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lux-facts" style={{ marginTop: 28 }}>
        <div><span>Khách</span><b>{type.capacity}</b></div>
        <div><span>Diện tích</span><b>{type.size ? `${type.size} m²` : "—"}</b></div>
        <div><span>Giường</span><b>{story.beds}</b></div>
        <div><span>Tầm nhìn</span><b>{story.view}</b></div>
      </div>

      <div className="lux-chips" style={{ marginTop: 22 }}>
        {type.amenities.map((a) => {
          const Icon = amenityIcon(a);
          return (
            <span key={a} className="lux-chip">
              <Icon className="size-3.5" /> {a}
            </span>
          );
        })}
      </div>

      <div style={{ marginTop: 36, display: "grid", gap: 22, maxWidth: 560 }}>
        <div>
          <p className="lux-label">Giá</p>
          <p className="lux-stay__name" style={{ marginTop: 8 }}>{guestNightlyLabel(type, nightly)}</p>
          {!onRequest && (
            <p className="lux-field-hint" style={{ marginTop: 8 }}>
              {formatDate(checkIn)} → {formatDate(checkOut)} · {nights} đêm · {formatVND(total)}
            </p>
          )}
          <p className="lux-lede" style={{ marginTop: 16, maxWidth: "42ch" }}>
            {story.service}
          </p>
        </div>

        <div>
          <p className="lux-label">Bàn tối</p>
          <div className="lux-extras">
            <button type="button" aria-pressed={sunset === "18:30"} onClick={() => onSunset(sunset === "18:30" ? "" : "18:30")}>
              <span><UtensilsCrossed className="size-4" aria-hidden /> Bàn hoàng hôn 18:30 · 12 vị trí</span>
              <span className="lux-field-hint">Giữ chỗ với concierge</span>
            </button>
            <button type="button" aria-pressed={sunset === "19:30"} onClick={() => onSunset(sunset === "19:30" ? "" : "19:30")}>
              <span><Clock className="size-4" aria-hidden /> Bàn 19:30</span>
              <span className="lux-field-hint">Giữ chỗ với concierge</span>
            </button>
          </div>
        </div>

        {!onRequest && (
          <div className="lux-bill">
            <div className="lux-bill__row">
              <span>{formatDate(checkIn)} → {formatDate(checkOut)} · {nights} đêm · {guests} khách</span>
            </div>
            <div className="lux-bill__row lux-bill__row--total">
              <span>Giá kỳ lưu trú</span>
              <span className="tabular-nums">{formatVND(total)}</span>
            </div>
            <div className="lux-bill__row">
              <span>Cọc giữ chỗ</span>
              <span className="tabular-nums">{formatVND(Math.round(total * DEPOSIT_PERCENT))}</span>
            </div>
          </div>
        )}

        {soldOut ? (
          <div className="lux-alert lux-alert--warn" role="status">
            <div>
              Hết chỗ {type.name} cho các ngày này.
              {alt && (
                <p style={{ margin: "8px 0 0" }}>
                  Còn chỗ {formatDate(alt.checkIn)} → {formatDate(alt.checkOut)}.
                </p>
              )}
              <div className="lux-actions" style={{ marginTop: 12, justifyContent: "flex-start" }}>
                {alt && (
                  <button
                    type="button"
                    className="lux-btn lux-btn--ink lux-btn--sm"
                    onClick={() => onStayChange({ checkIn: alt.checkIn, checkOut: alt.checkOut })}
                  >
                    Đổi ngày
                  </button>
                )}
                <button type="button" className="lux-btn lux-btn--outline lux-btn--sm" onClick={onBack}>
                  Xem căn khác
                </button>
              </div>
            </div>
          </div>
        ) : onRequest ? (
          <a className="lux-btn lux-btn--ink" href={`mailto:${HOTEL_EMAIL}?subject=${encodeURIComponent("Sao Mai Residence")}`}>
            Nói với concierge
          </a>
        ) : (
          <button type="button" className="lux-btn lux-btn--ink" onClick={() => setPicking(true)}>
            <BedDouble className="lux-btn__icon" /> Đặt {type.name}
          </button>
        )}
      </div>

      <div className="lux-stay-dock">
        <div className="lux-stay-dock__meta">
          <b>{formatDate(checkIn)} → {formatDate(checkOut)}</b>
          <div className="lux-stay-dock__sub">
            {guests} khách · {nights} đêm · {onRequest ? "Theo yêu cầu" : guestNightlyLabel(type, nightly)}
          </div>
        </div>
        {onRequest ? (
          <a className="lux-btn lux-btn--ink lux-btn--sm" href={`mailto:${HOTEL_EMAIL}?subject=${encodeURIComponent("Sao Mai Residence")}`}>
            Concierge
          </a>
        ) : (
          <button
            type="button"
            className="lux-btn lux-btn--ink lux-btn--sm"
            disabled={soldOut}
            onClick={() => { if (roomId) setPicking(true); }}
          >
            Đặt
          </button>
        )}
      </div>

      {picking && roomId && (
        <BookingFlow
          type={type}
          roomId={roomId}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          nights={nights}
          sunset={sunset}
          transfer={transfer}
          onClose={() => setPicking(false)}
          onViewBookings={onViewBookings}
          onOpenLegal={onOpenLegal}
        />
      )}
    </article>
  );
}
