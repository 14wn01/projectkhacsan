import { useState } from "react";
import { LogIn, ShieldCheck, ArrowLeft, Building2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { HOTEL_NAME, useStore } from "../lib/store";
import { toast } from "sonner";
import { Tilt3D } from "./Tilt3D";

export function Login({ onBack }: { onBack?: () => void }) {
  const { login } = useStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = login(username.trim(), password.trim());
    if (u) toast.success(`Xin chào ${u.name}`);
    else toast.error("Sai tài khoản hoặc mật khẩu.");
  };

  return (
    <div 
      className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-8"
      style={{
        backgroundImage: 'url(/media/hero-resort.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark gradient overlay for a cinematic feel */}
      <div className="absolute inset-0 bg-black/40 bg-gradient-to-t from-black/80 via-black/20 to-black/80 backdrop-blur-[4px]" />

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="absolute left-6 top-6 z-10 inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" /> Quay lại trang công khai
        </button>
      )}

      <div className="relative z-10 w-full max-w-[420px]">
        <Tilt3D max={4} scale={1.02}>
          {/* Glassmorphism panel */}
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-white/20 to-white/5 p-4 shadow-inner ring-1 ring-white/20 backdrop-blur-md">
                <Building2 className="size-8 text-white drop-shadow-md" />
              </div>
              <h1 className="text-2xl font-light tracking-wide text-white drop-shadow-md">{HOTEL_NAME}</h1>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/90 ring-1 ring-white/20">
                <ShieldCheck className="size-3.5" /> Portal Quản Trị
              </div>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="u" className="text-[11px] font-semibold uppercase tracking-widest text-white/80 ml-1">
                  Tài khoản
                </label>
                <Input 
                  id="u" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="Nhập tên đăng nhập..." 
                  autoFocus 
                  className="h-12 rounded-xl border-white/20 bg-black/20 px-4 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/50 focus-visible:border-white/50 transition-all" 
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="p" className="text-[11px] font-semibold uppercase tracking-widest text-white/80 ml-1">
                  Mật khẩu
                </label>
                <Input 
                  id="p" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••" 
                  className="h-12 rounded-xl border-white/20 bg-black/20 px-4 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/50 focus-visible:border-white/50 transition-all" 
                />
              </div>
              
              <Button 
                type="submit" 
                className="mt-4 h-12 w-full rounded-xl bg-white text-black font-semibold tracking-wide hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all hover:scale-[1.02]"
              >
                <LogIn className="mr-2 size-4" /> ĐĂNG NHẬP
              </Button>
            </form>

            <div className="mt-8 border-t border-white/10 pt-6 text-center text-[10px] font-medium uppercase tracking-widest text-white/50">
              © 2026 {HOTEL_NAME}. Protected Area.
            </div>
          </div>
        </Tilt3D>
      </div>
    </div>
  );
}
