# Hướng dẫn vận hành — dành cho người không chuyên kỹ thuật

Tài liệu này viết cho lễ tân, quản lý và kế toán. Không cần biết lập trình.

---

## 1. Đăng nhập

Trang web mở ra là **trang đặt phòng cho khách**. Nhân viên bấm **“Đăng nhập nhân viên”** ở góc phải.

| Vai trò | Tài khoản demo | Làm được gì |
| --- | --- | --- |
| Quản trị | `admin` / `admin` | Toàn quyền |
| Quản lý | (tạo thêm trong Người dùng) | Như admin, trừ hoàn tiền & quản lý tài khoản |
| Lễ tân | `letan` / `letan` | Đặt phòng, nhận/trả phòng, dịch vụ, hóa đơn |
| Kế toán | `ketoan` / `ketoan` | Hóa đơn, thu tiền, hoàn tiền, báo cáo |
| Khách demo | `0901234567` / `123456` | Xem đặt phòng của mình |

> ⚠️ **Trước khi dùng thật phải đổi toàn bộ mật khẩu demo này.**

---

## 2. Việc hàng ngày của lễ tân

### 2.1 Khách đặt phòng online — cần làm gì

1. Vào **Đặt phòng**. Yêu cầu mới có trạng thái **Chờ duyệt**.
2. Kiểm tra khách đã **cọc 25%** chưa (cột Tiền cọc).
3. Đã cọc → bấm **Duyệt**. Chưa cọc quá 6 giờ → hệ thống tự nhắc; bạn có thể gọi trực tiếp.
4. Không liên lạc được → **Từ chối** kèm lý do, phòng được trả về kho ngay.

### 2.2 Nhận phòng (check-in)

1. **Đặt phòng** → tìm khách → bấm **Nhận phòng**.
2. Chọn loại giấy tờ (CCCD hoặc Hộ chiếu) → bấm **Quét ảnh giấy tờ**.
3. Hệ thống điền sẵn các trường và hiện **Độ tin cậy**.
   - Nền vàng “Cần kiểm tra lại” → **đọc lại bản gốc và sửa tay**. Máy đọc sai là bình thường.
   - Không có ảnh / máy đọc hỏng → nhập tay toàn bộ, vẫn nhận phòng được bình thường.
4. Bấm **Xác nhận nhận phòng**. Phòng chuyển sang **Đang ở**.

### 2.3 Trả phòng (check-out)

1. **Đặt phòng** → **Trả phòng**.
2. Hệ thống tạo hóa đơn gồm tiền phòng + dịch vụ, trừ tiền cọc đã thu.
3. Thu phần còn lại tại **Hóa đơn** → chọn hình thức → **Ghi nhận thanh toán**.
4. Phòng tự chuyển sang **Dọn dệp**. Sau khi dọn xong, vào **Phòng** đổi lại **Trống**.

### 2.4 Khách không đến (no-show)

Quá giờ nhận phòng mà khách không tới: **Đặt phòng** → **No-show**. Tiền cọc xử lý theo chính sách hủy, phòng được giải phóng để bán lại.

---

## 3. Những chức năng AI — và khi nào đừng tin AI

Nguyên tắc chung: **AI chỉ gợi ý, người quyết định.** Mọi chỗ AI xuất hiện đều có cách làm thủ công thay thế.

| Chức năng | Ở đâu | Tin đến mức nào | Khi AI sai thì làm gì |
| --- | --- | --- | --- |
| Chatbot đặt phòng | Nút chat góc phải trang khách | Tra phòng trống và giá là số thật | Khách bấm chọn phòng là vào form bình thường; hoặc gọi hotline |
| Gợi ý giá | **Doanh thu AI** | Tham khảo | Bỏ qua, hoặc tự đặt giá tại **Doanh thu AI → Áp giá** |
| Dự báo nhu cầu | **Doanh thu AI** | Tham khảo | Xem cụm “Vì sao” để hiểu; dữ liệu ít thì độ tin cậy thấp |
| Quét CCCD (OCR) | Lúc nhận phòng | Luôn phải đối chiếu | Sửa tay từng trường |
| Gợi ý bán thêm | Trong hộp Dịch vụ | Tham khảo | Bỏ qua, thêm dịch vụ thủ công |
| Phân tích đánh giá | **Đánh giá** | Tham khảo | Bấm **Sửa nhãn** để ghi đúng cảm xúc |
| Rủi ro no-show | **Doanh thu AI → No-show** | Tham khảo | **Không được tự hủy phòng của khách** chỉ vì điểm cao. Gọi xác nhận trước |

