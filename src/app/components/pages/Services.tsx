import { useMemo, useState } from "react";
import { Shirt, UtensilsCrossed, Car, Package, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { useStore } from "../../lib/store";
import { formatVND, uid } from "../../lib/format";
import { ServiceCatalogItem } from "../../lib/types";

const CAT_META: Record<ServiceCatalogItem["category"], { label: string; icon: typeof Shirt; tint: string }> = {
  laundry: { label: "Giặt là", icon: Shirt, tint: "bg-sky-100 text-sky-700" },
  food: { label: "Ăn uống", icon: UtensilsCrossed, tint: "bg-amber-100 text-amber-700" },
  transport: { label: "Đưa đón", icon: Car, tint: "bg-indigo-100 text-indigo-700" },
  other: { label: "Khác", icon: Package, tint: "bg-slate-100 text-slate-700" },
};

export function Services() {
  const { services, bookings, saveService, deleteService, can } = useStore();
  const [editing, setEditing] = useState<Partial<ServiceCatalogItem> | null>(null);

  const usage = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      for (const s of b.services) {
        const cur = map.get(s.serviceId) ?? { qty: 0, revenue: 0 };
        cur.qty += s.qty; cur.revenue += s.price * s.qty;
        map.set(s.serviceId, cur);
      }
    }
    return map;
  }, [bookings]);

  const totalRevenue = Array.from(usage.values()).reduce((s, x) => s + x.revenue, 0);
  const canEdit = can("services"); // Quyền quản lý dịch vụ

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.name || !editing.price || !editing.unit || !editing.category) return;
    saveService({
      id: editing.id || uid("s"),
      name: editing.name,
      category: editing.category,
      price: Number(editing.price),
      unit: editing.unit,
    } as ServiceCatalogItem);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(CAT_META) as ServiceCatalogItem["category"][]).map((cat) => {
          const m = CAT_META[cat];
          const Icon = m.icon;
          const count = services.filter((s) => s.category === cat).length;
          return (
            <Card key={cat}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`grid place-items-center size-11 rounded-xl ${m.tint}`}><Icon className="size-5" /></div>
                <div><div className="text-sm text-muted-foreground">{m.label}</div><div className="text-xl font-semibold">{count} dịch vụ</div></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Bảng giá dịch vụ</CardTitle>
            <div className="text-sm text-muted-foreground mt-1">Quản lý các dịch vụ và đồ uống cung cấp cho khách</div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-base font-medium">Tổng doanh thu: {formatVND(totalRevenue)}</Badge>
            {canEdit && (
              <Button onClick={() => setEditing({ category: "food", price: 0, unit: "suất" })}>
                <Plus className="size-4 mr-1" /> Thêm dịch vụ
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dịch vụ</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Đơn giá</TableHead>
                <TableHead>Đơn vị</TableHead>
                <TableHead className="text-right">Đã bán</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                {canEdit && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => {
                const u = usage.get(s.id);
                const m = CAT_META[s.category];
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="outline">{m.label}</Badge></TableCell>
                    <TableCell>{formatVND(s.price)}</TableCell>
                    <TableCell>{s.unit}</TableCell>
                    <TableCell className="text-right font-medium">{u?.qty ?? 0}</TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">{formatVND(u?.revenue ?? 0)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(s)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => {
                            if (confirm("Xóa dịch vụ này?")) deleteService(s.id);
                          }}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Sửa dịch vụ" : "Thêm dịch vụ mới"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Tên dịch vụ</Label>
                <Input value={editing?.name || ""} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))} autoFocus required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Đơn giá (VNĐ)</Label>
                  <Input type="number" min={0} value={editing?.price || 0} onChange={e => setEditing(p => ({ ...p!, price: Number(e.target.value) }))} required />
                </div>
                <div className="grid gap-2">
                  <Label>Đơn vị tính</Label>
                  <Input value={editing?.unit || ""} onChange={e => setEditing(p => ({ ...p!, unit: e.target.value }))} placeholder="VD: ly, chai, kg..." required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Phân loại</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editing?.category || "other"}
                  onChange={e => setEditing(p => ({ ...p!, category: e.target.value as ServiceCatalogItem["category"] }))}
                >
                  <option value="food">Ăn uống</option>
                  <option value="laundry">Giặt là</option>
                  <option value="transport">Đưa đón</option>
                  <option value="other">Khác</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Hủy</Button>
              <Button type="submit">Lưu dịch vụ</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
