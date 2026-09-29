import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "../ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useStore } from "../../lib/store";
import { Room, RoomStatus, RoomType } from "../../lib/types";
import { formatVND, uid } from "../../lib/format";
import { RoomStatusBadge } from "../status";
import { toast } from "sonner";

const STATUSES: RoomStatus[] = ["available", "occupied", "cleaning", "maintenance"];
const STATUS_LABEL: Record<RoomStatus, string> = {
  available: "Trống", occupied: "Đang ở", cleaning: "Đang dọn", maintenance: "Bảo trì",
};

export function Rooms() {
  const { rooms, roomTypes, saveRoom, deleteRoom, saveRoomType, roomType } = useStore();

  const [roomOpen, setRoomOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomType | null>(null);

  return (
    <Tabs defaultValue="rooms" className="space-y-4">
      <TabsList>
        <TabsTrigger value="rooms">Phòng ({rooms.length})</TabsTrigger>
        <TabsTrigger value="types">Loại phòng ({roomTypes.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="rooms">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Danh sách phòng</CardTitle>
            <Button size="sm" onClick={() => { setEditingRoom(null); setRoomOpen(true); }}>
              <Plus className="size-4" /> Thêm phòng
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Số phòng</TableHead>
                  <TableHead>Tầng</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Giá/đêm</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((r) => {
                  const t = roomType(r.typeId);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.number}</TableCell>
                      <TableCell>{r.floor}</TableCell>
                      <TableCell>{t?.name}</TableCell>
                      <TableCell>{formatVND(t?.basePrice ?? 0)}</TableCell>
                      <TableCell><RoomStatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingRoom(r); setRoomOpen(true); }}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { deleteRoom(r.id); toast.success(`Đã xóa phòng ${r.number}`); }}>
                          <Trash2 className="size-4 text-rose-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="types">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Loại phòng</CardTitle>
            <Button size="sm" onClick={() => { setEditingType(null); setTypeOpen(true); }}>
              <Plus className="size-4" /> Thêm loại
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roomTypes.map((t) => (
              <Card key={t.id} className="border-2">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4>{t.name}</h4>
                    <Button variant="ghost" size="icon" onClick={() => { setEditingType(t); setTypeOpen(true); }}>
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                  <div className="text-primary font-semibold">{formatVND(t.basePrice)}/đêm</div>
                  <div className="text-sm text-muted-foreground">Sức chứa: {t.capacity} khách</div>
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {t.amenities.map((a) => <Badge key={a} variant="secondary">{a}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      {roomOpen && (
        <RoomDialog
          room={editingRoom}
          roomTypes={roomTypes}
          onClose={() => setRoomOpen(false)}
          onSave={(r) => { saveRoom(r); toast.success("Đã lưu phòng"); setRoomOpen(false); }}
        />
      )}
      {typeOpen && (
        <TypeDialog
          type={editingType}
          onClose={() => setTypeOpen(false)}
          onSave={(t) => { saveRoomType(t); toast.success("Đã lưu loại phòng"); setTypeOpen(false); }}
        />
      )}
    </Tabs>
  );
}

function RoomDialog({ room, roomTypes, onClose, onSave }: {
  room: Room | null; roomTypes: RoomType[]; onClose: () => void; onSave: (r: Room) => void;
}) {
  const [number, setNumber] = useState(room?.number ?? "");
  const [floor, setFloor] = useState(String(room?.floor ?? 1));
  const [typeId, setTypeId] = useState(room?.typeId ?? roomTypes[0]?.id ?? "");
  const [status, setStatus] = useState<RoomStatus>(room?.status ?? "available");

  const submit = () => {
    if (!number.trim()) return toast.error("Vui lòng nhập số phòng.");
    onSave({ id: room?.id ?? uid("r"), number: number.trim(), floor: Number(floor) || 1, typeId, status });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{room ? "Sửa phòng" : "Thêm phòng"}</DialogTitle>
          <DialogDescription>Cấu hình số phòng, loại phòng và trạng thái.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Số phòng</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} /></div>
            <div className="space-y-2"><Label>Tầng</Label><Input type="number" value={floor} onChange={(e) => setFloor(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Loại phòng</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roomTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {formatVND(t.basePrice)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as RoomStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={submit}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeDialog({ type, onClose, onSave }: {
  type: RoomType | null; onClose: () => void; onSave: (t: RoomType) => void;
}) {
  const [name, setName] = useState(type?.name ?? "");
  const [basePrice, setBasePrice] = useState(String(type?.basePrice ?? 6800000));
  const [capacity, setCapacity] = useState(String(type?.capacity ?? 2));
  const [amenities, setAmenities] = useState((type?.amenities ?? []).join(", "));
  const [description, setDescription] = useState(type?.description ?? "");

  const submit = () => {
    if (!name.trim()) return toast.error("Vui lòng nhập tên loại phòng.");
    onSave({
      id: type?.id ?? uid("rt"),
      name: name.trim(),
      basePrice: Number(basePrice) || 0,
      capacity: Number(capacity) || 1,
      amenities: amenities.split(",").map((a) => a.trim()).filter(Boolean),
      description: description.trim(),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type ? "Sửa loại phòng" : "Thêm loại phòng"}</DialogTitle>
          <DialogDescription>Đặt tên, sức chứa và giá cơ bản cho loại phòng.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2"><Label>Tên loại</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Giá/đêm (VND)</Label><Input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} /></div>
            <div className="space-y-2"><Label>Sức chứa</Label><Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Tiện ích (phân cách bằng dấu phẩy)</Label><Input value={amenities} onChange={(e) => setAmenities(e.target.value)} /></div>
          <div className="space-y-2"><Label>Mô tả</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={submit}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
