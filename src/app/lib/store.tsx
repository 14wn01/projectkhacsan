import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { supabase } from "./supabase";
import {
  AuditEntry,
  Booking,
  BookingService,
  ChannelAccount,
  Customer,
  IdDocumentData,
  Invoice,
  LocalEvent,
  LoyaltyAccount,
  LoyaltyTxn,
  NotificationChannel,
  NotificationKind,
  NotificationLog,
  BankAccount,
  BankFeedConfig,
  BankInflow,
  Payment,
  PaymentMethod,
  PaymentPurpose,
  PriceOverride,
  RatePlan,
  Review,
  Role,
  Room,
  RoomHold,
  RoomType,
  ServiceCatalogItem,
  User,
} from "./types";
import {
  seedBookings,
  seedCustomers,
  seedInvoices,
  seedRooms,
  seedRoomTypes,
  seedServices,
  seedUsers,
} from "./seed";
import {
  seedChannels,
  seedLocalEvents,
  seedLoyaltyAccounts,
  seedPriceOverrides,
  seedRatePlans,
  seedReviews,
} from "./seedExtra";
import { addDays, dateRangesOverlap, isISODate, nightsBetween, toISODate, uid } from "./format";
import { logger } from "./logger";
import { toast } from "sonner";
import {
  clearState,
  exportBackup,
  importBackup,
  isPersistenceAvailable,
  lastSavedAt,
  loadState,
  saveState,
} from "./persistence";
import { DEMO_PAYMENTS } from "./payments";
import { DEFAULT_BANK_ACCOUNT, transferContent } from "./bank";
import { defaultBankFeed, fetchCassoTransactions, fetchSepayTransactions, matchInflow, toBankInflow, type BankInflowDraft } from "./bankFeed";
import { StayQuote, occupancyMap, quoteStay } from "./pricing";
import {
  HOLD_TTL_MINUTES,
  consumeHold,
  createHold,
  getSessionId,
  heldRoomIds,
  pruneHolds,
  releaseHold,
  releaseSessionHolds,
} from "./holds";
import { ConflictError, assertVersion, bookingMutex, nextVersion, runOnce } from "./concurrency";
import {
  VAT_RATE,
  confirmPayment as confirmGatewayPayment,
  createPayment,
  nextEInvoiceNo,
  paidTotal,
  refundPayment,
  splitVat,
} from "./payments";
import { accruePoints, emptyAccount, maxRedeemablePoints, redeemPoints } from "./loyalty";
import { dueNotifications, renderTemplate, retryFailed, sendNotification } from "./notifications";
import { analyzeSentiment } from "./sentiment";

export const HOTEL_NAME = "Sao Mai";
export const HOTEL_FULL_NAME = "Sao Mai Hotel & Residences";
export const HOTEL_HOTLINE = "0900 000 000";
export const HOTEL_EMAIL = "concierge@saomai.vn";
/** Tỷ lệ cọc giữ phòng (25% — trong khoảng 20–30% giá trị đặt phòng) */
export const DEPOSIT_PERCENT = 0.25;

/* ===========================================================================
 * PHÂN QUYỀN
 * =========================================================================*/

export type Permission =
  | "dashboard"
  | "calendar"
  | "rooms"
  | "customers"
  | "bookings"
  | "availability"
  | "services"
  | "invoices"
  | "stats"
  | "ai"
  | "requests"
  | "portal"
  | "revenue"
  | "reviews"
  | "channels"
  | "loyalty"
  | "ops"
  | "edit_price"
  | "refund"
  | "manage_users";

const ALL: Permission[] = [
  "dashboard", "calendar", "rooms", "customers", "bookings", "availability",
  "services", "invoices", "stats", "ai", "requests", "portal",
  "revenue", "reviews", "channels", "loyalty", "ops", "edit_price", "refund", "manage_users",
];

/**
 * Ma trận quyền theo vai trò. Nguyên tắc: chỉ cấp quyền tối thiểu đủ làm việc.
 * Lễ tân KHÔNG được sửa giá hay hoàn tiền — tránh gian lận nội bộ.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL,
  manager: [
    "dashboard", "calendar", "rooms", "customers", "bookings", "availability",
    "services", "invoices", "stats", "ai", "requests", "portal",
    "revenue", "reviews", "channels", "loyalty", "ops", "edit_price",
  ],
  reception: [
    "dashboard", "calendar", "rooms", "customers", "bookings", "availability",
    "services", "invoices", "ai", "requests", "portal", "reviews", "loyalty",
  ],
  accountant: [
    "dashboard", "invoices", "stats", "customers", "bookings", "revenue", "channels", "refund", "ops",
  ],
  guest: [],
};

export function hasPermission(user: User | null, perm: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(perm) ?? false;
}

/* ===========================================================================
 * KIỂU DỮ LIỆU LƯU TRỮ
 * =========================================================================*/

interface PersistedState {
  currentUser: User | null;
  users: User[];
  roomTypes: RoomType[];
  rooms: Room[];
  customers: Customer[];
  services: ServiceCatalogItem[];
  bookings: Booking[];
  invoices: Invoice[];
  holds: RoomHold[];
  payments: Payment[];
  loyaltyAccounts: LoyaltyAccount[];
  loyaltyTxns: LoyaltyTxn[];
  notifications: NotificationLog[];
  reviews: Review[];
  ratePlans: RatePlan[];
  priceOverrides: PriceOverride[];
  localEvents: LocalEvent[];
  channels: ChannelAccount[];
  auditLog: AuditEntry[];
  bankAccount?: BankAccount;
  bankFeed?: BankFeedConfig;
  bankInflows?: BankInflow[];
}

interface NewBookingInput {
  roomId: string;
  customerId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  note?: string;
  status?: Booking["status"];
  source?: Booking["source"];
  /** Chuyển hold thành booking (giữ chỗ → đặt thật) */
  holdId?: string;
  /** Khóa chống gửi trùng khi khách bấm 2 lần */
  idempotencyKey?: string;
  channelRef?: string;
  services?: Booking["services"];
}

/** Dữ liệu sửa hồ sơ cá nhân (trang "Tài khoản của tôi"). */
export interface ProfilePatch {
  name?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  /** null = gỡ ảnh đại diện */
  avatar?: string | null;
  /** Bắt buộc khi đổi mật khẩu */
  currentPassword?: string;
  newPassword?: string;
}

interface StoreValue {
  /* --- dữ liệu --- */
  currentUser: User | null;
  users: User[];
  roomTypes: RoomType[];
  rooms: Room[];
  customers: Customer[];
  bookings: Booking[];
  services: ServiceCatalogItem[];
  invoices: Invoice[];
  holds: RoomHold[];
  payments: Payment[];
  loyaltyAccounts: LoyaltyAccount[];
  loyaltyTxns: LoyaltyTxn[];
  notifications: NotificationLog[];
  reviews: Review[];
  ratePlans: RatePlan[];
  priceOverrides: PriceOverride[];
  localEvents: LocalEvent[];
  channels: ChannelAccount[];
  auditLog: AuditEntry[];
  sessionId: string;
  bankAccount: BankAccount;
  saveBankAccount: (a: BankAccount) => void;
  bankFeed: BankFeedConfig;
  bankInflows: BankInflow[];
  saveBankFeed: (c: BankFeedConfig) => void;
  ingestBankDrafts: (drafts: BankInflowDraft[]) => { added: number; matched: number };
  syncBankFeed: (override?: Partial<BankFeedConfig>) => Promise<{ ok: boolean; message: string; added?: number; matched?: number }>;
  ignoreBankInflow: (id: string) => void;
  linkBankInflow: (inflowId: string, paymentId: string) => { ok: boolean; message: string };

  /* --- tài khoản --- */
  login: (username: string, password: string) => User | null;
  logout: () => void;
  registerGuest: (input: { name: string; phone: string; email: string; password: string }) => { ok: boolean; message: string };
  can: (perm: Permission) => boolean;
  /** Tự cập nhật hồ sơ/ảnh đại diện/mật khẩu của chính người đang đăng nhập */
  updateProfile: (patch: ProfilePatch) => { ok: boolean; message: string };

  /* --- phòng --- */
  saveRoom: (room: Room) => void;
  deleteRoom: (id: string) => void;
  saveRoomType: (t: RoomType) => void;
  saveService: (s: ServiceCatalogItem) => void;
  deleteService: (id: string) => void;

  /* --- khách --- */
  saveCustomer: (c: Customer) => Customer;

  /* --- đặt phòng --- */
  findConflict: (roomId: string, checkIn: string, checkOut: string, ignoreId?: string) => Booking | null;
  getAvailableRooms: (checkIn: string, checkOut: string, guests?: number) => Room[];
  createBooking: (input: NewBookingInput) => { ok: boolean; message: string; booking?: Booking };
  /** Bản an toàn cho concurrency: khóa tuần tự + chống gửi trùng + kiểm tra lại trước khi ghi */
  createBookingSafe: (input: NewBookingInput) => Promise<{ ok: boolean; message: string; booking?: Booking }>;
  approveBooking: (id: string) => { ok: boolean; message: string };
  rejectBooking: (id: string, reason?: string) => void;
  updateBookingStatus: (id: string, status: Booking["status"], expectedVersion?: number) => { ok: boolean; message: string };
  cancelBooking: (id: string, reason: string) => { ok: boolean; message: string };
  markNoShow: (id: string) => void;
  checkInWithDocument: (bookingId: string, doc: IdDocumentData) => { ok: boolean; message: string };
  addServiceToBooking: (bookingId: string, svc: BookingService) => void;
  removeServiceFromBooking: (bookingId: string, index: number) => void;
  /** Đổi / nâng phòng: giữ đơn, có thể giữ giá cũ hoặc áp giá hạng mới. */
  changeRoom: (bookingId: string, newRoomId: string, opts?: { keepRate?: boolean; note?: string }) => {
    ok: boolean;
    message: string;
    kind?: "move" | "upgrade" | "downgrade";
    surcharge?: number;
  };

