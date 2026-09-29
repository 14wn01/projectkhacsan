import { ReactNode, useEffect, useState } from "react";
import {
  LayoutDashboard, CalendarDays, BedDouble, Users, ClipboardList,
  Search, ConciergeBell, Receipt, BarChart3, Bot, LogOut,
  Inbox, Globe, Bell, TrendingUp, Star, Share2, Award, ServerCog,
  IdCard, Menu, X, ChevronLeft, ChevronRight, ArrowDownToLine,
} from "lucide-react";
import { Role } from "../lib/types";
import { HOTEL_NAME, ROLE_LABELS, useStore } from "../lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Copilot } from "./Copilot";
import { CommandPalette } from "./admin/CommandPalette";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { formatDate } from "../lib/format";

export type PageKey =
  | "dashboard" | "calendar" | "rooms" | "customers" | "bookings"
  | "availability" | "services" | "invoices" | "cashflow" | "stats" | "ai"
  | "requests" | "portal"
  | "revenue" | "reviews" | "channels" | "loyalty" | "ops"
  | "profile";

interface NavItem {
  key: PageKey;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
  group: string;
  /** Không hiện trong menu trái (vào bằng đường khác, ví dụ ô tài khoản). */
  hidden?: boolean;
}

const ALL: Role[] = ["admin", "manager", "reception", "accountant"];
const OPS: Role[] = ["admin", "manager", "reception"];
const FINANCE: Role[] = ["admin", "manager", "accountant"];

export const NAV: NavItem[] = [
  { key: "dashboard", label: "Ca hôm nay", icon: LayoutDashboard, roles: ALL, group: "Ca làm" },
  { key: "requests", label: "Yêu cầu web", icon: Inbox, roles: OPS, group: "Ca làm" },
  { key: "calendar", label: "Lịch phòng", icon: CalendarDays, roles: OPS, group: "Ca làm" },
  { key: "bookings", label: "Đặt phòng", icon: ClipboardList, roles: OPS, group: "Ca làm" },
  { key: "availability", label: "Walk-in / trống", icon: Search, roles: OPS, group: "Ca làm" },
  { key: "customers", label: "Khách hàng", icon: Users, roles: OPS, group: "Khách" },
  { key: "loyalty", label: "Khách thân thiết", icon: Award, roles: ALL, group: "Khách" },
  { key: "reviews", label: "Đánh giá", icon: Star, roles: OPS, group: "Khách" },
  { key: "invoices", label: "Hóa đơn", icon: Receipt, roles: FINANCE, group: "Tài chính" },
  { key: "cashflow", label: "Dòng tiền +", icon: ArrowDownToLine, roles: ALL, group: "Tài chính" },
  { key: "stats", label: "Báo cáo", icon: BarChart3, roles: FINANCE, group: "Tài chính" },
  { key: "revenue", label: "Giá & dự báo", icon: TrendingUp, roles: ["admin", "manager"], group: "Tài chính" },
  { key: "channels", label: "Kênh & OTA", icon: Share2, roles: FINANCE, group: "Tài chính" },
  { key: "rooms", label: "Phòng & hạng", icon: BedDouble, roles: ["admin", "manager"], group: "Hệ thống" },
  { key: "services", label: "Dịch vụ", icon: ConciergeBell, roles: OPS, group: "Hệ thống" },
  { key: "ops", label: "Sao lưu & nhật ký", icon: ServerCog, roles: ["admin", "manager"], group: "Hệ thống" },
  { key: "ai", label: "Trợ lý AI", icon: Bot, roles: ALL, group: "Hệ thống" },
  // Trang khách đã có PublicSite — cổng đặt trong admin chỉ trùng, ẩn khỏi menu.
  { key: "portal", label: "Cổng đặt phòng", icon: Globe, roles: OPS, group: "Kênh khách", hidden: true },
  { key: "profile", label: "Tài khoản của tôi", icon: IdCard, roles: ALL, group: "Tài khoản", hidden: true },
];

export function canAccess(page: PageKey, role: Role) {
  return NAV.find((n) => n.key === page)?.roles.includes(role) ?? false;
}

/** Bỏ dấu tiếng Việt để tìm kiếm menu gõ không dấu vẫn ra. */
function plain(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0111/g, "d");
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.[0] ?? "?";
  const first = parts.length > 1 ? parts[0][0] : "";
  return (first + last).toUpperCase();
}

const COLLAPSE_KEY = "smh.sidebar.collapsed";

