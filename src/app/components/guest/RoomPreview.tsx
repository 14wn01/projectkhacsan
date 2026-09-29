import { lazy, Suspense, useId, useState } from "react";
import { Box, Image, RotateCcw } from "lucide-react";
import type { RoomType } from "../../lib/types";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { ErrorBoundary } from "../ErrorBoundary";

// No engine or geometry in the initial guest bundle. Existing images stay default.
const RoomScene = lazy(() => import("./RoomScene"));
const enabled = import.meta.env.VITE_ROOM_3D !== "false";

export function RoomPreview({ type, image, photoOnly = false }: { type: RoomType; image: string; photoOnly?: boolean }) {
  const [mode, setMode] = useState<"photo" | "3d">("photo");
  const [version, setVersion] = useState(0);
  const id = useId();
  return (
    <div className="room-preview">
      {mode === "photo" ? (
        <ImageWithFallback src={image} alt={`Phòng ${type.name}`} loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <ErrorBoundary key={version} scope="room-preview" fallback={
          <div className="room-preview__fallback" role="status">
            <p>Không thể mở mô phỏng 3D trên thiết bị này.</p>
            <button type="button" onClick={() => setMode("photo")}>Trở về ảnh phòng</button>
          </div>
        }>
          <Suspense fallback={<div className="room-preview__fallback" role="status">Đang chuẩn bị không gian 3D…</div>}>
            <RoomScene roomType={type} onFallback={() => setMode("photo")} />
          </Suspense>
        </ErrorBoundary>
      )}
      {enabled && !photoOnly && (
        <div className="room-preview__switch" role="group" aria-label={`Cách xem phòng ${type.name}`}>
          <button type="button" aria-pressed={mode === "photo"} onClick={() => setMode("photo")}><Image size={14} aria-hidden="true" />Ảnh</button>
          <button type="button" aria-pressed={mode === "3d"} aria-describedby={mode === "3d" ? id : undefined} onClick={() => { setVersion(v => v + 1); setMode("3d"); }}><Box size={14} aria-hidden="true" />Khám phá 3D</button>
        </div>
      )}
      {mode === "3d" && <span id={id} className="room-preview__caption"><RotateCcw size={12} aria-hidden="true" />Mô phỏng minh họa · không phải phòng thực tế</span>}
    </div>
  );
}
