# Báo cáo nâng cấp — Sao Mai Hotel

## Trạng thái bàn giao

Bản nâng cấp trên mã nguồn React/Vite gốc, không đổi hệ thống điều hướng, không chuyển framework, không thay schema dữ liệu đã lưu (vẫn version 3). Đây là bản để kiểm thử/staging, **chưa đủ điều kiện vận hành giao dịch khách sạn thật**.

## Các lỗi đã vá

| Vấn đề | Bản vá tại chỗ |
|---|---|
| Ngày trả phòng được chọn cùng ngày nhận | Giới hạn lịch từ ngày nhận + 1; parse ngày địa phương, kiểm tra ngày ISO hợp lệ |
| Ngày sai tạo NaN và vượt qua kiểm tra số đêm | Ngày sai trả 0 đêm; kiểm tra ngày/khách khi giữ phòng và tra cứu |
| Giá trên thẻ dùng basePrice, xác nhận dùng giá động | Thẻ phòng dùng cùng quoteFor với bước xác nhận |
| Phòng chọn bị suy ra lại từ danh sách khả dụng thay đổi | Chụp type + roomId khi chọn; không truy cập phần tử [0] trên undefined |
| Effect cleanup có thể nhả hold khi dependency thay đổi | Giữ hold bằng ref, cleanup ổn định; kiểm tra hiệu lực hold trước khi ghi |
| Bấm xác nhận nhanh tạo rủi ro gửi lặp | Khóa submit bằng ref và gọi createBookingSafe có sẵn |
| Bước xác nhận vẫn cho gửi khi hold hết hạn | Chặn nút và kiểm tra lại ở submit/store, hướng dẫn chọn lại |
| Phòng không tồn tại/bảo trì hoặc số khách không hợp lệ | Chặn ở hold và buildBooking |
| Yêu cầu pending đã cọc không chặn tồn phòng | Tính pending + depositPaid vào kiểm tra xung đột và giữ phòng |
| Khách báo chuyển khoản được xem là đã nhận tiền | Chế độ demo tạo payment pending, không tự gán depositPaid |
| settlePayment dùng closure trước khi payment mới vào state | Nhánh demo cập nhật từ bản ghi giao dịch trả về, không tra closure cũ |
| QR dùng tài khoản mẫu/URL lỗi và thông điệp bảo mật gây hiểu nhầm | Bỏ QR tài khoản mẫu; tắt thanh toán mô phỏng mặc định, cảnh báo chưa có cổng thật |
| Thông báo email/đăng ký ưu đãi khẳng định gửi dù không có backend | Đổi sang thông báo đúng tình trạng chưa gửi thật |
| Đăng nhập khách đặt minLength 8 trong khi tài khoản demo có mật khẩu 6 ký tự | Bỏ giới hạn độ dài tại login; vẫn giữ yêu cầu 8 ký tự ở đăng ký; cho phép password manager/paste |
| Ảnh fallback không phục hồi khi src đổi | Reset trạng thái lỗi theo src, giữ alt mô tả |
| Nút Đặt phòng từ trang pháp lý chỉ về đầu trang | Đi thẳng về vùng chọn phòng |
| TypeScript lỗi/có wildcard che lỗi | Loại bỏ declare module "*"; sửa import HeroScene3D, NotificationKind, property không tồn tại, Sonner prop; truyền loại phòng đúng cho upsell |

Không thay bộ lưu trữ hoặc viết lại nghiệp vụ. Các bản vá phía client không thay thế khóa giao dịch ở máy chủ.

## 3D đã bổ sung

- Nút **Ảnh / Khám phá 3D** trong vùng ảnh cũ; ảnh vẫn là mặc định.
- Xem ngay trong bước xác nhận chọn phòng, không thay luồng booking.
- Sáu study theo tên: Standard, Deluxe, Suite, Family, Penthouse, Presidential. Hạng phòng mới chưa khớp tên dùng study Standard.
- Xoay đủ vòng, zoom, kéo chuột, hai ngón chạm, nút điều khiển 44px, phím mũi tên / +/- / Home.
- WebGL nhẹ tự chứa, không thêm thư viện hoặc request CDN; tách lazy chunk, chỉ vẽ khi thao tác/resize, giới hạn DPR 1.5 và dọn tài nguyên khi đóng. Trong bản QA chunk 3D khoảng 10 KB minified, chưa gzip.
- Màu gỗ, vải, marble và kính được gợi bằng shader thủ tục; ánh sáng giả lập. **Đây là mô phỏng kiến trúc minh họa, không phải phòng thực tế, không photorealistic.**
- Không hỗ trợ WebGL hoặc context bị mất: thông báo và nút quay lại ảnh. Không ảnh hưởng bước đặt phòng.
- Tắt bằng `VITE_ROOM_3D=false` rồi build lại.

### Chưa thực hiện trong bản này

ZIP nguồn không có GLB/HDRI hay bản đo phòng. Bản này **không tích hợp Three.js/React Three Fiber, GLB loader hoặc HDRI**. Để đạt mô hình nội thất chân thực đúng từng phòng cần model/texture được cấp phép và kiểm thử GPU thật. Điểm thay thế là `RoomScene.tsx`; UI `RoomPreview` và ảnh cũ có thể giữ nguyên khi đổi engine. Không tuyên bố đây là bản mô phỏng hoàn thiện ở chuẩn hình ảnh khách sạn 5 sao.

## Giao diện và hiệu năng

