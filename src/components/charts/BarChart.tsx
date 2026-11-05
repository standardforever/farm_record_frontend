"use client";

import { useState } from "react";
import { Table2 } from "lucide-react";
import { cn } from "@/lib/format";

/**
 * One measure per day (deaths, kg of feed, eggs): thin bars from a zero baseline, a hover readout and a table view.
 * One series, so no legend: the title names it. Two measures of different size get two charts, never two axes.
 */
export function BarChart({ title, data, unit, color = "var(--series-1)", format = (v) => v.toLocaleString("en-NG"), height = 150 }: {
  title: string; data: { label: string; short: string; value: number }[]; unit: string; color?: string;
  format?: (v: number) => string; height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * 10 ** Math.floor(Math.log10(max))).find((s) => max / s <= 4) ?? max;
  const top = Math.ceil(max / step) * step;
  const ticks = [0, top / 2, top];
  const total = data.reduce((n, d) => n + d.value, 0);
  const shown = hover != null ? data[hover] : null;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="flex items-center gap-2 text-[12px] text-ink-3">
          <span className="tnum" aria-live="polite">{shown ? `${shown.label}: ${format(shown.value)} ${unit}` : `${format(total)} ${unit} in ${data.length} days`}</span>
          <button type="button" onClick={() => setTable((t) => !t)} className="rounded-md p-1 hover:bg-surface-2" aria-pressed={table}
            aria-label={table ? "Show as a chart" : "Show as a table"} title={table ? "Chart" : "Table"}><Table2 size={14} /></button>
        </span>
      </figcaption>
      {table ? (
        <div className="max-h-[220px] overflow-auto rounded-lg border border-line">
          <table className="w-full text-[12.5px]"><thead className="sticky top-0 bg-surface text-left text-ink-3"><tr><th className="px-2 py-1 font-semibold">Day</th><th className="px-2 py-1 text-right font-semibold">{unit}</th></tr></thead>
            <tbody>{[...data].reverse().map((d) => <tr key={d.label} className="border-t border-line"><td className="px-2 py-1">{d.label}</td><td className="px-2 py-1 text-right font-mono tnum">{format(d.value)}</td></tr>)}</tbody></table>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <div className="flex flex-col justify-between pb-[18px] text-right font-mono text-[10.5px] text-ink-3 tnum" style={{ height }}>
            {[...ticks].reverse().map((t) => <span key={t} className="leading-none">{format(t)}</span>)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height: height - 18 }} onMouseLeave={() => setHover(null)}>
              {ticks.map((t) => <div key={t} className="absolute inset-x-0 border-t border-[var(--grid,var(--line))]" style={{ bottom: `${(t / top) * 100}%` }} />)}
              <div className="absolute inset-0 flex items-end gap-[2px]">
                {data.map((d, i) => (
                  <div key={d.label} className="flex h-full min-w-0 flex-1 cursor-default items-end" onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)} tabIndex={0} aria-label={`${d.label}: ${format(d.value)} ${unit}`}>
                    <div className={cn("w-full rounded-t-[3px] transition-opacity", hover != null && hover !== i && "opacity-45")}
                      style={{ height: d.value ? `max(2px, ${(d.value / top) * 100}%)` : 0, background: color }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-1 flex justify-between text-[10.5px] text-ink-3">
              <span>{data[0]?.short}</span><span>{data[Math.floor(data.length / 2)]?.short}</span><span>{data[data.length - 1]?.short}</span>
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
