import { ImageWithFallback } from "../figma/ImageWithFallback";
import { Reveal } from "./Reveal";

export function StayPage({ onConcierge }: { onConcierge: () => void }) {
  return (
    <div className="lux-page">
      <div className="lux-shell lux-shell--wide">
        <Reveal className="lux-section__head">
          <p className="lux-eyebrow">Ở như chủ nhà</p>
          <h1 className="lux-title">Residences dài hạn</h1>
          <p className="lux-lede">
            Không đặt theo đêm cho đông khách. Ở tuần, tháng, mùa — bếp, nhịp riêng, butler khi cần.
          </p>
        </Reveal>

        <div className="lux-split" style={{ marginTop: 48 }}>
          <Reveal className="lux-split__media">
            <ImageWithFallback
              src="/media/room-penthouse.webp"
              alt="Không gian residences để ở lâu"
              loading="lazy"
              className="size-full object-cover"
            />
          </Reveal>
          <Reveal className="lux-split__body" delay={1}>
            <p className="lux-note">Đây là định hướng mô hình, chưa mở bán.</p>
            <p className="lux-lede">
              Bếp thật. Hồ trong tầm nhìn. Không hành lang chung.
              Đồ giặt thu buổi sáng, trả trước tối.
            </p>
            <button type="button" className="lux-linkline" onClick={onConcierge}>
              Nói với concierge
            </button>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
