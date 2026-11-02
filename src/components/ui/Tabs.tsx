"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

export function LinkTabs({ tabs }: { tabs: { href: string; label: string; count?: number }[] }) {
  const path = usePathname();
  return (
    <div className="mb-5 flex gap-0.5 overflow-x-auto border-b border-line [scrollbar-width:none]" role="tablist">
      {tabs.map((t) => {
        const on = path === t.href;
        return (
          <Link key={t.href} href={t.href} role="tab" aria-selected={on}
            className={cn("-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 font-semibold",
              on ? "border-brand text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-surface-2 px-2 text-[11px] text-ink-2 tnum">{t.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-[10px] bg-surface-2 p-[3px]" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn("cursor-pointer whitespace-nowrap rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold",
            value === o.value ? "bg-surface text-ink shadow-[var(--shadow)]" : "text-ink-2")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
