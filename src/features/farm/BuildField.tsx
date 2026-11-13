"use client";

import { Field, Select } from "@/components/ui";
import { usePacks } from "@/features/packs";
import { type SizeState, sizeWork } from "./SizeFields";

export const BUILDS: Record<string, string> = { tarpaulin: "Tarpaulin", concrete: "Concrete", plastic: "Plastic tank", earthen: "Earthen pond", other: "Other" };
const FISH = new Set(["", "catfish", "fingerlings", "mixed"]);

/** How a pond or tank is built, and how many fish it holds at harvest size from its size (catfish pack densities). */
export function BuildField({ id, kind, purpose, build, onChange, size, each }: {
  id: string; kind: string; purpose: string; build: string; onChange: (b: string) => void; size: SizeState; each?: boolean;
}) {
  const packs = usePacks();
  if (kind !== "pond" && kind !== "tank") return null;
  const stocking = packs.data?.find((p) => p.key === "catfish")?.stocking;
  const w = size.exact ? { area: Number(size.area) || null, m3: Number(size.volume) || null } : sizeWork(size, true);
  const b = build && build !== "other" ? build : kind === "tank" || w?.m3 ? "tarpaulin" : "earthen";
  const d = stocking?.by_build[b];
  const amount = d ? (d.per === "m3" ? w?.m3 : w?.area) : null;
  const n = (x: number) => Math.floor(x).toLocaleString("en-NG");
  return (
    <div className="flex flex-col gap-1.5">
      <Field label="How it is built" htmlFor={id} hint="For how many fish it can hold">
        <Select id={id} value={build} onChange={(e) => onChange(e.target.value)}>
          <option value="">Not set</option>{Object.entries(BUILDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      {FISH.has(purpose) && d && (amount
        ? <p className="rounded-lg bg-surface-2 p-2.5 text-[12.5px] text-ink-2">
            {each ? "Each holds" : "Holds"} about <b className="tnum">{n(amount * d.good)}</b> catfish to {stocking!.harvest_g / 1000} kg comfortably,
            {" "}<b className="tnum">{n(amount * d.most)}</b> at most ({d.good}–{d.most} per {d.per === "m3" ? "m³ of water" : "m² of water surface"}).
            {!build && " Set how it is built for a better figure."} {d.note}</p>
        : <p className="text-[12.5px] text-ink-3">Add its size to see how many fish it holds.</p>)}
    </div>
  );
}
