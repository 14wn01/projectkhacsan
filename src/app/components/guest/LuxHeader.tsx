import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { UserRound, Menu, X } from "lucide-react";
import { trapTab } from "../../lib/a11y";

export type LuxNavItem = {
  id: string;
  label: string;
  onSelect: () => void;
  active?: boolean;
};

type AccountAction = {
  id: string;
  label: string;
  onSelect: () => void;
};

/**
 * Header hideaway: trong suốt khi nằm trên ảnh hero, chuyển nền mờ đục
 * khi cuộn xuống, kèm menu tràn màn hình cho mobile.
 *
 * Một CTA duy nhất: Đặt Residences. Tài khoản là icon/chữ mảnh — click mới mở menu.
 */
export function LuxHeader({
  hotelName,
  nav,
  overHero = false,
  isGuest = false,
  userName,
  onHome,
  onBook,
  onLogin,
  onLogout,
  onRegister,
  onMyBookings,
  onAccount,
  languageSwitcher,
}: {
  hotelName: string;
  nav: LuxNavItem[];
  /** True khi header đang đặt chồng lên ảnh hero (trang chủ). */
  overHero?: boolean;
  isGuest?: boolean;
  userName?: string;
  onHome: () => void;
  onBook: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onRegister?: () => void;
  onMyBookings?: () => void;
  onAccount?: () => void;
  languageSwitcher?: ReactNode;
}) {
  const [solid, setSolid] = useState(!overHero);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountBtnRef = useRef<HTMLButtonElement>(null);
  const wasMenuOpen = useRef(false);
  const navKey = nav.map((n) => n.id).join("|");
  const accountMenuId = useId();

  const openRegister = onRegister ?? onLogin;
  const openBookings = onMyBookings ?? onLogin;
  const openAccount = onAccount ?? openBookings;

  const accountActions: AccountAction[] = isGuest
    ? [
        { id: "bookings", label: "Đơn đặt của tôi", onSelect: openBookings },
        { id: "account", label: "Tài khoản", onSelect: openAccount },
        { id: "logout", label: "Đăng xuất", onSelect: onLogout },
      ]
    : [
        { id: "login", label: "Đăng nhập", onSelect: onLogin },
        { id: "register", label: "Đăng ký", onSelect: openRegister },
        { id: "bookings", label: "Đơn đặt của tôi", onSelect: openBookings },
      ];

  useEffect(() => {
    if (!overHero) {
      setSolid(true);
      return;
    }
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSolid(window.scrollY > 48));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [overHero]);

  // Khoá cuộn nền khi mở menu mobile
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const [activeSection, setActiveSection] = useState<string>("");

  // Tự động nhận diện phân đoạn (ScrollSpy)
  useEffect(() => {
    if (!overHero) return; // Chỉ theo dõi ở trang chủ
    const observer = new IntersectionObserver(
      (entries) => {
        let maxVisible = 0;
        let activeId = "";
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > maxVisible) {
            maxVisible = entry.intersectionRatio;
            activeId = entry.target.id;
          }
        });
        if (activeId) {
          setActiveSection(activeId);
        }
      },
      { rootMargin: "-80px 0px -40% 0px", threshold: [0.1, 0.5, 0.9] }
    );
    
    const sectionIds = navKey.split("|").filter(Boolean);
    const elements = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
    elements.forEach((el) => observer.observe(el!));

    return () => observer.disconnect();
  }, [overHero, navKey]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeBtn = menuRef.current?.querySelector<HTMLButtonElement>('[data-lux-menu-close="true"]');
    const id = requestAnimationFrame(() => closeBtn?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (menuRef.current) trapTab(menuRef.current, e);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) {
      wasMenuOpen.current = true;
      setAccountOpen(false);
      return;
    }
    if (wasMenuOpen.current) {
      wasMenuOpen.current = false;
      burgerRef.current?.focus();
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const first = accountRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    const focusId = requestAnimationFrame(() => first?.focus());
    const onPointer = (e: PointerEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setAccountOpen(false);
        accountBtnRef.current?.focus();
        return;
      }
      if (accountRef.current) trapTab(accountRef.current, e);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(focusId);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  const initials = hotelName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const runNav = (item: LuxNavItem) => {
    setMenuOpen(false);
    setAccountOpen(false);
    item.onSelect();
  };

  const runAccount = (action: AccountAction) => {
    setAccountOpen(false);
    setMenuOpen(false);
    action.onSelect();
  };

  const brand = (
    <button type="button" className="lux-brand" onClick={() => { setMenuOpen(false); setAccountOpen(false); onHome(); }}>
      <span className="lux-brand__mark">{initials}</span>
      <span>
        <span className="lux-brand__name">{hotelName}</span>
        <br />
        <span className="lux-brand__tag">Hotel &amp; Residences</span>
      </span>
    </button>
  );

  const accountMenu = (
    <div ref={accountRef} className="lux-account">
      <button
        ref={accountBtnRef}
        type="button"
        className="lux-account__btn"
        aria-label="Tài khoản"
        aria-haspopup="menu"
        aria-expanded={accountOpen}
        aria-controls={accountMenuId}
        onClick={() => setAccountOpen((open) => !open)}
      >
        <UserRound className="lux-account__icon" aria-hidden />
        <span className="lux-account__label">Tài khoản</span>
      </button>
      {accountOpen && (
        <div id={accountMenuId} className="lux-account__menu" role="menu" aria-label="Tài khoản">
          {isGuest && userName && (
            <div className="lux-account__who">
              <span className="lux-account__who-name">{userName}</span>
              <span className="lux-account__who-meta">Tài khoản khách</span>
            </div>
          )}
          {accountActions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              className="lux-account__item"
              onClick={() => runAccount(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <header
        className={[
          "lux-header",
          solid ? "lux-header--solid lux-header--onLight" : "lux-header--onDark",
        ].join(" ")}
      >
        <div className="lux-shell lux-shell--wide lux-header__inner">
          {brand}

          <nav className="lux-nav" aria-label="Điều hướng chính">
            {nav.map((item) => (
              <button
                key={item.id}
                type="button"
                className="lux-nav__link"
                aria-current={(item.active || activeSection === item.id) ? "page" : undefined}
                onClick={() => runNav(item)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="lux-header__actions">
            {languageSwitcher}
            {accountMenu}
            <button type="button" className="lux-btn lux-btn--gold lux-btn--sm" onClick={() => { setAccountOpen(false); onBook(); }}>
              Đặt Residences
            </button>

            <button
              ref={burgerRef}
              type="button"
              className="lux-burger"
              aria-label="Mở menu"
              aria-expanded={menuOpen}
              aria-controls="lux-menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div ref={menuRef} id="lux-menu" className="lux-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="lux-menu__top">
            {brand}
            <button type="button" className="lux-burger" data-lux-menu-close="true" aria-label="Đóng menu" onClick={() => setMenuOpen(false)}>
              <X className="size-5" />
            </button>
          </div>

          <ul className="lux-menu__list">
            {nav.map((item) => (
              <li key={item.id}>
                <button type="button" className="lux-menu__link" onClick={() => runNav(item)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="lux-menu__foot">
            {languageSwitcher}
            <div className="lux-menu__account">
              {accountActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="lux-menu__account-link"
                  onClick={() => runAccount(action)}
                >
                  {action.label}
                </button>
              ))}
            </div>
            <button type="button" className="lux-btn lux-btn--gold lux-btn--block" onClick={() => { setMenuOpen(false); onBook(); }}>
              Đặt Residences
            </button>
          </div>
        </div>
      )}
    </>
  );
}
