import { useMemo, useState } from "react";

export function useTable<T>(
  rows: T[],
  searchFields: (row: T) => string,
  pageSize = 8,
) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => searchFields(r).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    query,
    setQuery: (v: string) => { setQuery(v); setPage(1); },
    page: safePage,
    setPage,
    totalPages,
    total: filtered.length,
    rows: paged,
  };
}
