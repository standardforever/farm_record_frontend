"use client";

import { useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { Button, Field, Select } from "@/components/ui";
import { locate } from "@/features/daily/device";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import { locatePlace, useStateDetail, useStates } from "./api";

export type Place = { state: string; lga: string; ward?: string };
export type Fix = { latitude: number; longitude: number; accuracy_m: number };

/**
 * State → LGA → ward pickers from the official lists, plus "Use my location", which reads
 * the phone's GPS and fills all three. Pass `withWard` where a precise place matters (a site);
 * a workspace only needs state and LGA.
 */
export function LocationFields({ value, onChange, withWard = false, onFix, disabled, idPrefix = "loc" }: {
  value: Place; onChange: (p: Place) => void; withWard?: boolean; onFix?: (f: Fix) => void; disabled?: boolean; idPrefix?: string;
}) {
  const states = useStates();
  const detail = useStateDetail(value.state);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const lgas = detail.data?.lgas ?? [];
  const lga = lgas.find((l) => l.name === value.lga);
  const wards = lga?.wards ?? [];
  // A value saved before the lists existed (free text) stays visible until it is changed.
  const oldLga = value.lga && detail.data && !lga ? value.lga : null;
  const oldState = value.state && states.data && !states.data.some((s) => s.name === value.state) ? value.state : null;

  const useGps = async () => {
    setBusy(true); setMsg(null);
    try {
      const fix = await locate();
      onFix?.(fix);
      try {
        const p = await locatePlace(fix.latitude, fix.longitude);
        onChange({ state: p.state, lga: p.lga, ...(withWard ? { ward: p.ward } : {}) });
        setMsg({ tone: "ok", text: `Found: ${withWard ? `${p.ward} ward, ` : ""}${p.lga}, ${p.state}. Check it is right.` });
      } catch (e) {
        setMsg({ tone: "err", text: e instanceof ApiError ? e.message : "Saved the GPS point, but could not match it to a ward." });
      }
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("grid gap-4", withWard ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <Field label="State" htmlFor={`${idPrefix}-state`}>
          <Select id={`${idPrefix}-state`} disabled={disabled} value={value.state}
            onChange={(e) => onChange({ state: e.target.value, lga: "", ...(withWard ? { ward: "" } : {}) })}>
            <option value="">{states.isLoading ? "Loading…" : "Choose a state"}</option>
            {oldState && <option value={oldState}>{oldState} (choose again)</option>}
            {states.data?.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="LGA" htmlFor={`${idPrefix}-lga`}>
          <Select id={`${idPrefix}-lga`} disabled={disabled || !value.state} value={value.lga}
            onChange={(e) => onChange({ ...value, lga: e.target.value, ...(withWard ? { ward: "" } : {}) })}>
            <option value="">{!value.state ? "Choose the state first" : detail.isLoading ? "Loading…" : "Choose an LGA"}</option>
            {oldLga && <option value={oldLga}>{oldLga} (choose again)</option>}
            {lgas.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
          </Select>
        </Field>
        {withWard && (
          <Field label="Ward" htmlFor={`${idPrefix}-ward`} hint="Optional">
            <Select id={`${idPrefix}-ward`} disabled={disabled || !lga} value={value.ward ?? ""}
              onChange={(e) => onChange({ ...value, ward: e.target.value })}>
              <option value="">{!lga ? "Choose the LGA first" : "Choose a ward"}</option>
              {wards.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
            </Select>
          </Field>
        )}
      </div>
      {!disabled && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Button type="button" size="sm" variant="ghost" loading={busy} onClick={useGps}><LocateFixed size={15} /> Use my location</Button>
          {msg && <span role="status" className={cn("inline-flex items-center gap-1.5 text-[12.5px]", msg.tone === "ok" ? "text-ink-2" : "text-crit")}>
            {msg.tone === "ok" && <MapPin size={13} className="shrink-0 text-brand" />}{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
