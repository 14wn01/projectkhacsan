import { BadgeCheck, BedDouble, CalendarDays, Star, Wifi } from "lucide-react";
import { HOTEL_NAME } from "../lib/store";

/**
 * HeroScene3D — cảnh 3D thuần CSS cho khối hero trang khách (không cần three.js).
 * Gồm thẻ đặt phòng nổi với các lớp translateZ tạo chiều sâu, tự động xoay đung
 * đưa nhẹ; xung quanh là các chip lơ lửng. Chỉ hiển thị trên màn hình lớn.
 */
export function HeroScene3D() {
  return (
    <div className="hero3d-scene select-none" aria-hidden>
      <div className="hero3d-stage mx-auto w-full max-w-sm">
        {/* Thẻ đặt phòng chính — nhiều lớp translateZ tạo chiều sâu */}
        <div className="hero3d-card rounded-2xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
          <div className="hero3d-layer flex items-center gap-3" style={{ transform: "translateZ(50px)" }}>
            <div className="grid size-11 place-items-center rounded-xl bg-white text-sidebar shadow-lg">
              <BedDouble className="size-6" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{HOTEL_NAME}</div>
              <div className="text-[11px] text-white/60">Ocean Suite</div>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white/80">
              Check-in riêng
            </span>
          </div>

          <div className="hero3d-layer mt-4 grid grid-cols-2 gap-2 text-[11px]" style={{ transform: "translateZ(36px)" }}>
            <div className="rounded-lg bg-white/10 p-2.5">
              <div className="flex items-center gap-1 text-white/50"><CalendarDays className="size-3" /> Nhận phòng</div>
              <div className="mt-0.5 font-medium text-white">T6, 28/08</div>
            </div>
            <div className="rounded-lg bg-white/10 p-2.5">
              <div className="flex items-center gap-1 text-white/50"><CalendarDays className="size-3" /> Trả phòng</div>
              <div className="mt-0.5 font-medium text-white">CN, 30/08</div>
            </div>
          </div>

          <div
            className="hero3d-layer mt-3 flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-300/20 to-transparent p-3"
            style={{ transform: "translateZ(28px)" }}
          >
            <div>
              <div className="text-[11px] text-white/60">Chỉ từ</div>
              <div className="text-lg font-semibold text-amber-300">
                850.000₫<span className="text-[11px] font-normal text-white/50"> /đêm</span>
              </div>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-sidebar shadow-lg">Đặt ngay</div>
          </div>
        </div>

        {/* Các chip lơ lửng quanh thẻ */}
        <div className="hero3d-chip absolute -right-6 -top-7 flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-xl">
          <Star className="size-3.5 fill-amber-300 text-amber-300" /> 4.8/5 · 320 đánh giá
        </div>

        <div className="hero3d-chip hero3d-chip-slow absolute -left-8 bottom-6 flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-xl">
          <span className="grid size-6 place-items-center rounded-full bg-emerald-400/25">
            <BadgeCheck className="size-3.5 text-emerald-300" />
          </span>
          Xác nhận trong 5 phút
        </div>

        <div
          className="hero3d-chip absolute -bottom-6 right-10 flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-xl"
          style={{ animationDelay: "-3s" }}
        >
          <Wifi className="size-3.5 text-sky-300" /> Wifi miễn phí
        </div>
      </div>
    </div>
  );
}
