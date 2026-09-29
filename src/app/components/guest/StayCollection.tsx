import { ImageWithFallback } from "../figma/ImageWithFallback";
import { RoomType } from "../../lib/types";
import { Reveal } from "./Reveal";
import { guestNightlyLabel, stayPresentation, storyFor } from "./stay";

export function StayCollection({
  types,
  onOpen,
  showPrice = true,
}: {
  types: RoomType[];
  onOpen: (typeId: string) => void;
  showPrice?: boolean;
}) {
  const trio = types.filter((t) => stayPresentation(t.id) === "trio");
  const suite = types.find((t) => stayPresentation(t.id) === "suite");
  const residences = types.filter((t) => stayPresentation(t.id) === "residence");
  const cover = (t: RoomType) => t.image?.trim() || storyFor(t).gallery[0]?.src || "/media/room-garden.webp";

  return (
    <div className="lux-staygrid">
      {trio.length > 0 && (
        <div className="lux-staygrid__trio">
          {trio.map((t, i) => (
            <StayCard
              key={t.id}
              type={t}
              image={cover(t)}
              variant="trio"
              delay={(i % 3) as 0 | 1 | 2}
              showPrice={showPrice}
              onOpen={() => onOpen(t.id)}
            />
          ))}
        </div>
      )}
      {suite && (
        <StayCard
          type={suite}
          image={cover(suite)}
          variant="suite"
          showPrice={showPrice}
          onOpen={() => onOpen(suite.id)}
        />
      )}
      {residences.map((t) => (
        <StayCard
          key={t.id}
          type={t}
          image={cover(t)}
          variant="residence"
          showPrice={showPrice}
          onOpen={() => onOpen(t.id)}
        />
      ))}
    </div>
  );
}

function StayCard({
  type,
  image,
  variant,
  delay = 0,
  showPrice,
  onOpen,
}: {
  type: RoomType;
  image: string;
  variant: "trio" | "suite" | "residence";
  delay?: 0 | 1 | 2;
  showPrice: boolean;
  onOpen: () => void;
}) {
  const story = storyFor(type);
  const cls =
    variant === "trio" ? "lux-stay lux-stay--tile" :
    variant === "suite" ? "lux-stay lux-stay--suite" :
    "lux-stay lux-stay--full";

  return (
    <Reveal as="article" id={`stay-${type.id}`} className={cls} delay={delay}>
      <button type="button" className="lux-stay__media" onClick={onOpen} aria-label={`Xem ${type.name}`}>
        <ImageWithFallback src={image} alt={type.name} loading="lazy" className="size-full object-cover" />
      </button>
      <div className="lux-stay__copy">
        <h3 className="lux-stay__name">
          <button type="button" className="lux-ghost lux-stay__name-btn" onClick={onOpen}>
            {type.name}
          </button>
        </h3>
        <p className="lux-stay__desc">{story.essay}</p>
        {showPrice && <p className="lux-stay__amen">{guestNightlyLabel(type)}</p>}
        <button type="button" className="lux-linkline" onClick={onOpen}>
          Chi tiết
        </button>
      </div>
    </Reveal>
  );
}
