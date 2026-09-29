import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "./components/ui/sonner";
import { StoreProvider, useStore } from "./lib/store";
import { Login } from "./components/Login";
import { PublicSite } from "./components/PublicSite";
import { Layout, PageKey, canAccess, NAV } from "./components/Layout";
import { adminHash, parseAdminHash } from "./components/admin/adminHash";
const Dashboard = lazy(() => import("./components/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const RoomCalendar = lazy(() => import("./components/pages/RoomCalendar").then((m) => ({ default: m.RoomCalendar })));
const Availability = lazy(() => import("./components/pages/Availability").then((m) => ({ default: m.Availability })));
const Bookings = lazy(() => import("./components/pages/Bookings").then((m) => ({ default: m.Bookings })));
const Customers = lazy(() => import("./components/pages/Customers").then((m) => ({ default: m.Customers })));
const Rooms = lazy(() => import("./components/pages/Rooms").then((m) => ({ default: m.Rooms })));
const Services = lazy(() => import("./components/pages/Services").then((m) => ({ default: m.Services })));
const Invoices = lazy(() => import("./components/pages/Invoices").then((m) => ({ default: m.Invoices })));
const Cashflow = lazy(() => import("./components/pages/Cashflow").then((m) => ({ default: m.Cashflow })));
const Statistics = lazy(() => import("./components/pages/Statistics").then((m) => ({ default: m.Statistics })));
const AIAssistant = lazy(() => import("./components/pages/AIAssistant").then((m) => ({ default: m.AIAssistant })));
const Requests = lazy(() => import("./components/pages/Requests").then((m) => ({ default: m.Requests })));
const BookingPortal = lazy(() => import("./components/pages/BookingPortal").then((m) => ({ default: m.BookingPortal })));
const RevenueAI = lazy(() => import("./components/pages/RevenueAI").then((m) => ({ default: m.RevenueAI })));
const Reviews = lazy(() => import("./components/pages/Reviews").then((m) => ({ default: m.Reviews })));
const Channels = lazy(() => import("./components/pages/Channels").then((m) => ({ default: m.Channels })));
const Loyalty = lazy(() => import("./components/pages/Loyalty").then((m) => ({ default: m.Loyalty })));
const Operations = lazy(() => import("./components/pages/Operations").then((m) => ({ default: m.Operations })));
const Profile = lazy(() => import("./components/pages/Profile").then((m) => ({ default: m.Profile })));
import { ErrorBoundary } from "./components/ErrorBoundary";
import { I18nProvider } from "./lib/i18n";

const TITLES: Record<PageKey, { title: string; subtitle: string }> = {
  dashboard: { title: "Ca hôm nay", subtitle: "Nhận · trả · dọn · walk-in — việc lễ tân phải xong trong ca" },
  portal: { title: "Cổng đặt phòng", subtitle: "Bản sao trang khách (ẩn khỏi menu)" },
  requests: { title: "Yêu cầu web", subtitle: "Duyệt đặt từ website trước khi giữ phòng" },
  calendar: { title: "Lịch phòng", subtitle: "Ai ở phòng nào, ngày nào" },
  availability: { title: "Walk-in / phòng trống", subtitle: "Tìm phòng theo ngày rồi đặt ngay tại quầy" },
  bookings: { title: "Đặt phòng", subtitle: "Quản lý đặt / nhận / trả / hủy phòng" },
  customers: { title: "Khách hàng", subtitle: "Hồ sơ & lịch sử lưu trú" },
  rooms: { title: "Phòng & Loại phòng", subtitle: "Cấu hình phòng, giá, tiện ích" },
  services: { title: "Dịch vụ", subtitle: "Dịch vụ phát sinh & doanh thu" },
  invoices: { title: "Hóa đơn", subtitle: "Lập hóa đơn & theo dõi thanh toán" },
  cashflow: { title: "Dòng tiền +", subtitle: "Sao kê tiền vào — khách nào vừa chuyển, khớp COC BK-xxxx" },
  stats: { title: "Báo cáo", subtitle: "Công suất, doanh thu theo tuần/tháng — xuất khi cần" },
  ai: { title: "Trợ lý AI", subtitle: "Tư vấn phòng, soạn email, phân tích công suất" },
  revenue: { title: "Doanh thu & Giá AI", subtitle: "Dự báo nhu cầu, đề xuất giá, rủi ro no-show" },
  reviews: { title: "Đánh giá khách", subtitle: "Phân tích cảm xúc & cảnh báo chất lượng" },
  channels: { title: "Kênh & OTA", subtitle: "Phân bổ phòng, hoa hồng và đối soát doanh thu" },
  loyalty: { title: "Khách thân thiết", subtitle: "Hạng thành viên, tích điểm và đổi điểm" },
  ops: { title: "Vận hành & Sao lưu", subtitle: "Nhật ký, hiệu năng, email/SMS, sao lưu dữ liệu" },
  profile: { title: "Tài khoản của tôi", subtitle: "Ảnh đại diện, thông tin liên hệ và mật khẩu" },
};

function Shell() {
  const { currentUser } = useStore();
  const [page, setPage] = useState<PageKey>("dashboard");
  // Khách (chưa đăng nhập) vào thẳng cổng đặt phòng công khai;
  // chỉ mở form đăng nhập khi bấm nút "Đăng nhập" (dành cho nhân viên).
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (!currentUser || currentUser.role === "guest") return;
    const from = parseAdminHash(window.location.hash);
    if (from && canAccess(from, currentUser.role)) setPage(from);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.role === "guest") return;
    const next = adminHash(page);
    if (window.location.hash !== next) history.replaceState(null, "", next);
  }, [page, currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.role === "guest") return;
    const onHash = () => {
      const from = parseAdminHash(window.location.hash);
      if (from && canAccess(from, currentUser.role)) setPage(from);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [currentUser]);

  // Khi đổi user/role, đảm bảo trang hiện tại được phép truy cập
  useEffect(() => {
    if (currentUser && !canAccess(page, currentUser.role)) {
      const first = NAV.find((n) => n.roles.includes(currentUser.role));
      if (first) setPage(first.key);
    }
  }, [currentUser, page]);

  // Đăng nhập thành công → ẩn form login, vào thẳng khu quản trị
  useEffect(() => {
    if (currentUser) setShowLogin(false);
  }, [currentUser]);

  // Khách vãng lai hoặc tài khoản khách (role "guest") → trang công khai;
  // chỉ nhân viên (admin / lễ tân / kế toán) mới vào khu quản trị.
  // Nhân viên truy cập trang đăng nhập bằng URL: #/staff-login
  const isStaff = !!currentUser && currentUser.role !== "guest";

  // Nhận diện hash #/staff-login để mở trang đăng nhập nội bộ
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, "").split("?")[0].replace(/\/$/, "");
      if (hash === "staff-login" && !isStaff) {
        setShowLogin(true);
      }
    };
    onHash(); // Kiểm tra khi mount
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [isStaff]);

  if (!isStaff) {
    if (showLogin) return <Login onBack={() => { setShowLogin(false); history.replaceState(null, "", "#/"); }} />;
    return <PublicSite onStaffLogin={() => setShowLogin(true)} />;
  }

  const meta = TITLES[page];

  return (
    <Layout page={page} onNavigate={setPage} title={meta.title} subtitle={meta.subtitle}>
      {/* Mỗi trang được bọc riêng: 1 trang lỗi không làm trắng toàn hệ thống */}
      <ErrorBoundary key={page} scope={`page:${page}`}><Suspense fallback={<p role="status" style={{ padding: 24 }}>Đang tải nội dung…</p>}>
      {page === "dashboard" && <Dashboard onNavigate={setPage} />}
      {page === "portal" && <BookingPortal />}
      {page === "requests" && <Requests />}
      {page === "calendar" && <RoomCalendar />}
      {page === "availability" && <Availability />}
      {page === "bookings" && <Bookings />}
      {page === "customers" && <Customers />}
      {page === "rooms" && <Rooms />}
      {page === "services" && <Services />}
      {page === "invoices" && <Invoices />}
      {page === "cashflow" && <Cashflow />}
      {page === "stats" && <Statistics />}
      {page === "ai" && <AIAssistant />}
      {page === "revenue" && <RevenueAI />}
      {page === "reviews" && <Reviews />}
      {page === "channels" && <Channels />}
      {page === "loyalty" && <Loyalty />}
      {page === "ops" && <Operations />}
      {page === "profile" && <Profile />}
      </Suspense></ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary scope="app">
      <I18nProvider>
        <StoreProvider>
          <Shell />
          {/* Cấu hình chi tiết (tự tắt, dàn dọc, tối đa 4 cái) nằm trong components/ui/sonner.tsx */}
          <Toaster position="top-right" duration={1500} />
        </StoreProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
