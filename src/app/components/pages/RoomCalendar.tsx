import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { useStore } from "../../lib/store";
import { addDays, dateRangesOverlap, toISODate, nightsBetween } from "../../lib/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

export function RoomCalendar() {
  const { rooms, bookings, customer, roomType } = useStore();
  const [start, setStart] = useState(toISODate(new Date()));
  const [viewDays, setViewDays] = useState<7 | 14 | 30>(14);

  const dates = useMemo(() => Array.from({ length: viewDays }, (_, i) => addDays(start, i)), [start, viewDays]);
  const today = toISODate(new Date());

  // Nhóm phòng theo loại
  const groupedRooms = useMemo(() => {
    const groups = new Map<string, typeof rooms>();
    rooms.forEach(r => {
      if (!groups.has(r.typeId)) groups.set(r.typeId, []);
      groups.get(r.typeId)!.push(r);
    });
    return Array.from(groups.entries());
  }, [rooms]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "checked_in": return "bg-[#e6ebf5] text-[#1e3a8a] border-[#bfdbfe]"; // Đang ở
      case "reserved": return "bg-[#fbf4e3] text-[#7a5c1a] border-[#dfb76c]"; // Đã đặt
      case "checked_out": return "bg-[#f4f4f5] text-[#52525b] border-gray-300"; // Đã trả
      default: return "bg-white text-gray-500 border-gray-200";
    }
  };

  const getMaintenanceStyle = (status?: string) => {
    switch (status) {
      case "maintenance": 
        return { className: "bg-[#fce8e8] text-[#9f1239]" };
      case "cleaning": 
        return { 
          className: "text-[#92400e]",
          style: {
            backgroundColor: "#fef3c7",
            backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(146, 64, 14, 0.05) 10px, rgba(146, 64, 14, 0.05) 20px)"
          }
        };
      default: return {};
    }
  };

  // Tính toán vị trí cột bắt đầu và span của booking trên Grid
  const getBookingSpan = (checkIn: string, checkOut: string) => {
    const startOffset = nightsBetween(start, checkIn);
    let colStart = startOffset + 2; // +1 tên phòng, +1 index CSS grid 1-based
    let span = nightsBetween(checkIn, checkOut) || 1;

    // Cắt đầu nếu booking bắt đầu trước ngày hiện thị
    if (colStart < 2) {
      span -= (2 - colStart);
      colStart = 2;
    }
    
    // Cắt đuôi nếu booking kết thúc sau ngày hiển thị
    if (colStart + span > viewDays + 2) {
      span = viewDays + 2 - colStart;
    }

    return { colStart, span };
  };

  return (
    <div className="space-y-4">
      {/* 1. HEADER & CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setStart(addDays(start, -viewDays))}>
            <ChevronLeft className="size-4" /> Trước
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStart(today)}>
            Hôm nay
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStart(addDays(start, viewDays))}>
            Sau <ChevronRight className="size-4" />
          </Button>
          
          <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
          
          <select 
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none transition-colors focus:border-[#dfb76c] focus:ring-1 focus:ring-[#dfb76c]"
            value={viewDays}
            onChange={(e) => setViewDays(Number(e.target.value) as 7 | 14 | 30)}
          >
            <option value={7}>7 ngày</option>
            <option value={14}>14 ngày</option>
            <option value={30}>30 ngày</option>
          </select>
        </div>

        {/* Chú thích màu (Legend) - Gọn gàng bên phải */}
        <div className="flex flex-wrap items-center gap-4 text-[13px] font-medium bg-white px-4 py-2 rounded-lg border shadow-sm">
          <Legend cls="bg-[#fbf4e3] border-[#dfb76c] border text-[#7a5c1a]" label="Đã đặt" />
          <Legend cls="bg-[#e6ebf5] border-[#bfdbfe] border text-[#1e3a8a]" label="Đang ở" />
          <Legend cls="bg-[#f4f4f5] border-gray-300 border text-[#52525b]" label="Đã trả" />
          <Legend cls="bg-[#fce8e8] text-[#9f1239]" label="Bảo trì" />
          <Legend cls="bg-[#fef3c7] text-[#92400e]" label="Đang dọn" />
        </div>
      </div>

      {/* 2. CALENDAR GRID */}
      <Card className="border-[#e5dfd3] shadow-sm">
        <CardContent className="p-0 overflow-x-auto no-scrollbar relative">
          <div className="min-w-max pb-4">
            
            {/* Header: Các ngày (Dính trên cùng) */}
            <div 
              className="sticky top-0 z-20 grid border-b border-[#e5dfd3] bg-[#fdfbf7]"
              style={{ gridTemplateColumns: `140px repeat(${viewDays}, minmax(70px, 1fr))` }}
            >
              <div className="sticky left-0 z-30 bg-[#fdfbf7] border-r border-[#e5dfd3] px-4 py-3 text-sm font-semibold text-[#503d15] shadow-[1px_0_0_0_#e5dfd3]">
                Phòng
              </div>
              {dates.map((d) => {
                const dt = new Date(d);
                const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                const isToday = d === today;
                
                return (
                  <div 
                    key={d} 
                    className={`flex flex-col items-center justify-center border-r border-[#e5dfd3] py-2 
                      ${isWeekend ? "bg-[#f5efe4]/50" : ""} 
                      ${isToday ? "bg-[#fbf4e3] text-[#7a5c1a]" : "text-[#786f66]"}`}
                  >
                    <span className={`text-[11px] uppercase tracking-widest font-medium ${isToday ? "font-bold text-[#b8860b]" : ""}`}>
                      {["CN","T2","T3","T4","T5","T6","T7"][dt.getDay()]}
                    </span>
                    <span className={`text-sm mt-0.5 ${isToday ? "font-bold flex size-7 items-center justify-center rounded-full bg-[#dfb76c] text-white shadow-sm" : ""}`}>
                      {dt.getDate()}/{dt.getMonth() + 1}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Nội dung lưới phòng */}
            <div className="relative">
              
              {/* Lưới nền (kẻ sọc dọc) */}
              <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `140px repeat(${viewDays}, minmax(70px, 1fr))` }}>
                <div className="border-r border-[#e5dfd3]" />
                {dates.map((d) => {
                  const dt = new Date(d);
                  const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                  const isToday = d === today;
                  return (
                    <div 
                      key={`bg-${d}`} 
                      className={`border-r border-[#e5dfd3] ${isWeekend ? "bg-[#f5efe4]/20" : ""} ${isToday ? "bg-[#fbf4e3]/20" : ""}`} 
                    />
                  );
                })}
              </div>

              <TooltipProvider delayDuration={150}>
                {groupedRooms.map(([typeId, typeRooms]) => {
                  const t = roomType(typeId);
                  return (
                    <div key={typeId} className="relative z-10">
                      {/* Sub-header Nhóm Hạng Phòng */}
                      <div className="sticky left-0 z-10 w-[140px] bg-[#f5efe4] px-4 py-1.5 text-[10px] font-bold text-[#503d15] uppercase tracking-widest border-b border-r border-[#e5dfd3] shadow-[1px_0_0_0_#e5dfd3]">
                        {t?.name}
                      </div>
                      
                      {/* Từng phòng */}
                      {typeRooms.map((r) => {
                        // Lọc các booking chạm vào màn hình hiện tại
                        const roomBookings = bookings.filter(
                          (b) =>
                            b.roomId === r.id &&
                            b.status !== "cancelled" &&
                            dateRangesOverlap(b.checkIn, b.checkOut, start, addDays(start, viewDays))
                        );

                        const mainStyle = getMaintenanceStyle(r.status);

                        return (
                          <div 
                            key={r.id} 
                            className="group/row relative grid border-b border-[#e5dfd3] hover:bg-black/[0.02] transition-colors"
                            style={{ gridTemplateColumns: `140px repeat(${viewDays}, minmax(70px, 1fr))` }}
                          >
                            {/* Cột Tên Phòng Dính (Sticky) */}
                            <div className="sticky left-0 z-10 flex h-[52px] items-center bg-white px-4 border-r border-[#e5dfd3] shadow-[1px_0_0_0_#e5dfd3] group-hover/row:bg-[#faf9f7] transition-colors">
                              <span className="font-semibold text-[#1c1917]">P.{r.number}</span>
                            </div>

                            {/* Vẽ các ô ngày để bắt event hover/click (Empty Cells) */}
                            {dates.map((d, index) => {
                              const isPast = new Date(d) < new Date(today);
                              return (
                                <div 
                                  key={`cell-${d}`}
                                  className={`h-full border-r border-[#e5dfd3] flex items-center justify-center opacity-0 hover:opacity-100 
                                    ${r.status === 'available' && !isPast ? "cursor-pointer hover:bg-[#dfb76c]/10" : ""}
                                    ${r.status !== 'available' ? mainStyle.className : ''}`}
                                  style={{ gridColumn: index + 2, ...mainStyle.style }}
                                >
                                  {r.status === 'available' && !isPast && <Plus className="size-4 text-[#dfb76c]" />}
                                </div>
                              );
                            })}

                            {/* Render Booking vắt ngang (Continuous Blocks) */}
                            {roomBookings.map((b) => {
                              const c = customer(b.customerId);
                              const { colStart, span } = getBookingSpan(b.checkIn, b.checkOut);
                              if (span <= 0) return null;
                              
                              const nights = nightsBetween(b.checkIn, b.checkOut);
                              const isPaid = !!b.depositPaid;

                              return (
                                <Tooltip key={b.id}>
                                  <TooltipTrigger asChild>
                                    <div 
                                      className={`absolute top-1.5 bottom-1.5 mx-[3px] rounded border shadow-sm flex items-center px-2.5 cursor-pointer transition-all hover:scale-[1.02] hover:brightness-[1.03] hover:z-20 overflow-hidden ${getStatusColor(b.status)}`}
                                      style={{ gridColumn: `${colStart} / span ${span}` }}
                                    >
                                      {/* Dấu chấm cảnh báo chưa thanh toán */}
                                      {!isPaid && (
                                        <div className="absolute left-1 top-1 size-1.5 rounded-full bg-rose-500 animate-pulse" />
                                      )}
                                      <span className="truncate text-xs font-semibold tracking-tight whitespace-nowrap pl-1">
                                        {c?.name}
                                        {span > 1 && <span className="font-normal opacity-80"> · {nights} đêm</span>}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="p-0 border-[#dfb76c]/30 shadow-xl overflow-hidden" side="top" sideOffset={4}>
                                    <div className="bg-[#1a1714] text-[#fcfaf7] min-w-[220px]">
                                      <div className="bg-[#2a2520] px-3 py-2 border-b border-[#3a342d] flex justify-between items-center">
                                        <div className="font-bold text-[#dfb76c] truncate max-w-[150px]">{c?.name}</div>
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground">{b.code}</div>
                                      </div>
                                      <div className="p-3 text-[12px] space-y-1.5 text-[#c9bfb0]">
                                        <div className="flex justify-between">
                                          <span>SĐT:</span>
                                          <span className="text-white font-medium">{c?.phone}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Lưu trú:</span>
                                          <span className="text-white font-medium">{b.checkIn} ➔ {b.checkOut}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Số lượng:</span>
                                          <span className="text-white font-medium">{b.guests} khách</span>
                                        </div>
                                        
                                        <div className="pt-2 mt-2 border-t border-[#3a342d] flex items-center justify-between">
                                          <span className={`inline-flex px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider ${isPaid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                                            {isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </TooltipProvider>

            </div>
          </div>
        </CardContent>
      </Card>
      
      <p className="text-xs text-muted-foreground mt-2 px-1">
        Bảng lịch hỗ trợ kéo dài liền mạch. Cuộn ngang để xem thêm. Chấm đỏ là trạng thái chưa thanh toán.
      </p>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-3.5 rounded shadow-sm ${cls}`} />
      <span className="text-[#503d15]">{label}</span>
    </span>
  );
}