### Quy tắc vàng khi áp giá

Đề xuất có nhãn **“Cần duyệt”** là mức biến động lớn. Chỉ quản lý/admin áp được. Lễ tân bấm sẽ báo không đủ quyền — đó là đúng thiết kế, không phải lỗi.

---

## 4. Tiền — việc của kế toán

### 4.1 Thu tiền

**Hóa đơn** → chọn hóa đơn → chọn hình thức (VNPay / MoMo / Thẻ / Chuyển khoản / Tiền mặt) → **Ghi nhận thanh toán**.
Thanh toán từng phần được — hệ thống tự tính còn lại bao nhiêu.

### 4.2 Hoàn tiền

Chỉ **admin** và **kế toán** làm được. Mọi lần hoàn đều ghi vào **Vận hành → Nhật ký kiểm toán**: ai làm, lúc nào, số tiền.

### 4.3 Hóa đơn điện tử

Bấm **Phát hành hóa đơn điện tử** → sinh số hóa đơn và tách VAT 8%.

> Đây là bản **mô phỏng**. Muốn hợp pháp phải nối với nhà cung cấp hóa đơn điện tử (Viettel, VNPT, MISA…).

### 4.4 Đối soát OTA

**Kênh bán** → xem doanh thu gộp, hoa hồng, thực nhận theo từng kênh. Lệch với sao kê OTA → kiểm `channelRef` của từng đặt phòng.

---

## 5. Giá và mùa cao điểm

| Muốn đổi gì | Vào đâu |
| --- | --- |
| Giá niêm yết từng hạng phòng | **Phòng → Loại phòng** |
| Hệ số cuối tuần / mùa | **Doanh thu AI → Bảng giá** |
| Chốt giá cứng cho một ngày | **Doanh thu AI → Áp giá** (giá chốt tay thắng mọi hệ số) |
| Thêm sự kiện địa phương | **Doanh thu AI → Sự kiện** — nhập ngày và mức tăng nhu cầu |
| Mức cọc (mặc định 25%) | Sửa `DEPOSIT_PERCENT` trong `src/app/lib/store.tsx` |
| Thời gian giữ phòng (15 phút) | Sửa `HOLD_TTL_MINUTES` trong `src/app/lib/holds.ts` |
| Mốc hoàn cọc khi hủy | Sửa `CANCELLATION_TIERS` trong `src/app/components/guest/LegalPages.tsx` |

---

## 6. Khi có sự cố

### 6.1 Bảng tra nhanh

| Hiện tượng | Nguyên nhân thường gặp | Xử lý |
| --- | --- | --- |
| “Phòng vừa được khách khác đặt” | Hai người đặt cùng lúc — hệ thống đã chặn đúng | Chọn phòng khác cùng hạng |
| “Hết thời gian giữ phòng” | Khách để form quá 15 phút | Tra lại phòng trống và đặt lại |
| “Dỵ liệu vừa được người khác sửa” | Hai nhân viên sửa cùng đặt phòng | Tải lại trang rồi làm lại — **không bấm lại liên tục** |
| Thanh toán báo lỗi | Cổng từ chủi hoặc mạng đứt | Hệ thống gợi ý chuyển khoản/hotline. **Không thu hai lần** — kiểm **Hóa đơn** trước |
| Trang trắng | Lỗi hiển thị | Bấm **Thử lại**; còn lỗi thì **Copy chi tiết lỗi** gửi kỹ thuật |
| Quét giấy tờ sai | Ảnh mờ, chụp chéo | Chụp lại đủ sáng, hoặc nhập tay |
| Email/SMS không đến | Hàng đợi lỗi | **Vận hành → Thông báo** → **Gửi lại cái lỗi** |

