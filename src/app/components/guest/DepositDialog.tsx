import { useRef, useState } from "react";
import { Building2, CheckCircle2, Copy, Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { DEPOSIT_PERCENT, useStore } from "../../lib/store";
import { isBankConfigured, transferContent, vietQrImageUrl } from "../../lib/bank";
import { Booking } from "../../lib/types";
import { formatVND, nightsBetween } from "../../lib/format";
import { toast } from "sonner";

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`Đã chép ${label}`);
  } catch {
    toast.error("Không chép được. Hãy chọn và copy thủ công.");
  }
}

/**
 * Cọc giữ phòng bằng chuyển khoản VietQR — khách chuyển thật, lễ tân đối chiếu.
 */
export function DepositPanel({ booking, onPaid, onOpenLegal }: {
  booking: Booking;
  onPaid?: () => void;
  onOpenLegal?: () => void;
}) {
  const { startPayment, payments, bankAccount } = useStore();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [qrBroken, setQrBroken] = useState(false);
  const payLock = useRef(false);
  const agreeRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const nights = Math.max(nightsBetween(booking.checkIn, booking.checkOut), 1);
  const serviceTotal = booking.services.reduce((s, x) => s + x.price * x.qty, 0);
  const total = (booking.nightlyRates?.length ? booking.nightlyRates.reduce((s, n) => s + n.price, 0) : booking.roomPricePerNight * nights) + serviceTotal;
  const percent = Math.round((booking.depositPercent ?? DEPOSIT_PERCENT) * 100);
  const deposit = booking.depositAmount ?? Math.round(total * DEPOSIT_PERCENT);
  const content = transferContent(booking.code, "deposit");
  const pending = payments.find(
    (p) => p.bookingId === booking.id && p.method === "bank_transfer" && p.purpose === "deposit" && p.state === "pending",
  );
  const ready = isBankConfigured(bankAccount);
  const qr = ready ? vietQrImageUrl(bankAccount, deposit, content) : "";

  if (booking.depositPaid) {
    return (
      <div className="lux-done">
        <hr className="lux-rule" />
        <CheckCircle2 className="size-8" style={{ color: "var(--lux-success)" }} aria-hidden />
        <div className="lux-done__code" style={{ fontSize: "1.45rem" }}>
          Đã nhận cọc {formatVND(booking.depositAmount ?? deposit)}
        </div>
        <p className="lux-muted">
          Phòng đang được giữ. Lễ tân sẽ sớm xác nhận yêu cầu {booking.code}.
        </p>
      </div>
    );
  }

  const report = async () => {
    if (payLock.current || pending) return;
    if (!agreed) {
      setError("Bạn cần đồng ý điều khoản và chính sách hủy phòng trước khi báo chuyển khoản.");
      agreeRef.current?.focus();
      return;
    }
    setError(null);
    payLock.current = true;
    setBusy(true);
    try {
      const result = await startPayment({
        bookingId: booking.id,
        method: "bank_transfer",
        purpose: "deposit",
        amount: deposit,
        payerNote: note,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Đã ghi nhận. Lễ tân đối chiếu sao kê rồi xác nhận cọc.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được báo chuyển khoản.");
    } finally {
      payLock.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="lux-form">
      <p className="lux-label">Chuyển khoản giữ phòng</p>
      <p className="lux-muted" style={{ marginTop: -4 }}>
        Quét VietQR hoặc chuyển đúng số tiền và nội dung dưới đây. Cọc {percent}%: <b className="tabular-nums">{formatVND(deposit)}</b>
      </p>

      {!ready && (
        <div className="lux-alert lux-alert--warn" role="status">
          Khách sạn chưa khai báo số tài khoản nhận tiền. Gọi lễ tân để được hướng dẫn chuyển khoản.
        </div>
      )}

      {ready && (
        <div className="lux-alert" role="group" aria-label="Thông tin chuyển khoản">
          <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
            {!qrBroken && (
              <img
                src={qr}
                alt="Mã VietQR chuyển khoản cọc"
                width={220}
                height={220}
                style={{ background: "#fff", borderRadius: 4 }}
                onError={() => setQrBroken(true)}
              />
            )}
            {qrBroken && <p className="lux-muted">Không tải được mã QR. Chuyển tay theo số tài khoản bên dưới.</p>}
            <dl className="lux-form" style={{ width: "100%", fontSize: "0.875rem" }}>
              <Row label="Ngân hàng" value={`${bankAccount.bankName}${bankAccount.branch ? ` · ${bankAccount.branch}` : ""}`} />
              <Row label="Chủ tài khoản" value={bankAccount.accountName} onCopy={() => void copyText("tên chủ TK", bankAccount.accountName)} />
              <Row label="Số tài khoản" value={bankAccount.accountNo} onCopy={() => void copyText("số tài khoản", bankAccount.accountNo)} />
              <Row label="Số tiền" value={formatVND(deposit)} onCopy={() => void copyText("số tiền", String(deposit))} />
              <Row label="Nội dung" value={content} onCopy={() => void copyText("nội dung", content)} />
            </dl>
            <p className="lux-field-hint" style={{ textAlign: "center" }}>
              Ghi đúng nội dung <b>{content}</b> để lễ tân khớp sao kê với đơn của bạn.
            </p>
          </div>
        </div>
      )}

      {pending && (
        <p className="lux-alert lux-alert--warn" role="status">
          Bạn đã báo chuyển khoản lúc {new Date(pending.createdAt).toLocaleString("vi-VN")}. Chờ lễ tân đối chiếu — chưa ghi nhận đã nhận tiền.
        </p>
      )}

      <label className="lux-label" htmlFor="ck-note">Ghi chú (tuỳ chọn)</label>
      <input
        id="ck-note"
        className="lux-input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="VD: chuyển lúc 14:20 từ TK Vietcombank …"
        disabled={!!pending}
      />

      <label className="lux-check">
        <input
          ref={agreeRef}
          type="checkbox"
          checked={agreed}
          onChange={(e) => { setAgreed(e.target.checked); setError(null); }}
        />
        <span>
          Tôi đã đọc và đồng ý{" "}
          {onOpenLegal ? (
            <button type="button" className="lux-ghost" style={{ minHeight: "auto", padding: 0, display: "inline" }} onClick={onOpenLegal}>
              điều khoản dịch vụ, chính sách hủy phòng và chính sách bảo mật
            </button>
          ) : (
            <b>điều khoản dịch vụ, chính sách hủy phòng và chính sách bảo mật</b>
          )}
          . Tiền cọc được hoàn theo mốc thời gian hủy ghi trong chính sách.
        </span>
      </label>

      {error && (
        <div className="lux-alert lux-alert--danger" role="alert">{error}</div>
      )}

      <p className="lux-muted" style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.75rem" }}>
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
        Cọc chỉ được ghi nhận sau khi lễ tân thấy tiền vào tài khoản Sao Mai.
      </p>

      <button
        type="button"
        className="lux-btn lux-btn--ink lux-btn--block"
        onClick={() => void report()}
        disabled={busy || !!pending || !ready}
      >
        {busy ? <Loader2 className="lux-btn__icon animate-spin" aria-hidden /> : pending ? <CheckCircle2 className="lux-btn__icon" aria-hidden /> : <Building2 className="lux-btn__icon" aria-hidden />}
        {pending ? "Đã báo chuyển khoản" : busy ? "Đang ghi nhận…" : "Tôi đã chuyển khoản"}
      </button>
    </div>
  );
}

function Row({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div>
        <div className="lux-field-hint">{label}</div>
        <div className="tabular-nums" style={{ fontWeight: 500 }}>{value}</div>
      </div>
      {onCopy && (
        <button type="button" className="lux-ghost" onClick={onCopy} aria-label={`Chép ${label}`} style={{ minHeight: 36, padding: "0 8px" }}>
          <Copy className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

export function DepositDialog({ booking, onClose, onOpenLegal }: {
  booking: Booking;
  onClose: () => void;
  onOpenLegal?: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md lux-sheet" overlayClassName="lux-overlay">
        <DialogHeader>
          <DialogTitle>Đặt cọc giữ phòng</DialogTitle>
          <DialogDescription>Chuyển khoản VietQR · mã {booking.code}</DialogDescription>
        </DialogHeader>
        <DepositPanel booking={booking} onOpenLegal={onOpenLegal} />
      </DialogContent>
    </Dialog>
  );
}
