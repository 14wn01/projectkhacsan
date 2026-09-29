/* ===========================================================================
 * TÀI KHOẢN CỦA TÔI
 * Mở bằng cách bấm vào ô tài khoản (icon tròn) ở góc dưới menu trái.
 * Gồm 3 thẻ: Hồ sơ (sửa thông tin + ảnh đại diện), Bảo mật (đổi mật khẩu),
 * Hoạt động (nhật ký thao tác của chính mình).
 * =========================================================================*/
import { useMemo, useRef, useState } from "react";
import {
  Check, History, IdCard, Mail, Pencil, Phone, RotateCcw,
  ShieldCheck, Trash2, Upload, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { PageHeader } from "../PageHeader";
import { HOTEL_NAME, ROLE_LABELS, useStore } from "../../lib/store";

const MAX_UPLOAD = 3 * 1024 * 1024; // 3 MB

/** Cắt vuông + thu nhỏ ảnh về 256px để không làm phình bộ nhớ trình duyệt. */
function resizeToSquare(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Đọc file thất bại"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Ảnh không hợp lệ"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Trình duyệt không hỗ trợ canvas"));
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.[0] ?? "?";
  const first = parts.length > 1 ? parts[0][0] : "";
  return (first + last).toUpperCase();
}

function strengthOf(pw: string) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^\w\s]/.test(pw)) score++;
  const label = ["Rất yếu", "Yếu", "Trung bình", "Khá", "Mạnh", "Rất mạnh"][score];
  const color = score <= 1 ? "#e11d48" : score <= 2 ? "#d97706" : score <= 3 ? "#0284c7" : "#059669";
  return { score, label, color, pct: (score / 5) * 100 };
}

