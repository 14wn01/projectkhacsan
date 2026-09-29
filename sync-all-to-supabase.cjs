/**
 * Script đồng bộ toàn bộ dữ liệu mẫu (seed) lên Supabase.
 * Chạy: node sync-all-to-supabase.cjs
 */
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Đọc .env
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Helper: ngày hôm nay và cộng/trừ ngày
function toISODate(d) { return d.toISOString().slice(0, 10); }
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toISODate(d);
}
function nightsBetween(a, b) {
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
}

const today = toISODate(new Date());

// ===== DỮ LIỆU =====

const customers = [
  { id: "c1", name: "Phạm Văn An", phone: "0901234567", email: "an.pham@email.com", idNumber: "0123456789", address: "Hà Nội", createdAt: addDays(today, -40) },
  { id: "c2", name: "Nguyễn Thị Bình", phone: "0912345678", email: "binh.nguyen@email.com", idNumber: "0223456789", address: "TP.HCM", createdAt: addDays(today, -30) },
  { id: "c3", name: "Trần Minh Châu", phone: "0923456789", email: "chau.tran@email.com", idNumber: "0323456789", address: "Đà Nẵng", createdAt: addDays(today, -20) },
  { id: "c4", name: "Lê Hoàng Dũng", phone: "0934567890", email: "dung.le@email.com", idNumber: "0423456789", address: "Hải Phòng", createdAt: addDays(today, -10) },
  { id: "c5", name: "Võ Thị Em", phone: "0945678901", email: "em.vo@email.com", idNumber: "0523456789", address: "Cần Thơ", createdAt: addDays(today, -5) },
];

const users = [
  { id: "u1", name: "Nguyễn Quản Trị", username: "admin", password: "admin123", role: "admin" },
  { id: "u2", name: "Trần Lễ Tân", username: "letan", password: "letan123", role: "reception" },
  { id: "u3", name: "Lê Kế Toán", username: "ketoan", password: "ketoan123", role: "accountant" },
  { id: "u4", name: "Phạm Văn An", username: "0901234567", password: "12345678", role: "guest", phone: "0901234567", email: "an.pham@email.com", customerId: "c1" },
];

const roomTypes = [
  { id: "rt1", name: "Garden Pavilion", basePrice: 6800000, capacity: 2, amenities: ["Wifi", "Điều hòa", "TV", "Tủ lạnh mini"], description: "Một giường. Ban công vườn.", image: "/media/room-garden.webp", size: 28 },
  { id: "rt2", name: "Ocean Suite", basePrice: 9500000, capacity: 3, amenities: ["Wifi", "Điều hòa", "TV", "Minibar", "Ban công", "Bồn tắm"], description: "View biển. Ban công rộng.", image: "/media/room-deluxe.webp", size: 38 },
  { id: "rt3", name: "Horizon Suite", basePrice: 16500000, capacity: 4, amenities: ["Wifi", "Điều hòa", "Smart TV", "Minibar", "Phòng khách", "Bồn tắm", "Bếp nhỏ"], description: "Suite nhìn chân trời.", image: "/media/room-suite.webp", size: 65 },
  { id: "rt4", name: "Family Villa", basePrice: 12800000, capacity: 4, amenities: ["Wifi", "Điều hòa", "Smart TV", "2 Giường đôi", "Ban công"], description: "Hai không gian ngủ.", image: "/media/room-family.webp", size: 52 },
  { id: "rt5", name: "Sky Residence", basePrice: 28000000, capacity: 6, amenities: ["Wifi", "Điều hòa trung tâm", "Smart TV 75 inch", "Bể bơi riêng", "Bếp lớn"], description: "Nhiều tầng trong một căn.", image: "/media/room-penthouse.webp", size: 120 },
  { id: "rt6", name: "Sao Mai Residence", basePrice: 45000000, capacity: 4, amenities: ["Bảo vệ riêng", "Xe đưa đón", "Bể bơi vô cực", "Phòng họp", "Butler"], description: "Căn lớn nhất. Butler.", image: "/media/room-presidential.webp", size: 160 },
];

const rooms = [
  { id: "r101", number: "101", floor: 1, typeId: "rt1", status: "available" },
  { id: "r102", number: "102", floor: 1, typeId: "rt1", status: "occupied" },
  { id: "r103", number: "103", floor: 1, typeId: "rt1", status: "cleaning" },
  { id: "r104", number: "104", floor: 1, typeId: "rt1", status: "available" },
  { id: "r201", number: "201", floor: 2, typeId: "rt2", status: "available" },
  { id: "r202", number: "202", floor: 2, typeId: "rt2", status: "occupied" },
  { id: "r203", number: "203", floor: 2, typeId: "rt2", status: "available" },
  { id: "r204", number: "204", floor: 2, typeId: "rt2", status: "maintenance" },
  { id: "r301", number: "301", floor: 3, typeId: "rt3", status: "available" },
  { id: "r302", number: "302", floor: 3, typeId: "rt3", status: "available" },
  { id: "r401", number: "401", floor: 4, typeId: "rt4", status: "available" },
  { id: "r501", number: "501", floor: 5, typeId: "rt5", status: "available" },
  { id: "r601", number: "601", floor: 6, typeId: "rt6", status: "available" },
];

