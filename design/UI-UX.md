# Sao Mai Hotel — Đặc tả UI & UX (trang khách)

Tài liệu mô tả **đúng những gì đang chạy** trên giao diện công khai (`PublicSite`), không phải bản mock.  
Phiên bản thị giác hiện tại: **Maison Atelier**.

Đối tượng đọc: thiết kế, frontend, QA, chủ khách sạn.  
Mã nguồn chính: `main/src/app/components/guest/`, `main/src/styles/luxury.css`, `main/src/styles/atelier.css`, `main/src/styles/cinematic-hero.css`.

---

## 1. Sản phẩm và người dùng

Sao Mai là website **đặt phòng trực tiếp** của khách sạn/resort biển. Khách xem phòng, chọn ngày, gửi yêu cầu, đặt cọc giữ phòng. Nhân viên vào khu quản trị qua “Đăng nhập nội bộ”.

### 1.1 Ba vai trên cùng một app

| Vai | Vào từ đâu | Được làm gì |
| --- | --- | --- |
| Khách vãng lai (chưa tài khoản) | Trang chủ công khai | Xem hết nội dung, đổi ngày, xem ảnh/3D. Chỉ khi bấm **Đặt phòng** mới bị hỏi đăng nhập/đăng ký. |
| Khách đã đăng nhập (`role: guest`) | Cùng trang chủ | Thêm mục **Đặt phòng của tôi**, đặt cọc, đăng xuất. |
| Nhân viên | Nút **Đăng nhập nội bộ** trong hộp đăng nhập khách | Rời trang khách, vào dashboard vận hành. |

### 1.2 Việc khách cần hoàn thành (mục tiêu UX)

1. Hiểu đây là khách sạn 5 sao bên vịnh trong **3 giây** (hero).
2. Biết còn phòng cho **ngày + số khách** đang chọn.
3. Chọn một hạng, xác nhận, giữ phòng bằng cọc nhỏ.
4. Tìm lại đặt phòng sau đó, không phải gọi lễ tân.

Nguyên tắc sản phẩm: **không bắt đăng nhập để xem**. Đặt phòng mới cần tài khoản. Giá trên trang là giá đặt trực tiếp.

---

## 2. Hướng thẩm mỹ đang dùng — Maison Atelier

Tên nội bộ. Tham chiếu tinh thần Aman / Rosewood / Six Senses: ảnh lớn, chữ mỏng, khoảng trắng, chuyển động chậm — **không** dùng navy SaaS hay Inter.

| Hạng mục | Quyết định |
| --- | --- |
| Cảm xúc 3 giây đầu | Im, ấm, hơi điện ảnh. Hoàng hôn trên hồ, chữ Didone mỏng. |
| Neo nhận diện (bỏ logo vẫn nhận ra) | Bodoni nghiêng màu kem trên ảnh đêm; CTA **kem/mực**, không nút vàng đặc. |
| Chrome | Kính mờ **chỉ** ở header khi cuộn và thanh đặt phòng. Không kính trên mọi thẻ. |
| Góc | Gần vuông (`0–2px`). |
| Mật độ | Rộng (section 64–120px). |
| Chuyển động | UI 150–200ms; ảnh ~400–700ms; parallax nhẹ, tắt khi `prefers-reduced-motion`. |

**Cố ý không làm:** Inter/Roboto, gradient tím, viên thuốc ngôn ngữ, Ken Burns mạnh, stepper < 44px, ba thẻ phòng hoàn toàn giống nhau (hạng đầu là editorial 2 cột).

---

## 3. Hệ thống thiết kế (token)

Toàn bộ lớp khách dùng class `lux-*` trong CSS thuần, không phụ thuộc utility Tailwind cho layout chính. Admin dùng theme shadcn riêng.

### 3.1 Màu

