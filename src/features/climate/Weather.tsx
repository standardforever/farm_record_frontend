"use client";

import type { LucideIcon } from "lucide-react";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Sun } from "lucide-react";
import { cn } from "@/lib/format";
import { type ClimateDay, dayName } from "./api";

/** WMO weather codes → an icon and a word. */
export function weatherOf(code: number | null): { icon: LucideIcon; label: string } {
  if (code == null) return { icon: Cloud, label: "—" };
  if (code === 0) return { icon: Sun, label: "Sunny" };
  if (code <= 2) return { icon: CloudSun, label: "Some cloud" };
  if (code === 3) return { icon: Cloud, label: "Cloudy" };
  if (code === 45 || code === 48) return { icon: CloudFog, label: "Haze or fog" };
  if (code >= 51 && code <= 57) return { icon: CloudDrizzle, label: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: CloudRain, label: "Rain" };
  if (code >= 95) return { icon: CloudLightning, label: "Storm" };
  return { icon: Cloud, label: "Cloudy" };
}

const r = (n: number | null) => (n == null ? "—" : Math.round(n));

/** A week of weather: day, icon, high/low, rain. Scrolls sideways on a phone. */
export function WeekStrip({ days, alertDays }: { days: ClimateDay[]; alertDays?: Map<string, "watch" | "danger"> }) {
  return (
    <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Forecast">
      {days.map((d) => {
        const w = weatherOf(d.code); const lv = alertDays?.get(d.on);
        return (
          <li key={d.on} className={cn("flex min-w-[84px] flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center",
            lv === "danger" ? "border-crit bg-crit-soft/50" : lv === "watch" ? "border-warn bg-maize-soft/60" : "border-line")}>
            <span className="text-[12px] font-semibold text-ink-2">{dayName(d.on, true)}</span>
            <w.icon size={24} aria-label={w.label} className={cn(w.label === "Sunny" ? "text-warn" : w.label === "Rain" || w.label === "Storm" ? "text-water" : "text-ink-3")} />
            <span className="font-mono text-[14px] font-semibold tnum">{r(d.t_max)}°<span className="text-ink-3">/{r(d.t_min)}°</span></span>
            <span className="text-[11.5px] text-ink-3 tnum">{d.rain_mm != null && d.rain_mm >= 1 ? `${r(d.rain_mm)} mm` : d.rain_chance != null ? `${r(d.rain_chance)}% rain` : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