export function Profile() {
  const { currentUser, updateProfile, auditLog, storageInfo } = useStore();
  const user = currentUser!;
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user.name);
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [avatar, setAvatar] = useState<string | undefined>(user.avatar);
  const [busy, setBusy] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const dirty =
    name !== user.name ||
    jobTitle !== (user.jobTitle ?? "") ||
    email !== (user.email ?? "") ||
    phone !== (user.phone ?? "") ||
    avatar !== user.avatar;

  const myLog = useMemo(
    () => auditLog.filter((a) => a.actor === user.name).slice(0, 25),
    [auditLog, user.name],
  );
  const storage = storageInfo();
  const strength = strengthOf(newPw);

  const pickFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Vui lòng chọn một file ảnh.");
    if (file.size > MAX_UPLOAD) return toast.error("Ảnh tối đa 3 MB. Hãy chọn ảnh nhẹ hơn.");
    setBusy(true);
    try {
      setAvatar(await resizeToSquare(file));
      toast.success("Đã chọn ảnh mới. Bấm “Lưu thay đổi” để áp dụng.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xử lý được ảnh này.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveInfo = () => {
    const res = updateProfile({ name, jobTitle, email, phone, avatar: avatar ?? null });
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };

  const resetInfo = () => {
    setName(user.name);
    setJobTitle(user.jobTitle ?? "");
    setEmail(user.email ?? "");
    setPhone(user.phone ?? "");
    setAvatar(user.avatar);
    toast.info("Đã khôi phục thông tin ban đầu.");
  };

  const changePassword = () => {
    if (newPw !== confirmPw) return toast.error("Mật khẩu nhập lại không khớp.");
    const res = updateProfile({ currentPassword: curPw, newPassword: newPw });
    if (!res.ok) return toast.error(res.message);
    toast.success(res.message);
    setCurPw(""); setNewPw(""); setConfirmPw("");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={IdCard}
        title="Tài khoản của tôi"
        description="Cập nhật ảnh đại diện, thông tin liên hệ và mật khẩu đăng nhập"
        actions={<Badge variant="outline" className="gap-1.5"><ShieldCheck className="size-3.5" /> {ROLE_LABELS[user.role]}</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ------------------------------------------------ THẺ NHÂN VIÊN */}
        <aside className="space-y-4 rounded-2xl border bg-white p-5 text-center">
          <div className="relative mx-auto w-fit">
            <Avatar className="size-28 ring-4 ring-muted">
              {avatar && <AvatarImage src={avatar} alt={name} />}
              <AvatarFallback className="bg-foreground text-2xl text-background">{initials(name)}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              title="Đổi ảnh đại diện"
              className="absolute bottom-0 right-0 grid size-9 place-items-center rounded-full border-2 border-white bg-foreground text-background shadow-md transition-transform hover:scale-105"
            >
              <Pencil className="size-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>

          <div>
            <div className="text-lg font-semibold leading-tight">{name || "Chưa đặt tên"}</div>
            <div className="text-sm text-muted-foreground">{jobTitle || ROLE_LABELS[user.role]}</div>
            <div className="mt-1 text-xs text-muted-foreground">{HOTEL_NAME}</div>
          </div>

          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload className="size-4" /> Tải ảnh lên
            </Button>
            {avatar && (
              <Button size="sm" variant="outline" onClick={() => setAvatar(undefined)}>
                <Trash2 className="size-4" /> Gỡ
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            JPG/PNG tối đa 3 MB. Ảnh được tự cắt vuông và nén về 256px để tải nhanh.
          </p>

          <div className="space-y-2 border-t pt-4 text-left text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>Tên đăng nhập</span><span className="font-medium text-foreground">{user.username}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Thao tác đã ghi nhận</span><span className="font-medium text-foreground">{myLog.length}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Lưu dữ liệu lần cuối</span>
              <span className="font-medium text-foreground">
                {storage.savedAt ? new Date(storage.savedAt).toLocaleTimeString("vi-VN") : "—"}
              </span>
            </div>
          </div>
        </aside>

        {/* ------------------------------------------------------- NỘI DUNG */}
        <Tabs defaultValue="info" className="space-y-4">
          <TabsList>
            <TabsTrigger value="info"><UserCheck className="size-4" /> Hồ sơ</TabsTrigger>
            <TabsTrigger value="security"><ShieldCheck className="size-4" /> Bảo mật</TabsTrigger>
            <TabsTrigger value="activity"><History className="size-4" /> Hoạt động</TabsTrigger>
          </TabsList>

          {/* --- HỒ SƠ --- */}
          <TabsContent value="info" className="space-y-4 rounded-2xl border bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pf-name">Họ và tên</Label>
                <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-title">Chức danh</Label>
                <Input id="pf-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Trưởng ca lễ tân" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-email" className="gap-1.5"><Mail className="size-3.5" /> Email</Label>
                <Input id="pf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ten@khachsan.vn" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-phone" className="gap-1.5"><Phone className="size-3.5" /> Số điện thoại</Label>
                <Input id="pf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" />
              </div>
            </div>

            <div className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
              Tên đăng nhập và vai trò do quản trị viên cấp, không tự sửa được tại đây. Cần đổi vai trò,
              hãy liên hệ quản trị viên hệ thống.
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <Button onClick={saveInfo} disabled={!dirty || busy}>
                <Check className="size-4" /> Lưu thay đổi
              </Button>
              <Button variant="outline" onClick={resetInfo} disabled={!dirty}>
                <RotateCcw className="size-4" /> Huỷ sửa
              </Button>
              {dirty && <span className="text-xs text-amber-600">Có thay đổi chưa lưu.</span>}
            </div>
          </TabsContent>

          {/* --- BẢO MẬT --- */}
          <TabsContent value="security" className="space-y-4 rounded-2xl border bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="pf-cur">Mật khẩu hiện tại</Label>
                <Input id="pf-cur" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-new">Mật khẩu mới</Label>
                <Input id="pf-new" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-confirm">Nhập lại mật khẩu mới</Label>
                <Input id="pf-confirm" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
              </div>
            </div>

            {newPw && (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all" style={{ width: `${strength.pct}%`, backgroundColor: strength.color }} />
                </div>
                <div className="text-xs" style={{ color: strength.color }}>Độ mạnh: {strength.label}</div>
              </div>
            )}

            <ul className="space-y-1 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
              <li>• Tối thiểu 4 ký tự; nên dùng từ 8 ký tự trở lên, có chữ hoa và số.</li>
              <li>• Không dùng chung mật khẩu với tài khoản cá nhân bên ngoài.</li>
              <li>• Đổi mật khẩu ngay khi có nhân sự nghỉ việc biết tài khoản chung.</li>
            </ul>

            <div className="border-t pt-4">
              <Button onClick={changePassword} disabled={!curPw || !newPw || !confirmPw}>
                <ShieldCheck className="size-4" /> Đổi mật khẩu
              </Button>
            </div>
          </TabsContent>

          {/* --- HOẠT ĐỘNG --- */}
          <TabsContent value="activity" className="rounded-2xl border bg-white p-5">
            {myLog.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chưa có thao tác nào được ghi nhận.</p>
            ) : (
              <ol className="relative space-y-3 border-l pl-5">
                {myLog.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[23px] top-1.5 size-2.5 rounded-full bg-foreground ring-4 ring-white" />
                    <div className="text-sm font-medium">{a.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.at).toLocaleString("vi-VN")}{a.detail ? ` · ${a.detail}` : ""}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
