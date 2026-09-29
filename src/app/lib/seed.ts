import {
  Booking,
  Customer,
  Invoice,
  Room,
  RoomType,
  ServiceCatalogItem,
  User,
} from "./types";
import { addDays, nightsBetween, toISODate } from "./format";

const today = toISODate(new Date());

export const seedUsers: User[] = [
  { id: "u1", name: "Nguyễn Quản Trị", username: "admin", password: "admin123", role: "admin" },
  { id: "u2", name: "Trần Lễ Tân", username: "letan", password: "letan", role: "reception" },
  { id: "u3", name: "Lê Kế Toán", username: "ketoan", password: "ketoan", role: "accountant" },
  // Tài khoản khách demo (đăng nhập bằng SĐT)
  { id: "u4", name: "Phạm Văn An", username: "0901234567", password: "123456", role: "guest", phone: "0901234567", email: "an.pham@email.com", customerId: "c1" },
];

export const seedRoomTypes: RoomType[] = [
  {
    id: "rt1",
    name: "Garden Pavilion",
    basePrice: 6800000,
    capacity: 2,
    amenities: ["Wifi", "Điều hòa", "TV", "Tủ lạnh mini"],
    description: "Một giường. Ban công vườn. Yên, gọn, đủ cho hai người muốn tách khỏi sảnh.",
    image: "/media/room-garden.webp",
    size: 28,
  },
  {
    id: "rt2",
    name: "Ocean Suite",
    basePrice: 9500000,
    capacity: 3,
    amenities: ["Wifi", "Điều hòa", "TV", "Minibar", "Ban công", "Bồn tắm"],
    description: "View biển. Ban công rộng. Ánh sáng vào phòng suốt ngày.",
    image: "/media/room-deluxe.webp",
    size: 38,
  },
  {
    id: "rt3",
    name: "Horizon Suite",
    basePrice: 16500000,
    capacity: 4,
    amenities: ["Wifi", "Điều hòa", "Smart TV", "Minibar", "Phòng khách", "Bồn tắm", "Bếp nhỏ"],
    description: "Suite nhìn chân trời. Bồn tắm. Chỗ làm việc kín. Ở lâu được.",
    image: "/media/room-suite.webp",
    size: 65,
  },
  {
    id: "rt4",
    name: "Family Villa",
    basePrice: 12800000,
    capacity: 4,
    amenities: ["Wifi", "Điều hòa", "Smart TV", "2 Giường đôi", "Ban công"],
    description: "Hai không gian ngủ. Bếp nhỏ. Cho gia đình muốn ở như nhà, không như khách sạn.",
    image: "/media/room-family.webp",
    size: 52,
  },
  {
    id: "rt5",
    name: "Sky Residence",
    basePrice: 28000000,
    capacity: 6,
    amenities: ["Wifi", "Điều hòa trung tâm", "Smart TV 75 inch", "Bể bơi riêng", "Bếp lớn"],
    description: "Nhiều tầng trong một căn. Hồ / view rộng. Bếp. Cho nhóm nhỏ hoặc ở dài ngày.",
    image: "/media/room-penthouse.webp",
    size: 120,
  },
  {
    id: "rt6",
    name: "Sao Mai Residence",
    basePrice: 45000000,
    capacity: 4,
    amenities: ["Bảo vệ riêng", "Xe đưa đón", "Bể bơi vô cực", "Phòng họp", "Butler"],
    description: "Căn lớn nhất. Check-in riêng. Butler. Đặt trực tiếp với concierge.",
    image: "/media/room-presidential.webp",
    size: 160,
  },
];

