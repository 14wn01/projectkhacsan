import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { useStore } from "../../lib/store";
import { toast } from "sonner";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="lux-field-error">{message}</p>;
}

/**
 * Form đăng nhập / đăng ký dành cho KHÁCH (role "guest").
 * Dùng inline trong flow đặt phòng hoặc trong GuestAuthDialog.
 */
export function GuestAuthForm({ onDone, onStaffLogin, initialMode = "login" }: {
  onDone?: () => void;
  onStaffLogin?: () => void;
  initialMode?: "login" | "register";
}) {
  const { login, registerGuest } = useStore();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMode(initialMode);
    setErrors({});
  }, [initialMode]);

  const submitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (username.trim().length !== 10) next.username = "Số điện thoại đăng nhập phải đủ 10 chữ số.";
    if (!password) next.password = "Nhập mật khẩu.";
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => {
        summaryRef.current?.focus();
        userRef.current?.focus();
      });
      return;
    }
    setBusy(true);
    const u = login(username.trim(), password);
    setBusy(false);
    if (u) {
      toast.success(`Xin chào ${u.name}!`);
      onDone?.();
    } else {
      setErrors({ form: "Sai số điện thoại hoặc mật khẩu. Thử lại, hoặc đăng ký tài khoản mới." });
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  };

  const submitRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Nhập họ tên.";
    if (!/^0[35789]\d{8}$/.test(phone)) next.phone = "Số điện thoại chưa hợp lệ (ví dụ: 0912345678).";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Email chưa hợp lệ — có thể để trống.";
    if (regPassword.length < 8) next.regPassword = "Mật khẩu tối thiểu 8 ký tự.";
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => {
        summaryRef.current?.focus();
        nameRef.current?.focus();
      });
      return;
    }
    setBusy(true);
    const res = registerGuest({ name, phone, email, password: regPassword });
    setBusy(false);
    if (res.ok) {
      toast.success(res.message);
      onDone?.();
    } else {
      setErrors({ form: res.message });
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  };

  const formError = errors.form;

  return (
    <div className="lux-form">
      <div className="lux-tabs" role="group" aria-label="Tài khoản khách">
        <button
          type="button"
          aria-pressed={mode === "login"}
          onClick={() => { setMode("login"); setErrors({}); }}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          aria-pressed={mode === "register"}
          onClick={() => { setMode("register"); setErrors({}); }}
        >
          Đăng ký
        </button>
      </div>

      {formError && (
        <div className="lux-alert lux-alert--danger" role="alert" tabIndex={-1} ref={summaryRef}>
          {formError}
        </div>
      )}

      {mode === "login" ? (
        <form onSubmit={submitLogin} className="lux-form" noValidate>
          <div>
            <label className="lux-label" htmlFor="g-u">Số điện thoại <span className="lux-req" aria-hidden>*</span></label>
            <input
              ref={userRef}
              id="g-u"
              className="lux-input"
              type="tel"
              inputMode="numeric"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                if (val.length <= 10) setUsername(val);
                setErrors((er) => ({ ...er, username: "", form: "" }));
              }}
              required
              minLength={10}
              maxLength={10}
              pattern="[0-9]{10}"
              aria-invalid={Boolean(errors.username) || undefined}
              aria-describedby={errors.username ? "g-u-err" : undefined}
            />
            <FieldError id="g-u-err" message={errors.username} />
          </div>
          <div>
            <label className="lux-label" htmlFor="g-p">Mật khẩu <span className="lux-req" aria-hidden>*</span></label>
            <div className="lux-input-wrap">
              <input
                id="g-p"
                className="lux-input"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((er) => ({ ...er, password: "", form: "" })); }}
                required
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password) || undefined}
                aria-describedby={errors.password ? "g-p-err" : undefined}
              />
              <button
                type="button"
                className="lux-peek"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPass ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </div>
            <FieldError id="g-p-err" message={errors.password} />
          </div>
          <button type="submit" className="lux-btn lux-btn--ink lux-btn--block" disabled={busy}>
            <LogIn className="lux-btn__icon" aria-hidden /> {busy ? "Đang vào…" : "Đăng nhập"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitRegister} className="lux-form" noValidate>
          <div>
            <label className="lux-label" htmlFor="r-n">Họ tên <span className="lux-req" aria-hidden>*</span></label>
            <input
              ref={nameRef}
              id="r-n"
              className="lux-input"
              autoComplete="name"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((er) => ({ ...er, name: "", form: "" })); }}
              aria-invalid={Boolean(errors.name) || undefined}
              aria-describedby={errors.name ? "r-n-err" : undefined}
            />
            <FieldError id="r-n-err" message={errors.name} />
          </div>
          <div className="lux-form__row lux-form__row--2">
            <div>
              <label className="lux-label" htmlFor="r-p">Số điện thoại <span className="lux-req" aria-hidden>*</span></label>
              <input
                id="r-p"
                className="lux-input"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  if (val.length <= 10) setPhone(val);
                  setErrors((er) => ({ ...er, phone: "", form: "" }));
                }}
                required
                minLength={10}
                maxLength={10}
                pattern="[0-9]{10}"
                aria-invalid={Boolean(errors.phone) || undefined}
                aria-describedby={errors.phone ? "r-p-err" : undefined}
              />
              <FieldError id="r-p-err" message={errors.phone} />
            </div>
            <div>
              <label className="lux-label" htmlFor="r-e">Email</label>
              <input
                id="r-e"
                className="lux-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((er) => ({ ...er, email: "", form: "" })); }}
                aria-invalid={Boolean(errors.email) || undefined}
                aria-describedby={errors.email ? "r-e-err" : undefined}
              />
              <p className="lux-field-hint">Không bắt buộc</p>
              <FieldError id="r-e-err" message={errors.email} />
            </div>
          </div>
          <div>
            <label className="lux-label" htmlFor="r-pw">Mật khẩu <span className="lux-req" aria-hidden>*</span></label>
            <div className="lux-input-wrap">
              <input
                id="r-pw"
                className="lux-input"
                type={showRegPass ? "text" : "password"}
                value={regPassword}
                onChange={(e) => { setRegPassword(e.target.value); setErrors((er) => ({ ...er, regPassword: "", form: "" })); }}
                minLength={8}
                required
                autoComplete="new-password"
                aria-invalid={Boolean(errors.regPassword) || undefined}
                aria-describedby={errors.regPassword ? "r-pw-err" : "r-pw-hint"}
              />
              <button
                type="button"
                className="lux-peek"
                onClick={() => setShowRegPass((v) => !v)}
                aria-label={showRegPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showRegPass ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </div>
            <p id="r-pw-hint" className="lux-field-hint">Tối thiểu 8 ký tự</p>
            <FieldError id="r-pw-err" message={errors.regPassword} />
          </div>
          <button type="submit" className="lux-btn lux-btn--ink lux-btn--block" disabled={busy}>
            <UserPlus className="lux-btn__icon" aria-hidden /> {busy ? "Đang tạo…" : "Tạo tài khoản & tiếp tục"}
          </button>
        </form>
      )}


    </div>
  );
}