  /* --- giữ chỗ tạm thời --- */
  holdRoom: (input: { roomId: string; checkIn: string; checkOut: string; guests: number; customerId?: string }) =>
    { ok: boolean; message: string; hold?: RoomHold };
  dropHold: (holdId: string) => void;
  dropMyHolds: () => void;
  myActiveHolds: () => RoomHold[];
  blockedRoomIds: (checkIn: string, checkOut: string) => Set<string>;

  /* --- giá động --- */
  quoteFor: (typeId: string, checkIn: string, checkOut: string) => StayQuote | null;
  activeRatePlan: RatePlan;
  saveRatePlan: (p: RatePlan) => void;
  setActiveRatePlan: (id: string) => void;
  addPriceOverride: (o: Omit<PriceOverride, "id" | "createdAt" | "createdBy">) => void;
  removePriceOverride: (id: string) => void;
  saveLocalEvent: (e: LocalEvent) => void;
  deleteLocalEvent: (id: string) => void;

  /* --- hóa đơn & thanh toán --- */
  ensureInvoice: (bookingId: string) => Invoice;
  recordPayment: (invoiceId: string, amount: number) => void;
  issueEInvoice: (invoiceId: string) => Invoice | null;
  bookingTotalOf: (b: Booking) => number;
  amountPaid: (bookingId: string) => number;
  startPayment: (args: {
    bookingId: string;
    method: PaymentMethod;
    purpose: PaymentPurpose;
    amount: number;
    invoiceId?: string;
    payerNote?: string;
  }) => Promise<{ ok: boolean; message: string; payment?: Payment }>;
  settlePayment: (paymentId: string, succeeded: boolean, reason?: string) => void;
  refundOne: (paymentId: string) => Promise<{ ok: boolean; message: string }>;
  payDeposit: (bookingId: string) => void;
  payDepositWithGateway: (bookingId: string, method: PaymentMethod) => Promise<{ ok: boolean; message: string }>;

  /* --- loyalty --- */
  loyaltyOf: (customerId: string) => LoyaltyAccount;
  redeemLoyalty: (customerId: string, points: number, invoiceId: string) => { ok: boolean; message: string };

  /* --- thông báo --- */
  notify: (bookingId: string, kind: NotificationKind, channel?: NotificationChannel) => Promise<void>;
  runDueNotifications: () => Promise<number>;
  retryFailedNotifications: () => Promise<void>;

  /* --- đánh giá --- */
  addReview: (r: Omit<Review, "id" | "createdAt" | "sentiment" | "topics" | "sentimentConfidence">) => void;
  replyToReview: (id: string) => void;
  overrideSentiment: (id: string, sentiment: Review["sentiment"]) => void;

  /* --- kênh OTA --- */
  saveChannel: (c: ChannelAccount) => void;
  syncChannel: (id: string) => void;

  /* --- vận hành --- */
  pushAudit: (action: string, target?: string, detail?: string) => void;
  backupNow: () => void;
  restoreFromFile: (file: File) => Promise<{ ok: boolean; message: string }>;
  resetAll: () => void;
  storageInfo: () => { available: boolean; savedAt: string | null };

  /* --- helpers --- */
  roomType: (typeId: string) => RoomType | undefined;
  roomLabel: (roomId: string) => string;
  customer: (id: string) => Customer | undefined;
  booking: (id: string) => Booking | undefined;
}

const StoreContext = createContext<StoreValue | null>(null);

/* ===========================================================================
 * PROVIDER
 * =========================================================================*/

