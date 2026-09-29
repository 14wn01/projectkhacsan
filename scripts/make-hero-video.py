"""Ken Burns looping MP4 from hero stills (used when AI video gen is unavailable)."""
from __future__ import annotations

from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "media"
W, H = 1280, 720
FPS = 24
HALF_SECONDS = 6


def ease(t: float) -> float:
    return t * t * (3.0 - 2.0 * t)


def cover_crop(im: Image.Image, scale: float, pan_x: float, pan_y: float) -> Image.Image:
    src_w, src_h = im.size
    cover = max(W / src_w, H / src_h) * scale
    crop_w = W / cover
    crop_h = H / cover
    cx = src_w * (0.5 + pan_x)
    cy = src_h * (0.52 + pan_y)
    left = max(0.0, min(src_w - crop_w, cx - crop_w / 2))
    top = max(0.0, min(src_h - crop_h, cy - crop_h / 2))
    cropped = im.crop((int(left), int(top), int(left + crop_w), int(top + crop_h)))
    return cropped.resize((W, H), Image.Resampling.LANCZOS)


def shimmer(arr: np.ndarray, t: float) -> np.ndarray:
    """Very light pool-surface flicker so the still does not look frozen."""
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    xx = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    pool = ((yy > 0.40) & (yy < 0.92) & (xx > 0.10) & (xx < 0.90)).astype(np.float32)
    wave = np.sin(xx * 42 + t * 5.2) * np.sin(yy * 28 + t * 3.4)
    gain = 1.0 + pool * wave * 0.018
    out = arr.astype(np.float32) * gain[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


def encode(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGB")
    n = HALF_SECONDS * FPS
    writer = imageio.get_writer(
        dst.as_posix(),
        fps=FPS,
        codec="libx264",
        ffmpeg_params=["-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"],
        macro_block_size=None,
    )
    try:
        sequence = list(range(n)) + list(range(n - 1, -1, -1))
        for i in sequence:
            t = ease(i / max(n - 1, 1))
            frame = cover_crop(im, scale=1.0 + 0.09 * t, pan_x=0.012 * t, pan_y=-0.01 * t)
            arr = shimmer(np.asarray(frame), i / FPS)
            writer.append_data(arr)
    finally:
        writer.close()
    print(f"{dst.name}: {dst.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    encode(ROOT / "hero-sunset.webp", ROOT / "hero-sunset.mp4")
    encode(ROOT / "hero-night.webp", ROOT / "hero-night.mp4")
