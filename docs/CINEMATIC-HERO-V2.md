# Cinematic Hero v2 — đã tích hợp vào dự án

## Thay đổi
- Thay riêng vùng hero bằng concept “Một khoảng trời riêng”; giữ header, thanh chọn ngày, danh sách phòng và nghiệp vụ cũ.
- Chuyển Hoàng hôn / Về đêm. Hai ảnh được chỉnh màu từ chính ảnh resort gốc, không tạo địa điểm/kiến trúc khác.
- Ảnh nền có hiệu ứng 2.5D WebGL: chiều sâu theo chuột, gợn nước nhẹ ở vùng hồ bơi, chuyển ánh sáng mềm. Không phải model resort 3D/GLB và không phải video quay thật.
- Điểm khám phá Suite + thẻ phòng mở dialog. Khách chọn hạng, xem ảnh hoặc mở mô phỏng phòng 3D có sẵn, rồi quay về thanh chọn ngày.
- Typography serif lớn, vàng champagne, xanh trầm; nút đặt phòng rõ ràng và có focus bàn phím.
- Mobile mặc định dùng ảnh nhẹ, có nút bật chuyển động. Khi máy bật giảm chuyển động hoặc tiết kiệm dữ liệu, không tự mở GPU. Reduced motion vô hiệu hóa nút chuyển động.
- Hero GPU lazy-load sau khoảng 1 giây, cap 24fps (mục tiêu, không phải benchmark), cap DPR 1.25; dừng ngoài viewport/tab ẩn, dispose khi tắt. Không thêm npm dependency hoặc request bên thứ ba.
- Không có tự phát âm thanh, scroll hijacking, lời hứa gửi tiền thật hoặc model nội thất đúng thực tế.

## Bật/tắt và rollback
`VITE_CINEMATIC_HERO=false` trong `.env`, chạy/build lại để dùng `LegacyLuxHero.tsx` của bản v1. Mặc định true. `VITE_ROOM_3D` và `VITE_DEMO_PAYMENTS` giữ nguyên như v1; demo payments vẫn false.

Các file chính: `LuxHero.tsx`, `LegacyLuxHero.tsx`, `HeroAtmosphere.tsx`, `cinematic-hero.css`, các ảnh `hero-sunset*.webp`, `hero-night*.webp`, import stylesheet và preload trong index.html.

## Kiểm tra
- TypeScript PASS.
- 35/35 test logic hồi quy qua harness ngoại tuyến PASS; không phải kết quả Vitest chuẩn.
- Chromium headless: desktop 1440x1000, mobile 390x844; đổi ánh sáng, tắt GPU, mở dialog và xem 3D, CTA về chọn ngày, reduced motion, không tràn ngang mobile.
- Kiểm thử booking mobile v1 chạy lại: đăng nhập, giữ phòng, xem 3D, tạo booking pending, để cọc sau, lưu trạng thái; không pageerror trong kịch bản.
- Preview biên dịch bằng esbuild và CSS snapshot gốc + stylesheet mới do sandbox không cài được native Vite/Rollup Linux qua mạng. Vẫn phải chạy npm ci / npm test / npm run build chuẩn trên máy có mạng trước triển khai.
- Chưa đo FPS/Lighthouse trên thiết bị thật, chưa QA Safari và GPU điện thoại. Không cam kết mọi thiết bị chạy 24fps.
- Chưa có mô hình GLB/HDRI resort, rèm chuyển động hay camera hành trình 3D xuyên cảnh; phần hiện tại là ảnh điện ảnh có chiều sâu/gợn nước. Mô phỏng phòng trong dialog giữ nguyên giới hạn minh họa từ v1.
