import { ArrowDownToLine, ArrowRight } from "lucide-react";
import { useStore } from "../../lib/store";
import { formatVND } from "../../lib/format";
import type { PageKey } from "../Layout";

const MATCH_LABEL: Record<string, string> = {
  matched: "Khớp đơn",
  unmatched: "Chưa gắn",
  amount_mismatch: "Lệch tiền",
  ignored: "Bỏ qua",
};

export function CashflowStrip({ onOpen }: { onOpen?: (page: PageKey) => void }) {
  const { bankInflows, bookings, customer } = useStore();
  const open = bankInflows.filter((x) => x.match === "unmatched" || x.match === "amount_mismatch");
  const recent = bankInflows.slice(0, 5);
  if (recent.length === 0 && open.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border border-[#e3ddd2] bg-[#fcfaf7] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ArrowDownToLine className="size-4 text-[#8a6d33]" />
          Dòng tiền vào
          {open.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              {open.length} chưa gắn đơn
            </span>
          )}
        </div>
        {onOpen && (
          <button type="button" className="inline-flex items-center gap-1 text-xs text-[#8a6d33]" onClick={() => onOpen("cashflow")}>
            Sổ đầy đủ <ArrowRight className="size-3.5" />
          </button>
        )}
      </div>
      {recent.map((row) => {
        const b = row.matchedBookingId ? bookings.find((x) => x.id === row.matchedBookingId) : undefined;
        const guest = b ? customer(b.customerId)?.name : undefined;
        return (
          <div key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-[#e3ddd2] bg-white px-3 py-2 text-sm">
            <div className="min-w-0">
              <span className="font-medium text-emerald-800">+{formatVND(row.amount)}</span>
              <span className="text-muted-foreground"> · {guest ?? row.bookingCode ?? "Chưa rõ khách"}</span>
              <div className="truncate text-[11px] text-muted-foreground">{row.description || "—"}</div>
            </div>
            <span className="text-[11px] text-muted-foreground">{MATCH_LABEL[row.match] ?? row.match}</span>
          </div>
        );
      })}
    </div>
  );
}