| Vai trò | Token | Hex | Dùng khi |
| --- | --- | --- | --- |
| Nền tối, footer, dải số | `--lux-onyx` | `#0F0D0B` | Hero scrim, footer |
| Chữ chính trên giấy | `--lux-ink` | `#1C1917` | Body, tiêu đề sáng |
| Chữ phụ | `--lux-stone` | `#6E675E` | Lede, caption; ≥ 4.5:1 trên ivory |
| Nền trang | `--lux-ivory` | `#FCFAF7` | Mặc định |
| Nền khối | `--lux-sand` | `#F4EFE7` | Section mosaic, dịch vụ |
| Bề mặt thẻ | `--lux-white` | `#FFFFFF` | Card phòng, quote |
| Nhấn trên nền tối | `--lux-champagne` | `#C4A574` | Eyebrow hero, số liệu |
| Nhấn trên nền sáng (AA) | `--lux-gold-deep` | `#8A6D33` | Eyebrow, icon |
| CTA chữ / accent skill | `--lux-gold-ink` | `#A16207` | Không dùng làm nền nút đặc |
| Còn phòng | `--lux-success` | `#4B7A5A` | Chấm trên flag |
| Hết phòng | `--lux-danger` | `#A2453C` | Flag đỏ |

Selection: nền champagne, chữ onyx.  
Focus bàn phím: `outline 2px gold-deep`, offset 3px.

### 3.2 Chữ

| Vai trò | Font | Cân | Ghi chú |
| --- | --- | --- | --- |
| Tiêu đề | **Bodoni Moda** (dự phòng Cormorant Garamond, Georgia) | 300–500, italic cho nhấn | Didone cao tương phản |
| Nội dung, nút, nav | **Jost** | 300–600 | Grotesque nhẹ, không Inter |
| Eyebrow | Jost | 500, 11px, tracking 0.28em, uppercase | Có gạch ngang 28×1px phía trước |

Thang:

| Class | Cỡ | Line-height |
| --- | --- | --- |
| `.lux-display` / hero `h1` | `clamp(2.6rem … 4.9rem)` / hero ~64–104px | ~1.02–1.06 |
| `.lux-title` | `clamp(2rem … 3rem)` | 1.14 |
| `.lux-subtitle` | `clamp(1.35rem … 1.75rem)` | 1.25 |
| `.lux-lede` | 17px | 1.75, tối đa ~62ch |
| Body | 16px | 1.65 |
| Label field | 10px uppercase tracking | — |
| Ngày trên bookbar | serif ~20px | — |

Tải font: `<link>` Google Fonts trong `index.html`, `font-display: swap` qua URL. `theme-color` = `#0F0D0B`.

### 3.3 Nhịp không gian

| Token | Giá trị |
| --- | --- |
| `--lux-max` | 1200px (shell thường) |
| `.lux-shell--wide` | 1360px (header, home) |
| `.lux-shell--narrow` | 760px (trang pháp lý) |
| `--lux-gutter` | 24px; 18px dưới 640px |
| Section | `clamp(64px, 8vw, 120px)` |
| Section chặt | `clamp(48px, 6vw, 84px)` |
| Header | 84px; 68px khi solid / mobile |
| Bán kính | 0px; 2px cho bookbar |
| Easing | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Duration UI | 180ms |

Bóng: rất nhẹ, ưu tiên viền. Không bóng nặng kiểu card SaaS.

### 3.4 Lớp file CSS (thứ tự nạp)

1. `fonts.css` — stack dự phòng  
2. `tailwind.css` + `theme.css` — shadcn/admin  
3. `luxury.css` — hệ `lux-*`  
4. `admin.css`  
5. `enhancements.css` — 3D phòng, dialog booking  
6. `cinematic-hero.css` — hero v2  
7. `atelier.css` — lớp Maison (grain, kính, mosaic, featured room)

---

## 4. Cấu trúc thông tin và điều hướng

### 4.1 Sơ đồ màn hình khách

```
PublicSite (.lux)
├── skip link → #main
├── Header cố định
├── main
│   ├── home        Trang chủ (một trang dài)
│   ├── my-bookings Chỉ khi đã login guest
│   └── legal       Điều khoản / bảo mật / quyền
├── Footer (#contact)
├── Chat nổi (góc phải dưới)
└── Dialog đăng nhập khách
```

Không dùng React Router cho khách: `view` là state `"home" | "my-bookings" | "legal"`. Cuộn mượt tới `id` section.

### 4.2 Header