export const seedRooms: Room[] = [
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

export const seedCustomers: Customer[] = [
  { id: "c1", name: "Phạm Văn An", phone: "0901234567", email: "an.pham@email.com", idNumber: "0123456789", address: "Hà Nội", createdAt: addDays(today, -40) },
  { id: "c2", name: "Nguyễn Thị Bình", phone: "0912345678", email: "binh.nguyen@email.com", idNumber: "0223456789", address: "TP.HCM", createdAt: addDays(today, -30) },
  { id: "c3", name: "Trần Minh Châu", phone: "0923456789", email: "chau.tran@email.com", idNumber: "0323456789", address: "Đà Nẵng", createdAt: addDays(today, -20) },
  { id: "c4", name: "Lê Hoàng Dũng", phone: "0934567890", email: "dung.le@email.com", idNumber: "0423456789", address: "Hải Phòng", createdAt: addDays(today, -10) },
  { id: "c5", name: "Võ Thị Em", phone: "0945678901", email: "em.vo@email.com", idNumber: "0523456789", address: "Cần Thơ", createdAt: addDays(today, -5) },
];

export const seedServices: ServiceCatalogItem[] = [
  { id: "s1", name: "Giặt là (kg)", category: "laundry", price: 40000, unit: "kg" },
  { id: "s2", name: "Bữa sáng", category: "food", price: 80000, unit: "suất" },
  { id: "s3", name: "Bữa tối set menu", category: "food", price: 250000, unit: "suất" },
  { id: "s4", name: "Đưa đón sân bay", category: "transport", price: 350000, unit: "lượt" },
  { id: "s5", name: "Thuê xe máy", category: "transport", price: 150000, unit: "ngày" },
  { id: "s6", name: "Nước uống minibar", category: "other", price: 30000, unit: "chai" },
];

export const seedBookings: Booking[] = [
  {
    id: "b1", code: "BK-1001", roomId: "r102", customerId: "c1",
    checkIn: addDays(today, -1), checkOut: addDays(today, 2), guests: 2,
    status: "checked_in", roomPricePerNight: 500000,
    services: [{ serviceId: "s2", name: "Bữa sáng", price: 80000, qty: 4, date: today }],
    createdAt: addDays(today, -3),
  },
  {
    id: "b2", code: "BK-1002", roomId: "r202", customerId: "c2",
    checkIn: today, checkOut: addDays(today, 3), guests: 2,
    status: "checked_in", roomPricePerNight: 850000,
    services: [{ serviceId: "s4", name: "Đưa đón sân bay", price: 350000, qty: 1, date: today }],
    createdAt: addDays(today, -2),
  },
  {
    id: "b3", code: "BK-1003", roomId: "r301", customerId: "c3",
    checkIn: addDays(today, 2), checkOut: addDays(today, 5), guests: 4,
    status: "reserved", roomPricePerNight: 1500000,
    services: [], createdAt: addDays(today, -1),
  },
  {
    id: "b4", code: "BK-1004", roomId: "r201", customerId: "c4",
    checkIn: addDays(today, 4), checkOut: addDays(today, 6), guests: 3,
    status: "reserved", roomPricePerNight: 850000,
    services: [], createdAt: today,
  },
  {
    id: "b5", code: "BK-1005", roomId: "r101", customerId: "c5",
    checkIn: addDays(today, -5), checkOut: addDays(today, -2), guests: 2,
    status: "checked_out", roomPricePerNight: 500000,
    services: [{ serviceId: "s1", name: "Giặt là (kg)", price: 40000, qty: 3, date: addDays(today, -3) }],
    createdAt: addDays(today, -7),
  },
  {
    id: "b6", code: "BK-1006", roomId: "r302", customerId: "c2",
    checkIn: addDays(today, 3), checkOut: addDays(today, 6), guests: 4,
    status: "pending", roomPricePerNight: 1500000,
    services: [], createdAt: addDays(today, 0), source: "website",
    note: "Kỷ niệm ngày cưới, mong được trang trí phòng.",
  },
  {
    id: "b7", code: "BK-1007", roomId: "r203", customerId: "c3",
    checkIn: addDays(today, 1), checkOut: addDays(today, 2), guests: 2,
    status: "pending", roomPricePerNight: 850000,
    services: [], createdAt: addDays(today, 0), source: "ota",
  },
];

function buildInvoice(b: Booking, id: string, paid: number): Invoice {
  const roomTotal = nightsBetween(b.checkIn, b.checkOut) * b.roomPricePerNight;
  const serviceTotal = b.services.reduce((s, x) => s + x.price * x.qty, 0);
  const total = roomTotal + serviceTotal;
  return {
    id, code: b.code.replace("BK", "HD"), bookingId: b.id,
    issuedAt: b.checkOut, roomTotal, serviceTotal, discount: 0, total, paid,
    status: paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid",
  };
}

export const seedInvoices: Invoice[] = [
  buildInvoice(
    seedBookings[4],
    "inv1",
    nightsBetween(seedBookings[4].checkIn, seedBookings[4].checkOut) * seedBookings[4].roomPricePerNight + 120000,
  ),
  buildInvoice(seedBookings[0], "inv2", 500000),
];
