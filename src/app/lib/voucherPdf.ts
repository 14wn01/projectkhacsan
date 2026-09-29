import { Booking } from "./types";
import { formatDate, formatVND, nightsBetween } from "./format";
import { HOTEL_EMAIL, HOTEL_FULL_NAME, HOTEL_HOTLINE } from "./store";

export type VoucherInput = {
  booking: Booking;
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  roomLabel: string;
  typeName: string;
};

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= max) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawVoucher(input: VoucherInput): HTMLCanvasElement {
  const w = 1191;
  const h = 1684;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không vẽ được phiếu.");

  const ivory = "#fcfaf7";
  const ink = "#1c1917";
  const gold = "#8a6d33";
  const stone = "#6e675e";
  const line = "#e3ddd2";
  const { booking: b, guestName, guestPhone, guestEmail, roomLabel, typeName } = input;
  const nights = Math.max(nightsBetween(b.checkIn, b.checkOut), 1);
  const roomTotal = b.nightlyRates?.length
    ? b.nightlyRates.reduce((s, n) => s + n.price, 0)
    : b.roomPricePerNight * nights;
  const serviceTotal = b.services.reduce((s, x) => s + x.price * x.qty, 0);
  const total = roomTotal + serviceTotal;
  const deposit = b.depositAmount ?? Math.round(total * (b.depositPercent ?? 0.25));
  const remaining = Math.max(0, total - (b.depositPaid ? deposit : 0));

  ctx.fillStyle = ivory;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, w, 18);
  ctx.fillRect(0, h - 18, w, 18);

  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(48, 48, w - 96, h - 96);

  ctx.fillStyle = gold;
  ctx.font = "500 22px 'Jost', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SAO MAI HOTEL & RESIDENCES", w / 2, 120);

  ctx.fillStyle = ink;
  ctx.font = "300 italic 54px 'Bodoni Moda', Georgia, serif";
  ctx.fillText("Phiếu xác nhận", w / 2, 190);

  ctx.fillStyle = stone;
  ctx.font = "400 16px 'Jost', 'Segoe UI', sans-serif";
  ctx.fillText("Confirmation of stay", w / 2, 222);

  ctx.fillStyle = gold;
  ctx.fillRect(w / 2 - 40, 244, 80, 1);

  ctx.fillStyle = ink;
  ctx.font = "600 28px 'Jost', 'Segoe UI', sans-serif";
  ctx.fillText(b.code, w / 2, 300);

  ctx.fillStyle = stone;
  ctx.font = "400 15px 'Jost', 'Segoe UI', sans-serif";
  const status =
    b.status === "reserved" ? "Đã giữ chỗ" :
    b.status === "checked_in" ? "Đang lưu trú" :
    b.status === "pending" ? "Chờ duyệt" :
    b.status === "checked_out" ? "Đã trả phòng" : "Đã hủy";
  ctx.fillText(status, w / 2, 328);

  const left = 110;
  const col2 = 620;
  let y = 390;
  const row = (label: string, value: string, x = left) => {
    ctx.textAlign = "left";
    ctx.fillStyle = stone;
    ctx.font = "500 12px 'Jost', 'Segoe UI', sans-serif";
    ctx.fillText(label.toUpperCase(), x, y);
    ctx.fillStyle = ink;
    ctx.font = "400 20px 'Jost', 'Segoe UI', sans-serif";
    wrap(ctx, value, 420).forEach((ln, i) => ctx.fillText(ln, x, y + 26 + i * 24));
  };

  row("Khách", guestName);
  row("Hạng / căn", `${typeName} · ${roomLabel}`, col2);
  y += 78;
  row("Điện thoại", guestPhone || "—");
  row("Email", guestEmail || "—", col2);
  y += 78;
  row("Nhận phòng", `${formatDate(b.checkIn)} · từ 14:00`);
  row("Trả phòng", `${formatDate(b.checkOut)} · trước 12:00`, col2);
  y += 78;
  row("Số đêm", `${nights} đêm`);
  row("Số khách", `${b.guests} khách`, col2);

  y += 90;
  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(w - left, y);
  ctx.stroke();
  y += 40;

  const money = (label: string, value: string, bold = false) => {
    ctx.textAlign = "left";
    ctx.fillStyle = stone;
    ctx.font = "400 16px 'Jost', 'Segoe UI', sans-serif";
    ctx.fillText(label, left, y);
    ctx.textAlign = "right";
    ctx.fillStyle = ink;
    ctx.font = `${bold ? 600 : 400} 18px 'Jost', 'Segoe UI', sans-serif`;
    ctx.fillText(value, w - left, y);
    y += 36;
  };
  money("Tiền phòng", formatVND(roomTotal));
  if (serviceTotal > 0) money("Dịch vụ", formatVND(serviceTotal));
  money("Tổng", formatVND(total), true);
  money(b.depositPaid ? "Đã cọc" : "Cọc giữ chỗ (25%)", formatVND(deposit));
  money("Còn lại khi nhận phòng", formatVND(remaining), true);

  y += 24;
  ctx.strokeStyle = gold;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(w - left, y);
  ctx.stroke();
  y += 48;

  ctx.textAlign = "left";
  ctx.fillStyle = gold;
  ctx.font = "500 13px 'Jost', 'Segoe UI', sans-serif";
  ctx.fillText("CHÍNH SÁCH HỦY", left, y);
  y += 28;
  ctx.fillStyle = ink;
  ctx.font = "400 16px 'Jost', 'Segoe UI', sans-serif";
  const policy = [
    "Huỷ trước 7 ngày nhận phòng: hoàn 100% tiền cọc.",
    "Huỷ trước 3–6 ngày: hoàn 50% tiền cọc.",
    "Huỷ dưới 3 ngày: không hoàn cọc.",
    "Nhận từ 14:00 · Trả trước 12:00.",
  ];
  policy.forEach((p) => {
    ctx.fillText(p, left, y);
    y += 26;
  });

  if (b.roomMoves?.length) {
    y += 16;
    ctx.fillStyle = gold;
    ctx.font = "500 13px 'Jost', 'Segoe UI', sans-serif";
    ctx.fillText("ĐÃ ĐỔI PHÒNG", left, y);
    y += 26;
    ctx.fillStyle = stone;
    ctx.font = "400 15px 'Jost', 'Segoe UI', sans-serif";
    ctx.fillText(`${b.roomMoves.length} lần · căn hiện tại: ${roomLabel}`, left, y);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = stone;
  ctx.font = "400 14px 'Jost', 'Segoe UI', sans-serif";
  ctx.fillText(`${HOTEL_FULL_NAME}  ·  ${HOTEL_HOTLINE}  ·  ${HOTEL_EMAIL}`, w / 2, h - 80);
  ctx.fillText("Phiếu này xác nhận yêu cầu đặt residences. Không phải hóa đơn GTGT.", w / 2, h - 56);

  return canvas;
}

