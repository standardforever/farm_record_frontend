"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Dialog, Field, Input, Segmented, Select, useToast } from "@/components/ui";
import { useCanPay } from "@/features/finance/PaymentFields";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import { type Site, useBulkUnits, useCatalog, useCreateUnit } from "./api";
import { SizeFields, type SizeState, noSize, sizeBody, sizeReady } from "./SizeFields";
import { UnitCostFields, type UnitCostState, noUnitCost, unitCostBody, unitCostReady } from "./CostFields";
import { kindIcon } from "./look";

const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function AddUnitsDialog({ open, onClose, sites, presetSite, room }: {
  open: boolean; onClose: () => void; sites: Site[]; presetSite?: string; room: number | null;
}) {
  const ws = useCurrentWorkspace();
  const catalog = useCatalog();
  const bulk = useBulkUnits(ws.orgId);
  const single = useCreateUnit(ws.orgId);
  const toast = useToast();
  const [mode, setMode] = useState<"many" | "one">("many");
  const [f, setF] = useState({ site: "", kind: "pond", count: "4", prefix: "", start: "", code: "", name: "", purpose: "", capacity: "" });
  const [error, setError] = useState<string | null>(null);
  const canPay = useCanPay();
  const [cost, setCost] = useState<UnitCostState>(noUnitCost);
  const [size, setSize] = useState<SizeState>(noSize);

  useEffect(() => {
    if (open) { setError(null); setCost(noUnitCost()); setSize(noSize()); setF((x) => ({ ...x, site: presetSite ?? sites[0]?.id ?? "", code: "", name: "" })); }
  }, [open, presetSite, sites]);

  const kinds = catalog.data?.kinds ?? {};
  const kind = kinds[f.kind];
  const count = Math.max(1, Math.min(50, Number(f.count) || 1));
  const prefix = (f.prefix || kind?.prefix || "U").toUpperCase();
  const preview = useMemo(() => {
    const s = f.start ? Number(f.start) : null;
    return s == null ? `${prefix}… (next free numbers)` : count === 1 ? `${prefix}${s}` : `${prefix}${s} – ${prefix}${s + count - 1}`;
  }, [f.start, prefix, count]);
  const overLimit = room !== null && (mode === "many" ? count : 1) > room;

  const save = async () => {
    setError(null);
    const shared = { site_id: f.site, kind: f.kind, purpose: f.purpose || null, capacity: num(f.capacity), ...sizeBody(size, !!kind?.water),
      cost: unitCostBody(cost, canPay) };
    try {
      if (mode === "many") {
        const units = await bulk.mutateAsync({ ...shared, count, ...(f.prefix ? { prefix: f.prefix } : {}), ...(f.start ? { start: Number(f.start) } : {}) });
        toast(`Added ${units.length} ${kind?.label.toLowerCase()}${units.length > 1 ? "s" : ""}: ${units[0].code}${units.length > 1 ? `–${units[units.length - 1].code}` : ""}`);
      } else {
        const u = await single.mutateAsync({ ...shared, ...(f.code ? { code: f.code } : {}), name: f.name || null });
        toast(`Added ${u.code}`);
      }
      onClose();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not add."); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add units" eyebrow="Farm" wide
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={bulk.isPending || single.isPending} disabled={!f.site || overLimit || !unitCostReady(cost, canPay) || !sizeReady(size, !!kind?.water)} onClick={save}>
          {mode === "many" ? `Add ${count}` : "Add unit"}</Button>
      </>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        {room !== null && <Alert tone={overLimit ? "warn" : "info"}>Your plan has room for {room} more unit{room === 1 ? "" : "s"}.{overLimit ? " Add fewer, archive unused units, or upgrade." : ""}</Alert>}
        <div className="flex flex-col gap-1.5"><span className="text-[12.5px] font-semibold text-ink-2">What are you adding?</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Object.entries(kinds).map(([k, v]) => {
              const Icon = kindIcon(k);
              return (
                <button key={k} type="button" onClick={() => setF({ ...f, kind: k })} aria-pressed={f.kind === k}
                  className={cn("flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-2.5 text-center text-[12.5px] font-semibold",
                    f.kind === k ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-ink-3")}>
                  <Icon size={19} />{v.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Segmented value={mode} onChange={setMode} options={[{ value: "many", label: "Several at once" }, { value: "one", label: "Just one" }]} />
          {sites.length > 1 && (
            <Field label="Site" htmlFor="u-site" className="min-w-[180px] flex-1"><Select id="u-site" value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })}>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</Select></Field>
          )}
        </div>
        {mode === "many" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="How many" htmlFor="u-count"><Input id="u-count" inputMode="numeric" value={f.count} onChange={(e) => setF({ ...f, count: e.target.value.replace(/\D/g, "") })} /></Field>
            <Field label="Code letters" htmlFor="u-prefix" hint={`Default ${kind?.prefix ?? ""}`}><Input id="u-prefix" value={f.prefix} maxLength={6} onChange={(e) => setF({ ...f, prefix: e.target.value.replace(/[^A-Za-z-]/g, "").toUpperCase() })} placeholder={kind?.prefix} /></Field>
            <Field label="Start at number" htmlFor="u-start" hint="Optional"><Input id="u-start" inputMode="numeric" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value.replace(/\D/g, "") })} /></Field>
            <p className="-mt-2 text-[13px] text-ink-2 sm:col-span-3">Codes: <b className="font-mono">{preview}</b></p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" htmlFor="u-code" hint="Optional. Generated when empty"><Input id="u-code" value={f.code} maxLength={20} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder={`${kind?.prefix ?? ""}1`} /></Field>
            <Field label="Name" htmlFor="u-name" hint="Optional"><Input id="u-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Layer house A" /></Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Used for" htmlFor="u-purpose"><Select id="u-purpose" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })}>
            <option value="">Not set</option>{Object.entries(catalog.data?.purposes ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label={`Capacity (${kind?.counts ?? "head"})`} htmlFor="u-capacity" hint={mode === "many" ? "Each" : undefined}>
            <Input id="u-capacity" inputMode="numeric" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value.replace(/\D/g, "") })} /></Field>
        </div>
        <SizeFields value={size} onChange={setSize} water={!!kind?.water} each={mode === "many" && count > 1} idPrefix="u-size" />
        <UnitCostFields value={cost} onChange={setCost} count={mode === "many" ? count : 1} />
      </div>
    </Dialog>
  );
}
