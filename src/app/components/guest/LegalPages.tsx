import { useState } from "react";
import { ArrowLeft, FileText, ShieldCheck, UserCheck } from "lucide-react";
import { HOTEL_EMAIL, HOTEL_FULL_NAME, HOTEL_HOTLINE } from "../../lib/store";

export type LegalDoc = "privacy" | "terms" | "rights";

const TABS: Array<{ key: LegalDoc; label: string; icon: typeof FileText }> = [
  { key: "privacy", label: "Chính sách bảo mật", icon: ShieldCheck },
  { key: "terms", label: "Điều khoản & Hủy phòng", icon: FileText },
  { key: "rights", label: "Quyền của bạn", icon: UserCheck },
];

/** Chính sách hủy phòng — dùng chung cho cả UI đặt phòng và email xác nhận. */
export const CANCELLATION_TIERS = [
  { when: "Trước 7 ngày so với ngày nhận phòng", refund: "Hoàn 100% tiền cọc" },
  { when: "Từ 3 đến 7 ngày", refund: "Hoàn 50% tiền cọc" },
  { when: "Dưới 3 ngày", refund: "Không hoàn cọc" },
  { when: "Khách không đến (no-show)", refund: "Không hoàn cọc, phòng được giải phóng sau 18:00" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

export function LegalPages({ initial = "privacy", onBack }: { initial?: LegalDoc; onBack?: () => void }) {
  const [tab, setTab] = useState<LegalDoc>(initial);
  const updated = "01/01/2025";

  return (
    <div>
      {onBack && (
        <button type="button" className="lux-btn lux-btn--outline lux-btn--sm" onClick={onBack} style={{ marginBottom: 24 }}>
          <ArrowLeft className="lux-btn__icon" aria-hidden /> Về trang chủ
        </button>
      )}

      <p className="lux-eyebrow">Sao Mai</p>
      <h1 className="lux-title">Thông tin pháp lý</h1>
      <p className="lux-lede" style={{ marginTop: 8 }}>Cập nhật lần cuối: {updated}</p>

      <div className="lux-legal-tabs" role="group" aria-label="Tài liệu pháp lý">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              <Icon className="size-4" aria-hidden /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="lux-legal">
        {tab === "privacy" && (
          <>
            <Section title="1. Chúng tôi thu thập những gì">
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <b>Thông tin đặt phòng:</b> họ tên, số điện thoại, email, ngày nhận/trả phòng, số khách, yêu cầu đặc biệt.
                </li>
                <li>
                  <b>Giấy tờ tùy thân:</b> số CCCD/hộ chiếu, ngày sinh, địa chỉ — thu thập khi nhận phòng theo
                  yêu cầu khai báo lưu trú của cơ quan có thẩm quyền.
                </li>
                <li>
                  <b>Thanh toán:</b> số tiền, phương thức, mã giao dịch. Chúng tôi
                  <b> không lưu số thẻ đầy đủ, CVV hay mã PIN</b> — toàn bộ do cổng thanh toán đạt chuẩn
                  PCI-DSS xử lý. Chúng tôi chỉ giữ 4 số cuối để đối soát.
                </li>
                <li>
                  <b>Dữ liệu kỹ thuật:</b> loại thiết bị, trình duyệt, log lỗi — chỉ để khắc phục sự cố.
                </li>
              </ul>
            </Section>

            <Section title="2. Mục đích và căn cứ xử lý">
              <p>
                Chúng tôi xử lý dữ liệu để (a) thực hiện hợp đồng lưu trú mà bạn đã giao kết, (b) tuân thủ
                nghĩa vụ pháp lý về khai báo lưu trú và hóa đơn điện tử, và (c) gửi ưu đãi marketing
                — riêng mục (c) chỉ khi bạn đã đồng ý và có thể rút lại bất kỳ lúc nào.
              </p>
            </Section>

            <Section title="3. Chia sẻ cho ai">
              <ul className="list-disc space-y-1 pl-5">
                <li>Cổng thanh toán (VNPay, Momo, Stripe) — để xử lý giao dịch.</li>
                <li>Kênh đặt phòng trục tuyến (Booking.com, Agoda, Traveloka) — nếu bạn đặt qua các kênh này.</li>
                <li>Cơ quan nhà nước có thẩm quyền — khi có yêu cầu hợp pháp bằng văn bản.</li>
                <li>Chúng tôi <b>không bán</b> dữ liệu cá nhân cho bên thứ ba.</li>
              </ul>
            </Section>

            <Section title="4. Lưu bao lâu">
              <p>
                Hồ sơ đặt phòng và hóa đơn: 10 năm theo quy định kế toán. Thông tin giấy tờ tùy thân:
                xóa sau 12 tháng kể từ ngày trả phòng, trừ khi pháp luật yêu cầu lưu lâu hơn.
              </p>
            </Section>

            <Section title="5. Bảo vệ dữ liệu">
              <p>
                Dữ liệu được mã hóa khi truyền (TLS) và khi lưu. Truy cập nội bộ được phân quyền theo vai
                trò (lễ tân không xem được báo cáo tài chính, không thực hiện được hoàn tiền) và mọi thao tác
                quan trọng đều được ghi nhật ký kiểm toán.
              </p>
            </Section>
          </>
        )}

        {tab === "terms" && (
          <>
            <Section title="1. Đặt phòng và tiền cọc">
              <p>
                Đặt phòng chỉ được xác nhận sau khi bạn thanh toán tiền cọc
                <b> 25% tổng giá trị đặt phòng</b>. Trong lúc hoàn tất đặt phòng, hệ thống giữ phòng cho
                bạn <b>15 phút</b>; quá thời gian này phòng sẽ được mở lại cho khách khác.
              </p>
            </Section>

            <Section title="2. Chính sách hủy phòng và hoàn cọc">
              <div style={{ overflow: "hidden", border: "1px solid var(--lux-line)", margin: "12px 0" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--lux-sand)", textAlign: "left" }}>
                      <th className="lux-label" style={{ padding: "10px 12px", margin: 0 }}>Thời điểm hủy</th>
                      <th className="lux-label" style={{ padding: "10px 12px", margin: 0 }}>Mức hoàn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CANCELLATION_TIERS.map((r) => (
                      <tr key={r.when} style={{ borderTop: "1px solid var(--lux-line)" }}>
                        <td style={{ padding: "10px 12px" }}>{r.when}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 500 }}>{r.refund}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Tiền hoàn được chuyển về đúng phương thức bạn đã thanh toán trong 5–10 ngày làm việc.
                Phí do ngân hàng/cổng thanh toán thu (nếu có) không thuộc phạm vi hoàn trả.
              </p>
            </Section>

            <Section title="3. Giờ nhận và trả phòng">
              <p>
                Nhận phòng từ <b>14:00</b>, trả phòng trước <b>12:00</b>. Trả muộn đến 18:00 tính 50% giá
                phòng; sau 18:00 tính trọn 1 đêm. Nhận phòng sớm tùy tình trạng phòng trống.
              </p>
            </Section>

            <Section title="4. Giá phòng thay đổi theo thời điểm">
              <p>
                Giá hiển thị thay đổi theo mùa, ngày trong tuần, sự kiện địa phương và tình trạng phòng
                còn lại. <b>Giá tại thời điểm bạn xác nhận đặt phòng là giá cuối cùng</b> và không bị điều
                chỉnh về sau, kể cả khi giá niêm yết tăng hoặc giảm.
              </p>
            </Section>

            <Section title="5. Trách nhiệm của khách">
              <ul className="list-disc space-y-1 pl-5">
                <li>Xuất trình CCCD/hộ chiếu hợp lệ khi nhận phòng.</li>
                <li>Không mang chất dễ cháy nổ, hàng cấm vào nhà.</li>
                <li>Bồi thường theo giá trị thực tế nếu làm hư hỏng tài sản.</li>
                <li>Không hút thuốc trong phòng — phí vệ sinh 500.000đ nếu vi phạm.</li>
              </ul>
            </Section>

            <Section title="6. Trường hợp bất khả kháng">
              <p>
                Nếu thiên tai, dịch bệnh hoặc quyết định của cơ quan nhà nước khiến Sao Mai không thể
                phục vụ, chúng tôi hoàn <b>100% tiền cọc</b> hoặc giữ nguyên giá trị để bạn dùng trong 12 tháng.
              </p>
            </Section>
          </>
        )}

        {tab === "rights" && (
          <>
            <Section title="Bạn có những quyền gì">
              <p>
                Theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân (và GDPR nếu bạn ở Châu Âu),
                bạn có các quyền sau với dữ liệu của mình:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li><b>Quyền được biết &amp; truy cập:</b> yêu cầu bản sao dữ liệu chúng tôi đang giữ về bạn.</li>
                <li><b>Quyền chỉnh sửa:</b> yêu cầu sửa thông tin sai hoặc cũ.</li>
                <li><b>Quyền xóa:</b> yêu cầu xóa dữ liệu, trừ phần bắt buộc lưu theo luật kế toán/lưu trú.</li>
                <li><b>Quyền rút lại đồng ý:</b> hủy nhận email/SMS marketing bất kỳ lúc nào.</li>
                <li><b>Quyền phản đối &amp; hạn chế xử lý</b> trong các trường hợp luật cho phép.</li>
                <li><b>Quyền mang dữ liệu đi:</b> nhận dữ liệu ở định dạng máy đọc được (JSON).</li>
                <li><b>Quyền khiếu nại</b> tới cơ quan có thẩm quyền.</li>
              </ul>
            </Section>

            <Section title="Cách thực hiện">
              <p>
                Gửi yêu cầu tới hotline <b>{HOTEL_HOTLINE}</b> hoặc email
                <b> {HOTEL_EMAIL}</b>, kèm họ tên và số điện thoại bạn đã dùng khi đặt.
                Chúng tôi phản hồi trong <b>72 giờ</b> và xử lý xong trong <b>30 ngày</b>.
              </p>
            </Section>

            <Section title="Trẻ vị thành niên">
              <p>
                Chúng tôi không chủ đích thu thập dữ liệu của người dưới 16 tuổi. Thông tin trẻ em đi cùng
                chỉ được ghi nhận qua người đại diện hợp pháp để phục vụ khai báo lưu trú.
              </p>
            </Section>

            <Section title="Liên hệ">
              <p>
                {HOTEL_FULL_NAME} — 123 Đường Biển, TP. HCM. Hotline {HOTEL_HOTLINE}.
                Người phụ trách bảo vệ dữ liệu: Ban Giám đốc.
              </p>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
