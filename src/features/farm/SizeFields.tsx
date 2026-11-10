"use client";

import { Field, Input, Segmented } from "@/components/ui";
import { cn } from "@/lib/format";

/** A unit's size the way people say it: "10ft by 10ft by 4ft", a round tank 8ft across, or a 2,000-litre tank. */
export type Size = {
  measure: "ft" | "m"; shape: "rect" | "round" | "litres";
  length?: number | null; width?: number | null; diameter?: number | null; depth?: number | null; space_top?: number | null; litres?: number | null;
};
export type SizeState = {
  exact: boolean; measure: "ft" | "m"; shape: Size["shape"];
  length: string; width: string; diameter: string; depth: string; top: string; litres: string; area: string; volume: string;
};

const FT = 0.3048;
const dec = (v: string) => v.replace(/[^\d.]/g, "");
const n = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
const s = (x: number | null | undefined) => (x == null ? "" : String(+x.toFixed(3)));

export const noSize = (): SizeState => ({ exact: false, measure: "ft", shape: "rect", length: "", width: "", diameter: "", depth: "", top: "6", litres: "", area: "", volume: "" });

/** The form's state from a saved unit: its size as typed if there is one, else the exact m² and m³. */
export function sizeFromUnit(u: { size?: Size | Record<string, unknown> | null; area_m2: number | null; volume_m3: number | null }): SizeState {
  const z = u.size as Size | null | undefined;
  if (!z) {
    const blank = noSize();
    return u.area_m2 || u.volume_m3 ? { ...blank, exact: true, area: s(u.area_m2), volume: s(u.volume_m3) } : blank;
  }
  const top = z.space_top == null ? (z.measure === "ft" ? 6 : 15) : z.measure === "ft" ? z.space_top * 12 : z.space_top * 100;
  return { ...noSize(), measure: z.measure, shape: z.shape, length: s(z.length), width: s(z.width), diameter: s(z.diameter),
    depth: s(z.depth), top: s(top), litres: s(z.litres) };
}

/** What to send: { size } (the server works out m² and m³), or the exact numbers, or nothing. */
export function sizeBody(st: SizeState, water: boolean): { size: Size | null; area_m2?: number | null; volume_m3?: number | null } {
  if (st.exact) return { size: null, area_m2: n(st.area), volume_m3: water ? n(st.volume) : null };
  const shape = water ? st.shape : st.shape === "round" ? "round" : "rect";
  const top = n(st.top);
  const z: Size = { measure: st.measure, shape };
  if (shape === "litres") z.litres = n(st.litres);
  else {
    if (shape === "rect") { z.length = n(st.length); z.width = n(st.width); } else z.diameter = n(st.diameter);
    if (water) { z.depth = n(st.depth); z.space_top = top == null ? null : st.measure === "ft" ? top / 12 : top / 100; }
  }
  const complete = shape === "litres" ? !!z.litres : shape === "rect" ? !!(z.length && z.width) : !!z.diameter;
  return complete ? { size: z } : { size: null, area_m2: null, volume_m3: null };
}

/** Is it sendable: nothing typed, or enough to work it out. */
export function sizeReady(st: SizeState, water: boolean): boolean {
  if (st.exact) return true;
  const typed = [st.length, st.width, st.diameter, st.depth, st.litres].some((x) => x.trim() !== "");
  if (!typed) return true;
  const b = sizeBody(st, water);
  if (!b.size) return false;
  if (water && b.size.depth != null && b.size.space_top != null && b.size.space_top >= b.size.depth) return false;
  return true;
}

function work(st: SizeState, water: boolean) {
  const b = sizeBody(st, water);
  const z = b.size;
  if (!z) return null;
  const f = z.measure === "ft" ? FT : 1;
  const area = z.shape === "rect" ? z.length! * f * z.width! * f : z.shape === "round" ? Math.PI * (z.diameter! * f / 2) ** 2 : null;
  const fill = z.depth != null ? Math.max(z.depth - (z.space_top ?? (z.measure === "ft" ? 0.5 : 0.15)), 0) : null;
  const m3 = z.shape === "litres" ? z.litres! / 1000 : area != null && fill != null ? area * fill * f : null;
  return { area, m3, fill, z };
}

const ftIn = (ft: number) => { const whole = Math.floor(ft); const inch = Math.round((ft - whole) * 12); return inch === 12 ? `${whole + 1} ft` : inch ? `${whole} ft ${inch} in` : `${whole} ft`; };
const num = (x: number, d = 0) => x.toLocaleString("en-NG", { maximumFractionDigits: d });