- `position: fixed`, z-index 60.  
- **Trên hero:** chữ sáng, nền trong suốt + gradient tối rất nhẹ phía trên.  
- **Khi `scrollY > 48`:** nền ivory kính mờ, cao 68px, viền tóc vàng.  
- Trái: dấu `SM` trong ô tròn + tên + tagline `Hotel & Residences` (ẩn tag trên mobile). Bấm về đầu trang.  
- Giữa (desktop ≥901px): nav chữ hoa tracking rộng.

| Mục | Hành vi |
| --- | --- |
| Phòng & Suite | Cuộn `#rooms` |
| Trải nghiệm | `#experiences` |
| Dịch vụ | `#services` |
| Ưu đãi | `#offers` |
| Liên hệ | `#contact` (footer) |
| Đặt phòng của tôi | Chỉ hiện khi `role === guest` |

Mục đang xem: `aria-current="page"` + gạch champagne dưới chữ (IntersectionObserver, rootMargin `-80px 0  -40%`).

Phải:

- Đăng nhập (outline, ẩn dưới 900px — nằm trong menu) hoặc tên + Đăng xuất.  
- **Đặt phòng** (nút kem trên hero tối; trên nền sáng: viền `gold-deep`, hover đổ mực).  
- Hamburger chỉ `<900px` (atelier ẩn burger ≥901px).

Menu mobile: overlay full màn onyx, chữ serif lớn, Esc đóng, khóa cuộn body.

**Không có** chuyển VI/EN trên trang khách.

### 4.3 Footer (`#contact`)

Lưới 4 cột (2 cột ≤1080px, 1 cột ≤640px), nền onyx, chữ kem mờ.

1. Thương hiệu + đoạn 2 câu + form email ưu đãi (chưa nối server: báo rõ nếu gửi).  
2. Khám phá: trùng nav.  
3. Hỗ trợ: đặt phòng của tôi / điều khoản / bảo mật / đăng nhập nội bộ.  
4. Liên hệ: hotline 24/7, địa chỉ, giờ nhận-trả phòng.

Đáy: © năm + 3 link pháp lý dạng gạch chân chạy.

---

## 5. Trang chủ — từng khối, trên xuống dưới

Thứ tự bắt buộc (đừng đảo khi làm lại):

**Hero → Bookbar → Phòng → Mosaic 4 khoảnh khắc → Ẩm thực → Hồ bơi → Dải số → Dịch vụ → Đánh giá → CTA cọc → Footer.**

Mỗi section tiêu đề: eyebrow in hoa + số La Mã nghiêng champagne + `h2` Bodoni.

### 5.1 Hero điện ảnh (`.cinema-hero`)

- Cao gần `100svh` (tối đa ~1000px).  
- Ảnh hoàng hôn mặc định; **Về đêm** crossfade opacity ~1s, không tháo/gắn lại ảnh.  
- Lớp tối (scrim) trái đậm, phải thoáng, thêm vignette trên để chữ header đọc được.  
- Parallax nền: Chrome dùng `animation-timeline: scroll()`; không thì `transform` trên **ref + rAF**, hệ số 0.18, **không** `setState` mỗi frame. Tắt khi reduced-motion.  
- Atmosphere 3D (nước/ánh sáng) chỉ desktop pointer mịn, không save-data, không reduced-motion; lỗi thì im lặng về ảnh.

**Copy hiện tại**

- Chapter: `THE SAO MAI EXPERIENCE / 01`  
- Eyebrow: “Một kỳ nghỉ. Chỉ dành cho bạn.”  
- H1: “Một khoảng *trời riêng.*”  
- Lede: biển, ánh sáng, tĩnh tại.  
- CTA chính: **Đặt kỳ nghỉ** → cuộn bookbar.  
- CTA phụ: **Khám phá không gian** → dialog hạng phòng.  
- Meta: số phòng & “Đặt trực tiếp tại Sao Mai”.

Phải: hotspot + thẻ teaser suite (ảnh nhỏ, tên, “Ảnh phòng & mô phỏng 3D”).  
Đáy: “Tiếp nối hành trình” · nhãn cảnh “Hoàng hôn / Dưới ánh sao” · bật/tắt chuyển động.

**Toggle Hoàng hôn / Về đêm:** hai tab chữ nhật (không pill vàng), vùng chạm ≥44px.

