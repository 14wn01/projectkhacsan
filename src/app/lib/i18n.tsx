/**
 * ĐA NGÔN NGỮ (i18n) — Tiếng Việt + English
 *
 * Thiết kế tối giản, không phụ thuộc thư viện ngoài:
 *  - `t("key")` tra cứu theo ngôn ngữ hiện tại
 *  - Thiếu bản dịch → fallback tiếng Việt → fallback chính key (không bao giờ vỡ UI)
 *  - Hỗ trợ tham số: t("nights_count", { n: 3 })
 *  - Ghi nhận lụa chọn vào localStorage
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "vi" | "en";

const LANG_KEY = "smh.lang";

type Dict = Record<string, string>;

const vi: Dict = {
  // chung
  "common.book_now": "Đặt phòng",
  "common.search": "Tìm",
  "common.cancel": "Hủy",
  "common.confirm": "Xác nhận",
  "common.close": "Đóng",
  "common.save": "Lưu",
  "common.login": "Đăng nhập",
  "common.logout": "Thoát",
  "common.register": "Đăng ký",
  "common.guests": "Số khách",
  "common.nights": "đêm",
  "common.per_night": "/ đêm",
  "common.check_in": "Nhận phòng",
  "common.check_out": "Trả phòng",
  "common.total": "Tổng",
  "common.loading": "Đang tải…",
  "common.retry": "Thử lại",
  "common.optional": "không bắt buộc",

  // trang khách
  "guest.hero.badge": "Một khoảng trời riêng",
  "guest.hero.title": "Một khoảng trời riêng.",
  "guest.hero.subtitle":
    "Sao Mai không phải nơi nghỉ đông người. 13 residences — mỗi căn là một khoảng trời riêng.",
  "guest.nav.rooms": "Residences",
  "guest.nav.services": "Dịch vụ",
  "guest.nav.contact": "Liên hệ",
  "guest.nav.my_bookings": "Đặt phòng của tôi",
  "guest.rooms.title": "Residences",
  "guest.rooms.sold_out": "Hết chỗ",
  "guest.rooms.left": "13 residences",
  "guest.rooms.capacity": "Tối đa {n} khách",
  "guest.services.title": "Dịch vụ đi kèm",
  "guest.reviews.title": "Sao Mai",
  "guest.cta.title": "Đặt residences",
  "guest.deposit.title": "Đặt cọc giữ phòng",
  "guest.deposit.hold_note": "Phòng được giữ {min} phút để bạn hoàn tất đặt cọc.",
  "guest.legal.privacy": "Chính sách bảo mật",
  "guest.legal.cancellation": "Chính sách hủy phòng",
  "guest.legal.terms": "Điều khoản sử dụng",

  // điều hướng quản trị
  "nav.dashboard": "Tổng quan",
  "nav.portal": "Cổng đặt phòng",
  "nav.requests": "Yêu cầu đặt phòng",
  "nav.calendar": "Lịch phòng",
  "nav.availability": "Tra phòng trống",
  "nav.bookings": "Đặt phòng",
  "nav.customers": "Khách hàng",
  "nav.rooms": "Phòng & Loại phòng",
  "nav.services": "Dịch vụ",
  "nav.invoices": "Hóa đơn",
  "nav.stats": "Thống kê",
  "nav.ai": "Trợ lý AI",
  "nav.revenue": "Quản trị doanh thu",
  "nav.reviews": "Đánh giá khách",
  "nav.channels": "Kênh OTA",
  "nav.loyalty": "Khách thân thiết",
  "nav.ops": "Vận hành hệ thống",

  // AI
  "ai.fallback_notice": "AI có thể sai — luôn kiểm tra trước khi áp dụng.",
  "ai.confidence": "Độ tin cậy",
  "ai.apply": "Áp dụng",
  "ai.override": "Chỉnh thủ công",
};

const en: Dict = {
  "common.book_now": "Book now",
  "common.search": "Search",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.close": "Close",
  "common.save": "Save",
  "common.login": "Sign in",
  "common.logout": "Sign out",
  "common.register": "Sign up",
  "common.guests": "Guests",
  "common.nights": "nights",
  "common.per_night": "/ night",
  "common.check_in": "Check-in",
  "common.check_out": "Check-out",
  "common.total": "Total",
  "common.loading": "Loading…",
  "common.retry": "Retry",
  "common.optional": "optional",

  "guest.hero.badge": "A sky of your own",
  "guest.hero.title": "A sky of your own.",
  "guest.hero.subtitle":
    "Sao Mai is not a crowded stay. 13 residences — each one a sky of its own.",
  "guest.nav.rooms": "Residences",
  "guest.nav.services": "Services",
  "guest.nav.contact": "Contact",
  "guest.nav.my_bookings": "My bookings",
  "guest.rooms.title": "Residences",
  "guest.rooms.sold_out": "Unavailable",
  "guest.rooms.left": "13 residences",
  "guest.rooms.capacity": "Up to {n} guests",
  "guest.services.title": "Hotel services",
  "guest.reviews.title": "Sao Mai",
  "guest.cta.title": "Reserve a residence",
  "guest.deposit.title": "Deposit to hold your room",
  "guest.deposit.hold_note": "We hold this room for {min} minutes while you complete the deposit.",
  "guest.legal.privacy": "Privacy policy",
  "guest.legal.cancellation": "Cancellation policy",
  "guest.legal.terms": "Terms of service",

  "nav.dashboard": "Dashboard",
  "nav.portal": "Booking portal",
  "nav.requests": "Booking requests",
  "nav.calendar": "Room calendar",
  "nav.availability": "Availability",
  "nav.bookings": "Bookings",
  "nav.customers": "Guests",
  "nav.rooms": "Rooms & types",
  "nav.services": "Services",
  "nav.invoices": "Invoices",
  "nav.stats": "Reports",
  "nav.ai": "AI assistant",
  "nav.revenue": "Revenue management",
  "nav.reviews": "Guest reviews",
  "nav.channels": "OTA channels",
  "nav.loyalty": "Loyalty",
  "nav.ops": "System operations",

  "ai.fallback_notice": "AI can be wrong — always review before applying.",
  "ai.confidence": "Confidence",
  "ai.apply": "Apply",
  "ai.override": "Manual override",
};

const DICTS: Record<Lang, Dict> = { vi, en };

export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFunc;
  /** Định dạng tiền theo ngôn ngữ đang chọn (VND luôn giữ nguyên đơn vị) */
  formatMoney: (n: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "vi" || v === "en") return v;
    // Đoán theo trình duyệt, mặc định tiếng Việt
    return navigator.language?.toLowerCase().startsWith("en") ? "en" : "vi";
  } catch {
    return "vi";
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* không lưu được thì vẫn đổi được trong phiên */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback<TFunc>(
    (key, vars) => {
      const raw = DICTS[lang][key] ?? DICTS.vi[key] ?? key;
      return interpolate(raw, vars);
    },
    [lang],
  );

  const formatMoney = useCallback(
    (n: number) =>
      new Intl.NumberFormat(lang === "en" ? "en-US" : "vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(n || 0),
    [lang],
  );

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t, formatMoney }), [lang, setLang, t, formatMoney]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Dùng trong component. An toàn khi chưa có Provider (trả về tiếng Việt). */
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    lang: "vi",
    setLang: () => undefined,
    t: (key, vars) => interpolate(vi[key] ?? key, vars),
    formatMoney: (n) =>
      new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n || 0),
  };
}
