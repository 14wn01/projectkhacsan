# Tài liệu API & thiết kế dữ liệu — Sao Mai Hotel PMS

Bản hiện tại chạy **frontend-only**: toàn bộ nghiệp vụ nằm trong `src/app/lib`, dữ liệu lưu `localStorage`.
Tài liệu này mô tả hợp đồng API khi đưa lên backend thật — giữ nguyên tên trường để không phải sửa UI.

---

## 1. Quy ước chung

| Mục | Quy ước |
| --- | --- |
| Base URL | `/api/v1` |
| Định dạng | JSON, `UTF-8` |
| Ngày | `YYYY-MM-DD` (ngày ở), ISO-8601 (mốc thời gian) |
| Khoảng ngày | Nửa mở `[checkIn, checkOut)` — trả phòng cùng ngày khách khác nhận là **không trùng** |
| Tiền | Số nguyên VND, không thập phân |
| Xác thực | `Authorization: Bearer <access_token>` (JWT 15 phút + refresh token 30 ngày) |
| Chỡng trùng lặp | Header `Idempotency-Key` cho mọi `POST` có tiền |
| Khóa bản ghi | Header `If-Match: <version>` — sai phiên bản trả `409` |

### Mã lỗi

| HTTP | `code` | Khi nào |
| --- | --- | --- |
| 400 | `invalid_dates` | `checkOut <= checkIn` hoặc ngày quá khứ |
| 401 | `unauthenticated` | Thiếu / hết hạn token |
| 403 | `forbidden` | Sai vai trò (xem bảng phân quyền) |
| 409 | `room_unavailable` | Phòng đã bị người khác đặt |
| 409 | `hold_expired` | Phiên giữ phòng hết 15 phút |
| 409 | `version_conflict` | Bản ghi đã bị người khác sửa |
| 422 | `payment_failed` | Cổng thanh toán từ chủi |
| 429 | `rate_limited` | Quá 60 req/phút/IP |

Thân lỗi luôn có câu tiếng Việt cho người dùng cuối:

```json
{ "error": { "code": "room_unavailable", "message": "Phòng vừa được khách khác đặt. Mời bạn chọn phòng khác." } }
```

---

## 2. Danh sách endpoint

