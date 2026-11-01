"use client";

import { Checkbox, Segmented } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { useMemo, useState } from "react";
import { useFarmMap } from "./api";

export type FarmScope = { sites?: string[]; units?: string[] };
type Mode = "all" | "sites" | "units";

const modeOf = (s: FarmScope): Mode => (s.units?.length ? "units" : s.sites?.length ? "sites" : "all");

/** Limit someone to chosen sites or units. Empty means the whole farm. */
export function ScopePicker({ value, onChange }: { value: FarmScope; onChange: (v: FarmScope) => void }) {
  const ws = useCurrentWorkspace();
  const usable = ws.has("farm") && ws.can("farm.view");
  const map = useFarmMap(ws.orgId, false, usable);
  // Own state, so "Chosen units" stays selected while nothing is ticked yet.
  const [mode, setModeState] = useState<Mode>(() => modeOf(value));
  const sites = map.data?.sites ?? [];
  const sel = new Set(mode === "units" ? value.units : value.sites);
  const toggle = (id: string, on: boolean) => {
    const next = new Set(sel);
    if (on) next.add(id); else next.delete(id);
    onChange(mode === "units" ? { units: [...next] } : { sites: [...next] });
  };
  const setMode = (m: Mode) => {
    setModeState(m);
    if (m === "all") onChange({});
    else if (m === "sites") onChange({ sites: sites.length === 1 ? [sites[0].id] : [] });
    else onChange({ units: [] });
  };
  const anyUnits = sites.some((s) => s.units.length);
  if (!usable) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12.5px] font-semibold text-ink-2">Which part of the farm?</span>
      <Segmented value={mode} onChange={setMode} options={[
        { value: "all", label: "Whole farm" },
        ...(sites.length > 1 ? [{ value: "sites" as Mode, label: "Chosen sites" }] : []),
        ...(anyUnits ? [{ value: "units" as Mode, label: "Chosen units" }] : []),
      ]} />
      {mode === "all" && <p className="text-[12.5px] text-ink-3">They see every site and unit their role allows.{!anyUnits ? " Add units on the Farm page to limit access to particular ponds or houses." : ""}</p>}
      {mode === "sites" && (
        <div className="rounded-xl border border-line px-3 py-1.5">
          {sites.map((s) => <Checkbox key={s.id} checked={sel.has(s.id)} onChange={(v) => toggle(s.id, v)} label={`${s.name} (${s.code})`} description={`${s.unit_count} units`} />)}
        </div>
      )}
      {mode === "units" && (
        <div className="max-h-[260px] overflow-y-auto rounded-xl border border-line px-3 py-2">
          {sites.filter((s) => s.units.length).map((s) => {
            const ids = s.units.map((u) => u.id);
            const all = ids.every((id) => sel.has(id));
            return (
              <div key={s.id} className="mb-2">
                <div className="flex items-center justify-between"><span className="eyebrow">{s.name}</span>
                  <button type="button" className="text-[12.5px] font-semibold text-brand" onClick={() => {
                    const next = new Set(sel); ids.forEach((id) => (all ? next.delete(id) : next.add(id))); onChange({ units: [...next] });
                  }}>{all ? "Clear" : "Select all"}</button></div>
                <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-3">
                  {s.units.map((u) => <Checkbox key={u.id} checked={sel.has(u.id)} onChange={(v) => toggle(u.id, v)} label={u.code} description={u.name ?? undefined} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {mode !== "all" && sel.size === 0 && <p className="text-[12.5px] text-warn">Choose at least one, or pick “Whole farm”.</p>}
    </div>
  );
}

/** {} means the whole farm; a chosen mode with nothing ticked is not valid yet. */
export function scopeIsValid(s: FarmScope) {
  return Object.keys(s).length === 0 || ((s.sites?.length ?? 0) + (s.units?.length ?? 0)) > 0;
}

export function scopeLabel(scope: Record<string, unknown> | undefined, lookup?: { sites: Map<string, string>; units: Map<string, string> }) {
  const s = (scope ?? {}) as FarmScope;
  if (s.units?.length) {
    const codes = lookup ? s.units.map((id) => lookup.units.get(id)).filter(Boolean) : [];
    return codes.length && codes.length <= 6 ? codes.join(", ") : `${s.units.length} units`;
  }
  if (s.sites?.length) {
    const names = lookup ? s.sites.map((id) => lookup.sites.get(id)).filter(Boolean) : [];
    return names.length && names.length <= 3 ? names.join(", ") : `${s.sites.length} sites`;
  }
  return null;
}

/** Names for site and unit ids, so team screens can say "P1, P2" instead of "2 units". */
export function useScopeLookup() {
  const ws = useCurrentWorkspace();
  const map = useFarmMap(ws.orgId, true, ws.has("farm") && ws.can("farm.view"));
  return useMemo(() => {
    const sites = new Map<string, string>();
    const units = new Map<string, string>();
    for (const s of map.data?.sites ?? []) {
      sites.set(s.id, s.name);
      for (const u of s.units) units.set(u.id, u.code);
    }
    return { sites, units };
  }, [map.data]);
}
