-- =====================================================================
-- Khách sạn Sao Mai — Khởi tạo Database + Dữ liệu đầy đủ
-- Chạy trong Supabase Dashboard > SQL Editor > New Query > Dán vào > Run
-- =====================================================================

-- ═══════════════════════════════════════════════════════════════════════
-- PHẦN 1: XÓA BẢNG CŨ (tránh lỗi trùng)
-- ═══════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.booking_services CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.room_types CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- ═══════════════════════════════════════════════════════════════════════
-- PHẦN 2: TẠO BẢNG
-- ═══════════════════════════════════════════════════════════════════════

-- Bảng Customers (Khách hàng)
CREATE TABLE public.customers (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "idNumber" TEXT,
    "address" TEXT,
    "nationality" TEXT,
    "dob" DATE,
    "preferences" JSONB DEFAULT '[]'::JSONB,
    "consentAt" TIMESTAMP WITH TIME ZONE,
    "marketingOptIn" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bảng Users (Nhân viên / Tài khoản khách)
CREATE TABLE public.users (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL, 
    "role" TEXT NOT NULL DEFAULT 'guest',
    "phone" TEXT,
    "email" TEXT,
    "customerId" TEXT REFERENCES public.customers("id") ON DELETE SET NULL,
    "avatar" TEXT,
    "jobTitle" TEXT
);

-- Bảng Room Types (Hạng phòng)
CREATE TABLE public.room_types (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "amenities" JSONB DEFAULT '[]'::JSONB,
    "description" TEXT,
    "image" TEXT,
    "size" INTEGER
);

-- Bảng Rooms (Phòng vật lý)
CREATE TABLE public.rooms (
    "id" TEXT PRIMARY KEY,
    "number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "typeId" TEXT NOT NULL REFERENCES public.room_types("id") ON DELETE RESTRICT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "note" TEXT
);

-- Bảng Bookings (Đặt phòng)
CREATE TABLE public.bookings (
    "id" TEXT PRIMARY KEY,
    "code" TEXT UNIQUE NOT NULL,
    "roomId" TEXT NOT NULL REFERENCES public.rooms("id") ON DELETE RESTRICT,
    "customerId" TEXT NOT NULL REFERENCES public.customers("id") ON DELETE RESTRICT,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "roomPricePerNight" INTEGER NOT NULL,
    "source" TEXT,
    "note" TEXT,
    "depositPercent" NUMERIC(5, 2),
    "depositAmount" INTEGER,
    "depositPaid" BOOLEAN DEFAULT FALSE,
    "depositPaidAt" TIMESTAMP WITH TIME ZONE,
    "channelRef" TEXT,
    "channelCommission" NUMERIC(5, 2),
    "noShowRisk" NUMERIC(3, 2),
    "cancelReason" TEXT,
    "holdId" TEXT,
    "noShow" BOOLEAN DEFAULT FALSE,
    "reviewedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "version" INTEGER DEFAULT 1
);

-- Bảng Booking Services (Dịch vụ phát sinh)
CREATE TABLE public.booking_services (
    "id" TEXT PRIMARY KEY,
    "bookingId" TEXT NOT NULL REFERENCES public.bookings("id") ON DELETE CASCADE,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "date" DATE NOT NULL
);

-- Bảng Invoices (Hóa đơn)
CREATE TABLE public.invoices (
    "id" TEXT PRIMARY KEY,
    "code" TEXT UNIQUE NOT NULL,
    "bookingId" TEXT NOT NULL REFERENCES public.bookings("id") ON DELETE RESTRICT,
    "issuedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "roomTotal" INTEGER NOT NULL DEFAULT 0,
    "serviceTotal" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "eInvoiceNo" TEXT,
    "eInvoiceIssuedAt" TIMESTAMP WITH TIME ZONE,
    "taxRate" NUMERIC(5, 2),
    "pointsRedeemed" INTEGER DEFAULT 0
);

-- Bảng Payments (Thanh toán)
CREATE TABLE public.payments (
    "id" TEXT PRIMARY KEY,
    "bookingId" TEXT NOT NULL REFERENCES public.bookings("id") ON DELETE RESTRICT,
    "invoiceId" TEXT REFERENCES public.invoices("id") ON DELETE SET NULL,
    "method" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "gatewayRef" TEXT,
    "failureReason" TEXT,
    "recordedBy" TEXT,
    "cardLast4" TEXT,
    "transferContent" TEXT,
    "payerNote" TEXT,
    "completedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- PHẦN 3: CHÈN DỮ LIỆU MẪU ĐẦY ĐỦ
-- ═══════════════════════════════════════════════════════════════════════

-- 3.1 Khách hàng (5 khách)
INSERT INTO public.customers ("id", "name", "phone", "email", "idNumber", "address", "createdAt") VALUES
  ('c1', 'Phạm Văn An',     '0901234567', 'an.pham@email.com',    '0123456789', 'Hà Nội',    NOW() - INTERVAL '40 days'),
  ('c2', 'Nguyễn Thị Bình', '0912345678', 'binh.nguyen@email.com','0223456789', 'TP.HCM',    NOW() - INTERVAL '30 days'),
  ('c3', 'Trần Minh Châu',  '0923456789', 'chau.tran@email.com',  '0323456789', 'Đà Nẵng',   NOW() - INTERVAL '20 days'),
  ('c4', 'Lê Hoàng Dũng',   '0934567890', 'dung.le@email.com',    '0423456789', 'Hải Phòng',  NOW() - INTERVAL '10 days'),
  ('c5', 'Võ Thị Em',       '0945678901', 'em.vo@email.com',      '0523456789', 'Cần Thơ',    NOW() - INTERVAL '5 days');

-- 3.2 Tài khoản nhân viên + khách (4 tài khoản)
INSERT INTO public.users ("id", "name", "username", "password", "role", "phone", "email", "customerId") VALUES
  ('u1', 'Nguyễn Quản Trị', 'admin',      'admin123',   'admin',      NULL,          NULL,                    NULL),
  ('u2', 'Trần Lễ Tân',     'letan',      'letan123',   'reception',  NULL,          NULL,                    NULL),
  ('u3', 'Lê Kế Toán',      'ketoan',     'ketoan123',  'accountant', NULL,          NULL,                    NULL),
  ('u4', 'Phạm Văn An',     '0901234567', '12345678',   'guest',      '0901234567',  'an.pham@email.com',     'c1');

-- 3.3 Hạng phòng (6 loại)
INSERT INTO public.room_types ("id", "name", "basePrice", "capacity", "amenities", "description", "image", "size") VALUES
  ('rt1', 'Garden Pavilion',    6800000,  2, '["Wifi","Điều hòa","TV","Tủ lạnh mini"]'::JSONB,
    'Một giường. Ban công vườn. Yên, gọn, đủ cho hai người muốn tách khỏi sảnh.',
    '/media/room-garden.webp', 28),
  ('rt2', 'Ocean Suite',        9500000,  3, '["Wifi","Điều hòa","TV","Minibar","Ban công","Bồn tắm"]'::JSONB,
    'View biển. Ban công rộng. Ánh sáng vào phòng suốt ngày.',
    '/media/room-deluxe.webp', 38),
  ('rt3', 'Horizon Suite',      16500000, 4, '["Wifi","Điều hòa","Smart TV","Minibar","Phòng khách","Bồn tắm","Bếp nhỏ"]'::JSONB,
    'Suite nhìn chân trời. Bồn tắm. Chỗ làm việc kín. Ở lâu được.',
    '/media/room-suite.webp', 65),
  ('rt4', 'Family Villa',       12800000, 4, '["Wifi","Điều hòa","Smart TV","2 Giường đôi","Ban công"]'::JSONB,
    'Hai không gian ngủ. Bếp nhỏ. Cho gia đình muốn ở như nhà, không như khách sạn.',
    '/media/room-family.webp', 52),
  ('rt5', 'Sky Residence',      28000000, 6, '["Wifi","Điều hòa trung tâm","Smart TV 75 inch","Bể bơi riêng","Bếp lớn"]'::JSONB,
    'Nhiều tầng trong một căn. Hồ / view rộng. Bếp. Cho nhóm nhỏ hoặc ở dài ngày.',
    '/media/room-penthouse.webp', 120),
  ('rt6', 'Sao Mai Residence',  45000000, 4, '["Bảo vệ riêng","Xe đưa đón","Bể bơi vô cực","Phòng họp","Butler"]'::JSONB,
    'Căn lớn nhất. Check-in riêng. Butler. Đặt trực tiếp với concierge.',
    '/media/room-presidential.webp', 160);

-- 3.4 Phòng vật lý (13 phòng)
INSERT INTO public.rooms ("id", "number", "floor", "typeId", "status") VALUES
  ('r101', '101', 1, 'rt1', 'available'),
  ('r102', '102', 1, 'rt1', 'occupied'),
  ('r103', '103', 1, 'rt1', 'cleaning'),
  ('r104', '104', 1, 'rt1', 'available'),
  ('r201', '201', 2, 'rt2', 'available'),
  ('r202', '202', 2, 'rt2', 'occupied'),
  ('r203', '203', 2, 'rt2', 'available'),
  ('r204', '204', 2, 'rt2', 'maintenance'),
  ('r301', '301', 3, 'rt3', 'available'),
  ('r302', '302', 3, 'rt3', 'available'),
  ('r401', '401', 4, 'rt4', 'available'),
  ('r501', '501', 5, 'rt5', 'available'),
  ('r601', '601', 6, 'rt6', 'available');

-- 3.5 Đặt phòng (7 booking)
INSERT INTO public.bookings ("id", "code", "roomId", "customerId", "checkIn", "checkOut", "guests", "status", "roomPricePerNight", "source", "note", "createdAt") VALUES
  ('b1', 'BK-1001', 'r102', 'c1',
    CURRENT_DATE - 1, CURRENT_DATE + 2, 2, 'checked_in', 500000,
    NULL, NULL, NOW() - INTERVAL '3 days'),
  ('b2', 'BK-1002', 'r202', 'c2',
    CURRENT_DATE, CURRENT_DATE + 3, 2, 'checked_in', 850000,
    NULL, NULL, NOW() - INTERVAL '2 days'),
  ('b3', 'BK-1003', 'r301', 'c3',
    CURRENT_DATE + 2, CURRENT_DATE + 5, 4, 'reserved', 1500000,
    NULL, NULL, NOW() - INTERVAL '1 day'),
  ('b4', 'BK-1004', 'r201', 'c4',
    CURRENT_DATE + 4, CURRENT_DATE + 6, 3, 'reserved', 850000,
    NULL, NULL, NOW()),
  ('b5', 'BK-1005', 'r101', 'c5',
    CURRENT_DATE - 5, CURRENT_DATE - 2, 2, 'checked_out', 500000,
    NULL, NULL, NOW() - INTERVAL '7 days'),
  ('b6', 'BK-1006', 'r302', 'c2',
    CURRENT_DATE + 3, CURRENT_DATE + 6, 4, 'pending', 1500000,
    'website', 'Kỷ niệm ngày cưới, mong được trang trí phòng.', NOW()),
  ('b7', 'BK-1007', 'r203', 'c3',
    CURRENT_DATE + 1, CURRENT_DATE + 2, 2, 'pending', 850000,
    'ota', NULL, NOW());

-- 3.6 Dịch vụ phát sinh (2 dịch vụ cho booking b1 và b5)
INSERT INTO public.booking_services ("id", "bookingId", "serviceId", "name", "price", "qty", "date") VALUES
  ('bs1', 'b1', 's2', 'Bữa sáng',       80000,  4, CURRENT_DATE),
  ('bs2', 'b5', 's1', 'Giặt là (kg)',    40000,  3, CURRENT_DATE - 3),
  ('bs3', 'b2', 's4', 'Đưa đón sân bay', 350000, 1, CURRENT_DATE);

-- 3.7 Hóa đơn (2 hóa đơn)
-- Hóa đơn cho b5: 3 đêm × 500.000 = 1.500.000 + giặt là 120.000 = 1.620.000 (đã thanh toán đủ)
INSERT INTO public.invoices ("id", "code", "bookingId", "issuedAt", "roomTotal", "serviceTotal", "discount", "total", "paid", "status") VALUES
  ('inv1', 'HD-1005', 'b5', CURRENT_DATE - 2, 1500000, 120000, 0, 1620000, 1620000, 'paid'),
  ('inv2', 'HD-1001', 'b1', CURRENT_DATE + 2, 1500000, 320000, 0, 1820000, 500000,  'partial');

-- 3.8 Thanh toán (2 khoản)
INSERT INTO public.payments ("id", "bookingId", "invoiceId", "method", "purpose", "amount", "state", "recordedBy", "completedAt", "createdAt") VALUES
  ('pay1', 'b5', 'inv1', 'cash',     'full',    1620000, 'completed', 'Trần Lễ Tân', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('pay2', 'b1', 'inv2', 'transfer', 'deposit', 500000,  'completed', 'Trần Lễ Tân', NOW() - INTERVAL '1 day',  NOW() - INTERVAL '1 day');

-- ═══════════════════════════════════════════════════════════════════════
-- PHẦN 4: BẬT ROW LEVEL SECURITY + CHO PHÉP TẤT CẢ TRUY CẬP
-- (Dùng service_role key nên không bị chặn, nhưng cần policy cho anon key)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_types     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments       ENABLE ROW LEVEL SECURITY;

-- Policy: cho phép đọc/ghi tất cả (vì app dùng service_role key)
-- Nếu sau này chuyển sang anon key, cần viết policy chi tiết hơn.
CREATE POLICY "Allow all for service role" ON public.customers      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.users          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.room_types     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.rooms          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.bookings       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.booking_services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.invoices       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.payments       FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- PHẦN 5: KIỂM TRA DỮ LIỆU
-- ═══════════════════════════════════════════════════════════════════════

SELECT 'customers'        AS "Bảng", COUNT(*) AS "Số bản ghi" FROM public.customers
UNION ALL
SELECT 'users',            COUNT(*) FROM public.users
UNION ALL
SELECT 'room_types',       COUNT(*) FROM public.room_types
UNION ALL
SELECT 'rooms',            COUNT(*) FROM public.rooms
UNION ALL
SELECT 'bookings',         COUNT(*) FROM public.bookings
UNION ALL
SELECT 'booking_services', COUNT(*) FROM public.booking_services
UNION ALL
SELECT 'invoices',         COUNT(*) FROM public.invoices
UNION ALL
SELECT 'payments',         COUNT(*) FROM public.payments;