const bookings = [
  {
    id: "b1", code: "BK-1001", roomId: "r102", customerId: "c1",
    checkIn: addDays(today, -1), checkOut: addDays(today, 2), guests: 2,
    status: "checked_in", roomPricePerNight: 500000,
    createdAt: addDays(today, -3),
  },
  {
    id: "b2", code: "BK-1002", roomId: "r202", customerId: "c2",
    checkIn: today, checkOut: addDays(today, 3), guests: 2,
    status: "checked_in", roomPricePerNight: 850000,
    createdAt: addDays(today, -2),
  },
  {
    id: "b3", code: "BK-1003", roomId: "r301", customerId: "c3",
    checkIn: addDays(today, 2), checkOut: addDays(today, 5), guests: 4,
    status: "reserved", roomPricePerNight: 1500000,
    createdAt: addDays(today, -1),
  },
  {
    id: "b4", code: "BK-1004", roomId: "r201", customerId: "c4",
    checkIn: addDays(today, 4), checkOut: addDays(today, 6), guests: 3,
    status: "reserved", roomPricePerNight: 850000,
    createdAt: today,
  },
  {
    id: "b5", code: "BK-1005", roomId: "r101", customerId: "c5",
    checkIn: addDays(today, -5), checkOut: addDays(today, -2), guests: 2,
    status: "checked_out", roomPricePerNight: 500000,
    createdAt: addDays(today, -7),
  },
  {
    id: "b6", code: "BK-1006", roomId: "r302", customerId: "c2",
    checkIn: addDays(today, 3), checkOut: addDays(today, 6), guests: 4,
    status: "pending", roomPricePerNight: 1500000,
    createdAt: today, source: "website",
    note: "Kỷ niệm ngày cưới, mong được trang trí phòng.",
  },
  {
    id: "b7", code: "BK-1007", roomId: "r203", customerId: "c3",
    checkIn: addDays(today, 1), checkOut: addDays(today, 2), guests: 2,
    status: "pending", roomPricePerNight: 850000,
    createdAt: today, source: "ota",
  },
];

// Tạo hóa đơn
function buildInvoice(b, id, paid) {
  const roomTotal = nightsBetween(b.checkIn, b.checkOut) * b.roomPricePerNight;
  const total = roomTotal;
  return {
    id, code: b.code.replace("BK", "HD"), bookingId: b.id,
    issuedAt: b.checkOut, roomTotal, serviceTotal: 0, discount: 0, total, paid,
    status: paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid",
  };
}

const invoices = [
  buildInvoice(bookings[4], "inv1", nightsBetween(bookings[4].checkIn, bookings[4].checkOut) * bookings[4].roomPricePerNight + 120000),
  buildInvoice(bookings[0], "inv2", 500000),
];

const payments = [
  {
    id: "pay1", bookingId: "b5", invoiceId: "inv1", method: "cash", purpose: "full",
    amount: invoices[0].paid, state: "completed",
    recordedBy: "Trần Lễ Tân", createdAt: addDays(today, -2),
    completedAt: addDays(today, -2),
  },
  {
    id: "pay2", bookingId: "b1", invoiceId: "inv2", method: "transfer", purpose: "deposit",
    amount: 500000, state: "completed",
    recordedBy: "Trần Lễ Tân", createdAt: addDays(today, -1),
    completedAt: addDays(today, -1),
  },
];

// ===== ĐỒNG BỘ =====

async function syncAll() {
  console.log('🚀 Bắt đầu đồng bộ toàn bộ dữ liệu lên Supabase...\n');

  // 1. Customers (trước vì users & bookings tham chiếu)
  console.log('📋 Customers...');
  const r1 = await supabase.from('customers').upsert(customers, { onConflict: 'id' });
  console.log(r1.error ? `   ❌ ${r1.error.message}` : `   ✅ ${customers.length} khách hàng`);

  // 2. Users (cần customers xong trước do FK customerId)
  console.log('👤 Users...');
  const r2 = await supabase.from('users').upsert(users, { onConflict: 'id' });
  console.log(r2.error ? `   ❌ ${r2.error.message}` : `   ✅ ${users.length} tài khoản`);

  // 3. Room Types
  console.log('🏷️  Room Types...');
  const r3 = await supabase.from('room_types').upsert(roomTypes, { onConflict: 'id' });
  console.log(r3.error ? `   ❌ ${r3.error.message}` : `   ✅ ${roomTypes.length} loại phòng`);

  // 4. Rooms (cần room_types xong trước do FK typeId)
  console.log('🚪 Rooms...');
  const r4 = await supabase.from('rooms').upsert(rooms, { onConflict: 'id' });
  console.log(r4.error ? `   ❌ ${r4.error.message}` : `   ✅ ${rooms.length} phòng`);

  // 5. Bookings (cần rooms + customers xong trước)
  console.log('📅 Bookings...');
  const r5 = await supabase.from('bookings').upsert(bookings, { onConflict: 'id' });
  console.log(r5.error ? `   ❌ ${r5.error.message}` : `   ✅ ${bookings.length} đặt phòng`);

  // 6. Invoices (cần bookings xong trước)
  console.log('🧾 Invoices...');
  const r6 = await supabase.from('invoices').upsert(invoices, { onConflict: 'id' });
  console.log(r6.error ? `   ❌ ${r6.error.message}` : `   ✅ ${invoices.length} hóa đơn`);

  // 7. Payments (cần bookings + invoices xong trước)
  console.log('💳 Payments...');
  const r7 = await supabase.from('payments').upsert(payments, { onConflict: 'id' });
  console.log(r7.error ? `   ❌ ${r7.error.message}` : `   ✅ ${payments.length} thanh toán`);

  console.log('\n✨ Hoàn tất! Kiểm tra Supabase Dashboard > Table Editor.');
  
  // Kiểm tra lại bằng cách đếm
  console.log('\n📊 Kiểm tra dữ liệu trong Supabase:');
  const tables = ['customers', 'users', 'room_types', 'rooms', 'bookings', 'invoices', 'payments'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('id');
    if (error) console.log(`   ${t}: ❌ ${error.message}`);
    else console.log(`   ${t}: ${data.length} bản ghi`);
  }
}

syncAll();