export function StoreProvider({ children }: { children: ReactNode }) {
  // Nạp lại trạng thái đã lưu — refresh trang không mất dữ liệu.
  // Dùng useRef + cờ để chỉ đọc localStorage đúng 1 lần, không parse lại mỗi render.
  const restoredRef = useRef<{ value: PersistedState | null } | null>(null);
  if (!restoredRef.current) restoredRef.current = { value: loadState<PersistedState>() };
  const restored = restoredRef.current.value;

  const [currentUser, setCurrentUser] = useState<User | null>(restored?.currentUser ?? null);
  const [users, setUsers] = useState<User[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<ServiceCatalogItem[]>(() => {
    const svcs = restored?.services ?? seedServices;
    const missing = seedServices.filter(ss => !svcs.some(s => s.id === ss.id));
    return [...svcs, ...missing];
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [holds, setHolds] = useState<RoomHold[]>(restored?.holds ?? []);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loyaltyAccounts, setLoyaltyAccounts] = useState<LoyaltyAccount[]>(
    restored?.loyaltyAccounts ?? seedLoyaltyAccounts,
  );
  const [loyaltyTxns, setLoyaltyTxns] = useState<LoyaltyTxn[]>(restored?.loyaltyTxns ?? []);
  const [notifications, setNotifications] = useState<NotificationLog[]>(restored?.notifications ?? []);
  const [reviews, setReviews] = useState<Review[]>(restored?.reviews ?? seedReviews);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>(restored?.ratePlans ?? seedRatePlans);
  const [priceOverrides, setPriceOverrides] = useState<PriceOverride[]>(
    restored?.priceOverrides ?? seedPriceOverrides,
  );
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>(restored?.localEvents ?? seedLocalEvents);
  const [channels, setChannels] = useState<ChannelAccount[]>(restored?.channels ?? seedChannels);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(restored?.auditLog ?? []);
  const [bankAccount, setBankAccount] = useState<BankAccount>(restored?.bankAccount ?? DEFAULT_BANK_ACCOUNT);
  const [bankFeed, setBankFeed] = useState<BankFeedConfig>(restored?.bankFeed ?? defaultBankFeed());
  const [bankInflows, setBankInflows] = useState<BankInflow[]>(restored?.bankInflows ?? []);

  const sessionId = useMemo(() => getSessionId(), []);

  // ĐỒNG BỘ DỮ LIỆU TỪ SUPABASE KHI KHỞI ĐỘNG VÀ REALTIME
  useEffect(() => {
    async function syncSupabase() {
      try {
        const [
          { data: dbUsers }, { data: dbRooms }, { data: dbRoomTypes },
          { data: dbCustomers }, { data: dbBookings }, { data: dbInvoices }, { data: dbPayments }
        ] = await Promise.all([
          supabase.from("users").select("*"),
          supabase.from("rooms").select("*"),
          supabase.from("room_types").select("*"),
          supabase.from("customers").select("*"),
          supabase.from("bookings").select("*, services:booking_services(*)"),
          supabase.from("invoices").select("*"),
          supabase.from("payments").select("*")
        ]);

        if (dbUsers && dbUsers.length > 0) {
          setUsers(dbUsers.map(u => u.username === 'admin' ? { ...u, password: u.password || 'admin123' } : u) as User[]);
        }
        if (dbRooms && dbRooms.length > 0) setRooms(dbRooms as Room[]);
        if (dbRoomTypes && dbRoomTypes.length > 0) setRoomTypes(dbRoomTypes as RoomType[]);
        if (dbCustomers && dbCustomers.length > 0) setCustomers(dbCustomers as Customer[]);
        if (dbBookings && dbBookings.length > 0) {
          setBookings(dbBookings.map((b: any) => ({ ...b, services: b.services || [] })) as Booking[]);
        }
        if (dbInvoices && dbInvoices.length > 0) setInvoices(dbInvoices as Invoice[]);
        if (dbPayments && dbPayments.length > 0) setPayments(dbPayments as Payment[]);
      } catch (err) {
        logger.warn("store", "Lỗi đồng bộ Supabase ban đầu", err);
      }
    }
    syncSupabase();

    // Lắng nghe realtime từ Supabase để tự động cập nhật khi có booking mới
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          logger.info("store", "Nhận thay đổi Realtime booking", payload);
          // Tải lại toàn bộ bảng bookings (kèm services) để đồng bộ nhất quán
          supabase.from("bookings").select("*, services:booking_services(*)").then(({ data: dbBookings, error }) => {
            if (!error && dbBookings) {
              setBookings(dbBookings.map((b: any) => ({ ...b, services: b.services || [] })) as Booking[]);
              if (payload.eventType === 'INSERT') {
                toast.info("Có đơn đặt phòng mới!");
              }
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ------------------------------------------------------ NHẬT KÝ --------*/

  const pushAudit = useCallback(
    (action: string, target?: string, detail?: string) => {
      const entry: AuditEntry = {
        id: uid("aud"),
        at: new Date().toISOString(),
        actor: currentUser?.name ?? "Khách/Hệ thống",
        action,
        target,
        detail,
      };
      setAuditLog((prev) => [entry, ...prev].slice(0, 500));
      logger.info("audit", action, { target, detail });
    },
    [currentUser],
  );

  /* --------------------------------------------------- LƯU TỰ ĐỘNG ------*/

  useEffect(() => {
    saveState<Partial<PersistedState>>({
      currentUser, services,
      holds, loyaltyAccounts, loyaltyTxns, notifications, reviews,
      ratePlans, priceOverrides, localEvents, channels, auditLog, bankAccount, bankFeed, bankInflows,
    });
  }, [
    currentUser, services,
    holds, loyaltyAccounts, loyaltyTxns, notifications, reviews,
    ratePlans, priceOverrides, localEvents, channels, auditLog, bankAccount, bankFeed, bankInflows,
  ]);

  /* --------------------------------- DỌN HOLD HẾT HẠN ĐỊNH KỲ ----------*/

  useEffect(() => {
    const timer = setInterval(() => {
      setHolds((prev) => {
        const { kept, expired } = pruneHolds(prev);
        return expired.length ? kept : prev;
      });
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  /* ------------------------------------------------------ HELPERS --------*/

  const roomType = useCallback((typeId: string) => roomTypes.find((t) => t.id === typeId), [roomTypes]);
  const roomLabel = useCallback(
    (roomId: string) => {
      const r = rooms.find((x) => x.id === roomId);
      if (!r) return roomId;
      const t = roomTypes.find((x) => x.id === r.typeId);
      return `${r.number}${t ? ` · ${t.name}` : ""}`;
    },
    [rooms, roomTypes],
  );
  const customer = useCallback((id: string) => customers.find((c) => c.id === id), [customers]);
  const booking = useCallback((id: string) => bookings.find((b) => b.id === id), [bookings]);
  const can = useCallback((perm: Permission) => hasPermission(currentUser, perm), [currentUser]);

  const bookingTotalOf = useCallback((b: Booking) => {
    const roomTotal = b.nightlyRates?.length
      ? b.nightlyRates.reduce((s, n) => s + n.price, 0)
      : nightsBetween(b.checkIn, b.checkOut) * b.roomPricePerNight;
    const serviceTotal = b.services.reduce((s, x) => s + x.price * x.qty, 0);
    return roomTotal + serviceTotal;
  }, []);

  const amountPaid = useCallback((bookingId: string) => paidTotal(payments, bookingId), [payments]);

  /* -------------------------------------------------- TÀI KHOẢN ---------*/

  const login = useCallback(
    (username: string, password: string) => {
      const u = users.find((x) => x.username === username && x.password === password) || null;
      setCurrentUser(u);
      if (u) logger.info("auth", `Đăng nhập: ${u.name} (${u.role})`);
      else logger.warn("auth", `Đăng nhập thất bại cho "${username}"`);
      return u;
    },
    [users],
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    setHolds((prev) => releaseSessionHolds(prev, sessionId));
  }, [sessionId]);

  /**
   * Cập nhật hồ sơ của chính mình. Không cho đổi vai trò/tên đăng nhập ở đây —
   * đó là việc của quản trị viên, tránh nhân viên tự nâng quyền.
   */
  const updateProfile = useCallback<StoreValue["updateProfile"]>(
    (patch) => {
      if (!currentUser) return { ok: false, message: "Chưa đăng nhập." };

      const name = patch.name?.trim();
      if (patch.name !== undefined && !name)
        return { ok: false, message: "Họ tên không được để trống." };
      const email = patch.email?.trim();
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return { ok: false, message: "Email không hợp lệ." };
      const phone = patch.phone?.trim();
      if (phone && !/^[0-9+()\s.-]{8,15}$/.test(phone))
        return { ok: false, message: "Số điện thoại không hợp lệ." };

      if (patch.newPassword !== undefined) {
        if (patch.currentPassword !== currentUser.password)
          return { ok: false, message: "Mật khẩu hiện tại không đúng." };
        if (patch.newPassword.length < 4)
          return { ok: false, message: "Mật khẩu mới tối thiểu 4 ký tự." };
        if (patch.newPassword === currentUser.password)
          return { ok: false, message: "Mật khẩu mới phải khác mật khẩu cũ." };
      }

      const next: User = {
        ...currentUser,
        ...(name ? { name } : {}),
        ...(patch.email !== undefined ? { email } : {}),
        ...(patch.phone !== undefined ? { phone } : {}),
        ...(patch.jobTitle !== undefined ? { jobTitle: patch.jobTitle.trim() } : {}),
        ...(patch.avatar !== undefined ? { avatar: patch.avatar ?? undefined } : {}),
        ...(patch.newPassword ? { password: patch.newPassword } : {}),
      };

      setUsers((prev) => prev.map((u) => (u.id === next.id ? next : u)));
      setCurrentUser(next);
      
      // Đồng bộ user lên Supabase
      supabase.from("users").upsert(next).then(({ error }) => {
        if (error) logger.error("store", "Lỗi lưu cập nhật hồ sơ lên Supabase", error);
      });
      pushAudit(
        patch.newPassword ? "Đổi mật khẩu" : "Cập nhật hồ sơ cá nhân",
        next.id,
        patch.newPassword ? undefined : next.name,
      );
      logger.info("auth", `Cập nhật hồ sơ: ${next.name}`);
      return {
        ok: true,
        message: patch.newPassword ? "Đã đổi mật khẩu thành công." : "Đã lưu thông tin cá nhân.",
      };
    },
    [currentUser, pushAudit],
  );

  const saveCustomer = useCallback((c: Customer) => {
    let result = c;
    setCustomers((prev) => {
      const exists = prev.some((x) => x.id === c.id);
      if (exists) return prev.map((x) => (x.id === c.id ? c : x));
      result = { ...c, id: c.id || uid("c") };
      return [...prev, result];
    });
    
    // Đồng bộ lên Supabase (Fire and forget để UI mượt)
    supabase.from("customers").upsert(result).then(({ error }) => {
      if (error) logger.error("store", "Lỗi lưu khách hàng lên Supabase", error);
    });
    
    return result;
  }, []);

  const registerGuest = useCallback<StoreValue["registerGuest"]>(
    (input) => {
      const name = input.name.trim();
      const phone = input.phone.trim();
      const email = input.email.trim();
      const password = input.password;
      if (!name || !phone || !password)
        return { ok: false, message: "Vui lòng nhập đủ họ tên, số điện thoại và mật khẩu." };
      if (password.length < 8) return { ok: false, message: "Mật khẩu tối thiểu 8 ký tự." };
      if (users.some((u) => u.username === phone))
        return { ok: false, message: "Số điện thoại này đã được đăng ký. Vui lòng đăng nhập." };

      const existing = customers.find((c) => c.phone.trim() === phone);
      const cust =
        existing ??
        saveCustomer({
          id: "", name, phone, email, idNumber: "", address: "",
          createdAt: toISODate(new Date()),
          // Ghi nhận đồng ý chính sách dữ liệu cá nhân (Nghị định 13/2023)
          consentAt: new Date().toISOString(),
        });

      const user: User = {
        id: uid("u"), name, username: phone, password, role: "guest", phone, email, customerId: cust.id,
      };
      setUsers((prev) => [...prev, user]);
      setCurrentUser(user);
      // Đồng bộ user lên Supabase
      // Dùng setTimeout để đảm bảo khách hàng mới tạo đã được lưu vào Supabase (tránh lỗi foreign key)
      setTimeout(() => {
        supabase.from("users").upsert(user).then(({ error }) => {
          if (error) logger.error("store", "Lỗi lưu tài khoản khách lên Supabase", error);
        });
      }, existing ? 0 : 500);
      setLoyaltyAccounts((prev) =>
        prev.some((a) => a.customerId === cust.id) ? prev : [...prev, emptyAccount(cust.id)],
      );
      pushAudit("Đăng ký tài khoản khách", cust.id, name);
      return { ok: true, message: "Đăng ký thành công!" };
    },
    [users, customers, saveCustomer, pushAudit],
  );

  /* ------------------------------------------------------- PHÒNG ---------*/

  const saveRoom = useCallback((room: Room) => {
    setRooms((prev) => {
      const exists = prev.some((r) => r.id === room.id);
      return exists ? prev.map((r) => (r.id === room.id ? room : r)) : [...prev, room];
    });
    supabase.from("rooms").upsert(room).then(({ error }) => {
      if (error) logger.error("store", "Lỗi lưu phòng", error);
    });
  }, []);
  const deleteRoom = useCallback((id: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== id));
    supabase.from("rooms").delete().eq("id", id).then(({ error }) => {
      if (error) logger.error("store", "Lỗi xóa phòng", error);
    });
  }, []);
  const saveRoomType = useCallback((t: RoomType) => {
    setRoomTypes((prev) => {
      const exists = prev.some((x) => x.id === t.id);
      return exists ? prev.map((x) => (x.id === t.id ? t : x)) : [...prev, t];
    });
    supabase.from("room_types").upsert(t).then(({ error }) => {
      if (error) logger.error("store", "Lỗi lưu hạng phòng", error);
    });
  }, []);
  const saveService = useCallback((s: ServiceCatalogItem) => setServices((p) => [...p.filter((x) => x.id !== s.id), s]), []);
  const deleteService = useCallback((id: string) => setServices((p) => p.filter((x) => x.id !== id)), []);

  /* --------------------------------------------------- GIÁ ĐỘNG ---------*/

  const activeRatePlan = useMemo(
    () => ratePlans.find((p) => p.active) ?? ratePlans[0],
    [ratePlans],
  );

  const quoteFor = useCallback<StoreValue["quoteFor"]>(
    (typeId, checkIn, checkOut) => {
      const rt = roomTypes.find((t) => t.id === typeId);
      if (!rt || !checkIn || !checkOut || checkIn >= checkOut) return null;
      const days = Math.max(1, nightsBetween(checkIn, checkOut));
      return quoteStay(checkIn, checkOut, {
        roomType: rt,
        plan: activeRatePlan,
        events: localEvents,
        overrides: priceOverrides,
        occupancyByDate: occupancyMap(checkIn, days, rooms, bookings),
      });
    },
    [roomTypes, activeRatePlan, localEvents, priceOverrides, rooms, bookings],
  );

  const saveRatePlan = useCallback(
    (p: RatePlan) => {
      setRatePlans((prev) => (prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p]));
      pushAudit("Cập nhật bảng giá", p.id, p.name);
    },
    [pushAudit],
  );

  const setActiveRatePlan = useCallback(
    (id: string) => {
      setRatePlans((prev) => prev.map((p) => ({ ...p, active: p.id === id })));
      pushAudit("Đổi bảng giá đang áp dụng", id);
    },
    [pushAudit],
  );

  const addPriceOverride = useCallback<StoreValue["addPriceOverride"]>(
    (o) => {
      const item: PriceOverride = {
        ...o,
        id: uid("po"),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name ?? "Hệ thống",
      };
      setPriceOverrides((prev) => [...prev.filter((x) => !(x.typeId === o.typeId && x.date === o.date)), item]);
      pushAudit("Chốt giá thủ công", `${o.typeId} ${o.date}`, `${o.price} — ${o.reason}`);
    },
    [currentUser, pushAudit],
  );

  const removePriceOverride = useCallback(
    (id: string) => {
      setPriceOverrides((prev) => prev.filter((x) => x.id !== id));
      pushAudit("Xóa giá chốt thủ công", id);
    },
    [pushAudit],
  );

  const saveLocalEvent = useCallback(
    (e: LocalEvent) => {
      setLocalEvents((prev) =>
        prev.some((x) => x.id === e.id) ? prev.map((x) => (x.id === e.id ? e : x)) : [...prev, { ...e, id: e.id || uid("ev") }],
      );
      pushAudit("Cập nhật sự kiện địa phương", e.id, e.name);
    },
    [pushAudit],
  );

  const deleteLocalEvent = useCallback((id: string) => setLocalEvents((prev) => prev.filter((x) => x.id !== id)), []);

  /* ------------------------------------------------ GIỮ CHỖ TẠM ---------*/

  const holdRoom = useCallback<StoreValue["holdRoom"]>(
    (input) => {
      const room = rooms.find((r) => r.id === input.roomId);
      const type = roomTypes.find((t) => t.id === room?.typeId);
      if (!room || !type || room.status === "maintenance" || input.guests > type.capacity) return { ok: false, message: "Phòng không khả dụng hoặc vượt sức chứa." };
      const res = createHold(holds, bookings, { ...input, sessionId });
      if (!res.ok) return { ok: false, message: res.message };
      setHolds((prev) => [...prev, res.hold]);
      return {
        ok: true,
        message: `Đã giữ phòng ${HOLD_TTL_MINUTES} phút để bạn hoàn tất đặt phòng.`,
        hold: res.hold,
      };
    },
    [holds, bookings, sessionId, rooms, roomTypes],
  );

  const dropHold = useCallback((holdId: string) => setHolds((prev) => releaseHold(prev, holdId)), []);
  const dropMyHolds = useCallback(
    () => setHolds((prev) => releaseSessionHolds(prev, sessionId)),
    [sessionId],
  );
  const myActiveHolds = useCallback(
    () => holds.filter((h) => h.sessionId === sessionId && !h.releasedAt && !h.convertedBookingId && new Date(h.expiresAt) > new Date()),
    [holds, sessionId],
  );
  const blockedRoomIds = useCallback(
    (checkIn: string, checkOut: string) => heldRoomIds(holds, checkIn, checkOut, sessionId),
    [holds, sessionId],
  );

  /* ------------------------------------------------- ĐẬT PHÒNG ----------*/

  const findConflict = useCallback(
    (roomId: string, checkIn: string, checkOut: string, ignoreId?: string) =>
      bookings.find(
        (b) =>
          b.roomId === roomId &&
          b.id !== ignoreId &&
          (b.status === "reserved" || b.status === "checked_in" || (b.status === "pending" && b.depositPaid)) &&
          dateRangesOverlap(b.checkIn, b.checkOut, checkIn, checkOut),
      ) || null,
    [bookings],
  );

  const getAvailableRooms = useCallback(
    (checkIn: string, checkOut: string, guests = 1) => {
      if (!isISODate(checkIn) || !isISODate(checkOut) || checkOut <= checkIn || !Number.isInteger(guests) || guests < 1) return [];
      const blocked = heldRoomIds(holds, checkIn, checkOut, sessionId);
      return rooms.filter((r) => {
        if (r.status === "maintenance") return false;
        if (blocked.has(r.id)) return false; // phiên khác đang giữ
        const t = roomTypes.find((x) => x.id === r.typeId);
        if (t && t.capacity < guests) return false;
        return !bookings.some(
          (b) =>
            b.roomId === r.id &&
            (b.status === "reserved" || b.status === "checked_in" || (b.status === "pending" && b.depositPaid)) &&
            dateRangesOverlap(b.checkIn, b.checkOut, checkIn, checkOut),
        );
      });
    },
    [rooms, roomTypes, bookings, holds, sessionId],
  );

  /** Xây bản ghi đặt phòng + áp giá động. Không ghi state ở đây. */
  const buildBooking = useCallback(
    (input: NewBookingInput): { ok: false; message: string } | { ok: true; booking: Booking } => {
      if (!input.roomId || !input.customerId) return { ok: false, message: "Vui lòng chọn phòng và khách hàng." };
      if (nightsBetween(input.checkIn, input.checkOut) < 1)
        return { ok: false, message: "Ngày trả phòng phải sau ngày nhận phòng." };

      const conflict = findConflict(input.roomId, input.checkIn, input.checkOut);
      if (conflict)
        return {
          ok: false,
          message: `Phòng đã được đặt trùng lịch (${conflict.code}: ${conflict.checkIn} → ${conflict.checkOut}).`,
        };

      const r = rooms.find((x) => x.id === input.roomId);
      const t = r ? roomTypes.find((x) => x.id === r.typeId) : undefined;
      if (!r || !t || r.status === "maintenance") return { ok: false, message: "Phòng không khả dụng." };
      if (!Number.isInteger(input.guests) || input.guests < 1) return { ok: false, message: "Số khách không hợp lệ." };
      if (input.holdId) {
        const hold = holds.find((h) => h.id === input.holdId);
        if (!hold || hold.releasedAt || hold.convertedBookingId || hold.sessionId !== sessionId || hold.roomId !== input.roomId || hold.checkIn !== input.checkIn || hold.checkOut !== input.checkOut || new Date(hold.expiresAt).getTime() <= Date.now()) return { ok: false, message: "Lượt giữ phòng đã hết hiệu lực. Vui lòng chọn lại phòng." };
      }
      const guestsCap = t.capacity;
      if (input.guests > guestsCap) return { ok: false, message: `Phòng chỉ chứa tối đa ${guestsCap} khách.` };

      // Kiểm tra hold của phiên khác (lớp thứ hai chống double-booking)
      const blocked = heldRoomIds(holds, input.checkIn, input.checkOut, sessionId);
      if (blocked.has(input.roomId))
        return { ok: false, message: "Khách khác đang giữ phòng này. Vui lòng chọn phòng khác." };

      // Áp giá động
      const quote = t ? quoteFor(t.id, input.checkIn, input.checkOut) : null;
      const nights = nightsBetween(input.checkIn, input.checkOut);
      const roomTotal = quote?.total ?? (t?.basePrice ?? 0) * nights;
      const channel = channels.find((c) => c.channel === input.source && c.commissionRate > 0);

      const status = input.status ?? "reserved";
      const b: Booking = {
        id: uid("b"),
        code: `BK-${1000 + bookings.length + 1}`,
        roomId: input.roomId,
        customerId: input.customerId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guests: input.guests,
        status,
        roomPricePerNight: quote?.avgPerNight ?? t?.basePrice ?? 0,
        nightlyRates: quote?.nights.map((n) => ({ date: n.date, price: n.price })),
        services: input.services ?? [],
        createdAt: new Date().toISOString(),
        note: input.note,
        source: input.source,
        holdId: input.holdId,
        channelRef: input.channelRef,
        channelCommission: channel ? Math.round(roomTotal * channel.commissionRate) : undefined,
        depositPercent: DEPOSIT_PERCENT,
        depositAmount: Math.round(roomTotal * DEPOSIT_PERCENT),
        depositPaid: false,
        version: 1,
      };
      return { ok: true, booking: b };
    },
    [findConflict, rooms, roomTypes, holds, sessionId, quoteFor, channels, bookings.length],
  );

  const commitBooking = useCallback(
    (b: Booking, holdId?: string) => {
      setBookings((prev) => [...prev, b]);
      if (holdId) setHolds((prev) => consumeHold(prev, holdId, b.id));
      pushAudit("Tạo đặt phòng", b.code, `${roomLabel(b.roomId)} ${b.checkIn} → ${b.checkOut}`);
      
      const { services, nightlyRates, ...dbBooking } = b;
      supabase.from("bookings").upsert(dbBooking).then(({ error }) => {
        if (error) logger.error("store", "Lỗi lưu đặt phòng lên Supabase", error);
      });
    },
    [pushAudit, roomLabel],
  );

  const createBooking = useCallback<StoreValue["createBooking"]>(
    (input) => {
      const built = buildBooking(input);
      if (!built.ok) return { ok: false, message: built.message };
      commitBooking(built.booking, input.holdId);
      return {
        ok: true,
        message:
          built.booking.status === "pending"
            ? `Đã gửi yêu cầu ${built.booking.code}, chờ lễ tân duyệt.`
            : `Đã tạo đặt phòng ${built.booking.code}.`,
        booking: built.booking,
      };
    },
    [buildBooking, commitBooking],
  );

  /**
   * Bản an toàn cho tình huống nhiều người đặt cùng 1 phòng:
   *  - `bookingMutex` → các yêu cầu xết hàng tuần tự, không chạy chèn nhau
   *  - `runOnce` → khách bấm 2 lần chỉ tạo 1 đơn
   *  - kiểm tra trùng lịch LẠI ngay trước khi ghi
   */
  const createBookingSafe = useCallback<StoreValue["createBookingSafe"]>(
    async (input) => {
      const key = input.idempotencyKey ?? `${input.roomId}|${input.checkIn}|${input.checkOut}|${input.customerId}`;
      try {
        return await runOnce(key, () =>
          bookingMutex.runExclusive(async () => {
            const built = buildBooking(input);
            if (!built.ok) return { ok: false, message: built.message };
            commitBooking(built.booking, input.holdId);
            return {
              ok: true,
              message:
                built.booking.status === "pending"
                  ? `Đã gửi yêu cầu ${built.booking.code}, chờ lễ tân duyệt.`
                  : `Đã tạo đặt phòng ${built.booking.code}.`,
              booking: built.booking,
            };
          }),
        );
      } catch (err) {
        logger.error("booking", "Tạo đặt phòng thất bại", err);
        return { ok: false, message: err instanceof Error ? err.message : "Không tạo được đặt phòng." };
      }
    },
    [buildBooking, commitBooking],
  );

  const approveBooking = useCallback<StoreValue["approveBooking"]>(
    (id) => {
      const b = bookings.find((x) => x.id === id);
      if (!b) return { ok: false, message: "Không tìm thấy yêu cầu." };
      const conflict = findConflict(b.roomId, b.checkIn, b.checkOut, b.id);
      if (conflict)
        return { ok: false, message: `Không thể duyệt: phòng đã bị đặt trùng lịch (${conflict.code}).` };
      setBookings((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, status: "reserved", reviewedAt: new Date().toISOString(), version: nextVersion(x.version) }
            : x,
        ),
      );
      pushAudit("Duyệt yêu cầu đặt phòng", b.code);

      return { ok: true, message: `Đã duyệt yêu cầu ${b.code}.` };
    },
    [bookings, findConflict, pushAudit, customers],
  );

  const rejectBooking = useCallback<StoreValue["rejectBooking"]>(
    (id, reason) => {
      setBookings((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                status: "cancelled",
                reviewedAt: new Date().toISOString(),
                cancelReason: reason ?? "Lễ tân từ chối yêu cầu",
                version: nextVersion(x.version),
              }
            : x,
        ),
      );
      pushAudit("Từ chối yêu cầu đặt phòng", id, reason);
    },
    [pushAudit],
  );

  const updateBookingStatus = useCallback<StoreValue["updateBookingStatus"]>(
    (id, status, expectedVersion) => {
      const b = bookings.find((x) => x.id === id);
      if (!b) return { ok: false, message: "Không tìm thấy đặt phòng." };
      try {
        if (expectedVersion !== undefined) assertVersion(b.version, expectedVersion, `đặt phòng ${b.code}`);
      } catch (err) {
        if (err instanceof ConflictError) return { ok: false, message: err.message };
        throw err;
      }

      const nextBooking = { ...b, status, version: nextVersion(b.version) };
      setBookings((prev) =>
        prev.map((x) => (x.id === id ? nextBooking : x)),
      );

      const { services, nightlyRates, ...dbBooking } = nextBooking;
      supabase.from("bookings").upsert(dbBooking).then(({ error }) => {
        if (error) logger.error("store", "Lỗi cập nhật đặt phòng", error);
      });

      // Đồng bộ trạng thái phòng
      setRooms((prev) => {
        const nextRooms = prev.map((r) => {
          if (r.id !== b.roomId) return r;
          let newStatus = r.status;
          if (status === "checked_in") newStatus = "occupied";
          if (status === "checked_out") newStatus = "cleaning";
          if (status === "cancelled") newStatus = "available";
          if (newStatus !== r.status) {
            const nextRoom = { ...r, status: newStatus };
            supabase.from("rooms").upsert(nextRoom).then(({ error }) => {
              if (error) logger.error("store", "Lỗi đồng bộ trạng thái phòng", error);
            });
            return nextRoom;
          }
          return r;
        });
        return nextRooms;
      });

      // Tích điểm khi trả phòng
      if (status === "checked_out") {
        const spend = bookingTotalOf(b);
        setLoyaltyAccounts((prev) => {
          const acc = prev.find((a) => a.customerId === b.customerId) ?? emptyAccount(b.customerId);
          const { account, txn } = accruePoints(acc, spend, b.id);
          setLoyaltyTxns((t) => [txn, ...t]);
          return prev.some((a) => a.customerId === b.customerId)
            ? prev.map((a) => (a.customerId === b.customerId ? account : a))
            : [...prev, account];
        });
      }

      pushAudit("Đổi trạng thái đặt phòng", b.code, status);
      return { ok: true, message: "Đã cập nhật." };
    },
    [bookings, bookingTotalOf, pushAudit],
  );

  const cancelBooking = useCallback<StoreValue["cancelBooking"]>(
    (id, reason) => {
      const b = bookings.find((x) => x.id === id);
      if (!b) return { ok: false, message: "Không tìm thấy đặt phòng." };
      setBookings((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, status: "cancelled", cancelReason: reason, version: nextVersion(x.version) } : x,
        ),
      );
      setRooms((prev) => prev.map((r) => (r.id === b.roomId ? { ...r, status: "available" } : r)));
      pushAudit("Hủy đặt phòng", b.code, reason);
      return { ok: true, message: `Đã hủy ${b.code}.` };
    },
    [bookings, pushAudit],
  );

  const markNoShow = useCallback(
    (id: string) => {
      setBookings((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, noShow: true, status: "cancelled", cancelReason: "Khách không đến (no-show)", version: nextVersion(x.version) }
            : x,
        ),
      );
      pushAudit("Đánh dấu no-show", id);
    },
    [pushAudit],
  );

  /** Check-in nhanh: lưu thông tin giấy tờ đã xác nhận vào hồ sơ khách. */
  const checkInWithDocument = useCallback<StoreValue["checkInWithDocument"]>(
    (bookingId, doc) => {
      const b = bookings.find((x) => x.id === bookingId);
      if (!b) return { ok: false, message: "Không tìm thấy đặt phòng." };
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === b.customerId
            ? {
                ...c,
                name: doc.fullName || c.name,
                idNumber: doc.idNumber || c.idNumber,
                dob: doc.dob ?? c.dob,
                address: doc.address ?? c.address,
                nationality: doc.nationality ?? c.nationality,
              }
            : c,
        ),
      );
      const res = updateBookingStatus(bookingId, "checked_in");
      pushAudit("Check-in có quét giấy tờ", b.code, `${doc.docType} · độ tin cậy ${Math.round(doc.confidence * 100)}%`);
      return res.ok ? { ok: true, message: `Đã nhận phòng cho ${doc.fullName}.` } : res;
    },
    [bookings, updateBookingStatus, pushAudit],
  );

  const addServiceToBooking = useCallback<StoreValue["addServiceToBooking"]>((bookingId, svc) => {
    setBookings((prev) => {
      const next = prev.map((b) => (b.id === bookingId ? { ...b, services: [...b.services, svc] } : b));
      const b = next.find((x) => x.id === bookingId);
      if (b) {
        // Xoá tất cả và insert lại để đồng bộ với state (vì frontend dùng index)
        supabase.from("booking_services").delete().eq("bookingId", bookingId).then(() => {
          if (b.services.length > 0) {
            const toInsert = b.services.map((s, i) => ({ ...s, id: uid("bs") + i, bookingId }));
            supabase.from("booking_services").insert(toInsert).catch(console.error);
          }
        });
      }
      return next;
    });
  }, []);

  const removeServiceFromBooking = useCallback<StoreValue["removeServiceFromBooking"]>((bookingId, index) => {
    setBookings((prev) => {
      const next = prev.map((b) => (b.id === bookingId ? { ...b, services: b.services.filter((_, i) => i !== index) } : b));
      const b = next.find((x) => x.id === bookingId);
      if (b) {
        supabase.from("booking_services").delete().eq("bookingId", bookingId).then(() => {
          if (b.services.length > 0) {
            const toInsert = b.services.map((s, i) => ({ ...s, id: uid("bs") + i, bookingId }));
            supabase.from("booking_services").insert(toInsert).catch(console.error);
          }
        });
      }
      return next;
    });
  }, []);

  const changeRoom = useCallback<StoreValue["changeRoom"]>(
    (bookingId, newRoomId, opts) => {
      const keepRate = opts?.keepRate !== false;
      const b = bookings.find((x) => x.id === bookingId);
      if (!b) return { ok: false, message: "Không tìm thấy đặt phòng." };
      if (b.status !== "reserved" && b.status !== "checked_in") {
        return { ok: false, message: "Chỉ đổi phòng khi đơn đã giữ chỗ hoặc khách đang ở." };
      }
      if (b.roomId === newRoomId) return { ok: false, message: "Đây đã là phòng hiện tại." };

      const from = rooms.find((r) => r.id === b.roomId);
      const to = rooms.find((r) => r.id === newRoomId);
      const fromType = from ? roomTypes.find((t) => t.id === from.typeId) : undefined;
      const toType = to ? roomTypes.find((t) => t.id === to.typeId) : undefined;
      if (!from || !to || !fromType || !toType) return { ok: false, message: "Phòng không hợp lệ." };
      if (to.status === "maintenance") return { ok: false, message: `${to.number} đang bảo trì.` };
      if (toType.capacity < b.guests) {
        return { ok: false, message: `${toType.name} chỉ chứa ${toType.capacity} khách.` };
      }
      const conflict = findConflict(newRoomId, b.checkIn, b.checkOut, b.id);
      if (conflict) {
        return { ok: false, message: `Phòng ${to.number} trùng lịch với ${conflict.code}.` };
      }

      const nights = Math.max(nightsBetween(b.checkIn, b.checkOut), 1);
      const oldRoomTotal = b.nightlyRates?.length
        ? b.nightlyRates.reduce((s, n) => s + n.price, 0)
        : b.roomPricePerNight * nights;

      let roomPricePerNight = b.roomPricePerNight;
      let nightlyRates = b.nightlyRates;
      let surcharge = 0;
      if (!keepRate) {
        const quote = quoteFor(toType.id, b.checkIn, b.checkOut);
        roomPricePerNight = quote?.avgPerNight ?? toType.basePrice;
        nightlyRates = quote?.nights.map((n) => ({ date: n.date, price: n.price }));
        const newRoomTotal = quote?.total ?? toType.basePrice * nights;
        surcharge = newRoomTotal - oldRoomTotal;
      }

      const kind: "move" | "upgrade" | "downgrade" =
        toType.basePrice > fromType.basePrice ? "upgrade" : toType.basePrice < fromType.basePrice ? "downgrade" : "move";
      const line = `Đổi ${from.number} (${fromType.name}) → ${to.number} (${toType.name})${
        keepRate ? ", giữ giá cũ" : surcharge > 0 ? `, phụ thu ${surcharge.toLocaleString("vi-VN")} ₫` : surcharge < 0 ? ", áp giá hạng mới (thấp hơn)" : ", áp giá hạng mới"
      }`;

      const newBooking = {
        ...b,
        roomId: newRoomId,
        roomPricePerNight,
        nightlyRates,
        note: [b.note, opts?.note, line].filter(Boolean).join(" · "),
        roomMoves: [
          ...(b.roomMoves ?? []),
          {
            at: new Date().toISOString(),
            fromRoomId: b.roomId,
            toRoomId: newRoomId,
            keepRate,
            surcharge,
            note: opts?.note,
          },
        ],
        version: nextVersion(b.version),
      };

      setBookings((prev) =>
        prev.map((x) => (x.id === bookingId ? newBooking : x)),
      );

      const { services, nightlyRates: nr, ...dbBooking } = newBooking;
      supabase.from("bookings").upsert(dbBooking).then(({ error }) => {
        if (error) logger.error("store", "Lỗi đồng bộ Đổi phòng", error);
      });

      if (b.status === "checked_in") {
        setRooms((prev) => {
          const nextRooms = prev.map((r) => {
            if (r.id === b.roomId) return { ...r, status: "cleaning" as const };
            if (r.id === newRoomId) return { ...r, status: "occupied" as const };
            return r;
          });
          const fromRoom = nextRooms.find(r => r.id === b.roomId);
          const toRoom = nextRooms.find(r => r.id === newRoomId);
          if (fromRoom) supabase.from("rooms").upsert(fromRoom).catch(console.error);
          if (toRoom) supabase.from("rooms").upsert(toRoom).catch(console.error);
          return nextRooms;
        });
      }

      pushAudit("Đổi phòng", b.code, line);
      return {
        ok: true,
        message: kind === "upgrade" ? `Đã nâng lên ${toType.name} (${to.number}).` : `Đã chuyển sang phòng ${to.number}.`,
        kind,
        surcharge,
      };
    },
    [bookings, rooms, roomTypes, findConflict, quoteFor, pushAudit],
  );

  /* ------------------------------------------------- HÓA ĐƠN ------------*/

  const ensureInvoice = useCallback<StoreValue["ensureInvoice"]>(
    (bookingId) => {
      const existing = invoices.find((i) => i.bookingId === bookingId);
      const b = bookings.find((x) => x.id === bookingId)!;
      const roomTotal = b.nightlyRates?.length
        ? b.nightlyRates.reduce((s, n) => s + n.price, 0)
        : nightsBetween(b.checkIn, b.checkOut) * b.roomPricePerNight;
      const serviceTotal = b.services.reduce((s, x) => s + x.price * x.qty, 0);
      const total = roomTotal + serviceTotal;

      if (existing) {
        const net = total - existing.discount;
        const updated: Invoice = {
          ...existing,
          roomTotal,
          serviceTotal,
          total: net,
          status: existing.paid >= net ? "paid" : existing.paid > 0 ? "partial" : "unpaid",
        };
        setInvoices((prev) => prev.map((i) => (i.id === existing.id ? updated : i)));
        return updated;
      }

      // Cọc đã trả được tính là đã thanh toán
      const prepaid = paidTotal(payments, bookingId) || (b.depositPaid ? (b.depositAmount ?? 0) : 0);
      const inv: Invoice = {
        id: uid("inv"),
        code: b.code.replace("BK", "HD"),
        bookingId,
        issuedAt: new Date().toISOString(),
        roomTotal,
        serviceTotal,
        discount: 0,
        total,
        paid: Math.min(prepaid, total),
        status: prepaid >= total ? "paid" : prepaid > 0 ? "partial" : "unpaid",
        taxRate: VAT_RATE,
      };
      setInvoices((prev) => [...prev, inv]);
      
      supabase.from("invoices").upsert(inv).then(({ error }) => {
        if (error) logger.error("store", "Lỗi tạo hóa đơn lên Supabase", error);
      });
      
      return inv;
    },
    [invoices, bookings, payments],
  );

  const recordPayment = useCallback<StoreValue["recordPayment"]>((invoiceId, amount) => {
    let nextInv: Invoice | undefined;
    setInvoices((prev) =>
      prev.map((i) => {
        if (i.id !== invoiceId) return i;
        const paid = Math.min(i.total, i.paid + amount);
        nextInv = { ...i, paid, status: paid >= i.total ? "paid" : paid > 0 ? "partial" : "unpaid" };
        return nextInv;
      }),
    );
    if (nextInv) {
      supabase.from("invoices").upsert(nextInv).then(({ error }) => {
        if (error) logger.error("store", "Lỗi cập nhật hóa đơn", error);
      });
    }
  }, []);

  const issueEInvoice = useCallback<StoreValue["issueEInvoice"]>(
    (invoiceId) => {
      const inv = invoices.find((i) => i.id === invoiceId);
      if (!inv) return null;
      if (inv.eInvoiceNo) return inv;
      const issued = invoices.filter((i) => i.eInvoiceNo).length;
      const updated: Invoice = {
        ...inv,
        eInvoiceNo: nextEInvoiceNo(issued),
        eInvoiceIssuedAt: new Date().toISOString(),
        taxRate: inv.taxRate ?? VAT_RATE,
      };
      setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? updated : i)));
      const { net, vat } = splitVat(inv.total, updated.taxRate);
      pushAudit("Phát hành hóa đơn điện tử", updated.eInvoiceNo, `Chưa VAT ${net} + VAT ${vat}`);
      return updated;
    },
    [invoices, pushAudit],
  );

  /* ------------------------------------------------- THANH TOÁN ---------*/

  const startPayment = useCallback<StoreValue["startPayment"]>(
    async ({ bookingId, method, purpose, amount, invoiceId, payerNote }) => {
      const b = bookings.find((x) => x.id === bookingId);
      if (!b) return { ok: false, message: "Không tìm thấy đặt phòng." };
      if (amount <= 0) return { ok: false, message: "Số tiền không hợp lệ." };

      const p = await createPayment(method, {
        bookingId,
        amount,
        purpose,
        invoiceId,
        description: `${b.code} — ${purpose}`,
        customerContact: customer(b.customerId)?.email,
        recordedBy: currentUser?.name,
      });
      const content = method === "bank_transfer" ? transferContent(b.code, purpose) : undefined;
      const recorded: Payment = { ...p, transferContent: content, payerNote: payerNote?.trim() || undefined };

      setPayments((prev) => [recorded, ...prev]);
      supabase.from("payments").upsert(recorded).then(({ error }) => {
        if (error) logger.error("store", "Lỗi lưu thanh toán", error);
      });

      pushAudit(
        method === "bank_transfer" ? "Khách báo chuyển khoản" : "Tạo giao dịch thanh toán",
        b.code,
        `${method} ${amount} — ${recorded.state}${content ? ` · ${content}` : ""}`,
      );

      if (recorded.state === "failed") return { ok: false, message: recorded.failureReason ?? "Giao dịch thất bại.", payment: recorded };
      return {
        ok: true,
        message:
          method === "bank_transfer"
            ? "Đã ghi nhận báo chuyển khoản. Lễ tân đối chiếu sao kê rồi xác nhận cọc."
            : recorded.state === "succeeded"
              ? "Đã thu tiền thành công."
              : "Đã tạo giao dịch, chờ xác nhận.",
        payment: recorded,
      };
    },
    [bookings, customer, currentUser, pushAudit],
  );

  const settlePayment = useCallback<StoreValue["settlePayment"]>(
    (paymentId, succeeded, reason) => {
      const p = payments.find((x) => x.id === paymentId);
      if (!p) return;
      const updated = confirmGatewayPayment(p, succeeded, reason);
      setPayments((prev) => prev.map((x) => (x.id === paymentId ? updated : x)));
      
      supabase.from("payments").upsert(updated).then(({ error }) => {
        if (error) logger.error("store", "Lỗi cập nhật thanh toán", error);
      });

      if (succeeded) {
        if (updated.purpose === "deposit") {
          let updatedBooking: Booking | undefined;
          setBookings((prev) =>
            prev.map((b) => {
              if (b.id !== updated.bookingId) return b;
              updatedBooking = {
                ...b,
                depositPercent: b.depositPercent ?? DEPOSIT_PERCENT,
                depositAmount: updated.amount,
                depositPaid: true,
                depositPaidAt: new Date().toISOString(),
                version: nextVersion(b.version),
              };
              return updatedBooking;
            })
          );
          if (updatedBooking) {
            const { services, nightlyRates, ...dbBooking } = updatedBooking;
            supabase.from("bookings").upsert(dbBooking).then(({ error }) => {
              if (error) logger.error("store", "Lỗi cập nhật cọc đặt phòng", error);
            });
          }
        }
        if (updated.invoiceId) recordPayment(updated.invoiceId, updated.amount);
      }
      pushAudit(succeeded ? "Xác nhận thanh toán" : "Thanh toán thất bại", updated.gatewayRef, reason);
    },
    [payments, recordPayment, pushAudit],
  );

  const saveBankAccount = useCallback(
    (a: BankAccount) => {
      setBankAccount({
        ...a,
        accountNo: a.accountNo.replace(/\s+/g, ""),
        accountName: a.accountName.trim().toUpperCase(),
        bankName: a.bankName.trim(),
        bankBin: a.bankBin.trim(),
        branch: a.branch?.trim(),
      });
      pushAudit("Cập nhật tài khoản nhận chuyển khoản", a.bankName, a.accountNo);
    },
    [pushAudit],
  );

  const saveBankFeed = useCallback(
    (c: BankFeedConfig) => {
      setBankFeed({ ...c, apiKey: c.apiKey.trim() });
      pushAudit("Cập nhật kết nối sao kê ngân hàng", c.provider);
    },
    [pushAudit],
  );

  const ingestBankDrafts = useCallback<StoreValue["ingestBankDrafts"]>(
    (drafts) => {
      const existing = new Set(bankInflows.map((x) => `${x.source}:${x.tid}`));
      let added = 0;
      let matched = 0;
      const toSettle: string[] = [];
      const rows: BankInflow[] = [];
      for (const d of drafts) {
        if (d.amount <= 0) continue;
        const key = `${d.source}:${d.tid}`;
        if (existing.has(key)) continue;
        existing.add(key);
        const extra = matchInflow(d, bookings, payments);
        const row = toBankInflow(d, extra);
        rows.push(row);
        added += 1;
        if (row.match === "matched" && row.matchedPaymentId) {
          matched += 1;
          toSettle.push(row.matchedPaymentId);
        }
      }
      if (rows.length) setBankInflows((prev) => [...rows, ...prev].slice(0, 400));
      toSettle.forEach((id) => settlePayment(id, true, "Khớp sao kê ngân hàng"));
      if (added) pushAudit("Nhập dòng tiền vào", `${added} giao dịch`, `${matched} khớp đơn`);
      return { added, matched };
    },
    [bankInflows, bookings, payments, settlePayment, pushAudit],
  );

  const syncBankFeed = useCallback<StoreValue["syncBankFeed"]>(async (override) => {
    const feed = { ...bankFeed, ...override };
    if (feed.provider === "none" || !feed.apiKey) {
      return { ok: false, message: "Chưa chọn Casso/SePay và dán API key." };
    }
    try {
      const drafts =
        feed.provider === "sepay"
          ? await fetchSepayTransactions(feed.apiKey)
          : await fetchCassoTransactions(feed.apiKey);
      const res = ingestBankDrafts(drafts);
      setBankFeed((f) => ({ ...f, ...override, lastSyncAt: new Date().toISOString() }));
      return {
        ok: true,
        message: res.added ? `Kéo ${res.added} dòng tiền vào, khớp ${res.matched} đơn.` : "Không có giao dịch mới.",
        added: res.added,
        matched: res.matched,
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Không kéo được sao kê." };
    }
  }, [bankFeed, ingestBankDrafts]);

  const ignoreBankInflow = useCallback((id: string) => {
    setBankInflows((prev) => prev.map((x) => (x.id === id ? { ...x, match: "ignored" } : x)));
  }, []);

  const linkBankInflow = useCallback<StoreValue["linkBankInflow"]>(
    (inflowId, paymentId) => {
      const inflow = bankInflows.find((x) => x.id === inflowId);
      const p = payments.find((x) => x.id === paymentId);
      if (!inflow || !p) return { ok: false, message: "Không tìm thấy giao dịch." };
      setBankInflows((prev) =>
        prev.map((x) =>
          x.id === inflowId
            ? { ...x, match: p.amount === inflow.amount ? "matched" : "amount_mismatch", matchedPaymentId: p.id, matchedBookingId: p.bookingId }
            : x,
        ),
      );
      if (p.state === "pending" && p.amount === inflow.amount) {
        settlePayment(p.id, true, "Khớp tay với sao kê");
      }
      return { ok: true, message: "Đã gắn giao dịch với đơn." };
    },
    [bankInflows, payments, settlePayment],
  );

  const refundOne = useCallback<StoreValue["refundOne"]>(
    async (paymentId) => {
      const p = payments.find((x) => x.id === paymentId);
      if (!p) return { ok: false, message: "Không tìm thấy giao dịch." };
      if (p.state !== "succeeded") return { ok: false, message: "Chỉ hoàn được giao dịch đã thành công." };
      if (!hasPermission(currentUser, "refund"))
        return { ok: false, message: "Bạn không có quyền hoàn tiền. Vui lòng liên hệ kế toán." };
      try {
        const refunded = await refundPayment(p);
        setPayments((prev) => prev.map((x) => (x.id === paymentId ? refunded : x)));
        pushAudit("Hoàn tiền", p.gatewayRef, String(p.amount));
        return { ok: true, message: "Đã hoàn tiền." };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "Hoàn tiền thất bại." };
      }
    },
    [payments, currentUser, pushAudit],
  );

  /** Đánh dấu đã cọc thủ công (lễ tân thu tiền mặt / đã nhận chuyển khoản). */
  const payDeposit = useCallback(
    (bookingId: string) => {
      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== bookingId || b.depositPaid) return b;
          const roomTotal = b.nightlyRates?.length
            ? b.nightlyRates.reduce((s, n) => s + n.price, 0)
            : nightsBetween(b.checkIn, b.checkOut) * b.roomPricePerNight;
          const total = roomTotal + b.services.reduce((s, x) => s + x.price * x.qty, 0);
          return {
            ...b,
            depositPercent: DEPOSIT_PERCENT,
            depositAmount: Math.round(total * DEPOSIT_PERCENT),
            depositPaid: true,
            depositPaidAt: new Date().toISOString(),
            version: nextVersion(b.version),
          };
        }),
      );
      pushAudit("Ghi nhận tiền cọc", bookingId);
    },
    [pushAudit],
  );

  const payDepositWithGateway = useCallback<StoreValue["payDepositWithGateway"]>(
    async (bookingId, method) => {
      const b = bookings.find((x) => x.id === bookingId);
      if (!b) return { ok: false, message: "Không tìm thấy đặt phòng." };
      if (b.depositPaid) return { ok: true, message: "Khoản cọc đã được ghi nhận." };
      if (b.status === "cancelled" || b.status === "checked_out") return { ok: false, message: "Không thể cọc cho đặt phòng đã đóng." };
      const conflict = findConflict(b.roomId, b.checkIn, b.checkOut, b.id);
      if (conflict) return { ok: false, message: "Phòng không còn trống. Vui lòng liên hệ lễ tân trước khi cọc." };
      const amount = b.depositAmount ?? Math.round(bookingTotalOf(b) * DEPOSIT_PERCENT);
      if (method === "bank_transfer") {
        const res = await startPayment({ bookingId, method, purpose: "deposit", amount });
        return res.ok ? { ok: true, message: res.message } : { ok: false, message: res.message };
      }
      if (!DEMO_PAYMENTS) return { ok: false, message: "Chưa kết nối cổng ví/thẻ. Dùng chuyển khoản hoặc liên hệ lễ tân." };
      const res = await startPayment({ bookingId, method, purpose: "deposit", amount });
      if (!res.ok || !res.payment) return { ok: false, message: res.message };

      const updated = confirmGatewayPayment(res.payment, true);
      setPayments((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      setBookings((prev) => prev.map((item) => item.id === b.id ? {
        ...item, depositPaid: true, depositPaidAt: updated.completedAt,
        depositAmount: amount, version: nextVersion(item.version),
      } : item));
      pushAudit("Mô phỏng đặt cọc", b.code, method);
      return { ok: true, message: `Mô phỏng nhận cọc ${amount.toLocaleString("vi-VN")}đ. Không có giao dịch tiền thật.` };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookings, bookingTotalOf, startPayment, findConflict, pushAudit],
  );

  /* --------------------------------------------------- LOYALTY -----------*/

  const loyaltyOf = useCallback(
    (customerId: string) => loyaltyAccounts.find((a) => a.customerId === customerId) ?? emptyAccount(customerId),
    [loyaltyAccounts],
  );

  const redeemLoyalty = useCallback<StoreValue["redeemLoyalty"]>(
    (customerId, points, invoiceId) => {
      const inv = invoices.find((i) => i.id === invoiceId);
      if (!inv) return { ok: false, message: "Không tìm thấy hóa đơn." };
      const acc = loyaltyOf(customerId);
      const res = redeemPoints(acc, points, inv.total, inv.bookingId);
      if (!res.ok) return { ok: false, message: res.message };

      setLoyaltyAccounts((prev) =>
        prev.some((a) => a.customerId === customerId)
          ? prev.map((a) => (a.customerId === customerId ? res.account : a))
          : [...prev, res.account],
      );
      setLoyaltyTxns((prev) => [res.txn, ...prev]);
      setInvoices((prev) =>
        prev.map((i) => {
          if (i.id !== invoiceId) return i;
          const discount = i.discount + res.discount;
          const total = i.roomTotal + i.serviceTotal - discount;
          return {
            ...i,
            discount,
            total,
            pointsRedeemed: (i.pointsRedeemed ?? 0) + points,
            status: i.paid >= total ? "paid" : i.paid > 0 ? "partial" : "unpaid",
          };
        }),
      );
      pushAudit("Quy đổi điểm thân thiết", customerId, `${points} điểm → ${res.discount}đ`);
      return { ok: true, message: `Đã giảm ${res.discount.toLocaleString("vi-VN")}đ từ ${points} điểm.` };
    },
    [invoices, loyaltyOf, pushAudit],
  );

  /* ------------------------------------------------- THÔNG BÁO -----------*/

  const sendBookingNotification = useCallback(
    async (bookingId: string, kind: NotificationKind, channel: NotificationChannel = "email") => {
      const b = bookings.find((x) => x.id === bookingId);
      if (!b) return;
      const c = customers.find((x) => x.id === b.customerId);
      if (!c) return;
      const rt = roomTypes.find((t) => t.id === rooms.find((r) => r.id === b.roomId)?.typeId);

      const message = renderTemplate(kind, {
        hotelName: HOTEL_FULL_NAME,
        booking: b,
        customer: c,
        roomLabel: roomLabel(b.roomId),
        roomTypeName: rt?.name ?? "",
        total: bookingTotalOf(b),
        hotline: HOTEL_HOTLINE,
      });

      const to = channel === "sms" ? c.phone : c.email;
      const log = await sendNotification({ channel, kind, to, message, bookingId });
      setNotifications((prev) => [log, ...prev].slice(0, 300));
    },
    [bookings, customers, roomTypes, rooms, roomLabel, bookingTotalOf],
  );

  const notify = useCallback<StoreValue["notify"]>(
    (bookingId, kind, channel = "email") => sendBookingNotification(bookingId, kind, channel),
    [sendBookingNotification],
  );

  const runDueNotifications = useCallback(async () => {
    const due = dueNotifications(bookings, notifications);
    for (const d of due) await sendBookingNotification(d.bookingId, d.kind);
    if (due.length) pushAudit("Gửi thông báo tự động", undefined, `${due.length} thông báo`);
    return due.length;
  }, [bookings, notifications, sendBookingNotification, pushAudit]);

  const retryFailedNotifications = useCallback(async () => {
    const updated = await retryFailed(notifications);
    setNotifications(updated);
  }, [notifications]);

  /* -------------------------------------------------- ĐÁNH GIÁ -----------*/

  const addReview = useCallback<StoreValue["addReview"]>(
    (r) => {
      const analysis = analyzeSentiment(r.text, r.rating);
      const review: Review = {
        ...r,
        id: uid("rv"),
        createdAt: new Date().toISOString(),
        sentiment: analysis.sentiment,
        topics: analysis.topics,
        sentimentConfidence: analysis.confidence,
      };
      setReviews((prev) => [review, ...prev]);
      pushAudit("Thêm đánh giá", review.id, `${r.rating}★ ${analysis.sentiment}`);
    },
    [pushAudit],
  );

  const replyToReview = useCallback((id: string) => {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, replied: true } : r)));
  }, []);

  const overrideSentiment = useCallback<StoreValue["overrideSentiment"]>(
    (id, sentiment) => {
      setReviews((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, sentiment, sentimentOverriddenBy: currentUser?.name ?? "Nhân viên" } : r,
        ),
      );
      pushAudit("Sửa nhãn cảm xúc AI", id, sentiment);
    },
    [currentUser, pushAudit],
  );

  /* --------------------------------------------------- KÊNH OTA ----------*/

  const saveChannel = useCallback(
    (c: ChannelAccount) => {
      setChannels((prev) => (prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c]));
      pushAudit("Cập nhật kênh bán", c.id, c.name);
    },
    [pushAudit],
  );

  const syncChannel = useCallback(
    (id: string) => {
      setChannels((prev) =>
        prev.map((c) => (c.id === id ? { ...c, lastSyncAt: new Date().toISOString(), connected: true } : c)),
      );
      pushAudit("Đồng bộ kênh bán", id);
    },
    [pushAudit],
  );

  /* -------------------------------------------------- VẬN HÀNH -----------*/

  const backupNow = useCallback(() => {
    exportBackup<PersistedState>({
      currentUser, users, roomTypes, rooms, customers, services, bookings, invoices,
      holds, payments, loyaltyAccounts, loyaltyTxns, notifications, reviews,
      ratePlans, priceOverrides, localEvents, channels, auditLog, bankAccount, bankFeed, bankInflows,
    });
    pushAudit("Xuất bản sao lưu");
  }, [
    currentUser, users, roomTypes, rooms, customers, services, bookings, invoices, holds, payments,
    loyaltyAccounts, loyaltyTxns, notifications, reviews, ratePlans, priceOverrides,
    localEvents, channels, auditLog, bankAccount, bankFeed, bankInflows, pushAudit,
  ]);

  const restoreFromFile = useCallback<StoreValue["restoreFromFile"]>(
    async (file) => {
      try {
        const data = await importBackup<PersistedState>(file);
        setUsers(data.users ?? seedUsers);
        setRoomTypes(data.roomTypes ?? seedRoomTypes);
        setRooms(data.rooms ?? seedRooms);
        setCustomers(data.customers ?? seedCustomers);
        setBookings(data.bookings ?? seedBookings);
        setInvoices(data.invoices ?? seedInvoices);
        setHolds(data.holds ?? []);
        setPayments(data.payments ?? []);
        setLoyaltyAccounts(data.loyaltyAccounts ?? seedLoyaltyAccounts);
        setLoyaltyTxns(data.loyaltyTxns ?? []);
        setNotifications(data.notifications ?? []);
        setReviews(data.reviews ?? seedReviews);
        setRatePlans(data.ratePlans ?? seedRatePlans);
        setPriceOverrides(data.priceOverrides ?? seedPriceOverrides);
        setLocalEvents(data.localEvents ?? seedLocalEvents);
        setChannels(data.channels ?? seedChannels);
        setAuditLog(data.auditLog ?? []);
        setBankAccount(data.bankAccount ?? DEFAULT_BANK_ACCOUNT);
        setBankFeed(data.bankFeed ?? { provider: "none", apiKey: "" });
        setBankInflows(data.bankInflows ?? []);
        pushAudit("Phục hồi dữ liệu từ bản sao lưu", file.name);
        return { ok: true, message: "Đã phục hồi dữ liệu từ bản sao lưu." };
      } catch (err) {
        logger.error("ops", "Phục hồi thất bại", err);
        return { ok: false, message: err instanceof Error ? err.message : "Tệp sao lưu không hợp lệ." };
      }
    },
    [pushAudit],
  );

  const resetAll = useCallback(() => {
    clearState();
    setUsers(seedUsers);
    setRoomTypes(seedRoomTypes);
    setRooms(seedRooms);
    setCustomers(seedCustomers);
    setBookings(seedBookings);
    setInvoices(seedInvoices);
    setHolds([]);
    setPayments([]);
    setLoyaltyAccounts(seedLoyaltyAccounts);
    setLoyaltyTxns([]);
    setNotifications([]);
    setReviews(seedReviews);
    setRatePlans(seedRatePlans);
    setPriceOverrides(seedPriceOverrides);
    setLocalEvents(seedLocalEvents);
    setChannels(seedChannels);
    setAuditLog([]);
    setBankAccount(DEFAULT_BANK_ACCOUNT);
    setBankFeed({ provider: "none", apiKey: "" });
    setBankInflows([]);
    logger.warn("ops", "Đã đặt lại toàn bộ dữ liệu về mẫu");
  }, []);

  const storageInfo = useCallback(
    () => ({ available: isPersistenceAvailable(), savedAt: lastSavedAt() }),
    [],
  );

  /* ------------------------------------------------------- VALUE ---------*/

  const value: StoreValue = useMemo(
    () => ({
      currentUser, users, roomTypes, rooms, customers, bookings, services, invoices,
      holds, payments, loyaltyAccounts, loyaltyTxns, notifications, reviews,
      ratePlans, priceOverrides, localEvents, channels, auditLog, sessionId, bankAccount,
      bankFeed, bankInflows,

      login, logout, registerGuest, can, updateProfile,
      saveRoom, deleteRoom, saveRoomType, saveService, deleteService, saveCustomer,

      findConflict, getAvailableRooms, createBooking, createBookingSafe,
      approveBooking, rejectBooking, updateBookingStatus, cancelBooking, markNoShow,
      checkInWithDocument, addServiceToBooking, removeServiceFromBooking, changeRoom,

      holdRoom, dropHold, dropMyHolds, myActiveHolds, blockedRoomIds,

      quoteFor, activeRatePlan, saveRatePlan, setActiveRatePlan,
      addPriceOverride, removePriceOverride, saveLocalEvent, deleteLocalEvent,

      ensureInvoice, recordPayment, issueEInvoice, bookingTotalOf, amountPaid,
      startPayment, settlePayment, refundOne, payDeposit, payDepositWithGateway,

      loyaltyOf, redeemLoyalty,
      notify, runDueNotifications, retryFailedNotifications,
      addReview, replyToReview, overrideSentiment,
      saveChannel, syncChannel,
      pushAudit, backupNow, restoreFromFile, resetAll, storageInfo, saveBankAccount,
      saveBankFeed, ingestBankDrafts, syncBankFeed, ignoreBankInflow, linkBankInflow,

      roomType, roomLabel, customer, booking,
    }),
    [
      currentUser, users, roomTypes, rooms, customers, bookings, services, invoices,
      holds, payments, loyaltyAccounts, loyaltyTxns, notifications, reviews,
      ratePlans, priceOverrides, localEvents, channels, auditLog, sessionId, bankAccount, bankFeed, bankInflows,
      login, logout, registerGuest, can, updateProfile, saveRoom, deleteRoom, saveRoomType, saveService, deleteService, saveCustomer,
      findConflict, getAvailableRooms, createBooking, createBookingSafe, approveBooking,
      rejectBooking, updateBookingStatus, cancelBooking, markNoShow, checkInWithDocument,
      addServiceToBooking, removeServiceFromBooking, changeRoom, holdRoom, dropHold, dropMyHolds,
      myActiveHolds, blockedRoomIds, quoteFor, activeRatePlan, saveRatePlan, setActiveRatePlan,
      addPriceOverride, removePriceOverride, saveLocalEvent, deleteLocalEvent,
      ensureInvoice, recordPayment, issueEInvoice, bookingTotalOf, amountPaid,
      startPayment, settlePayment, refundOne, payDeposit, payDepositWithGateway,
      loyaltyOf, redeemLoyalty, notify, runDueNotifications, retryFailedNotifications,
      addReview, replyToReview, overrideSentiment, saveChannel, syncChannel,
      pushAudit, backupNow, restoreFromFile, resetAll, storageInfo, saveBankAccount,
      saveBankFeed, ingestBankDrafts, syncBankFeed, ignoreBankInflow, linkBankInflow,
      roomType, roomLabel, customer, booking,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Quản trị viên",
  manager: "Quản lý",
  reception: "Lễ tân",
  accountant: "Kế toán",
  guest: "Khách",
};

/** Tiện ích dùng ngoài component (ví dụ trong test). */
export { maxRedeemablePoints, addDays, toISODate };