Dialog khám phá: chọn hạng, ảnh/3D, mô tả, giá cơ sở, nút “Chọn ngày & đặt phòng”.

### 5.2 Thanh đặt phòng (`.lux-bookbar`)

Đè mép dưới hero (`margin-top: -56px`). Desktop ≥901px: khi mép trên chạm 68px thì **dính dưới header**, animation vào 8px + fade (không trượt cả thanh từ trên). Mobile: luôn trong luồng, không sticky.

Bốn ô:

| Ô | UI | Ghi chú |
| --- | --- | --- |
| Nhận phòng | Label + ngày serif + lịch popover | Không được sau trả phòng |
| Trả phòng | Như trên | Dưới ngày: “N đêm” |
| Số khách | Stepper − / số / + | 1–10, nút 44×44 |
| CTA | **Tìm phòng** mực đặc | Cuộn `#rooms` |

Ngày: `Popover` + `Calendar`. `min` = hôm nay; trả ≥ nhận + 1. Đổi nhận mà ≥ trả thì tự +1 ngày.

Mục tiêu: khách **luôn thấy ngày đang tìm** khi lướt phòng trên desktop.

### 5.3 Phòng & Suite (`#rooms`)

Lede động: `ngày → ngày · N đêm · còn X phòng cho Y khách`. Link “Xem dịch vụ đi kèm”.

- Hạng **đầu tiên**: `.lux-room--featured` — lưới 2 cột, ảnh cao ≥540px, tên lớn, mô tả tối đa 6 dòng. Desktop only; mobile xếp dọc như thẻ thường.  
- Các hạng sau: lưới 3 / 2 / 1 theo breakpoint.

Mỗi thẻ:

- Ảnh 4:3 + `RoomPreview` (Ảnh | Khám phá 3D).  
- Cờ: “Còn n phòng” (chấm xanh) hoặc “Hết phòng” (nền đỏ).  
- Tên, sức chứa, giá/đêm theo kỳ (quote), mô tả 2 dòng, 3 tiện nghi + “+n”.  
- Chân: tổng N đêm + nút Đặt phòng / Hết phòng disabled.

Giá: `quoteFor(typeId, checkIn, checkOut)` — giá theo đêm trung bình và tổng; nếu không quote thì `basePrice × nights`.

Hết phòng: nút outline disabled, không mở flow.

Hover thẻ: dịch lên 2px, 250ms, **không** phóng layout. Ảnh zoom 1.06 trong 1.2s (luxury.css). Mosaic zoom 1.1 chậm hơn.

### 5.4 Bốn khoảnh khắc

Nền sand. Lưới lệch: ô 1 cao 2 hàng; 3 ô còn lại. Ảnh + veil + kicker `01 — …` + tiêu đề + 1 câu.

Nội dung: hồ vô cực, ẩm thực ánh nến, quản gia, spa.

### 5.5 Trải nghiệm (`#experiences`)

Hai khối split:

1. Ảnh nhà hàng cao (4:5) + caption kính “Nhà hàng 12 bàn · Hoàng hôn” + copy bàn tối, 3 gạch đầu dòng, nút outline dịch vụ.  
2. Đảo cột: hồ + “Infinity · Tầng thượng”.

Khung 1px kem inset trên ảnh (atelier). Mobile: một cột, ảnh trên chữ.

### 5.6 Dải số (nền onyx)

Bốn cột: 4.9 · 96% · 5′ · 0₫ — `CountUp` khi vào viewport một lần. Label uppercase. Kẻ dọc champagne giữa cột (gỡ dưới 1080px).

### 5.7 Dịch vụ (`#services`)

Nhóm theo giặt là / ẩm thực / đưa đón / khác. Icon trong vòng tròn viền tóc. Tối đa 4 dòng tên + giá/đơn vị. Chi phí gộp hóa đơn lúc trả phòng.

### 5.8 Đánh giá

Căn giữa. 3 quote. Sao champagne, chữ serif, avatar 2 chữ cái. Không carousel (không prev/next). Hover 1px.

### 5.9 Ưu đãi (`#offers`)

