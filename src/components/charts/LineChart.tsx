"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Table2 } from "lucide-react";
import { cn } from "@/lib/format";

export type Series = {
  name: string;
  /** CSS colour, e.g. "var(--series-1)". Use the slots in order; never reuse a status colour. */
  color: string;
  points: [number, number][];
  /** Draw a dot on each point (measured data); a plain line for a reference curve. */
  markers?: boolean;
};

const W = 640, H = 260, PAD = { l: 52, r: 16, t: 14, b: 34 };

function nice(max: number) {
  const exp = 10 ** Math.floor(Math.log10(max || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * exp).find((s) => max / s <= 5) ?? exp * 10;
  return { step, top: Math.ceil(max / step) * step };
}

function valueAt(points: [number, number][], x: number): number | null {
  if (!points.length) return null;
  const exact = points.find((p) => p[0] === x);
  if (exact) return exact[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    if (a[0] <= x && x <= b[0]) return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  return null;
}

/** One-axis line chart with a hover crosshair, legend, direct end labels and a table view. */
export function LineChart({ series, xLabel, yLabel, formatX = (x) => String(x), formatY = (y) => y.toLocaleString("en-NG"),
  height = H, title }: {
  series: Series[]; xLabel: string; yLabel: string; formatX?: (x: number) => string; formatY?: (y: number) => string; height?: number; title: string;
}) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const all = series.flatMap((s) => s.points);
  const xMin = Math.min(...all.map((p) => p[0]), 0);
  const xMax = Math.max(...all.map((p) => p[0]), 1);
  const { step, top } = nice(Math.max(...all.map((p) => p[1]), 1));
  const ih = height - PAD.t - PAD.b;
  const x = (v: number) => PAD.l + ((v - xMin) / (xMax - xMin || 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ih - (v / top) * ih;
  const xs = useMemo(() => [...new Set(all.map((p) => p[0]))].sort((a, b) => a - b), [all]);
  const xTicks = useMemo(() => { const n = Math.min(6, xs.length); return Array.from({ length: n }, (_, i) => Math.round(xMin + (i * (xMax - xMin)) / Math.max(n - 1, 1))); }, [xs.length, xMin, xMax]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const v = xMin + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (xMax - xMin);
    setHover(xs.reduce((best, c) => (Math.abs(c - v) < Math.abs(best - v) ? c : best), xs[0]));
  };
  const readout = hover == null ? null : series.map((s) => ({ s, v: valueAt(s.points, hover) }));

  return (
    <figure className="flex w-full max-w-[760px] flex-col gap-2" aria-labelledby={`${id}-t`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption id={`${id}-t`} className="text-[13px] font-semibold text-ink-2">{title}</figcaption>
        <div className="flex items-center gap-3">
          {series.length > 1 && series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
              <span className="inline-block h-[2px] w-4 rounded" style={{ background: s.color }} />{s.name}</span>
          ))}
          <button type="button" onClick={() => setTable(!table)} aria-pressed={table}
            className={cn("flex items-center gap-1 rounded-lg border px-2 py-1 text-[12px] font-semibold", table ? "border-brand text-brand" : "border-line text-ink-2")}>
            <Table2 size={13} /> Table</button>
        </div>
      </div>
      {table ? (
        <div className="max-h-[260px] overflow-auto rounded-xl border border-line">
          <table className="w-full text-[13px] tnum">
            <thead className="sticky top-0 bg-surface-2 text-left"><tr><th className="px-3 py-1.5">{xLabel}</th>{series.map((s) => <th key={s.name} className="px-3 py-1.5 text-right">{s.name}</th>)}</tr></thead>
            <tbody>{xs.map((xv) => (
              <tr key={xv} className="border-t border-line"><td className="px-3 py-1">{formatX(xv)}</td>
                {series.map((s) => { const v = s.points.find((p) => p[0] === xv)?.[1]; return <td key={s.name} className="px-3 py-1 text-right">{v != null ? formatY(v) : "—"}</td>; })}</tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg ref={svg} viewBox={`0 0 ${W} ${height}`} className="w-full touch-none select-none" role="img" aria-label={`${title}. Use the table view for exact values.`}
            onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
            {Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step).map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
                <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)">{formatY(t)}</text>
              </g>
            ))}
            {xTicks.map((t) => <text key={t} x={x(t)} y={height - PAD.b + 16} textAnchor="middle" fontSize={11} fill="var(--ink-3)">{formatX(t)}</text>)}
            <text x={PAD.l} y={height - 4} fontSize={11} fill="var(--ink-3)">{xLabel}</text>
            <text x={10} y={PAD.t + 4} fontSize={11} fill="var(--ink-3)" transform={`rotate(-90 10 ${PAD.t + 4})`} textAnchor="end">{yLabel}</text>
            {series.map((s) => s.points.length > 1 && (
              <polyline key={s.name} points={s.points.map((p) => `${x(p[0])},${y(p[1])}`).join(" ")} fill="none" stroke={s.color}
                strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {series.filter((s) => s.markers).flatMap((s) => s.points.map((p) => (
              <circle key={`${s.name}-${p[0]}`} cx={x(p[0])} cy={y(p[1])} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
            )))}
            {series.map((s) => { const last = s.points[s.points.length - 1]; return last && (
              <text key={`l-${s.name}`} x={Math.min(x(last[0]) + 8, W - PAD.r)} y={y(last[1]) + (s.markers ? 16 : -8)} fontSize={11} fontWeight={600}
                fill="var(--ink-2)" stroke="var(--surface)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round"
                textAnchor={x(last[0]) > W - 90 ? "end" : "start"}>{s.name}</text>
            ); })}
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--ink-3)" strokeWidth={1} />}
          </svg>
          {readout && hover != null && (
            <div className="pointer-events-none absolute top-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-[var(--shadow)]"
              style={{ left: `${Math.min(Math.max((x(hover) / W) * 100, 2), 70)}%` }}>
              <div className="text-ink-3">{xLabel} {formatX(hover)}</div>
              {readout.map(({ s, v }) => (
                <div key={s.name} className="flex items-center gap-1.5"><span className="inline-block h-[2px] w-3 rounded" style={{ background: s.color }} />
                  <b className="tnum">{v != null ? formatY(Math.round(v)) : "—"}</b><span className="text-ink-3">{s.name}</span></div>
              ))}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