export function GuestAuthDialog({ open, onClose, onStaffLogin, initialMode = "login" }: {
  open: boolean;
  onClose: () => void;
  onStaffLogin?: () => void;
  initialMode?: "login" | "register";
}) {
  const { currentUser } = useStore();
  const isGuest = currentUser?.role === "guest";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md lux-sheet" overlayClassName="lux-overlay">
        <DialogHeader>
          <DialogTitle>{isGuest ? "Tài khoản" : "Tài khoản khách"}</DialogTitle>
          <DialogDescription>
            {isGuest
              ? "Thông tin dùng để xem đơn đặt và liên hệ lễ tân."
              : "Đăng nhập hoặc tạo tài khoản để theo dõi đơn đặt của bạn."}
          </DialogDescription>
        </DialogHeader>
        {isGuest && currentUser ? (
          <div className="lux-form">
            <p className="lux-title" style={{ fontSize: "1.45rem", margin: 0 }}>{currentUser.name}</p>
            {currentUser.phone ? <p className="lux-muted">{currentUser.phone}</p> : null}
            {currentUser.email ? <p className="lux-muted">{currentUser.email}</p> : null}
            <button type="button" className="lux-btn lux-btn--ink lux-btn--block" onClick={onClose}>
              Đóng
            </button>
          </div>
        ) : (
          <GuestAuthForm
            key={`${open}-${initialMode}`}
            onDone={onClose}
            onStaffLogin={onStaffLogin}
            initialMode={initialMode}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