### 2.1 Booking engine (khách — không cần đăng nhập)

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/rooms/availability?checkIn=&checkOut=&guests=` | Phòng còn trống theo thực tế (đã trừ booking + hold) |
| GET | `/rates/quote?typeId=&checkIn=&checkOut=` | Báo giá từng đêm theo giá động, kèm lý do tăng/giảm |
| POST | `/holds` | Giữ phòng 15 phút — bước chống double-booking |
| DELETE | `/holds/{holdId}` | Nhả phòng khi khách thoát giỏ |
| POST | `/bookings` | Tạo đặt phòng (tiêu thụ `holdId`) |
| GET | `/bookings/{code}?phone=` | Tra đặt phòng bằng mã + số điện thoại |
| POST | `/bookings/{id}/cancel` | Khách tự hủy — trả về mức hoàn cọc |

**POST /holds**

```json
{ "roomId": "r101", "checkIn": "2026-09-20", "checkOut": "2026-09-22", "guests": 2 }
```

```json
{ "hold": { "id": "h_8f2", "roomId": "r101", "expiresAt": "2026-09-01T10:15:00Z", "ttlSeconds": 900 } }
```

**POST /bookings**

```json
{
  "holdId": "h_8f2",
  "customer": { "name": "Phạm Văn An", "phone": "0901234567", "email": "an@example.com", "marketingOptIn": false },
  "guests": 2,
  "note": "Xin phòng tầng cao",
  "source": "website"
}
```

```json
{
  "booking": {
    "id": "b_931",
    "code": "BK-1008",
    "status": "pending",
    "total": 1150000,
    "depositPercent": 0.25,
    "depositAmount": 287500,
    "depositDueAt": "2026-09-01T16:00:00Z",
    "version": 1
  }
}
```

### 2.2 Thanh toán

| Method | Path | Mô tả |
| --- | --- | --- |
| POST | `/payments/intents` | Tạo phiên trả tiền (`vnpay` \| `momo` \| `stripe` \| `bank_transfer` \| `cash`) |
| POST | `/payments/{id}/confirm` | Chốt kết quả (dùng cho tiền mặt / chuyển khoản) |
| POST | `/payments/{id}/refund` | Hoàn tiền — chỉ `admin`, `accountant` |
| POST | `/webhooks/vnpay` | Webhook cổng — **bắt buộc kiểm chứng chữ ký HMAC** |
| GET | `/invoices?bookingId=` | Hóa đơn của đặt phòng |
| POST | `/invoices/{id}/e-invoice` | Phát hành hóa đơn điện tử (VAT 8%) |
| GET | `/reconciliation/ota?from=&to=` | Đối soát hoa hồng OTA |

Webhook là **nguồn sự thật** cho trạng thái thanh toán. Trình tự an toàn:

1. Ghi `payment.state = pending` trước khi chuyển khách sang cổng.
2. Webhook đến → kiểm chứng chữ ký → cập nhật `succeeded`/`failed` trong một transaction.
3. Webhook phải **idempotent** theo `gatewayRef` (cổng gửi lại nhiều lần).
4. Có job đối chiếu định kỳ cho phiên `pending` quá 30 phút.

### 2.3 Front office (nội bộ)

| Method | Path | Vai trò |
| --- | --- | --- |
| GET | `/rooms` · `PATCH /rooms/{id}` | `reception`+ (đổi trạng thái Dọn/Bảo trì) |
| POST | `/bookings/{id}/check-in` | `reception`+ — kèm dữ liệu OCR giấy tờ |
| POST | `/bookings/{id}/check-out` | `reception`+ — sinh hóa đơn |
| POST | `/bookings/{id}/no-show` | `reception`+ |
| POST | `/documents/ocr` | `reception`+ — `multipart/form-data`, ảnh CCCD/Passport |
| GET | `/reports/revenue?from=&to=` | `manager`, `accountant`, `admin` |

**POST /documents/ocr** trả về độ tin cậy từng trường để lễ tân sửa tay khi AI đọc sai:

```json
{
  "data": { "fullName": "PHẠM VĂN AN", "idNumber": "001199012345", "dob": "1990-05-12", "docType": "cccd", "confidence": 0.82 },
  "fieldConfidence": { "fullName": 0.93, "idNumber": 0.71 },
  "needsReview": true,
  "warnings": ["Số giấy tờ đọc chưa chắc chắn — vui lòng đối chiếu bản gốc."]
}
```

### 2.4 Kênh phân phối (OTA)

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/channels` | Danh sách kênh + hoa hồng + allotment |
| POST | `/channels/{id}/sync` | Đẩy giá & phòng trống lên OTA |
| POST | `/channels/{id}/bookings` | Nhận đặt phòng từ OTA (kèm `channelRef`) |

Allotment là hàng rào chống oversell: tổng phân bổ cho OTA luôn `<` tổng phòng thật.

### 2.5 AI

| Method | Path | Mô tả |
| --- | --- | --- |
| POST | `/ai/chat` | Chatbot đặt phòng — trả về câu trả lời + đề xuất phòng có thể chốt ngay |
| GET | `/ai/forecast?days=30` | Dự báo nhu cầu theo ngày |
| GET | `/ai/pricing/recommendations?days=30` | Đề xuất giá, kèm `requiresApproval` |
| POST | `/ai/pricing/apply` | Áp giá — chỉ `manager`, `admin` |
| GET | `/ai/upsell?bookingId=` | Gợi ý bán thêm |
| GET | `/ai/no-show?date=` | Xếp hạng rủi ro no-show |
| GET | `/ai/reviews/summary` | Tổng hợp cảm xúc + cảnh báo chất lượng |

Mọi endpoint AI đều trả `confidence` và `reasons`. Quy tắc bắt buộc: **AI không được tự động đổi giá hay tự hủy phòng** — luôn cần người duyệt, và luôn có đường thao tác thủ công tương đương trong UI.

---

## 3. Phân quyền

| Quyền | admin | manager | reception | accountant | guest |
| --- | --- | --- | --- | --- | --- |
| Xem/tạo đặt phòng | ✓ | ✓ | ✓ | – | chỉ của mình |
| Check-in / check-out | ✓ | ✓ | ✓ | – | – |
| Đổi giá (`edit_price`) | ✓ | ✓ | – | – | – |
| Hoàn tiền (`refund`) | ✓ | – | – | ✓ | – |
| Hóa đơn (`invoices`) | ✓ | ✓ | ✓ | ✓ | – |
| Báo cáo doanh thu (`revenue`) | ✓ | ✓ | – | ✓ | – |
| Kênh OTA (`channels`) | ✓ | ✓ | – | – | – |
| Vận hành/log (`ops`) | ✓ | ✓ | – | – | – |
| Quản lý người dùng | ✓ | – | – | – | – |