### 6.2 Nguyên tắc quan trọng nhất về tiền

Khi thanh toán “không rõ thành công hay chưa”: **luôn kiểm tra **Hóa đơn** trước khi thu lại.** Thu trùng gây phải hoàn tiền và mất lòng tin khách.

---

## 7. Theo dõi sức khỏe hệ thống (quản lý)

Vào **Vận hành**:

| Tab | Ý nghĩa |
| --- | --- |
| **Tình trạng** | Tốc độ tải trang, số lỗi gần đây, dung lượng dỵ liệu |
| **Nhật ký** | Lỗi kỹ thuật — gửi cho người phụ trách khi cần |
| **Thông báo** | Email/SMS đã gửi, cái nào lỗi, gửi lại |
| **Kiểm toán** | Ai làm gì, lúc nào — tra khi có tranh chấp |
| **Sao lưu** | Tải file dỵ liệu về máy / nạp lại |

**Nên làm: cuối mỗi ngày bấm Tải sao lưu.** Bản hiện tại lưu dỵ liệu trong trình duyệt — xóa dỵ liệu trình duyệt là mất.

---

## 8. Chạy và kiểm tra phần mềm (cho người kỹ thuật)

```bash
npm install          # cài thư viện
npm run dev          # chạy thử tại http://localhost:5173
npm test             # chạy kiểm thử logic đặt phòng
npm run typecheck    # kiểm tra kiểu dỵ liệu
npm run build        # đóng gói bản phát hành
```

`npm test` kiểm các điểm dễ sinh thiệt hại thật: chống đặt trùng phòng, hạn giữ phòng, biên giá sàn/trần, chống bấm đúp tạo hai đặt phòng, trừ điểm thân thiết, cộng tiền đã thu.

---

## 9. Trước khi chạy thật — danh mục kiểm tra

Bản hiện tại **chạy hoàn toàn trong trình duyệt**, phù hợp demo và chạy thử nghiệp vụ. Muốn bán phòng thật, bắt buộc có backend:

- [ ] Cơ sở dỵ liệu thật + ràng buộc chống đặt trùng ở tầng DB (xem `docs/API.md` §4.1)
- [ ] Đổi toàn bộ mật khẩu demo; băm mật khẩu bằng argon2/bcrypt
- [ ] Nối cổng thanh toán thật + xác thực chữ ký webhook
- [ ] Nối dịch vụ email/SMS thật
- [ ] Nối OCR thật (hoặc bỏ, nhập tay)
- [ ] Mã hóa số CCCD/hộ chiếu, có quy trình xuất/xóa dỵ liệu khách
- [ ] HTTPS, sao lưu tự động, giám sát lỗi
- [ ] Kiểm tra tải (nhiều người đặt cùng lúc)
- [ ] Rà lại nội dung pháp lý với tên, địa chỉ, hotline thật của khách sạn

---

## 10. Thông tin demo cần thay

| Nội dung | Giá trị demo | Sửa tại |
| --- | --- | --- |
| Tên khách sạn | Sao Mai Hotel | `HOTEL_NAME` — `src/app/lib/store.tsx` |
| Hotline | 0900 000 000 | `HOTEL_HOTLINE` — `src/app/lib/store.tsx` |
| Địa chỉ | 123 Đường Biển, TP. HCM | `guest/LegalPages.tsx`, `PublicSite.tsx` |
| Email riêng tư | privacy@saomaihotel.vn | `guest/LegalPages.tsx` |
| Số tài khoản | 0123 456 789 — MB Bank | `guest/DepositDialog.tsx` |
| VAT | 8% | `VAT_RATE` — `src/app/lib/payments.ts` |
