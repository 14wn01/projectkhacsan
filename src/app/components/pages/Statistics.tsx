import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { useStore } from "../../lib/store";
import { buildSeries } from "../../lib/analytics";
import { formatVND, toISODate } from "../../lib/format";

const RANGES = [
  { key: "day", label: "7 ngày", days: 7 },
  { key: "week", label: "4 tuần", days: 28 },
  { key: "month", label: "3 tháng", days: 90 },
] as const;

const PIE_COLORS = ["#0f766e", "#14b8a6", "#38bdf8", "#6366f1", "#f59e0b"];

export function Statistics() {
  const { bookings, rooms, roomType } = useStore();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("day");
  const days = RANGES.find((r) => r.key === range)!.days;

  const daily = useMemo(() => buildSeries(bookings, rooms, days), [bookings, rooms, days]);

  // gộp theo tuần/tháng cho gọn
  const series = useMemo(() => {
    if (range === "day") return daily;
    const bucket = range === "week" ? 7 : 30;
    const out: { label: string; revenue: number; occupancy: number }[] = [];
    for (let i = 0; i < daily.length; i += bucket) {
      const chunk = daily.slice(i, i + bucket);
      out.push({
        label: range === "week" ? `Tuần ${out.length + 1}` : `Tháng ${out.length + 1}`,
        revenue: chunk.reduce((s, x) => s + x.revenue, 0),
        occupancy: Math.round(chunk.reduce((s, x) => s + x.occupancy, 0) / chunk.length),
      });
    }
    return out;
  }, [daily, range]);

  const totalRevenue = daily.reduce((s, x) => s + x.revenue, 0);
  const avgOcc = Math.round(daily.reduce((s, x) => s + x.occupancy, 0) / Math.max(daily.length, 1));

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const t = roomType(rooms.find((r) => r.id === b.roomId)?.typeId ?? "");
      if (t) map.set(t.name, (map.get(t.name) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [bookings, rooms, roomType]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
          <TabsList>{RANGES.map((r) => <TabsTrigger key={r.key} value={r.key}>{r.label}</TabsTrigger>)}</TabsList>
        </Tabs>
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">Doanh thu: <strong className="text-foreground">{formatVND(totalRevenue)}</strong></span>
          <span className="text-muted-foreground">Công suất TB: <strong className="text-foreground">{avgOcc}%</strong></span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Doanh thu theo {range === "day" ? "ngày" : range === "week" ? "tuần" : "tháng"}</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ left: -10, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000000)}tr`} />
                <Tooltip formatter={(v: number) => [formatVND(v), "Doanh thu"]} />
                <Bar dataKey="revenue" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Công suất phòng (%)</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ left: -10, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip formatter={(v: number) => [`${v}%`, "Công suất"]} />
                <Line type="monotone" dataKey="occupancy" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cơ cấu đặt phòng theo loại</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tổng quan {toISODate(new Date())}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Metric label="Tổng phòng" value={String(rooms.length)} />
            <Metric label="Lượt đặt (kỳ này)" value={String(bookings.filter((b) => b.status !== "cancelled").length)} />
            <Metric label="Doanh thu kỳ" value={formatVND(totalRevenue)} />
            <Metric label="Công suất TB" value={`${avgOcc}%`} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
