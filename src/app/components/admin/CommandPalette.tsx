import { useEffect, useMemo, useRef, useState } from "react";
import { BedDouble, ClipboardList, Search, User } from "lucide-react";
import { NAV, canAccess, type PageKey } from "../Layout";
import { useStore } from "../../lib/store";

function plain(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0111/g, "d");
}

type Hit = {
  id: string;
  kind: "nav" | "booking" | "customer" | "room";
  title: string;
  hint: string;
  page: PageKey;
};

export function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (p: PageKey) => void;
}) {
  const { currentUser, bookings, customers, rooms, roomLabel, roomType } = useStore();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const role = currentUser?.role;

  const hits = useMemo<Hit[]>(() => {
    if (!role) return [];
    const n = plain(q.trim());
    const out: Hit[] = [];

    NAV.filter((item) => !item.hidden && item.roles.includes(role)).forEach((item) => {
      if (!n || plain(item.label).includes(n) || plain(item.group).includes(n) || item.key.includes(n)) {
        out.push({ id: `nav-${item.key}`, kind: "nav", title: item.label, hint: item.group, page: item.key });
      }
    });

    if (n.length >= 1 && canAccess("bookings", role)) {
      bookings.slice(0, 200).forEach((b) => {
        const c = customers.find((x) => x.id === b.customerId);
        const blob = plain(`${b.code} ${c?.name ?? ""} ${c?.phone ?? ""} ${roomLabel(b.roomId)}`);
        if (blob.includes(n)) {
          out.push({
            id: `b-${b.id}`,
            kind: "booking",
            title: b.code,
            hint: `${c?.name ?? "Khách"} · ${roomLabel(b.roomId)} · ${c?.phone ?? ""}`,
            page: "bookings",
          });
        }
      });
    }

    if (n.length >= 1 && canAccess("customers", role)) {
      customers.slice(0, 80).forEach((c) => {
        if (plain(`${c.name} ${c.phone} ${c.email}`).includes(n)) {
          out.push({ id: `c-${c.id}`, kind: "customer", title: c.name, hint: c.phone, page: "customers" });
        }
      });
    }

    if (n.length >= 1 && (canAccess("rooms", role) || canAccess("availability", role))) {
      rooms.forEach((r) => {
        if (plain(`${r.number} ${roomType(r.typeId)?.name ?? ""}`).includes(n)) {
          out.push({
            id: `r-${r.id}`,
            kind: "room",
            title: `Phòng ${r.number}`,
            hint: roomType(r.typeId)?.name ?? r.status,
            page: canAccess("availability", role) ? "availability" : "rooms",
          });
        }
      });
    }

    return out.slice(0, 12);
  }, [q, role, bookings, customers, rooms, roomLabel, roomType]);

  useEffect(() => { setI(0); }, [q, open]);
  useEffect(() => {
    if (open) {
      setQ("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const go = (hit: Hit) => {
    onNavigate(hit.page);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Tìm nhanh"
        className="w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mã BK, SĐT, tên khách, số phòng, trang…"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(hits.length - 1, v + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(0, v - 1)); }
              if (e.key === "Enter" && hits[i]) go(hits[i]);
            }}
          />
          <kbd className="hidden rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1">
          {hits.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Không khớp. Thử mã BK-10xx hoặc SĐT.</li>
          )}
          {hits.map((h, idx) => {
            const Icon = h.kind === "booking" ? ClipboardList : h.kind === "room" ? BedDouble : h.kind === "customer" ? User : Search;
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onMouseEnter={() => setI(idx)}
                  onClick={() => go(h)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${idx === i ? "bg-muted" : ""}`}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{h.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{h.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">Ctrl/Cmd + K · Enter để mở</p>
      </div>
    </div>
  );
}
