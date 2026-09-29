import { ImageWithFallback } from "../figma/ImageWithFallback";
import { Reveal } from "./Reveal";
import type { SunsetSlot } from "./stay";

export function ExperiencesPage({
  sunset,
  onSunset,
  onBook,
}: {
  sunset: SunsetSlot | "";
  onSunset: (v: SunsetSlot | "") => void;
  onBook: () => void;
}) {
  return (
    <div className="lux-page">
      <div className="lux-shell lux-shell--wide">
        <Reveal className="lux-section__head">
          <p className="lux-eyebrow">Trải nghiệm</p>
          <h1 className="lux-title">Một ngày tại Sao Mai</h1>
        </Reveal>

        <div className="lux-moments" style={{ marginTop: 48 }}>
          <article className="lux-moment">
            <ImageWithFallback src="/media/pool.webp" alt="Hồ vô cực" loading="lazy" className="size-full object-cover" />
            <div className="lux-moment__veil" aria-hidden="true" />
            <div className="lux-moment__body">
              <h3 className="lux-moment__title">Hồ vô cực</h3>
              <p className="lux-moment__desc">Hồ vô cực nhìn ra vịnh, quầy bar tới nửa đêm.</p>
            </div>
          </article>
          <article className="lux-moment">
            <ImageWithFallback src="/media/dining.webp" alt="Bàn 12 vị trí" loading="lazy" className="size-full object-cover" />
            <div className="lux-moment__veil" aria-hidden="true" />
            <div className="lux-moment__body">
              <h3 className="lux-moment__title">12 vị trí</h3>
              <p className="lux-moment__desc">Bữa tối bên sóng, chỉ dành cho 12 bàn.</p>
            </div>
          </article>
          <article className="lux-moment">
            <ImageWithFallback src="/media/spa.webp" alt="Spa chiều" loading="lazy" className="size-full object-cover" />
            <div className="lux-moment__veil" aria-hidden="true" />
            <div className="lux-moment__body">
              <h3 className="lux-moment__title">Chiều</h3>
              <p className="lux-moment__desc">Đá muối. Một giường. Nhìn biển.</p>
            </div>
          </article>
        </div>

        <div className="lux-split" style={{ marginTop: "clamp(80px, 10vw, 120px)" }}>
          <Reveal className="lux-split__media">
            <ImageWithFallback src="/media/dining.webp" alt="Bàn ăn ánh nến hướng biển" loading="lazy" className="size-full object-cover" />
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
              onClick={() => { onSunset("18:30"); onBook(); }}
            >
              Giữ bàn 18:30
            </button>
            {sunset && <p className="lux-field-hint">Đã chọn bàn {sunset}.</p>}
          </Reveal>
        </div>

        <div className="lux-split lux-split--reverse" style={{ marginTop: "clamp(80px, 10vw, 120px)" }}>
          <Reveal className="lux-split__media">
            <ImageWithFallback src="/media/pool.webp" alt="Hồ bơi vô cực lúc hoàng hôn" loading="lazy" className="size-full object-cover" />
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
    </div>
  );
}
