import { useMemo, useState } from "react";
import { Globe, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../../lib/store";
import { formatVND } from "../../lib/format";
import { reconcileChannels } from "../../lib/payments";
import { ChannelAccount } from "../../lib/types";
import { Button } from "../ui/button";

function timeAgo(iso?: string) {
  if (!iso) return "Chưa đồng bộ";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return mins + " phút trước";
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + " giờ trước";
  return Math.round(hours / 24) + " ngày trước";
}

export function Channels() {
  const { channels, bookings, payments, bookingTotalOf, saveChannel, syncChannel, rooms, can } = useStore();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [edit, setEdit] = useState<ChannelAccount | null>(null);

  const rows = useMemo(
    () => reconcileChannels(bookings, payments, channels, bookingTotalOf),
    [bookings, payments, channels, bookingTotalOf],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          gross: a.gross + r.grossRevenue,
          commission: a.commission + r.commission,
          net: a.net + r.netRevenue,
          unsettled: a.unsettled + r.unsettled,
          bookings: a.bookings + r.bookings,
        }),
        { gross: 0, commission: 0, net: 0, unsettled: 0, bookings: 0 },
      ),
    [rows],
  );

  const allotmentTotal = channels.reduce((s, c) => s + (c.connected ? c.allotment : 0), 0);
  const overAllotted = allotmentTotal > rooms.length;
  const readOnly = !can("channels");

  const doSync = async (c: ChannelAccount) => {
    if (!c.connected) {
      toast.error(c.name + " chưa kết nối. Bấm Sửa để bật kết nối trước.");
      return;
    }
    setSyncing(c.id);
    try {
      syncChannel(c.id);
      await new Promise((r) => setTimeout(r, 500));
      toast.success("\u0110\u00e3 \u0111\u1ed3ng b\u1ed9 t\u00ecnh tr\u1ea1ng ph\u00f2ng v\u1ec1 " + c.name);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-5">
      {readOnly && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <p>Chế độ chỉ xem. Chỉ Quản lý / Admin được sửa cấu hình kênh và hoa hồng.</p>
        </div>
      )}

      {overAllotted && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-600" />
          <p>
            Tổng phân bổ các kênh đang bật là <b>{allotmentTotal}</b> nhưng chỉ có <b>{rooms.length}</b> phòng.
            Rủi ro trùng phòng cao — hãy giảm phân bổ hoặc tắt bớt kênh.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Doanh thu gộp</div>
          <div className="mt-1 text-xl font-semibold">{formatVND(totals.gross)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{totals.bookings} đặt phòng</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Hoa hồng phải trả</div>
          <div className="mt-1 text-xl font-semibold text-red-600">-{formatVND(totals.commission)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Thực nhận</div>
          <div className="mt-1 text-xl font-semibold text-emerald-700">{formatVND(totals.net)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Chưa thu đủ</div>
          <div className="mt-1 text-xl font-semibold text-amber-600">{formatVND(totals.unsettled)}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Globe className="size-4" />
          <h3 className="text-sm font-semibold">Kênh bán phòng</h3>
          <span className="ml-auto text-xs text-muted-foreground">
            Phân bổ {allotmentTotal}/{rooms.length} phòng
          </span>
        </div>
        <ul className="divide-y">
          {channels.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-40 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {c.name}
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[11px] " +
                      (c.connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")
                    }
                  >
                    {c.connected ? "Đã kết nối" : "Chưa kết nối"}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Hoa hồng {Math.round(c.commissionRate * 100)}% · Phân bổ {c.allotment} phòng · {timeAgo(c.lastSyncAt)}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" disabled={syncing === c.id} onClick={() => void doSync(c)}>
                  <RefreshCw className={"size-4 " + (syncing === c.id ? "animate-spin" : "")} />
                  Đồng bộ
                </Button>
                <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => setEdit({ ...c })}>
                  Sửa
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {edit && (
        <div className="rounded-xl border bg-white p-4">
          <h3 className="text-sm font-semibold">Cấu hình {edit.name}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <label className="text-sm">
              <span className="text-muted-foreground">Tên kênh</span>
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                className="mt-1 w-full rounded-lg border px-2.5 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Hoa hồng (%)</span>
              <input
                type="number"
                min={0}
                max={40}
                step={0.5}
                value={Math.round(edit.commissionRate * 1000) / 10}
                onChange={(e) => setEdit({ ...edit, commissionRate: Number(e.target.value) / 100 })}
                className="mt-1 w-full rounded-lg border px-2.5 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Phân bổ phòng</span>
              <input
                type="number"
                min={0}
                max={200}
                value={edit.allotment}
                onChange={(e) => setEdit({ ...edit, allotment: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border px-2.5 py-2"
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={edit.connected}
                onChange={(e) => setEdit({ ...edit, connected: e.target.checked })}
              />
              <span className="text-muted-foreground">Bật kết nối</span>
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                saveChannel(edit);
                setEdit(null);
                toast.success("Đã lưu cấu hình kênh");
              }}
            >
              Lưu
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
              Hủy
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Đối soát doanh thu theo kênh</h3>
          <p className="text-xs text-muted-foreground">
            So doanh thu đặt phòng với số tiền thực thu, trừ hoa hồng từng kênh.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Kênh</th>
                <th className="px-4 py-2">Đặt phòng</th>
                <th className="px-4 py-2">Doanh thu gộp</th>
                <th className="px-4 py-2">Hoa hồng</th>
                <th className="px-4 py-2">Thực nhận</th>
                <th className="px-4 py-2">Chưa thu</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.channel} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium">{r.channel}</td>
                  <td className="px-4 py-2 tabular-nums">{r.bookings}</td>
                  <td className="px-4 py-2 tabular-nums">{formatVND(r.grossRevenue)}</td>
                  <td className="px-4 py-2 tabular-nums text-red-600">
                    {r.commission > 0 ? "-" + formatVND(r.commission) : "—"}
                  </td>
                  <td className="px-4 py-2 font-medium tabular-nums">{formatVND(r.netRevenue)}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {r.unsettled > 0 ? (
                      <span className="font-medium text-amber-600">{formatVND(r.unsettled)}</span>
                    ) : (
                      <span className="text-emerald-600">Đủ</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Chưa có dữ liệu để đối soát.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
