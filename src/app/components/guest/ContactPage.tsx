import { Mail, MapPin, Phone } from "lucide-react";
import { HOTEL_EMAIL, HOTEL_HOTLINE } from "../../lib/store";
import { Reveal } from "./Reveal";

export function ContactPage() {
  return (
    <div className="lux-page">
      <div className="lux-shell lux-shell--narrow">
        <Reveal className="lux-intro">
          <p className="lux-eyebrow lux-eyebrow--center">Concierge</p>
          <h1 className="lux-title">Một đầu mối. Mọi việc.</h1>
          <p className="lux-lede">
            Điện thoại hoặc email. Không form marketing.
            Butler sắp xếp giặt ủi, xe đón, bàn ăn riêng. Đồ giặt thu buổi sáng, trả trước tối.
          </p>
          <div className="lux-concierge">
            <a className="lux-concierge__link" href={`tel:${HOTEL_HOTLINE.replace(/\s+/g, "")}`}>
              <Phone className="size-4" /> {HOTEL_HOTLINE}
            </a>
            <a className="lux-concierge__link" href={`mailto:${HOTEL_EMAIL}`}>
              <Mail className="size-4" /> {HOTEL_EMAIL}
            </a>
          </div>
          <p className="lux-field-hint" style={{ marginTop: 28 }}>
            <MapPin className="size-3.5" style={{ display: "inline", marginRight: 6 }} />
            123 Đường Biển, TP. Hồ Chí Minh · Nhận 14:00 · Trả 12:00
          </p>
        </Reveal>
      </div>
    </div>
  );
}
