import { useMemo, useState } from "react";
import { Eye, Printer, Search, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { HOTEL_FULL_NAME, useStore } from "../../lib/store";
import { Invoice } from "../../lib/types";
import { formatDate, formatVND, nightsBetween } from "../../lib/format";
import { PaymentStatusBadge } from "../status";
import { useTable } from "../../lib/useTable";
import { Pagination } from "../Pagination";
import { toast } from "sonner";
import { BankTransferQueue } from "../admin/BankTransferQueue";

export function Invoices() {
  const { invoices, bookings, customer, roomLabel } = useStore();
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);

  const bookingCode = (id: string) => bookings.find((b) => b.id === id)?.code ?? "";
  const t = useTable(invoices, (i) => `${i.code} ${bookingCode(i.bookingId)}`);

  const outstanding = invoices.reduce((s, i) => s + (i.total - i.paid), 0);
  const collected = invoices.reduce((s, i) => s + i.paid, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Tổng hóa đơn</div><div className="text-2xl font-semibold">{invoices.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Đã thu</div><div className="text-2xl font-semibold text-emerald-600">{formatVND(collected)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Còn phải thu</div><div className="text-2xl font-semibold text-rose-600">{formatVND(outstanding)}</div></CardContent></Card>
      </div>

      <div className="rounded-md border border-[#e3ddd2] bg-[#fcfaf7] p-4">
        <BankTransferQueue />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Hóa đơn</CardTitle>
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input value={t.query} onChange={(e) => t.setQuery(e.target.value)} placeholder="Tìm mã hóa đơn…" className="pl-8 w-56" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã HĐ</TableHead>
                <TableHead>Khách</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead className="text-right">Tổng</TableHead>
                <TableHead className="text-right">Đã trả</TableHead>
                <TableHead>Thanh toán</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {t.rows.map((i) => {
                const b = bookings.find((x) => x.id === i.bookingId);
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.code}</TableCell>
                    <TableCell>{b ? customer(b.customerId)?.name : "-"}</TableCell>
                    <TableCell>{formatDate(i.issuedAt)}</TableCell>
                    <TableCell className="text-right">{formatVND(i.total)}</TableCell>
                    <TableCell className="text-right">{formatVND(i.paid)}</TableCell>
                    <TableCell><PaymentStatusBadge status={i.status} /></TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {i.status !== "paid" && (
                        <Button variant="ghost" size="icon" title="Ghi nhận thanh toán" onClick={() => setPaying(i)}><Wallet className="size-4 text-emerald-600" /></Button>
                      )}
                      <Button variant="ghost" size="icon" title="Xem" onClick={() => setViewing(i)}><Eye className="size-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {t.rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Chưa có hóa đơn. Hóa đơn được tạo khi khách trả phòng.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination page={t.page} totalPages={t.totalPages} total={t.total} onChange={t.setPage} />
        </CardContent>
      </Card>

      {viewing && <InvoiceView invoice={viewing} onClose={() => setViewing(null)} />}
      {paying && <PayDialog invoice={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

function PayDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { recordPayment } = useStore();
  const remaining = invoice.total - invoice.paid;
  const [amount, setAmount] = useState(String(remaining));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán — {invoice.code}</DialogTitle>
          <DialogDescription>Nhập số tiền khách thanh toán cho hóa đơn này.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-sm text-muted-foreground">Còn phải thu: <span className="font-medium text-foreground">{formatVND(remaining)}</span></div>
          <div className="space-y-2"><Label>Số tiền</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={() => { recordPayment(invoice.id, Number(amount) || 0); toast.success("Đã ghi nhận thanh toán"); onClose(); }}>Xác nhận</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceView({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { bookings, customer, roomLabel } = useStore();
  const b = bookings.find((x) => x.id === invoice.bookingId);
  const c = b ? customer(b.customerId) : undefined;
  const nights = b ? nightsBetween(b.checkIn, b.checkOut) : 0;

  const print = () => {
    const node = document.getElementById("invoice-print");
    if (!node) return;
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { toast.error("Trình duyệt chặn cửa sổ in."); return; }
    w.document.write(`<html><head><title>${invoice.code}</title>
      <style>body{font-family:Inter,system-ui,sans-serif;padding:32px;color:#0f172a}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}
      td.r,th.r{text-align:right}h1{margin:0}.muted{color:#64748b;font-size:13px}
      .total{font-size:18px;font-weight:700}</style></head>
      <body>${node.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hóa đơn {invoice.code}</DialogTitle>
          <DialogDescription>Chi tiết tiền phòng, dịch vụ và tình trạng thanh toán.</DialogDescription>
        </DialogHeader>
        <div id="invoice-print" className="text-sm">
          <div className="flex justify-between items-start">
            <div>
              <h1 style={{ fontSize: 22 }}>{HOTEL_FULL_NAME}</h1>
              <div className="muted">Hóa đơn dịch vụ lưu trú</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div><strong>{invoice.code}</strong></div>
              <div className="muted">Ngày: {formatDate(invoice.issuedAt)}</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div><strong>Khách hàng:</strong> {c?.name}</div>
            <div className="muted">{c?.phone} · {c?.email}</div>
            {b && <div className="muted">Phòng {roomLabel(b.roomId)} · {formatDate(b.checkIn)} → {formatDate(b.checkOut)} ({nights} đêm)</div>}
          </div>
          <table>
            <thead><tr><th>Hạng mục</th><th className="r">SL</th><th className="r">Đơn giá</th><th className="r">Thành tiền</th></tr></thead>
            <tbody>
              <tr><td>Tiền phòng</td><td className="r">{nights}</td><td className="r">{formatVND(b?.roomPricePerNight ?? 0)}</td><td className="r">{formatVND(invoice.roomTotal)}</td></tr>
              {b?.services.map((s, i) => (
                <tr key={i}><td>{s.name}</td><td className="r">{s.qty}</td><td className="r">{formatVND(s.price)}</td><td className="r">{formatVND(s.price * s.qty)}</td></tr>
              ))}
            </tbody>
          </table>
          <table>
            <tbody>
              <tr><td>Tạm tính dịch vụ</td><td className="r">{formatVND(invoice.serviceTotal)}</td></tr>
              <tr><td>Giảm giá</td><td className="r">-{formatVND(invoice.discount)}</td></tr>
              <tr><td className="total">TỔNG CỘNG</td><td className="r total">{formatVND(invoice.total)}</td></tr>
              <tr><td>Đã thanh toán</td><td className="r">{formatVND(invoice.paid)}</td></tr>
              <tr><td>Còn lại</td><td className="r">{formatVND(invoice.total - invoice.paid)}</td></tr>
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 24, textAlign: "center" }}>Cảm ơn Quý khách! Hẹn gặp lại tại {HOTEL_FULL_NAME}.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          <Button onClick={print}><Printer className="size-4" /> In / Xuất PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
