import { ImageWithFallback } from "../figma/ImageWithFallback";

const HERO_IMG = "/media/hero-resort.webp";

/** Hero toàn màn hình: ảnh full-bleed + thoại ngắn. */
export function LegacyLuxHero({
  onCheckAvailability,
  onExploreRooms,
}: {
  roomCount: number;
  rating?: string;
  reviewCount?: number;
  onCheckAvailability: () => void;
  onExploreRooms: () => void;
}) {
  return (
    <section className="lux-hero">
      <div className="lux-hero__media">
        <ImageWithFallback
          src={HERO_IMG}
          fetchPriority="high"
          decoding="async"
          width={1920}
          height={1280}
          alt=""
          className="size-full object-cover"
        />
      </div>
      <div className="lux-hero__scrim" />

      <div className="lux-shell lux-shell--wide lux-hero__content">
        <h1 className="lux-display lux-hero__title">
          Một khoảng
          <br />
          <em>trời riêng.</em>
        </h1>

        <div className="lux-hero__actions">
          <button type="button" className="lux-linkline cinema-link" onClick={onCheckAvailability}>
            Đặt residences
          </button>
          <button type="button" className="lux-linkline cinema-link" onClick={onExploreRooms}>
            Khám phá 13 căn
          </button>
        </div>
      </div>
    </section>
  );
}
