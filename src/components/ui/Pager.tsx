"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/format";
import { Button } from "./Button";

const SIZES = [10, 20, 50, 100];

/**
 * The footer under every list that keeps growing: "21–40 of 134 records", rows per page, Previous / Page 2 of 7 / Next.
 * Pair it with `usePager` (server pages) or `useSlice` (a list already loaded).
 */
export function Pager({ page, pageSize, total, onPage, onPageSize, noun = "records", className, loading }: {
  page: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize?: (n: number) => void;
  noun?: string; className?: string; loading?: boolean;
}) {
  // Nothing to page: everything fits on the smallest page, and you are on page 1.
  if (!total || (total <= SIZES[0] && page === 1)) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1, to = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pages" className={cn("mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-[12.5px] text-ink-3", className)}>
      <span className="mr-auto tnum" aria-live="polite">{from.toLocaleString("en-NG")}–{to.toLocaleString("en-NG")} of {total.toLocaleString("en-NG")} {noun}</span>
      {onPageSize && (
        <label className="flex items-center gap-1.5">Per page
          <select aria-label="Rows per page" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}
            className="rounded-lg border border-line bg-surface px-1.5 py-1 text-[12.5px] text-ink">
            {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
      {/* On a phone the buttons take their own full row, Previous at one end and Next at the other. */}
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
        <Button size="sm" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}><ChevronLeft size={14} /> Previous</Button>
        <span className="tnum whitespace-nowrap">Page {page} of {pages}</span>
        <Button size="sm" disabled={page >= pages || loading} onClick={() => onPage(page + 1)}>Next <ChevronRight size={14} /></Button>
      </div>
    </nav>
  );
}

/** Page state for a server-paged list. Goes back to page 1 when `resetOn` changes (a filter or search). */
export function usePager(initialSize = 20, resetOn: unknown[] = []) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(initialSize);
  const key = JSON.stringify(resetOn);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } setPage(1); }, [key]);
  return {
    page, size, params: { page, page_size: size },
    setPage, setSize: (n: number) => { setSize(n); setPage(1); },
    /** Spread into <Pager> with the total from the response. */
    bind: (total: number | undefined, loading?: boolean) =>
      ({ page, pageSize: size, total: total ?? 0, onPage: setPage, onPageSize: (n: number) => { setSize(n); setPage(1); }, loading }),
  };
}

/** Page a list that is already loaded (rows inside a batch, a month's statement…). */
export function useSlice<T>(items: T[] | undefined, initialSize = 20, resetOn: unknown[] = []) {
  const pg = usePager(initialSize, resetOn);
  const n = items?.length ?? 0;
  // A list that shrank (an entry voided, a filter) never leaves you on a page past its end.
  const page = Math.min(pg.page, Math.max(1, Math.ceil(n / pg.size)));
  const rows = useMemo(() => (items ?? []).slice((page - 1) * pg.size, page * pg.size), [items, page, pg.size]);
  return { rows, pager: { ...pg.bind(n), page } };
}

/** A search box's value, settled for `ms` so each keystroke is not its own request. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