- Lớp `enhancements.css` độc lập: xanh trầm/gỗ/be/đồng, overlay hero dễ đọc, border/hover tinh tế; bố cục gốc giữ nguyên.
- Hộp thoại booking có cuộn theo chiều cao màn hình; header/CTA chỉnh gọn trên mobile.
- Giảm chuyển động theo prefers-reduced-motion.
- Tách các trang quản trị nặng thành lazy imports; không tải sẵn toàn bộ chart/spreadsheet khi khách vào trang.
- Sinh bản WebP từ ảnh gốc: tổng 3,538,982 → 906,682 bytes (~74.4% giảm dung lượng bộ ảnh). Ảnh JPG gốc vẫn giữ để rollback và hỗ trợ dữ liệu cũ còn tham chiếu JPG. Không phải phép đo LCP hoặc tốc độ tải thực tế.

## Kết quả kiểm tra thực hiện

1. `npm run typecheck`: PASS sau khi bỏ wildcard shim.
2. 28 test logic có sẵn + 7 test hồi quy mới: **35/35 PASS**, chạy bằng harness tương thích ngoại tuyến, ở timezone Asia/Ho_Chi_Minh và America/Los_Angeles. Đây không phải kết quả lệnh Vitest chuẩn.
3. Browser QA trên Chromium headless/software WebGL: viewport 1440×1000 và 390×844. Trang chủ, menu mobile, thẻ phòng, đổi ảnh/3D, xoay/zoom/reset: chạy được, không phát hiện pageerror trong kịch bản.
4. Luồng mobile: tài khoản guest demo → chọn phòng → đăng nhập → hold giữ sau nhiều lần render → xem 3D trong dialog → xác nhận → cọc mặc định bị vô hiệu → để cọc sau → lưu booking pending. Persistence ghi 1 hold converted cho booking mới. Không gửi tiền hoặc email thật.
5. Cố ý trả null khi tạo WebGL: hiện fallback; quay lại ảnh được.
6. Không có tràn trang theo chiều ngang ở viewport mobile đã thử.

### Giới hạn kiểm tra

- `npm ci`, `npm test`/Vitest và `npm run build` chuẩn Vite **chưa xác nhận thành công** trong sandbox: DNS mạng bị chặn, thư viện native trong Git đính kèm là bản Windows, thiếu Rollup Linux. Không sửa node_modules trong bản bàn giao.
- Để thử UI, đã dùng esbuild của sandbox và CSS đã biên dịch từ phiên bản gốc cộng lớp CSS mới. `preview/` chỉ là **bản QA ngoại tuyến**, không phải chứng nhận build production Vite. Cần chạy lại lệnh chuẩn trên máy có mạng trước khi merge/deploy.
- Chưa kiểm tra Safari/iPhone thật, Android GPU yếu, benchmark FPS/Lighthouse, screen-reader, toàn bộ CRUD/quyền trong admin, stress test đa tab/đa thiết bị hoặc gateway sandbox thật.
- Nhánh thanh toán demo bật lại được vá theo code nhưng chưa được E2E đầy đủ; default OFF đã kiểm tra.
- Chưa chứng minh tương thích với mọi bản backup người dùng; schema không đổi và các field bổ sung đều optional.

## Các vấn đề còn lại / chặn production

1. Backend chưa tồn tại: localStorage và khóa JavaScript không chống double-booking giữa thiết bị. Cần API, giao dịch DB, ràng buộc khoảng ngày và idempotency server-side.
2. Tài khoản/mật khẩu/role demo còn lưu phía client. Cần auth phía server, hash mật khẩu, phân quyền server-side trước khi đưa dữ liệu thật vào. Không xem guard UI là biện pháp bảo mật.
3. Thanh toán/refund, notification, OTA, hóa đơn điện tử và AI chứa mô phỏng hoặc integration chưa chứng minh hoạt động thật. Cần backend webhook có xác thực; không bật demo payments để phục vụ khách thật.
4. `.env` gốc có cấu hình API frontend. File đó không được đưa vào gói mới. Nếu khóa từng được đưa vào bundle hoặc Git, hãy thu hồi/đổi khóa và chuyển API gọi AI sang backend. Không đặt secret trong biến VITE_*.
5. Hotline, địa chỉ, số sao, chính sách hủy, đánh giá và số liệu marketing trong dữ liệu gốc là nội dung mẫu/chưa xác minh. Không dùng làm cam kết với khách thật.
6. Chưa có form liên hệ gửi server. Footer newsletter nay thông báo chưa kết nối thay vì giả vờ thành công; cần API/CRM và cơ chế đồng ý marketing.
7. Menu mobile chưa được audit accessibility đầy đủ (focus trap/keyboard toàn trang cần vòng QA tiếp theo).
8. Một số luồng quản trị/chat dùng API booking cũ và các thao tác tài chính vẫn cần audit riêng. Không tuyên bố đã sửa toàn bộ lỗi của hệ thống.

## Triển khai theo từng phần

- Sao lưu dữ liệu từ màn hình Vận hành & Sao lưu của bản hiện tại; giữ ZIP nguồn cũ riêng.
- Tạo nhánh staging. Cài Node LTS, chạy `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.
- Ban đầu tắt 3D, kiểm tra booking và dữ liệu cũ. Sau đó bật 3D, kiểm tra từng hạng trên mobile thật. Giữ DEMO_PAYMENTS=false.
- QA toàn bộ luồng admin trước khi phát hành. Chỉ dùng dữ liệu thử trong preview và staging.
- Không triển khai `preview/` làm website nhận tiền thật.