function jpegToPdf(jpeg: Uint8Array, imgW: number, imgH: number): Uint8Array {
  const pageW = 595.28;
  const pageH = 841.89;
  const objects: string[] = [];
  const add = (s: string) => objects.push(s);

  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);

  const imgHeader = `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`;
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  add(imgHeader); // 4 — image dict, stream attached below
  add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const ascii = (s: string) => encoder.encode(s);
  chunks.push(ascii("%PDF-1.4\n"));
  const offsets: number[] = [0];
  let pos = chunks[0].length;

  const pushObj = (i: number, body: Uint8Array) => {
    const head = ascii(`${i} 0 obj\n`);
    const tail = ascii("\nendobj\n");
    offsets[i] = pos;
    chunks.push(head); pos += head.length;
    chunks.push(body); pos += body.length;
    chunks.push(tail); pos += tail.length;
  };

  pushObj(1, ascii(objects[0]));
  pushObj(2, ascii(objects[1]));
  pushObj(3, ascii(objects[2]));

  const imgHead = ascii(`${objects[3]}\nstream\n`);
  const imgTail = ascii("\nendstream");
  offsets[4] = pos;
  const obj4head = ascii("4 0 obj\n");
  chunks.push(obj4head); pos += obj4head.length;
  chunks.push(imgHead); pos += imgHead.length;
  chunks.push(jpeg); pos += jpeg.length;
  chunks.push(imgTail); pos += imgTail.length;
  const obj4end = ascii("\nendobj\n");
  chunks.push(obj4end); pos += obj4end.length;

  pushObj(5, ascii(objects[4]));

  const xrefPos = pos;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  chunks.push(ascii(xref));
  chunks.push(ascii(trailer));

  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function canvasJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Không tạo được ảnh phiếu."));
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(reject);
      },
      "image/jpeg",
      0.92,
    );
  });
}

export async function downloadVoucherPdf(input: VoucherInput) {
  const canvas = drawVoucher(input);
  const jpeg = await canvasJpeg(canvas);
  const pdf = jpegToPdf(jpeg, canvas.width, canvas.height);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `SaoMai-${input.booking.code}.pdf`;
  a.click();
  URL.revokeObjectURL(a.href);
}
