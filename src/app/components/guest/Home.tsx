import { useMemo } from "react";
import { Mail, Phone } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { HOTEL_EMAIL, HOTEL_HOTLINE, useStore } from "../../lib/store";
import { addDays, toISODate } from "../../lib/format";
import { LuxHero } from "./LuxHero";
import { BookingBar } from "./BookingBar";
import { Reveal } from "./Reveal";
import { StayCollection } from "./StayCollection";
import { STAY_ORDER, type GuestView, type SunsetSlot } from "./stay";

const MOMENTS = [
  { img: "/media/pool.webp", title: "Hồ vô cực", desc: "Hồ vô cực nhìn ra vịnh, quầy bar tới nửa đêm." },
  { img: "/media/dining.webp", title: "12 vị trí", desc: "Bữa tối bên sóng, chỉ dành cho 12 bàn." },
  { img: "/media/spa.webp", title: "Chiều", desc: "Đá muối. Một giường. Nhìn biển." },
];

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** Trang chủ hideaway — một hệ lưới, không tồn kho OTA. */
export function Home({
  checkIn,
  checkOut,
  guests,
  sunset,
  transfer: _transfer,
  onCheckIn,
  onCheckOut,
  onGuests,
  onSunset,
  onOpenRoom,
  onNavigate,
}: {
  checkIn: string;
  checkOut: string;
  guests: number;
  sunset: SunsetSlot | "";
  transfer: boolean;
  onCheckIn: (v: string) => void;
  onCheckOut: (v: string) => void;
  onGuests: (v: number) => void;
  onSunset: (v: SunsetSlot | "") => void;
  onOpenRoom: (typeId: string) => void;
  onNavigate: (page: GuestView) => void;
  onViewBookings?: () => void;
  onOpenLegal?: () => void;
}) {
  const { roomTypes, rooms } = useStore();
  const today = toISODate(new Date());

  const changeCheckIn = (v: string) => {
    onCheckIn(v);
    if (v >= checkOut) onCheckOut(addDays(v, 1));
  };

  const collection = useMemo(() => {
    const rank = new Map(STAY_ORDER.map((id, i) => [id, i]));
    return [...roomTypes].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
  }, [roomTypes]);

  return (
    <div>
      <LuxHero
        roomCount={rooms.length}
        onCheckAvailability={() => scrollTo("booking")}
        onExploreRooms={() => onNavigate("residences")}
      />

      <section className="lux-section" aria-label="Giới thiệu Sao Mai">
        <div className="lux-shell lux-shell--narrow">
          <Reveal className="lux-intro">
            <p className="lux-eyebrow lux-eyebrow--center">Hideaway</p>
            <h2 className="lux-title">Giữa biển, ánh sáng và sự tĩnh tại.</h2>
            <p className="lux-lede">
              Sao Mai không phải nơi nghỉ đông người. 13 residences — mỗi căn là một khoảng trời riêng.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="lux-section">
        <div className="lux-shell lux-shell--wide">
          <div className="lux-moments">
            {MOMENTS.map((m) => (
              <article key={m.title} className="lux-moment">
                <ImageWithFallback src={m.img} alt={m.title} loading="lazy" className="size-full object-cover" />
                <div className="lux-moment__veil" aria-hidden="true" />
                <div className="lux-moment__body">
                  <h3 className="lux-moment__title">{m.title}</h3>
                  <p className="lux-moment__desc">{m.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="rooms" className="lux-section" style={{ scrollMarginTop: 90 }}>
        <div className="lux-shell lux-shell--wide">
          <Reveal className="lux-section__head">
            <p className="lux-eyebrow">Lưu trú</p>
            <h2 className="lux-title">13 residences</h2>
          </Reveal>
          <StayCollection types={collection} onOpen={onOpenRoom} />
          <div style={{ marginTop: 48 }}>
            <button type="button" className="lux-linkline" onClick={() => onNavigate("residences")}>
              Xem 13 căn
            </button>
          </div>
        </div>
      </section>

      <section id="experiences" className="lux-section" style={{ scrollMarginTop: 90 }}>
        <div className="lux-shell lux-shell--wide">
          <div className="lux-split">
            <Reveal className="lux-split__media">
              <ImageWithFallback
                src="/media/dining.webp"
                alt="Bàn ăn ánh nến hướng biển"
                loading="lazy"
                className="size-full object-cover"
              />
            </Reveal>
            <Reveal className="lux-split__body" delay={1}>
              <p className="lux-eyebrow">Private dining</p>
              <h2 className="lux-title">Bữa tối bên sóng,<br />chỉ dành cho 12 bàn</h2>
              <p className="lux-lede">
                Bàn 12 vị trí. Chỉ phục vụ khách lưu trú. Giữ chỗ trước 18:30.
              </p>
              <button
                type="button"
                className="lux-linkline"
                onClick={() => { onSunset("18:30"); scrollTo("booking"); }}
              >
                Giữ bàn 18:30
              </button>
              {sunset && <p className="lux-field-hint">Đã chọn bàn {sunset}.</p>}
            </Reveal>
          </div>

          <div className="lux-split lux-split--reverse" style={{ marginTop: "clamp(80px, 10vw, 120px)" }}>
            <Reveal className="lux-split__media">
              <ImageWithFallback
                src="/media/pool.webp"
                alt="Hồ bơi vô cực trên tầng thượng lúc hoàng hôn"
                loading="lazy"
                className="size-full object-cover"
              />
            </Reveal>
            <Reveal className="lux-split__body" delay={1}>
              <p className="lux-eyebrow">Nước</p>
              <h2 className="lux-title">Hồ vô cực nhìn ra vịnh,<br />quầy bar tới nửa đêm</h2>
              <p className="lux-lede">
                Nước mặn. Đèn dưới mặt nước. Khăn và đồ uống tới ghế dài.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="stay" className="lux-section" style={{ scrollMarginTop: 90 }}>
        <div className="lux-shell lux-shell--wide">
          <div className="lux-split">
            <Reveal className="lux-split__media">
              <ImageWithFallback
                src="/media/room-penthouse.webp"
                alt="Không gian residences để ở lâu"
                loading="lazy"
                className="size-full object-cover"
              />
            </Reveal>
            <Reveal className="lux-split__body" delay={1}>
              <p className="lux-eyebrow">Ở như chủ nhà</p>
              <h2 className="lux-title">Residences dài hạn</h2>
              <p className="lux-lede">
                Không đặt theo đêm cho đông khách. Ở tuần, tháng, mùa — bếp, nhịp riêng, butler khi cần.
              </p>
              <p className="lux-note">Đây là định hướng mô hình, chưa mở bán.</p>
              <button type="button" className="lux-linkline" onClick={() => onNavigate("contact")}>
                Nói với concierge
              </button>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="contact" className="lux-section" style={{ scrollMarginTop: 90 }}>
        <div className="lux-shell lux-shell--narrow">
          <Reveal className="lux-intro">
            <p className="lux-eyebrow lux-eyebrow--center">Concierge</p>
            <h2 className="lux-title">Một đầu mối. Mọi việc.</h2>
            <p className="lux-lede">
              Điện thoại hoặc email. Butler sắp xếp giặt ủi, xe đón, bàn ăn riêng. Đồ giặt thu buổi sáng, trả trước tối.
            </p>
            <div className="lux-concierge">
              <a className="lux-concierge__link" href={`tel:${HOTEL_HOTLINE.replace(/\s+/g, "")}`}>
                <Phone className="size-4" /> {HOTEL_HOTLINE}
              </a>
              <a className="lux-concierge__link" href={`mailto:${HOTEL_EMAIL}`}>
                <Mail className="size-4" /> {HOTEL_EMAIL}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="booking" className="lux-section" style={{ scrollMarginTop: 90 }}>
        <div className="lux-shell lux-shell--wide">
          <Reveal className="lux-section__head">
            <p className="lux-eyebrow">Đặt residences</p>
            <h2 className="lux-title">Chọn ngày lưu trú</h2>
          </Reveal>
          <BookingBar
            inline
            ctaLabel="Đặt residences"
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
            minDate={today}
            onCheckIn={changeCheckIn}
            onCheckOut={onCheckOut}
            onGuests={onGuests}
            onSearch={() => scrollTo("rooms")}
          />
        </div>
      </section>
    </div>
  );
}
