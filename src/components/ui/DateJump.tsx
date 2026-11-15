"use client";

import { useRef } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/format";

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => { const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };

/** Earlier / later arrows plus a calendar to jump straight to any day. */
export function DayJump({ value, onChange, max, min, step = 1, label = "Go to a day", className }: {
  value: string; onChange: (day: string) => void; max?: string; min?: string; step?: number; label?: string; className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const open = () => {
    const el = ref.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };
  const clamp = (d: string) => (max && d > max ? max : min && d < min ? min : d);
  const btn = "grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface hover:bg-surface-2 disabled:opacity-40";
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button type="button" aria-label={step === 7 ? "Previous week" : "Previous day"} className={btn} disabled={!!min && value <= min} onClick={() => onChange(clamp(addDays(value, -step)))}><ChevronLeft size={18} /></button>
      <span className="relative">
        <button type="button" onClick={open} className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 text-[13px] font-semibold hover:bg-surface-2" aria-label={label}>
          <CalendarDays size={16} className="text-brand" /> <span className="hidden sm:inline">Pick a day</span>
        </button>
        <input ref={ref} type="date" tabIndex={-1} aria-hidden value={value} max={max} min={min}
          onChange={(e) => e.target.value && onChange(clamp(e.target.value))}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0" />
      </span>
      <button type="button" aria-label={step === 7 ? "Next week" : "Next day"} className={btn} disabled={!!max && value >= max} onClick={() => onChange(clamp(addDays(value, step)))}><ChevronRight size={18} /></button>
    </div>
  );
}

/** "YYYY-MM" for `offset` months from this one (0 = this month). */
export const monthOf = (offset: number) => { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth() + offset, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
export const offsetOf = (ym: string) => { const n = new Date(); const [y, m] = ym.split("-").map(Number); return (y - n.getFullYear()) * 12 + (m - 1 - n.getMonth()); };

/** Earlier / later arrows plus a list of months to jump straight to one (this month back three years). */
export function MonthJump({ value, onChange, back = 36, className }: { value: string; onChange: (ym: string) => void; back?: number; className?: string }) {
  const months = Array.from({ length: back + 1 }, (_, i) => monthOf(-i));
  if (!months.includes(value)) months.push(value);
  const off = offsetOf(value);
  const btn = "grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface hover:bg-surface-2 disabled:opacity-40";
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button type="button" aria-label="Earlier month" className={btn} onClick={() => onChange(monthOf(off - 1))}><ChevronLeft size={16} /></button>
      <select aria-label="Month" value={value} onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] font-semibold">
        {months.map((m) => <option key={m} value={m}>{new Date(m + "-01T12:00:00").toLocaleDateString("en-NG", { month: "long", year: "numeric" })}</option>)}
      </select>
      <button type="button" aria-label="Later month" className={btn} disabled={off >= 0} onClick={() => onChange(monthOf(off + 1))}><ChevronRight size={16} /></button>
    </div>
  );
}
