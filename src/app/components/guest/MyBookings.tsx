import { useMemo, useState } from "react";
import { BedDouble, CalendarDays, FileDown, Users2, Wallet } from "lucide-react";
import { DepositDialog } from "./DepositDialog";
import { BookingVoucher } from "../BookingVoucher";
import { DEPOSIT_PERCENT, useStore } from "../../lib/store";
import { formatDate, formatVND, nightsBetween } from "../../lib/format";
import { BookingStatus } from "../../lib/types";
import { cancelRefundFor, daysUntil } from "./stay";

const STATUS_COPY: Record<BookingStatus, { label: string; tone: "ok" | "warn" | "danger" | "plain" }> = {
  pending: { label: "Chờ duyệt", tone: "warn" },
  reserved: { label: "Đã đặt", tone: "ok" },
  checked_in: { label: "Đang ở", tone: "ok" },
  checked_out: { label: "Đã trả", tone: "plain" },
  cancelled: { label: "Đã hủy", tone: "danger" },
};

/** Trang "Đặt phòng của tôi" — khách xem trạng thái yêu cầu & cọc giữ phòng. */
export function MyBookings({ onBackHome, onOpenLegal }: { onBackHome?: () => void; onOpenLegal?: () => void }) {
  const { currentUser, bookings, roomLabel } = useStore();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [voucherId, setVoucherId] = useState<string | null>(null);

  const mine = useMemo(
    () =>
      bookings
        .filter((b) => b.customerId === currentUser?.customerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [bookings, currentUser],
  );
  const paying = payingId ? bookings.find((b) => b.id === payingId) ?? null : null;
  const voucher = voucherId ? bookings.find((b) => b.id === voucherId) ?? null : null;

  if (mine.length === 0) {
    return (
      <div className="lux-empty">
        <BedDouble className="size-10" aria-hidden />
        <h2>Chưa có đặt phòng</h2>
        <p>Chọn căn. Giữ chỗ 15 phút. Đặt cọc khi muốn.</p>
        {onBackHome && (
          <button type="button" className="lux-btn lux-btn--ink" onClick={onBackHome}>
            Xem 13 căn
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <header className="lux-page__head">
        <div>
          <p className="lux-eyebrow">Tài khoản khách</p>
          <h1 className="lux-title">Folio kỳ nghỉ</h1>
          <p className="lux-lede" style={{ marginTop: 8 }}>Mã đặt, ngày nhận 14:00, chính sách hủy theo đúng đơn của bạn.</p>
        </div>
      </header>

      {mine.map((b) => {
        const nights = Math.max(nightsBetween(b.checkIn, b.checkOut), 1);
        const serviceTotal = b.services.reduce((s, x) => s + x.price * x.qty, 0);
        const total = b.roomPricePerNight * nights + serviceTotal;
        const percent = Math.round((b.depositPercent ?? DEPOSIT_PERCENT) * 100);
        const deposit = b.depositAmount ?? Math.round(total * DEPOSIT_PERCENT);
        const canPay = !b.depositPaid && (b.status === "pending" || b.status === "reserved");
        const status = STATUS_COPY[b.status];
        return (
          <article key={b.id} className="lux-folio">
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <span className="lux-folio__code">{b.code}</span>
                <span className={`lux-status${status.tone === "plain" ? "" : ` lux-status--${status.tone}`}`}>
                  {status.label}
                </span>
                {b.depositPaid ? (
                  <span className="lux-status lux-status--ok">Đã cọc {percent}%</span>
                ) : canPay ? (
                  <span className="lux-status lux-status--warn">Chưa cọc</span>
                ) : null}
              </div>
              <div style={{ marginTop: 8, fontWeight: 500 }}>{roomLabel(b.roomId)}</div>
              <div className="lux-folio__meta">
                <span>
                  <CalendarDays className="size-3.5" aria-hidden />
                  {formatDate(b.checkIn)} → {formatDate(b.checkOut)} · {nights} đêm
                </span>
                <span>
                  <Users2 className="size-3.5" aria-hidden /> {b.guests} khách
                </span>
              </div>
              {b.note && <p className="lux-field-hint">Ghi chú: {b.note}</p>}
              {b.services.length > 0 && (
                <p className="lux-field-hint">
                  Dịch vụ: {b.services.map((s) => `${s.name} ×${s.qty}`).join(" · ")}
                </p>
              )}
              <div className="lux-folio__when">
                {daysUntil(b.checkIn) > 0
                  ? `Còn ${daysUntil(b.checkIn)} ngày tới Sao Mai.`
                  : b.status === "checked_in"
                    ? "Bạn đang lưu trú."
                    : "Ngày nhận phòng hôm nay hoặc đã qua."}
                <br />
                Nhận từ 14:00 · Trả trước 12:00
                <br />
                <span className={`lux-status lux-status--${cancelRefundFor(b.checkIn).tone}`} style={{ marginTop: 8 }}>
                  {cancelRefundFor(b.checkIn).label}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
              <div style={{ textAlign: "right" }}>
                <div className="lux-folio__price tabular-nums">{formatVND(total)}</div>
                <div className="lux-field-hint">
                  {b.depositPaid
                    ? `Đã cọc ${formatVND(b.depositAmount ?? deposit)}`
                    : `Cọc ${percent}%: ${formatVND(deposit)}`}
                </div>
              </div>
              {b.status !== "cancelled" && (
                <button type="button" className="lux-btn lux-btn--outline lux-btn--sm" onClick={() => setVoucherId(b.id)}>
                  <FileDown className="lux-btn__icon" aria-hidden /> Phiếu PDF
                </button>
              )}
              {canPay && (
                <button type="button" className="lux-btn lux-btn--ink lux-btn--sm" onClick={() => setPayingId(b.id)}>
                  <Wallet className="lux-btn__icon" aria-hidden /> Cọc ngay
                </button>
              )}
            </div>
          </article>
        );
      })}

      {paying && (
        <DepositDialog booking={paying} onClose={() => setPayingId(null)} onOpenLegal={onOpenLegal} />
      )}
      {voucher && <BookingVoucher booking={voucher} onClose={() => setVoucherId(null)} />}
    </div>
  );
}