Nguồn sự thật trong code: `ROLE_PERMISSIONS` tại `src/app/lib/store.tsx`. Backend phải kiểm tra lại — **không tin phân quyền ở frontend**.

---

## 4. Schema cơ sở dỵ liệu (PostgreSQL)

```sql
CREATE TYPE booking_status AS ENUM ('pending','reserved','checked_in','checked_out','cancelled');

CREATE TABLE room_types (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  base_price    bigint NOT NULL CHECK (base_price >= 0),
  capacity      smallint NOT NULL CHECK (capacity BETWEEN 1 AND 10),
  amenities     text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number        text NOT NULL UNIQUE,
  floor         smallint NOT NULL,
  type_id       uuid NOT NULL REFERENCES room_types(id),
  status        text NOT NULL DEFAULT 'available'
);

CREATE TABLE customers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  phone         text NOT NULL UNIQUE,
  email         text,
  -- Dỵ liệu định danh phải mã hóa ứng dụng, KHÔNG lưu thô
  id_number_enc bytea,
  consent_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  room_id       uuid NOT NULL REFERENCES rooms(id),
  customer_id   uuid NOT NULL REFERENCES customers(id),
  stay          daterange NOT NULL,
  guests        smallint NOT NULL CHECK (guests > 0),
  status        booking_status NOT NULL DEFAULT 'pending',
  room_price    bigint NOT NULL,
  deposit_amount bigint NOT NULL DEFAULT 0,
  deposit_paid  boolean NOT NULL DEFAULT false,
  channel_ref   text,
  version       integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (lower(stay) < upper(stay))
);
```

### 4.1 Chốt chặn double-booking — 3 lớp

**Lớp 1 — Ràng buộc ở DB (quan trọng nhất).** Dù code sai, DB vẩn từ chối:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    room_id WITH =,
    stay    WITH &&
  ) WHERE (status <> 'cancelled');
```

`daterange` mặc định `[)` nên trả phòng 12/03 — nhận phòng 12/03 vẫn hợp lệ, đúng như nghiệp vụ khách sạn.

**Lớp 2 — Giữ phòng có hạn (hold).** Chống hai khách cùng điền form một phòng:

```sql
CREATE TABLE room_holds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       uuid NOT NULL REFERENCES rooms(id),
  stay          daterange NOT NULL,
  session_id    text NOT NULL,
  expires_at    timestamptz NOT NULL,
  converted_booking_id uuid REFERENCES bookings(id),
  released_at   timestamptz
);

-- Chỉ một phiên được giữ một phòng trong cùng khoảng thời gian
ALTER TABLE room_holds
  ADD CONSTRAINT holds_no_overlap
  EXCLUDE USING gist (room_id WITH =, stay WITH &&)
  WHERE (released_at IS NULL AND converted_booking_id IS NULL);

CREATE INDEX holds_expiry_idx ON room_holds (expires_at) WHERE released_at IS NULL;
```

Job dọn hold hết hạn chạy mỗi phút; UI đếm ngược 15 phút để khách biết.

**Lớp 3 — Transaction có khóa dòng.** Đọc rồi ghi phải nằm trong một transaction, khóa phòng trước khi kiểm tra:

```sql
BEGIN ISOLATION LEVEL READ COMMITTED;

-- Khóa đúng dòng phòng đó, giao dịch khác phải xếp hàng
SELECT id FROM rooms WHERE id = $room_id FOR UPDATE;

-- Kiểm tra lại một lần cuối bên trong khóa
SELECT 1 FROM bookings
 WHERE room_id = $room_id
   AND status <> 'cancelled'
   AND stay && daterange($check_in, $check_out, '[)');
-- Nếu có dòng → ROLLBACK, trả 409 room_unavailable

UPDATE room_holds SET converted_booking_id = $booking_id
 WHERE id = $hold_id AND expires_at > now() AND released_at IS NULL;
-- Nếu 0 dòng → ROLLBACK, trả 409 hold_expired

INSERT INTO bookings (...) VALUES (...);

COMMIT;
```

Vì `EXCLUDE` đã đứng chặn cuối, kể cả khi hai transaction vượt qua bước kiểm tra thì chỉ một cái `COMMIT` thành công — cái còn lại nhận lỗi ràng buộc và được dịch thành `409`.

### 4.2 Optimistic locking

Mọi `PATCH` gửi `If-Match: <version>`:

```sql
UPDATE bookings SET status = $new, version = version + 1
 WHERE id = $id AND version = $expected;