Ảnh hồ full, scrim, kính chữ giữa, CTA **Chọn phòng ngay** → `#rooms`. Copy: cọc nhỏ, trả nốt lúc nhận, hủy miễn phí 48 giờ, xác nhận ~5 phút.

---

## 6. Luồng đặt phòng (UX then chốt)

```
Chọn ngày trên bookbar
    → Tìm phòng / Đặt phòng trên thẻ
        → BookingFlow (dialog)
            → [nếu chưa login] Auth
            → Hold phòng 15 phút
            → Xác nhận (tên, SĐT, email, ghi chú)
            → Cọc
            → Thành công → “Đặt phòng của tôi”
```

### 6.1 Hold

Khi vào bước confirm: `holdRoom`. Hai khách không giữ cùng phòng-ngày. Hết 15 phút: báo, không submit. Đóng dialog: `dropHold` nếu chưa tạo booking.

### 6.2 Auth trong flow

Tab Đăng nhập / Đăng ký. Login = SĐT 10 số + mật khẩu. Đăng ký: tên, SĐT, email, mật khẩu. Toast lỗi cạnh hành động. Sau auth: điền sẵn form confirm.

Hộp auth từ header: thêm **Đăng nhập nội bộ** cho staff.

### 6.3 Cọc

`DEPOSIT_PERCENT` (thường 30%). Phần còn lại tại quầy. `DepositPanel` / `DepositDialog`. Cờ demo thanh toán: không thu tiền thật trừ khi `VITE_DEMO_PAYMENTS=true`.

### 6.4 Đặt phòng của tôi

Danh sách mới → cũ. Badge trạng thái, đêm, tổng, cọc. Nút cọc nếu `pending|reserved` và chưa `depositPaid`. Empty: icon giường + “Khám phá phòng”.

**Lệch visual:** trang này và form auth vẫn dùng **Card/Button shadcn**, chưa `lux-*`. Khi làm lại visual, đồng bộ với Maison.

---

## 7. Chat nổi

Góc phải dưới, z trên grain. Nút 56px kem, viền champagne, chấm xanh online.

Gợi ý: đặt cuối tuần, báo giá, lịch 3N2Đ, ăn uống, thơ.  
Bot: Gemini nếu có; không thì rule. Chỉ gắn **thẻ phòng** khi câu hỏi thật sự về đặt/giá/trống (`isRoomIntent`). Thẻ mở `BookingFlow` cùng ngày trên bar.

Đóng/mở không chặn cuộn trang trừ khi panel focus.

---

## 8. Xem phòng 3D

`RoomPreview`: Ảnh mặc định. “Khám phá 3D” = WebGL minh họa, **không** GLB photoreal. Caption: “Mô phỏng minh họa · không phải phòng thực tế”. Lỗi: về ảnh + nút. Tắt bằng `VITE_ROOM_3D=false`. Hero 3D tắt: `VITE_CINEMATIC_HERO=false` (hero v1 Ken Burns).

---

## 9. Tương tác và chuyển động

| Sự kiện | Hành vi | Thời gian |
| --- | --- | --- |
| Hover nút | Đổi màu/opacity, không nhảy layout | 180ms |
| Hover thẻ phòng | `translateY(-2px)` | 250ms |
| Ảnh trong thẻ | scale 1.06 | 1.2s |
| Mosaic | scale 1.1 | 400ms |
| Reveal | opacity + 12px | 400ms, delay 50/100/150ms |
| Dock bookbar | 8px + fade | ~400ms |
| Đêm/hoàng hôn | opacity | ~1.05s |
| Vào hero copy | 12px + fade | 700ms desktop |
| Dialog | overlay ~58% onyx + blur; content 280ms | — |

Chỉ animate `transform` / `opacity`.  
`touch-action: manipulation` trên `.lux`.  
`html { scroll-behavior: smooth }` trừ reduced-motion.

Reduced-motion: cắt animation/transition, reveal hiện ngay, không parallax, không atmosphere.

Scroll listener: **rAF** (header solid, bookbar dock). Parallax: ref DOM, không re-render React.

---

## 10. Responsive

