import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export type Tone = "neutral" | "good" | "warn" | "crit" | "info" | "brand" | "maize";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  crit: "bg-crit-soft text-crit",
  info: "bg-water-soft text-water",
  brand: "bg-brand-soft text-brand",
  maize: "bg-maize-soft text-warn",
};

export function Badge({ tone = "neutral", dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold leading-relaxed whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Avatar({ name, size = 34, tone = "brand" }: { name: string; size?: number; tone?: "brand" | "maize" }) {
  const letters = name.replace(/^(Dr\.|Alhaji|Mrs\.|Mr\.)\s+/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span style={{ width: size, height: size }}
      className={cn("grid shrink-0 place-items-center rounded-[10px] text-[12px] font-bold",
        tone === "brand" ? "bg-brand-soft text-brand" : "bg-maize-soft text-warn")}>
      {letters}
    </span>
  );
}
