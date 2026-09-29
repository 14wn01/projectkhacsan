import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { createRoomRenderer, roomStyle, type RoomRenderer } from "../../lib/room3d";
import type { RoomType } from "../../lib/types";
export default function RoomScene({ roomType, onFallback }: { roomType: RoomType; onFallback: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const engine = useRef<RoomRenderer | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let renderer: RoomRenderer;
    try { renderer = createRoomRenderer(canvas, roomStyle(roomType.name), () => setError(true)); }
    catch { setError(true); return; }
    engine.current = renderer;
    const observer = new ResizeObserver(() => renderer.resize()); observer.observe(canvas);
    const points = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const distance = () => { const p = [...points.values()]; return p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0; };
    const down = (e: PointerEvent) => { points.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId); pinch = distance(); };
    const move = (e: PointerEvent) => {
      const previous = points.get(e.pointerId); if (!previous) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) { const next = distance(); if (pinch > 0 && next > 0) renderer.zoom(Math.log(pinch / next)); pinch = next; }
      else renderer.orbit(-(e.clientX - previous.x) * .009, (e.clientY - previous.y) * .007);
    };
    const up = (e: PointerEvent) => { points.delete(e.pointerId); pinch = distance(); };
    // Wheel zoom only when focused: normal page scrolling never gets hijacked.
    const wheel = (e: WheelEvent) => { if (document.activeElement !== canvas) return; e.preventDefault(); renderer.zoom(Math.max(-.25, Math.min(.25, e.deltaY * .001))); };
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up); canvas.addEventListener("lostpointercapture", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      observer.disconnect(); points.clear();
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); canvas.removeEventListener("lostpointercapture", up); canvas.removeEventListener("wheel", wheel);
      renderer.dispose(); engine.current = null;
    };
  }, [roomType.name]);
  if (error) return <div className="room-preview__fallback" role="status"><p>Thiết bị không hỗ trợ 3D hoặc đã hết bộ nhớ đồ họa.</p><button type="button" onClick={onFallback}>Trở về ảnh phòng</button></div>;
  return <div className="room-scene">
    <canvas ref={ref} tabIndex={0} aria-label={`Mô phỏng ${roomType.name}. Kéo để xoay; hai ngón để thu phóng. Bàn phím: mũi tên, cộng trừ, Home để đặt lại.`}
      onKeyDown={(e) => {
        const r = engine.current; if (!r) return;
        const actions: Record<string, () => void> = { ArrowLeft: () => r.orbit(-.15, 0), ArrowRight: () => r.orbit(.15, 0), ArrowUp: () => r.orbit(0, .1), ArrowDown: () => r.orbit(0, -.1), "+": () => r.zoom(-.15), "=": () => r.zoom(-.15), "-": () => r.zoom(.15), Home: () => r.reset() };
        if (actions[e.key]) { e.preventDefault(); actions[e.key](); }
      }} />
    <div className="room-scene__controls" role="group" aria-label="Điều khiển mô phỏng">
      <button type="button" aria-label="Xoay trái" onClick={() => engine.current?.orbit(-.3, 0)}><ChevronLeft size={16} /></button>
      <button type="button" aria-label="Xoay phải" onClick={() => engine.current?.orbit(.3, 0)}><ChevronRight size={16} /></button>
      <button type="button" aria-label="Phóng to" onClick={() => engine.current?.zoom(-.15)}><Plus size={16} /></button>
      <button type="button" aria-label="Thu nhỏ" onClick={() => engine.current?.zoom(.15)}><Minus size={16} /></button>
      <button type="button" aria-label="Đặt lại góc nhìn" onClick={() => engine.current?.reset()}><RotateCcw size={15} /></button>
    </div>
  </div>;
}