/** "10 × 10 × 4 ft · holds about 9,911 litres": for the unit's details. */
export function describeSize(u: { size?: Size | Record<string, unknown> | null; area_m2: number | null; volume_m3: number | null }, water: boolean) {
  const z = u.size as Size | null | undefined;
  const unit = z?.measure ?? "m";
  const dims = !z ? null : z.shape === "litres" ? `${num(z.litres!)} litre tank`
    : z.shape === "round" ? `Round, ${s(z.diameter)} ${unit} across${water && z.depth ? `, ${s(z.depth)} ${unit} deep` : ""}`
      : `${s(z.length)} × ${s(z.width)}${water && z.depth ? ` × ${s(z.depth)}` : ""} ${unit}`;
  const area = u.area_m2 ? (unit === "ft" ? `${num(u.area_m2 / FT / FT)} sq ft (${num(u.area_m2, 1)} m²)` : `${num(u.area_m2, 1)} m²`) : null;
  const water_ = water && u.volume_m3 ? `about ${num(u.volume_m3 * 1000)} litres (${num(u.volume_m3, 1)} m³)` : null;
  return { dims, area, water: water_ };
}

/** Size, the natural way. Ponds and tanks also give the depth and how much space to leave at the top. */
export function SizeFields({ value: st, onChange, water, each, idPrefix = "sz" }: {
  value: SizeState; onChange: (s: SizeState) => void; water: boolean; each?: boolean; idPrefix?: string;
}) {
  const set = (p: Partial<SizeState>) => onChange({ ...st, ...p });
  const u = st.measure;
  const w = work(st, water);
  const id = (k: string) => `${idPrefix}-${k}`;
  const len = (k: "length" | "width" | "diameter" | "depth", label: string) => (
    <Field label={label} htmlFor={id(k)}>
      <div className="relative"><Input id={id(k)} inputMode="decimal" value={st[k]} onChange={(e) => set({ [k]: dec(e.target.value) })} className="pr-9" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-3">{u}</span></div>
    </Field>
  );

  if (st.exact) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
        <div className="flex items-center justify-between gap-2"><b className="text-[13.5px]">Size{each ? " (each)" : ""}</b>
          <button type="button" className="text-[13px] font-semibold text-brand" onClick={() => set({ exact: false })}>Enter length and width instead</button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Floor or surface area (m²)" htmlFor={id("area")}><Input id={id("area")} inputMode="decimal" value={st.area} onChange={(e) => set({ area: dec(e.target.value) })} /></Field>
          {water && <Field label="Water it holds (m³)" htmlFor={id("volume")} hint="1 m³ = 1,000 litres"><Input id={id("volume")} inputMode="decimal" value={st.volume} onChange={(e) => set({ volume: dec(e.target.value) })} /></Field>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px]"><b>Size{each ? " (each)" : ""}</b> <span className="text-ink-3">(optional)</span></span>
        <Segmented value={st.measure} onChange={(m) => set({ measure: m, top: m === "ft" ? (st.top === "15" ? "6" : st.top) : (st.top === "6" ? "15" : st.top) })}
          options={[{ value: "ft", label: "Feet" }, { value: "m", label: "Metres" }]} />
      </div>
      {water && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Shape">
          {([["rect", "Square or long"], ["round", "Round"], ["litres", "Tank (I know the litres)"]] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={st.shape === k} onClick={() => set({ shape: k })}
              className={cn("cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold", st.shape === k ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2 hover:bg-surface-2")}>{label}</button>
          ))}
        </div>
      )}
      {water && st.shape === "litres" ? (
        <Field label="It holds (litres)" htmlFor={id("litres")} hint="As written on the tank, e.g. 2,000"><Input id={id("litres")} inputMode="numeric" value={st.litres} onChange={(e) => set({ litres: e.target.value.replace(/\D/g, "") })} /></Field>
      ) : (
        <div className={cn("grid gap-3", water ? "grid-cols-3" : "grid-cols-2")}>
          {st.shape === "round" && water ? len("diameter", "Across") : <>{len("length", "Length")}{len("width", "Width")}</>}
          {water && len("depth", "Depth")}
        </div>
      )}
      {water && st.shape !== "litres" && (
        <Field label={`Space to leave at the top (${u === "ft" ? "inches" : "cm"})`} htmlFor={id("top")} hint="So the water does not spill over. 0 fills it to the brim.">
          <Input id={id("top")} inputMode="decimal" value={st.top} onChange={(e) => set({ top: dec(e.target.value) })} className="max-w-[140px]" /></Field>
      )}
      {w && (w.area != null || w.m3 != null) && (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px]" data-testid="size-result" aria-live="polite">
          {w.area != null && <>Floor <b>{u === "ft" ? `${num(w.area / FT / FT)} sq ft` : `${num(w.area, 1)} m²`}</b>{u === "ft" && <span className="text-ink-3"> ({num(w.area, 1)} m²)</span>}</>}
          {w.m3 != null && w.m3 > 0 && <>{w.area != null ? " · " : ""}holds about <b>{num(w.m3 * 1000)} litres</b> of water
            {w.fill != null && <span className="text-ink-3"> when filled to {u === "ft" ? ftIn(w.fill) : `${num(w.fill, 2)} m`} deep</span>}</>}
          {w.m3 === 0 && " · the space at the top leaves no water"}
        </p>
      )}
      <button type="button" className="self-start text-[12.5px] text-ink-3 underline" onClick={() => set({ exact: true, area: w?.area ? s(w.area) : st.area, volume: w?.m3 ? s(w.m3) : st.volume })}>
        I know the exact m²{water ? " and m³" : ""}</button>
    </div>
  );
}
