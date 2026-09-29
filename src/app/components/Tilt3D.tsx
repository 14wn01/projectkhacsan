import { useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";

/**
 * Tilt3D — hiệu ứng nghiêng 3D theo con trỏ chuột (thuần CSS transform,
 * không cần thư viện ngoài). Bọc quanh một card để tạo cảm giác chiều sâu
 * khi rê chuột. Tự bỏ qua trên thiết bị cảm ứng (không có hover).
 */
export function Tilt3D({
  children,
  className = "",
  max = 7,
  scale = 1.015,
  style,
}: {
  children: ReactNode;
  className?: string;
  /** Góc nghiêng tối đa (độ) */
  max?: number;
  /** Phóng to nhẹ khi hover */
  scale?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    // Thiết bị cảm ứng / không có con trỏ chính xác → bỏ hiệu ứng
    if (typeof window !== "undefined" && !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${((0.5 - py) * max).toFixed(2)}deg) rotateY(${((px - 0.5) * max).toFixed(2)}deg) scale(${scale})`;
  };

  const handleLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)";
  };

  return (
    <div ref={ref} onMouseMove={handleMove} onMouseLeave={handleLeave} className={`tilt3d ${className}`} style={style}>
      {children}
    </div>
  );
}
