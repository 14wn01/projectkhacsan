import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "../../lib/store";
import type { BankFeedProvider } from "../../lib/types";
import { Button } from "../ui/button";

const PROVIDERS: Array<{ key: BankFeedProvider; label: string; hint: string }> = [
  { key: "none", label: "Chưa kết nối", hint: "Chỉ dán JSON hoặc nhập tay" },
  { key: "casso", label: "Casso", hint: "oauth.casso.vn — Apikey" },
  { key: "sepay", label: "SePay", hint: "my.sepay.vn — Bearer token" },
];

export function BankFeedSettings({ compact = false }: { compact?: boolean }) {
  const { bankFeed, saveBankFeed, syncBankFeed } = useStore();
  const [provider, setProvider] = useState<BankFeedProvider>(bankFeed.provider);
  const [apiKey, setApiKey] = useState(bankFeed.apiKey);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProvider(bankFeed.provider);
    setApiKey(bankFeed.apiKey);
  }, [bankFeed.provider, bankFeed.apiKey]);

  const save = () => {
    if (provider !== "none" && apiKey.trim().length < 8) {
      toast.error("Dán API key / token (tối thiểu 8 ký tự).");
      return;
    }
    saveBankFeed({ ...bankFeed, provider, apiKey: apiKey.trim() });
    toast.success("Đã lưu kết nối sao kê. Key chỉ nằm trên máy này.");
  };

  const pull = async () => {
    const next = { ...bankFeed, provider, apiKey: apiKey.trim() };
    if (provider !== "none" && next.apiKey.length < 8) {
      toast.error("Dán API key / token (tối thiểu 8 ký tự).");
      return;
    }
    saveBankFeed(next);
    setBusy(true);
    try {
      const res = await syncBankFeed(next);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-3 rounded-xl border bg-white p-4"}>
      {!compact && <h3 className="text-sm font-semibold">Kết nối sao kê ngân hàng</h3>}
      <p className="text-xs text-muted-foreground">
        Vietcombank / MB / Techcombank không mở API bán lẻ cho website. Casso hoặc SePay ngồi giữa:
        theo dõi STK khách sạn, gửi từng dòng tiền vào. Hệ thống khớp nội dung <b>COC BK-xxxx</b> với đơn đang chờ.
      </p>
      <div className="flex flex-wrap gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setProvider(p.key)}
            className={
              "rounded-lg border px-3 py-1.5 text-left text-sm " +
              (provider === p.key ? "border-[#8a6d33] bg-[#f6efe3] text-[#5c3d1d]" : "bg-white hover:bg-slate-50")
            }
          >
            <div className="font-medium">{p.label}</div>
            <div className="text-[11px] text-muted-foreground">{p.hint}</div>
          </button>
        ))}
      </div>
      {provider !== "none" && (
        <label className="block text-xs font-medium">
          {provider === "casso" ? "API key Casso" : "API token SePay"}
          <input
            type="password"
            autoComplete="off"
            className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "casso" ? "Apikey từ oauth.casso.vn" : "Token từ my.sepay.vn"}
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save}>Lưu kết nối</Button>
        {provider !== "none" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void pull()}>
            {busy ? "Đang kéo…" : "Kéo sao kê 7 ngày"}
          </Button>
        )}
      </div>
      {bankFeed.lastSyncAt && (
        <p className="text-[11px] text-muted-foreground">
          Lần kéo gần nhất: {new Date(bankFeed.lastSyncAt).toLocaleString("vi-VN")}
        </p>
      )}
      {!compact && (
        <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
          <li>Mở {provider === "sepay" ? "https://my.sepay.vn → API Token" : "https://oauth.casso.vn → API Key"}.</li>
          <li>Kết nối đúng số tài khoản đang hiện trên VietQR (tab Tài khoản nhận CK).</li>
          <li>Dán key vào đây. Chạy <code>npm run dev</code> để máy này proxy được API (tránh CORS).</li>
          <li>Webhook Casso trễ khoảng 5 phút — có thể copy JSON webhook rồi dán ở trang Dòng tiền +.</li>
        </ol>
      )}
    </div>
  );
}
