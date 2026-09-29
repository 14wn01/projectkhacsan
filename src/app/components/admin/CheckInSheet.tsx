import { useRef, useState } from "react";
import { AlertTriangle, Loader2, LogIn, ScanLine, Wallet } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { useStore } from "../../lib/store";
import { Booking, IdDocumentData } from "../../lib/types";
import { formatVND } from "../../lib/format";
import { scanIdDocument } from "../../lib/ocr";
import { toast } from "sonner";

/** Nhận phòng: CCCD bắt buộc; cảnh báo nếu chưa cọc. */
export function CheckInSheet({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { customer, checkInWithDocument, roomLabel } = useStore();
  const c = customer(booking.customerId);
  const depositDue = (booking.depositAmount ?? 0) > 0 && !booking.depositPaid;

  const [docType, setDocType] = useState<"cccd" | "passport">("cccd");
  const [scanning, setScanning] = useState(false);
  const [fullName, setFullName] = useState(c?.name ?? "");
  const [idNumber, setIdNumber] = useState(c?.idNumber ?? "");
  const [dob, setDob] = useState(c?.dob ?? "");
  const [address, setAddress] = useState(c?.address ?? "");
  const [nationality, setNationality] = useState(c?.nationality ?? "");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const onScan = async (file: File) => {
    setScanning(true);
    setWarnings([]);
    try {
      const res = await scanIdDocument(file, docType);
      setFullName(res.data.fullName || fullName);
      setIdNumber(res.data.idNumber || idNumber);
      setDob(res.data.dob || "");
      setAddress(res.data.address || address);
      setNationality(res.data.nationality || "");
      setConfidence(res.data.confidence);
      setNeedsReview(res.needsReview);
      setWarnings(res.warnings);
      toast.success(res.needsReview ? "Đã quét — cần kiểm tra lại bằng mắt." : "Đã quét xong giấy tờ.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không đọc được ảnh. Hãy nhập tay.");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = () => {
    if (!fullName.trim()) return toast.error("Thiếu họ tên trên giấy tờ.");
    if (!idNumber.trim()) return toast.error("Thiếu số CCCD/Passport.");
    const doc: IdDocumentData = {
      fullName: fullName.trim(),
      idNumber: idNumber.trim(),
      dob: dob.trim() || undefined,
      address: address.trim() || undefined,
      nationality: nationality.trim() || undefined,
      docType,
      confidence: confidence ?? 1,
    };
    const res = checkInWithDocument(booking.id, doc);
    if (res.ok) {
      toast.success(res.message);
      onClose();
    } else toast.error(res.message);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nhận phòng — {booking.code}</DialogTitle>
          <DialogDescription>
            {roomLabel(booking.roomId)} · {c?.name ?? "Khách"} · nhận từ 14:00. Cần CCCD/hộ chiếu trước khi đổi trạng thái.
          </DialogDescription>
        </DialogHeader>

        {depositDue && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <Wallet className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-medium">Chưa nhận cọc {formatVND(booking.depositAmount ?? 0)}</div>
              <p className="text-xs opacity-80">Vẫn có thể nhận phòng — nhắc thu cọc tại quầy hoặc ghi chú cho ca sau.</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-2">
              <Label>Loại giấy tờ</Label>
              <Select value={docType} onValueChange={(v) => setDocType(v as "cccd" | "passport")}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cccd">CCCD / CMND</SelectItem>
                  <SelectItem value="passport">Passport</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" disabled={scanning} onClick={() => fileRef.current?.click()}>
              {scanning ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
              {scanning ? "Đang đọc…" : "Quét ảnh giấy tờ"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onScan(f);
              }}
            />
            {confidence !== null && (
              <Badge variant={needsReview ? "destructive" : "secondary"}>
                Độ tin cậy {Math.round(confidence * 100)}%
              </Badge>
            )}
          </div>

          {(needsReview || warnings.length > 0) && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <div className="font-medium">Cần lễ tân xác nhận bằng mắt</div>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-xs">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                  {warnings.length === 0 && <li>Ảnh mờ hoặc chụp lệch — hãy đối chiếu với giấy tờ thật.</li>}
                </ul>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ci-name">Họ tên trên giấy tờ</Label>
              <Input id="ci-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci-id">Số {docType === "cccd" ? "CCCD" : "Passport"}</Label>
              <Input id="ci-id" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci-dob">Ngày sinh</Label>
              <Input id="ci-dob" value={dob} onChange={(e) => setDob(e.target.value)} placeholder="YYYY-MM-DD" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci-nat">Quốc tịch</Label>
              <Input id="ci-nat" value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="Việt Nam" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ci-addr">Địa chỉ</Label>
              <Input id="ci-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={submit}><LogIn className="size-4" /> Xác nhận nhận phòng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
