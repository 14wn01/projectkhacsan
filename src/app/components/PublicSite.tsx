import { useCallback, useEffect, useState } from "react";
import { Home } from "./guest/Home";
import { MyBookings } from "./guest/MyBookings";
import { GuestAuthDialog } from "./guest/GuestAuth";
import { LegalDoc, LegalPages } from "./guest/LegalPages";
import { BookingChat } from "./guest/BookingChat";
import { LuxHeader, type LuxNavItem } from "./guest/LuxHeader";
import { LuxFooter } from "./guest/LuxFooter";
import { RoomStay } from "./guest/RoomStay";
import { ResidencesPage } from "./guest/ResidencesPage";
import { ExperiencesPage } from "./guest/ExperiencesPage";
import { StayPage } from "./guest/StayPage";
import { StoryPage } from "./guest/StoryPage";
import { ContactPage } from "./guest/ContactPage";
import { HOTEL_NAME, useStore } from "../lib/store";
import { addDays, toISODate } from "../lib/format";
import { guestHash, parseGuestHash, type GuestView, type SunsetSlot } from "./guest/stay";

/**
 * Trang công khai — hideaway 13 residences.
 */
export function PublicSite({ onStaffLogin }: { onStaffLogin: () => void }) {
  const { currentUser, logout, roomTypes } = useStore();
  const isGuest = currentUser?.role === "guest";
  const today = toISODate(new Date());
  const [view, setView] = useState<GuestView>("home");
  const [section, setSection] = useState<string | undefined>();
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [afterAuth, setAfterAuth] = useState<"bookings" | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDoc>("privacy");
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [guests, setGuests] = useState(2);
  const [sunset, setSunset] = useState<SunsetSlot | "">("");
  const [transfer, setTransfer] = useState(false);

  const applyHash = useCallback((hash = window.location.hash) => {
    const route = parseGuestHash(hash);
    if (route.checkIn) setCheckIn(route.checkIn);
    if (route.checkOut && (!route.checkIn || route.checkOut > route.checkIn)) setCheckOut(route.checkOut);
    if (route.guests) setGuests(route.guests);
    if (route.view === "room" && route.typeId && roomTypes.some((t) => t.id === route.typeId)) {
      setRoomTypeId(route.typeId);
      setView("room");
      setSection(undefined);
      return;
    }
    setRoomTypeId(null);
    setView(route.view);
    setSection(route.section);
    if (route.view === "legal") setLegalDoc(route.doc ?? "privacy");
    if (route.view === "home" && route.section) {
      window.setTimeout(() => document.getElementById(route.section!)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }, [roomTypes]);

  useEffect(() => {
    applyHash();
    const onHash = () => applyHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [applyHash]);

  const writeHash = useCallback((next: { view: GuestView; section?: string; typeId?: string; doc?: LegalDoc }) => {
    const url = guestHash(
      {
        view: next.view,
        section: next.view === "home" ? next.section : undefined,
        typeId: next.typeId ?? roomTypeId ?? undefined,
        doc: next.doc ?? legalDoc,
      },
      { checkIn, checkOut, guests },
    );
    if (window.location.hash !== url) history.replaceState(null, "", url);
  }, [checkIn, checkOut, guests, roomTypeId, legalDoc]);

  useEffect(() => {
    writeHash({ view, section, typeId: roomTypeId ?? undefined, doc: legalDoc });
  }, [view, section, roomTypeId, legalDoc, checkIn, checkOut, guests, writeHash]);

  const openLegal = (doc: LegalDoc) => {
    setLegalDoc(doc);
    setView("legal");
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
  };

  useEffect(() => {
    if (!isGuest && view === "my-bookings") setView("home");
  }, [isGuest, view]);

  useEffect(() => {
    if (isGuest && afterAuth === "bookings") {
      setAfterAuth(null);
      setView("my-bookings");
      setSection(undefined);
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
    }
  }, [isGuest, afterAuth]);

  const goPage = (page: GuestView) => {
    setView(page);
    setSection(undefined);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
  };

  const scrollHome = (id: string) => {
    setView("home");
    setSection(id);
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 90);
  };

  const goHome = () => goPage("home");

  const openRoom = (typeId: string) => {
    setRoomTypeId(typeId);
    setView("room");
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
  };

  const roomType = roomTypes.find((t) => t.id === roomTypeId) ?? null;

  const nav: LuxNavItem[] = [
    { id: "residences", label: "Residences", active: view === "residences" || view === "room", onSelect: () => goPage("residences") },
    { id: "experiences", label: "Trải nghiệm", active: view === "experiences", onSelect: () => goPage("experiences") },
    { id: "stay", label: "Ở lâu", active: view === "stay", onSelect: () => goPage("stay") },
    { id: "story", label: "Câu chuyện", active: view === "story", onSelect: () => goPage("story") },
    { id: "contact", label: "Liên hệ", active: view === "contact", onSelect: () => goPage("contact") },
  ];

  const goBookings = () => goPage("my-bookings");
  const openAuth = (mode: "login" | "register" = "login") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };
  const openMyBookings = () => {
    if (isGuest) {
      goBookings();
      return;
    }
    setAfterAuth("bookings");
    openAuth("login");
  };
  const changeCheckIn = (v: string) => {
    setCheckIn(v);
    if (v >= checkOut) setCheckOut(addDays(v, 1));
  };

  return (
    <div className="lux min-h-screen">
      <a className="lux-skip" href="#main">Bỏ qua tới nội dung chính</a>

      <LuxHeader
        hotelName={HOTEL_NAME}
        nav={nav}
        overHero={view === "home"}
        isGuest={isGuest}
        userName={currentUser?.name}
        onHome={goHome}
        onBook={() => {
          if (view === "home") scrollHome("booking");
          else goPage("residences");
        }}
        onLogin={() => { setAfterAuth(null); openAuth("login"); }}
        onRegister={() => { setAfterAuth(null); openAuth("register"); }}
        onMyBookings={openMyBookings}
        onAccount={() => { setAfterAuth(null); openAuth("login"); }}
        onLogout={logout}
      />

      <main id="main">
        {view === "home" && (
          <Home
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
            sunset={sunset}
            transfer={transfer}
            onCheckIn={changeCheckIn}
            onCheckOut={setCheckOut}
            onGuests={setGuests}
            onSunset={setSunset}
            onOpenRoom={openRoom}
            onNavigate={goPage}
            onViewBookings={goBookings}
            onOpenLegal={() => openLegal("terms")}
          />
        )}
        {view === "residences" && (
          <ResidencesPage
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
            sunset={sunset}
            onCheckIn={changeCheckIn}
            onCheckOut={setCheckOut}
            onGuests={setGuests}
            onDetail={openRoom}
          />
        )}
        {view === "experiences" && (
          <ExperiencesPage
            sunset={sunset}
            onSunset={setSunset}
            onBook={() => goPage("contact")}
          />
        )}
        {view === "stay" && <StayPage onConcierge={() => goPage("contact")} />}
        {view === "story" && <StoryPage onResidences={() => goPage("residences")} />}
        {view === "contact" && <ContactPage />}
        {view === "room" && roomType && (
          <RoomStay
            key={roomType.id}
            type={roomType}
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
            sunset={sunset}
            transfer={transfer}
            onSunset={setSunset}
            onTransfer={setTransfer}
            onBack={() => goPage("residences")}
            onStayChange={({ checkIn: a, checkOut: b }) => { setCheckIn(a); setCheckOut(b); }}
            onOpenLegal={() => openLegal("terms")}
            onViewBookings={goBookings}
          />
        )}
        {view === "my-bookings" && (
          <div className="lux-shell lux-shell--wide lux-page">
            <MyBookings onBackHome={goHome} onOpenLegal={() => openLegal("terms")} />
          </div>
        )}
        {view === "legal" && (
          <div className="lux-shell lux-shell--narrow lux-page">
            <LegalPages key={legalDoc} initial={legalDoc} onBack={goHome} />
          </div>
        )}
      </main>

      <LuxFooter
        hotelName={HOTEL_NAME}
        isGuest={isGuest}
        onNav={(id) => goPage(id as GuestView)}
        onOpenLegal={openLegal}
        onMyBookings={goBookings}
        onLogin={() => { setAfterAuth(null); openAuth("login"); }}
      />

      <BookingChat onOpenLegal={() => openLegal("terms")} />

      <GuestAuthDialog
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onStaffLogin={() => {
          setAuthOpen(false);
          onStaffLogin();
        }}
      />
    </div>
  );
}
