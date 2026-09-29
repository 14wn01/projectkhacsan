import { Check, X } from "lucide-react";
import { Button } from "../ui/button";
import { useStore } from "../../lib/store";
import { formatVND } from "../../lib/format";
import { toast } from "sonner";

export function BankTransferQueue({ compact = false }: { compact?: boolean }) {
  const { payments, bookings, customer, roomLabel, settlePayment } = useStore();
  const pending = payments.filter((p) => p.method === "bank_transfer" && p.state === "pending");

  if (pending.length === 0) {
    if (compact) return null;
    return <p className="text-sm text-muted-foreground">Không có lệnh chuyển khoản chờ đối chiếu.</p>;
  }

  const confirm = (id: string, ok: boolean) => {
    settlePayment(id, ok, ok ? "Đã thấy tiền vào TK" : "Không thấy trên sao kê");
    toast[ok ? "success" : "error"](ok ? "Đã ghi nhận cọc / thanh toán." : "Đã đánh dấu chưa nhận tiền.");
  };

  return (
    <div className={compact ? "space-y-2 rounded-md border border-[#e3ddd2] bg-[#fcfaf7] p-4" : "space-y-2"}>
      <div className="text-sm font-medium">Chờ đối chiếu chuyển khoản ({pending.length})</div>
      {pending.map((p) => {
        const b = bookings.find((x) => x.id === p.bookingId);
        const c = b ? customer(b.customerId) : undefined;
        return (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#e3ddd2] bg-white px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium">
                {b?.code ?? p.bookingId} · {formatVND(p.amount)}
              </div>
              <div className="text-xs text-muted-foreground">
                {c?.name ?? "Khách"} {c?.phone ? `· ${c.phone}` : ""} {b ? `· ${roomLabel(b.roomId)}` : ""}
                <br />
                Nội dung: <span className="tabular-nums font-medium text-foreground">{p.transferContent ?? "—"}</span>
                {" · "}
                {new Date(p.createdAt).toLocaleString("vi-VN")}
                {p.payerNote ? ` · “${p.payerNote}”` : ""}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" onClick={() => confirm(p.id, true)}>
                <Check className="size-4" /> Đã nhận
              </Button>
              <Button size="sm" variant="outline" onClick={() => confirm(p.id, false)}>
                <X className="size-4" /> Không thấy
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
