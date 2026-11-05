"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Dialog, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { useCatalog, useFarmMap } from "@/features/farm";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import { usePacks } from "@/features/packs";
import { today, useBatchCatalog, useStockBatch } from "./api";

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/,/g, "")));

/** Stock a new batch into one or more units. */
export function StockBatchDialog({ open, onClose, presetUnit, onStocked }: {
  open: boolean; onClose: () => void; presetUnit?: string; onStocked?: (batchId: string) => void;
}) {
  const ws = useCurrentWorkspace();
  const router = useRouter();
  const farm = useFarmMap(ws.orgId, false, open);
  const units = useCatalog();
  const cat = useBatchCatalog();
  const stock = useStockBatch(ws.orgId);
  const packs = usePacks();
  const toast = useToast();
  const money = ws.can("finance.view");
  const [f, setF] = useState({ species: "", breed: "", breed_key: "", source_type: "purchased", source_name: "", started_on: today(), age: "", weight: "", cost: "", notes: "" });
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const allUnits = useMemo(() => (farm.data?.sites ?? []).flatMap((s) => s.units.filter((u) => !u.archived_at).map((u) => ({ ...u, site: s.name }))), [farm.data]);
  useEffect(() => {
    if (!open) return;
    setError(null);
    const pre = allUnits.find((u) => u.id === presetUnit);
    setCounts(presetUnit ? { [presetUnit]: pre?.capacity ? String(pre.capacity) : "" } : {});
    setF((x) => ({ ...x, species: pre?.purpose && cat.data?.species[pre.purpose] ? pre.purpose : x.species, started_on: today() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetUnit]);

  const chosen = Object.entries(counts).filter(([, v]) => v !== undefined);
  const total = chosen.reduce((n, [, v]) => n + (Number(v) || 0), 0);
  const valid = f.species && chosen.length > 0 && chosen.every(([, v]) => Number(v) > 0);
  const occupied = farm.data?.unit_batches ?? {};
  const cycle = f.species ? cat.data?.species[f.species]?.cycle_days : null;
  const pack = packs.data?.find((p) => p.key === f.species) ?? null;
  // Default to the pack's first breed when the species changes.
  useEffect(() => { setF((x) => ({ ...x, breed_key: pack?.breeds[0]?.key ?? "" })); }, [pack]);

  const save = async () => {
    setError(null);
    try {
      const b = await stock.mutateAsync({
        species: f.species, breed: f.breed_key ? null : f.breed || null, breed_key: f.breed_key || undefined, source_type: f.source_type, source_name: f.source_name || null, started_on: f.started_on,
        age_at_start_days: Number(f.age) || 0, avg_start_weight_g: num(f.weight), acquisition_cost: money ? num(f.cost) : null,
        units: chosen.map(([unit_id, v]) => ({ unit_id, count: Number(v) })), notes: f.notes || null,
      });
      toast(`Stocked ${b.code}: ${b.current.toLocaleString("en-NG")} ${units.data?.purposes[b.species]?.toLowerCase() ?? ""}`);
      onClose();
      if (onStocked) onStocked(b.id); else router.push(`/w/${ws.orgId}/batches/${b.id}`);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not stock the batch."); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Stock a batch" eyebrow="Batches" wide
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={stock.isPending} disabled={!valid} onClick={save}>Stock {total ? total.toLocaleString("en-NG") : ""}</Button>
      </>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Species" htmlFor="b-species"><Select id="b-species" value={f.species} onChange={(e) => setF({ ...f, species: e.target.value })}>
            <option value="">Choose…</option>
            {Object.keys(cat.data?.species ?? {}).map((k) => <option key={k} value={k}>{units.data?.purposes[k] ?? k}</option>)}</Select></Field>
          {pack ? (
            <Field label="Breed" htmlFor="b-breed-key" hint="Sets the growth standard and vaccination dates">
              <Select id="b-breed-key" value={f.breed_key} onChange={(e) => setF({ ...f, breed_key: e.target.value })}>
                {pack.breeds.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}
                <option value="">Other (type it)</option>
              </Select>
              {!f.breed_key && <Input aria-label="Breed name" className="mt-2" value={f.breed} onChange={(e) => setF({ ...f, breed: e.target.value })} placeholder="Breed or strain" />}
            </Field>
          ) : (
            <Field label="Breed or strain" htmlFor="b-breed" hint="Optional"><Input id="b-breed" value={f.breed} onChange={(e) => setF({ ...f, breed: e.target.value })} placeholder="Arbor Acres, Clarias, ISA Brown…" /></Field>
          )}
          <Field label="Where from" htmlFor="b-source"><Select id="b-source" value={f.source_type} onChange={(e) => setF({ ...f, source_type: e.target.value })}>
            {Object.entries(cat.data?.sources ?? {}).filter(([k]) => k !== "split").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Hatchery, supplier or farm" htmlFor="b-source-name" hint="Optional"><Input id="b-source-name" value={f.source_name} onChange={(e) => setF({ ...f, source_name: e.target.value })} /></Field>
          <Field label="Date stocked" htmlFor="b-date"><Input id="b-date" type="date" max={today()} value={f.started_on} onChange={(e) => setF({ ...f, started_on: e.target.value })} /></Field>
          <Field label="Age when stocked (days)" htmlFor="b-age" hint="0 for day-old chicks; fingerlings are often 28"><Input id="b-age" inputMode="numeric" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value.replace(/\D/g, "") })} placeholder="0" /></Field>
          <Field label="Average weight (g)" htmlFor="b-weight" hint="Optional"><Input id="b-weight" inputMode="decimal" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></Field>
          {money && <Field label="Total purchase cost (₦)" htmlFor="b-cost" hint="Whole bill, paid or not"><Input id="b-cost" inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></Field>}
        </div>
        {cycle ? <p className="-mt-1 text-[12.5px] text-ink-3">A typical {units.data?.purposes[f.species]?.toLowerCase()} cycle is about {cycle} days; the expected end date is set from that.</p> : null}
        {pack && (pack.vaccinations > 0 || pack.phases > 1) && <p className="-mt-2 text-[12.5px] text-ink-3">Vaccinations and feed changes from the {pack.name.toLowerCase()} pack will appear in Today on their dates.</p>}

        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-2">Which units, and how many in each?</span>
          {farm.isLoading ? <p className="text-ink-3">Loading units…</p> : allUnits.length === 0 ? (
            <Alert tone="warn">Add units on the Farm map first.</Alert>
          ) : (
            <ul className="grid max-h-[300px] gap-2 overflow-y-auto sm:grid-cols-2">
              {allUnits.map((u) => {
                const on = counts[u.id] !== undefined;
                const inIt = occupied[u.id] ?? [];
                return (
                  <li key={u.id} className={cn("flex items-center gap-2 rounded-xl border p-2.5", on ? "border-brand bg-brand-soft" : "border-line")}>
                    <input type="checkbox" aria-label={`Use ${u.code}`} className="h-[18px] w-[18px] accent-[var(--brand)]" checked={on}
                      onChange={(e) => setCounts((c) => { const n = { ...c }; if (e.target.checked) n[u.id] = u.capacity ? String(u.capacity) : ""; else delete n[u.id]; return n; })} />
                    <span className="min-w-0 flex-1">
                      <b className="font-mono">{u.code}</b>{u.name ? <span className="text-ink-2"> · {u.name}</span> : null}
                      <span className="block truncate text-[12px] text-ink-3">
                        {inIt.length ? `Has ${inIt.map((b) => b.code).join(", ")}` : u.status === "resting" ? "Resting" : u.capacity ? `Holds ${u.capacity.toLocaleString("en-NG")}` : u.site}
                      </span>
                    </span>
                    {on && <div className="w-[96px] shrink-0"><Input aria-label={`How many in ${u.code}`} inputMode="numeric" value={counts[u.id]}
                      onChange={(e) => setCounts((c) => ({ ...c, [u.id]: e.target.value.replace(/\D/g, "") }))} placeholder="Count" /></div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Field label="Notes" htmlFor="b-notes" hint="Optional"><Textarea id="b-notes" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}