| Breakpoint | Việc xảy ra |
| --- | --- |
| ≥1360 | Shell wide, featured 2 cột, mosaic 3 cột lệch |
| ≤1080 | Phòng 2 cột, quote/amenity/footer/band 2 cột, mosaic 2 hàng |
| ≤900 | Nav → burger; ẩn Đăng nhập trên header; bookbar 2×2 không sticky; split 1 cột; ẩn discovery hero; hero packing khác |
| ≤640 | 1 cột; gutter 18px; chân thẻ phòng xếp nút full width; brand không xuống dòng; mosaic 1 cột |

Không khóa zoom. `min-h-dvh` / `svh` cho hero. Không cuộn ngang.

---

## 11. Truy cập và nội dung

- Skip link “Bỏ qua tới nội dung chính”.  
- `h1` một cái (hero); `h2` section; `h3` thẻ.  
- Ảnh: `alt` mô tả (phòng theo tên; hero poster `alt=""` vì trang trí, section có `aria-label`).  
- Nút icon: `aria-label` (menu, stepper, hotspot).  
- Flag hết phòng: chữ + màu, không chỉ màu.  
- Form: `label` hiện, không placeholder-only. Lỗi: toast + (flow) text gần bước.  
- Focus visible gold.  
- Chat: không cướp focus khi toast (`aria-live` sonner).

Ngôn ngữ UI: **tiếng Việt**. Copy hero hơi thơ; lede phòng và giá thì cụ thể (ngày, đêm, còn chỗ).

---

## 12. Trạng thái cần thiết kế / QA

| Trạng thái | Hành vi mong muốn |
| --- | --- |
| Hết phòng hạng | Flag đỏ, nút disabled “Hết phòng” |
| 0 phòng cho bộ lọc | Lede “còn 0 phòng”; mọi thẻ hết |
| Hold hết hạn | Không tạo booking; khách chọn lại |
| Sai SĐT/mật khẩu | Toast, ở lại form |
| Chưa có booking | Empty + CTA về phòng |
| Newsletter | Báo chưa nối server, không giả thành công âm thầm |
| 3D fail | Fallback ảnh |
| Reduced motion | Tĩnh, vẫn dùng được hết |
| Mạng chậm | Ảnh webp + mobile srcset; hero preload |

---

## 13. Z-index

| Lớp | z |
| --- | --- |
| Ảnh hero | âm |
| Nội dung | 0–3 |
| Bookbar thường | 40 |
| Bookbar dock | 50 |
| Header | 60 |
| Menu mobile | 70 |
| Grain giấy | 0 (sau nội dung) |
| Chat | 95 |
| Skip / dialog | 100–101 (Radix portal, trên chat) |

---

## 14. File và cờ

| File | Việc |
| --- | --- |
| `guest/Home.tsx` | Trang chủ |
| `guest/LuxHero.tsx` | Hero v2 / v1 |
| `guest/BookingBar.tsx` | Ngày + khách |
| `guest/BookingFlow.tsx` | Dialog 4 bước |
| `guest/BookingChat.tsx` | Chat |
| `guest/MyBookings.tsx` | Danh sách đặt |
| `guest/GuestAuth.tsx` | Login/register |
| `guest/RoomPreview.tsx` | Ảnh/3D |
| `PublicSite.tsx` | Shell khách |

Cờ env (xem README): `VITE_CINEMATIC_HERO`, `VITE_ROOM_3D`, `VITE_DEMO_PAYMENTS`. Không nhét secret vào `VITE_*`.

---

## 15. Việc còn lệch (nếu làm tiếp visual)

1. Skill catalog từng gợi navy+Inter: **không áp** (lệch Sao Mai).  
2. Ba hướng đổi da đã đề xuất, chưa implement: **Indochine Deco**, **Daylight Linen**, **Editorial Maison**.  
3. Đã bổ sung (Maison, không đổi da): lịch dải đêm + gợi ý giá trên thanh đặt; thanh neo mobile; hash URL (`#/room/rt3?ci=&co=&g=`); trang một hạng; bàn hoàng hôn + đưa đón; folio sau đặt; hủy phòng thống nhất **7 ngày hoàn 100% cọc**.

Khe còn lại: badge trạng thái admin vẫn shadcn; trang quản trị không thuộc da khách.

---

*Cập nhật theo code tại thời điểm viết. Đổi token/copy thì sửa file này cùng PR.*
