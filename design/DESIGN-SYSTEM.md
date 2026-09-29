# Sao Mai — Maison Atelier (hạng sang)

Nguồn: skill `ui-ux-pro-max-skill-main` (`--design-system`, `--domain typography|ux|gsap|react`).

- Style chrome: Liquid Glass (chỉ header / bookbar)
- Type: **Luxury Minimalist** — Bodoni Moda + Jost (không dùng Inter)
- Accent: `#A16207` (Luxury/Premium Brand, AA)
- Density 3/10 spacious · Motion 5/10 · hover 150–200ms · reveal y=12px / 400ms
- React: không `setState` trên mọi frame scroll — ref + rAF / scroll-timeline

## Hướng thẩm mỹ

- **Tên:** Maison Atelier
- **DFII:** 13 — Impact 5, Fit 5, Feasibility 5, Performance 5, Consistency Risk 2
- **Neo nhận diện:** Didone mỏng (Bodoni) trên onyx, CTA kem chứ không nút vàng đặc, ảnh full-bleed.

## 6 nguyên tắc

1. **Ảnh kể chuyện, chữ nhường chỗ** — hero full-bleed, chữ ngắn, mosaic 4 khoảnh khắc.
2. **Đặt phòng luôn trong tầm tay** — thanh tìm phòng đè lên hero, dính khi cuộn; hiện số đêm ngay dưới ngày trả.
3. **Phòng là nhân vật chính** — suite đầu tiên dạng editorial 2 cột, các hạng còn lại lưới 3.
4. **Bảng màu trung tính ấm + ánh kim** — onyx / ivory / sand / champagne. Không navy SaaS, không teal.
5. **Khoảng trắng rộng, chiều sâu thật** — grain rất nhẹ, kính mờ, bóng nhiều lớp, khung ảnh lồng.
6. **Chuyển động chậm, có chủ đích** — 150–300ms cho UI, ~700ms cho ảnh; tôn trọng `prefers-reduced-motion`.

## Token

| Nhóm | Biến | Giá trị |
| --- | --- | --- |
| Nền tối | `--lux-onyx` | `#0F0D0B` |
| Chữ chính | `--lux-ink` | `#1C1917` |
| Chữ phụ | `--lux-stone` | `#6E675E` |
| Nền trang | `--lux-ivory` | `#FCFAF7` |
| Nhấn tối | `--lux-champagne` | `#C9AD78` |
| Nhấn sáng | `--lux-gold-deep` | `#8A6D33` |
| CTA chữ | `--lux-gold-ink` | `#A16207` |
| Tiêu đề | `--lux-font-display` | Bodoni Moda |
| Nội dung | `--lux-font-sans` | Jost |

## Cấu trúc trang chủ

Hero điện ảnh → Thanh đặt phòng → Phòng editorial → Mosaic khoảnh khắc → Ẩm thực + hồ bơi → Dải số liệu → Dịch vụ → Đánh giá → CTA cọc → Footer.

## Tránh

- Inter / Roboto / gradient loang tím
- Icon emoji, stepper < 44px, hover-only
- Palettes navy khách sạn generic từ catalog (không khớp thương hiệu Sao Mai)
