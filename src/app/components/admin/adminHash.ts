import { NAV, type PageKey } from "../Layout";

export function parseAdminHash(hash: string): PageKey | null {
  const path = (hash || "").replace(/^#\/?/, "").split("?")[0].replace(/\/$/, "");
  if (!path) return "dashboard";
  return NAV.some((n) => n.key === path) ? (path as PageKey) : null;
}

export function adminHash(page: PageKey): string {
  return `#/${page}`;
}
