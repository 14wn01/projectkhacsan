import { toISODate } from "../../lib/format";
import { BookingBar } from "./BookingBar";
import { ResidenceCatalog } from "./ResidenceCatalog";
import { Reveal } from "./Reveal";
import type { SunsetSlot } from "./stay";

export function ResidencesPage({
  checkIn,
  checkOut,
  guests,
  sunset,
  onCheckIn,
  onCheckOut,
  onGuests,
  onDetail,
}: {
  checkIn: string;
  checkOut: string;
  guests: number;
  sunset: SunsetSlot | "";
  onCheckIn: (v: string) => void;
  onCheckOut: (v: string) => void;
  onGuests: (v: number) => void;
  onDetail: (typeId: string) => void;
}) {
  const today = toISODate(new Date());

  return (
    <div className="lux-page">
      <div className="lux-shell lux-shell--wide">
        <Reveal className="lux-section__head">
          <p className="lux-eyebrow">Residences</p>
          <h1 className="lux-title">13 căn. Sáu hạng.</h1>
        </Reveal>

        <ResidenceCatalog
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          sunset={sunset}
          onDetail={onDetail}
        />

        <div id="booking" style={{ marginTop: "clamp(80px, 10vw, 120px)", scrollMarginTop: 90 }}>
          <Reveal className="lux-section__head">
            <p className="lux-eyebrow">Đặt residences</p>
            <h2 className="lux-title">Chọn ngày lưu trú</h2>
          </Reveal>
          <BookingBar
            inline
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
            minDate={today}
            onCheckIn={onCheckIn}
            onCheckOut={onCheckOut}
            onGuests={onGuests}
            onSearch={() => document.getElementById("stay-rt1")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />
        </div>
      </div>
    </div>
  );
}