interface Props {
  page: PageKey;
  onNavigate: (p: PageKey) => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function Layout({ page, onNavigate, title, subtitle, actions, children }: Props) {
  const { currentUser, logout, bookings, auditLog, bankInflows } = useStore();
  const role = currentUser!.role;

  // Trạng thái thu gọn được nhớ lại giữa các phiên làm việc.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch { /* bỏ qua */ }
  }, [collapsed]);

  // Phím tắt: Ctrl/Cmd + B thu gọn — Esc đóng menu trên điện thoại.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Đổi trang → tự đóng menu tràn trên điện thoại.
  useEffect(() => { setMobileOpen(false); }, [page]);

  const visible = NAV.filter((n) => !n.hidden && n.roles.includes(role));
  const q = plain(query.trim());
  const items = q ? visible.filter((n) => plain(n.label).includes(q) || plain(n.group).includes(q)) : visible;
  const groups = Array.from(new Set(items.map((n) => n.group)));
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const inflowOpen = bankInflows.filter((x) => x.match === "unmatched" || x.match === "amount_mismatch").length;
  const canSeeRequests = visible.some((n) => n.key === "requests");
  const current = NAV.find((n) => n.key === page);
  const today = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  const onProfile = page === "profile";

  const railBtn = (active: boolean) =>
    `group relative flex w-full items-center rounded-xl text-sm transition-colors ${
      collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
    } ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`;

  return (
    <div className="admin-shell flex h-screen w-full overflow-hidden">
      {/* Lớp phủ khi mở menu trên điện thoại */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside
        className={`admin-sidebar fixed inset-y-0 left-0 z-50 flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 ease-out md:static md:translate-x-0 ${
          collapsed ? "w-[76px]" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="pointer-events-none absolute -top-20 -left-16 size-64 rounded-full bg-white/5 blur-3xl" />

        {/* Thương hiệu + nút thu gọn */}
        <div className={`relative flex h-16 shrink-0 items-center border-b border-sidebar-border text-[#f7f1e5] ${collapsed ? "justify-center px-2" : "gap-3 px-4"}`}>
          <div className="admin-brand-mark shrink-0" aria-hidden>SM</div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold leading-tight tracking-wide">{HOTEL_NAME}</div>
              <div className="text-[11px] uppercase tracking-[0.18em] opacity-55">Vận hành</div>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="Thu gọn menu (Ctrl + B)"
              className="hidden size-8 shrink-0 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white md:grid"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white md:hidden"
            title="Đóng menu"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Mở rộng lại khi đang thu gọn */}
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="Mở rộng menu (Ctrl + B)"
            className="admin-tip relative mx-auto mt-3 hidden size-9 place-items-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white md:grid"
            data-tip="Mở rộng menu"
          >
            <ChevronRight className="size-4" />
          </button>
        )}

        {/* Tìm nhanh trong menu */}
        {!collapsed && (
          <div className="relative px-3 pt-3">
            <Search className="pointer-events-none absolute left-6 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm chức năng…"
              autoComplete="off"
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-sm text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none"
            />
          </div>
        )}

        {/* Danh sách chức năng */}
        <nav className="admin-scroll relative flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.length === 0 && (
            <p className="px-2 text-xs text-white/40">Không tìm thấy chức năng phù hợp.</p>
          )}
          {groups.map((g) => (
            <div key={g}>
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
              ) : (
                <div className="mb-1.5 px-3 text-[11px] uppercase tracking-wider opacity-40">{g}</div>
              )}
              <div className="space-y-1">
                {items.filter((n) => n.group === g).map((n) => {
                  const Icon = n.icon;
                  const active = n.key === page;
                  const badgeCount = n.key === "requests" ? pendingCount : n.key === "cashflow" ? inflowOpen : 0;
                  const badge = badgeCount > 0;
                  return (
                    <button
                      key={n.key}
                      onClick={() => onNavigate(n.key)}
                      title={collapsed ? n.label : undefined}
                      data-tip={n.label}
                      className={`${railBtn(active)} ${collapsed ? "admin-tip" : ""}`}
                    >
                      {active && <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-[#c4a574]" />}
                      <span className="relative shrink-0">
                        <Icon className={`size-4 transition-transform group-hover:scale-110 ${active ? "" : "opacity-70"}`} />
                        {badge && collapsed && (
                          <span className="absolute -right-1.5 -top-1.5 size-2 rounded-full bg-amber-400 ring-2 ring-sidebar" />
                        )}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate text-left">{n.label}</span>
                          {badge && (
                            <span className="ml-auto inline-grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-medium text-black">
                              {badgeCount}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Ô tài khoản góc dưới — bấm vào mở trang Hồ sơ */}
        <div className="relative shrink-0 border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={() => onNavigate("profile")}
            title={collapsed ? "Tài khoản của tôi" : undefined}
            data-tip="Tài khoản của tôi"
            className={`flex w-full items-center rounded-xl transition-colors ${collapsed ? "admin-tip justify-center p-1.5" : "gap-3 px-3 py-2.5"} ${
              onProfile ? "bg-white/15 ring-1 ring-white/20" : "bg-white/5 hover:bg-white/10"
            }`}
          >
            <Avatar className={`size-9 shrink-0 ring-2 ${onProfile ? "ring-white/60" : "ring-white/20"}`}>
              {currentUser!.avatar && <AvatarImage src={currentUser!.avatar} alt={currentUser!.name} />}
              <AvatarFallback className="bg-white text-sidebar">{initials(currentUser!.name)}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm text-white">{currentUser!.name}</span>
                  <span className="block truncate text-xs opacity-60">{currentUser!.jobTitle || ROLE_LABELS[role]}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 opacity-50" />
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ================= KHU NỘI DUNG ================= */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#fcfaf7]">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#e3ddd2] bg-[#fcfaf7]/92 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-muted md:hidden"
              title="Mở menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              {current && (
                <div className="hidden items-center gap-1 text-[11px] text-muted-foreground md:flex">
                  <span>{current.group}</span>
                  <ChevronRight className="size-3" />
                  <span className="text-foreground">{current.label}</span>
                </div>
              )}
              <h2 className="truncate leading-tight">{title}</h2>
              <p className="truncate text-xs capitalize text-muted-foreground md:hidden">{subtitle ? subtitle : today}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              title="Tìm nhanh (Ctrl + K)"
              className="hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted md:inline-flex"
            >
              <Search className="size-3.5" /> Tìm BK, SĐT…
              <kbd className="rounded border px-1 text-[10px]">⌘K</kbd>
            </button>
            {actions}
            {canAccess("ops", role) && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    title="Thông báo & Lịch sử thao tác"
                    className="relative grid size-9 place-items-center rounded-full transition-colors hover:bg-muted"
                  >
                    <Bell className="size-5" />
                    {auditLog.length > 0 && (
                      <span className="absolute right-1 top-1 size-2 rounded-full bg-[#8a6d33]" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="border-b px-4 py-3">
                    <h3 className="font-medium">Lịch sử hoạt động</h3>
                  </div>
                  <div className="flex max-h-96 flex-col overflow-y-auto">
                    {auditLog.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">Chưa có hoạt động nào</div>
                    ) : (
                      auditLog.slice().reverse().slice(0, 15).map((log) => (
                        <div key={log.id} className="border-b px-4 py-3 text-sm last:border-0 hover:bg-muted/50">
                          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{log.actor}</span>
                            <span>{new Date(log.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <div className="font-medium text-[#1c1917]">{log.action}</div>
                          {log.target && <div className="mt-0.5 text-[#3a3531]">Đối tượng: {log.target}</div>}
                          {log.detail && <div className="mt-0.5 text-xs text-[#6e675e]">{log.detail}</div>}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t p-2">
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => onNavigate("ops")}>
                      Xem tất cả trong Quản trị hệ thống
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
      
            <span className="hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-foreground lg:inline-flex">
              <span className="size-1.5 animate-pulse rounded-full bg-foreground" /> {ROLE_LABELS[role]}
            </span>
            <button
              type="button"
              onClick={() => onNavigate("profile")}
              title="Tài khoản của tôi"
              className={`grid place-items-center rounded-full transition-shadow md:hidden ${onProfile ? "ring-2 ring-foreground" : ""}`}
            >
              <Avatar className="size-8">
                {currentUser!.avatar && <AvatarImage src={currentUser!.avatar} alt={currentUser!.name} />}
                <AvatarFallback className="bg-foreground text-background text-xs">{initials(currentUser!.name)}</AvatarFallback>
              </Avatar>
            </button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" /> <span className="hidden sm:inline">Đăng xuất</span>
            </Button>
          </div>
        </header>

        <main className="admin-main admin-scroll flex-1 overflow-y-auto bg-[#fcfaf7] p-4 md:p-6">
          <div key={page} className="admin-page mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onNavigate={onNavigate} />
      <Copilot onNavigate={(p) => onNavigate(p as PageKey)} />
    </div>
  );
}