-- 0 dòng → 409 version_conflict
```

Trong bản frontend hiện tại, `assertVersion()` (`src/app/lib/concurrency.ts`) mô phỏng chính hành vi này.

### 4.3 Bảng tiền — không bao giờ ghi đè

```sql
CREATE TABLE payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES bookings(id),
  method        text NOT NULL,
  purpose       text NOT NULL,
  amount        bigint NOT NULL CHECK (amount > 0),
  state         text NOT NULL,
  gateway_ref   text NOT NULL UNIQUE,   -- chống xử lý webhook hai lần
  card_last4    char(4),                -- KHÔNG lưu số thẻ đầy đủ / CVV
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id      bigserial PRIMARY KEY,
  at      timestamptz NOT NULL DEFAULT now(),
  actor   text NOT NULL,
  action  text NOT NULL,
  target  text,
  detail  jsonb
);
```

Sửa tiền = ghi bản ghi mới (`refund`), không `UPDATE amount`. Đây là yêu cầu kế toán và cũng là yêu cầu kiểm toán.

### 4.4 Chỉ mục cần có

```sql
CREATE INDEX bookings_stay_idx     ON bookings USING gist (stay);
CREATE INDEX bookings_room_stay_idx ON bookings (room_id) INCLUDE (status);
CREATE INDEX bookings_status_idx   ON bookings (status) WHERE status IN ('pending','reserved');
CREATE INDEX payments_booking_idx  ON payments (booking_id, state);
```

---

## 5. Bảo mật — yêu cầu bắt buộc khi lên production

| Hạng mục | Cách làm |
| --- | --- |
| Mật khẩu | `argon2id` hoặc `bcrypt` cost ≥ 12. Bản demo lưu mật khẩu dạng thường — **phải thay** |
| Thẻ | Không bao giờ nhận số thẻ trên server của bạn. Dùng iframe/redirect của cổng (PCI-DSS SAQ-A) |
| SQL Injection | Chỉ dùng prepared statement / ORM tham số hóa |
| XSS | Không dùng `dangerouslySetInnerHTML`; bật CSP `default-src 'self'` |
| CSRF | Cookie `SameSite=Lax` + CSRF token cho form thay đổi trạng thái |
| CCCD/Passport | Mã hóa AES-256-GCM ở tầng ứng dụng, khóa ở KMS; log chỉ hiện 4 số cuối |
| Rate limit | 60 req/phút/IP; riêng `/ai/chat` và `/payments` siết hơn |
| Ghi log | Không ghi token, số thẻ, số CCCD đầy đủ |
| GDPR / NĐ 13/2023 | API `GET /me/data` (xuất) và `DELETE /me` (xóa/ẩn danh) — xem `guest/LegalPages.tsx` |

---

## 6. Mở rộng

- **Stateless API** sau load balancer → scale ngang tự do; session/hold đẩy vào Redis.
- **Redis**: khóa phân tán cho hold (`SET hold:{roomId}:{date} NX EX 900`), cache báo giá (TTL 60s), rate limit.
- **CDN**: ảnh phòng + JS/CSS đã hash; HTML không cache.
- **Read replica** cho báo cáo & dashboard AI để không đè lên luồng đặt phòng.
- **Queue** (BullMQ/SQS) cho email/SMS, đẩy OTA, chạy mô hình dự báo đêm.

### Backup & khôi phục

| Chỉ tiêu | Mục tiêu |
| --- | --- |
| RPO | ≤ 5 phút (WAL archiving liên tục) |
| RTO | ≤ 60 phút |
| Backup đầy đủ | Hàng ngày, giữ 30 ngày, mã hóa, để ở vùng khác |
| Diễn tập phục hồi | Mỗi tháng, có biên bản |

Bản frontend hiện tại đã có tải/nạp JSON tại **Vận hành → Sao lưu** để không mất dỵ liệu demo.

---

## 7. Lộ trình

| Giai đoạn | Phạm vi | Ước lượng |
| --- | --- | --- |
| **MVP** | Trang đặt phòng công khai, hold 15 phút, cọc 25%, sơ đồ phòng, check-in/out, hóa đơn, 4 vai trò | 4–6 tuần |
| **Giai đoạn 2** | Giá động + duyệt giá, OCR giấy tờ, email/SMS tự động, điểm thân thiết, chatbot đặt phòng | +4–6 tuần |
| **Giai đoạn 3** | Kết nối OTA thật (Booking/Agoda/Traveloka), đối soát, hóa đơn điện tử nhà cung cấp | +6–8 tuần |
| **Giai đoạn 4** | Dự báo nhu cầu trên dỵ liệu thật, no-show/overbooking, sentiment nhiều nền tảng, app mobile | +8–12 tuần |
