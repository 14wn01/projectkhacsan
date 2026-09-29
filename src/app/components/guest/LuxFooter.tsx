import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { HOTEL_EMAIL, HOTEL_FULL_NAME, HOTEL_HOTLINE } from "../../lib/store";
import type { LegalDoc } from "./LegalPages";

/** Footer tối — địa điểm, concierge, không badge OTA. */
export function LuxFooter({
  hotelName,
  isGuest,
  onNav,
  onOpenLegal,
  onMyBookings,
  onLogin,
}: {
  hotelName: string;
  isGuest: boolean;
  onNav: (id: string) => void;
  onOpenLegal: (doc: LegalDoc) => void;
  onMyBookings: () => void;
  onLogin: () => void;
}) {
  const initials = hotelName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <footer className="lux-footer">
      <div className="lux-shell lux-shell--wide">
        <div className="lux-footer__grid">
          <div>
            <div className="lux-brand" style={{ color: "#fff" }}>
              <span className="lux-brand__mark">{initials}</span>
              <span>
                <span className="lux-brand__name">{hotelName}</span>
                <br />
                <span className="lux-brand__tag">Hotel &amp; Residences</span>
              </span>
            </div>
            <p style={{ marginTop: 18, maxWidth: "38ch", fontSize: ".9375rem", lineHeight: 1.7 }}>
              Sao Mai không phải nơi nghỉ đông người. 13 residences — mỗi căn là một khoảng trời riêng.
            </p>
          </div>

          <div>
            <h4>Khám phá</h4>
            <ul className="lux-footer__list">
              <li><button type="button" onClick={() => onNav("residences")}>Residences</button></li>
              <li><button type="button" onClick={() => onNav("experiences")}>Trải nghiệm</button></li>
              <li><button type="button" onClick={() => onNav("stay")}>Ở lâu</button></li>
              <li><button type="button" onClick={() => onNav("story")}>Câu chuyện</button></li>
              <li><button type="button" onClick={() => onNav("contact")}>Concierge</button></li>
            </ul>
          </div>

          <div>
            <h4>Hỗ trợ</h4>
            <ul className="lux-footer__list">
              <li>
                <button type="button" onClick={isGuest ? onMyBookings : onLogin}>
                  Đặt phòng của tôi
                </button>
              </li>
              <li><button type="button" onClick={() => onOpenLegal("terms")}>Điều khoản &amp; chính sách huỷ</button></li>
              <li><button type="button" onClick={() => onOpenLegal("privacy")}>Bảo mật</button></li>
            </ul>
          </div>

          <div>
            <h4>Concierge</h4>
            <ul className="lux-footer__list">
              <li className="lux-footer__row"><Phone className="size-4" /> {HOTEL_HOTLINE}</li>
              <li className="lux-footer__row"><Mail className="size-4" /> {HOTEL_EMAIL}</li>
              <li className="lux-footer__row"><MapPin className="size-4" /> 123 Đường Biển, TP. Hồ Chí Minh</li>
              <li className="lux-footer__row"><Clock className="size-4" /> Nhận phòng 14:00 · Trả phòng 12:00</li>
            </ul>
          </div>
        </div>

        <div className="lux-footer__bottom">
          <span>© 2026 {HOTEL_FULL_NAME}. Mọi quyền được bảo lưu.</span>
          <div className="lux-footer__legal">
            <button type="button" className="lux-linkline" onClick={() => onOpenLegal("terms")}>Điều khoản</button>
            <button type="button" className="lux-linkline" onClick={() => onOpenLegal("privacy")}>Bảo mật</button>
            <button type="button" className="lux-linkline" onClick={() => onOpenLegal("rights")}>Quyền của bạn</button>
            <a href="#/staff-login" className="lux-linkline">Nhân viên</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
