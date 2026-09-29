import { ImageWithFallback } from "../figma/ImageWithFallback";
import { Reveal } from "./Reveal";

export function StoryPage({ onResidences }: { onResidences: () => void }) {
  return (
    <div className="lux-page">
      <div className="lux-shell lux-shell--wide">
        <Reveal className="lux-section__head">
          <p className="lux-eyebrow">Câu chuyện</p>
          <h1 className="lux-title">Vì sao chỉ 13 căn</h1>
          <p className="lux-lede">
            Sao Mai không phải nơi nghỉ đông người. 13 residences — mỗi căn là một khoảng trời riêng.
          </p>
        </Reveal>

        <div className="lux-split" style={{ marginTop: 48 }}>
          <Reveal className="lux-split__media">
            <ImageWithFallback src="/media/pool.webp" alt="Hồ vô cực Sao Mai" loading="lazy" className="size-full object-cover" />
          </Reveal>
          <Reveal className="lux-split__body" delay={1}>
            <p className="lux-lede">
              Mười ba là đủ để còn im. Check-in riêng. Không sảnh đông. Không hành lang chung.
              Mở thêm một cánh là mất khoảng trời đó.
            </p>
            <p className="lux-lede">
              Không xây thêm. Không lấp vịnh bằng phòng.
            </p>
            <button type="button" className="lux-linkline" onClick={onResidences}>
              Khám phá 13 căn
            </button>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
