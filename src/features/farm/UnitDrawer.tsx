"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, History, Layers, Pencil, Plus, RotateCcw, Wallet } from "lucide-react";
import { Alert, Badge, Button, Dialog, Field, Input, Select, Pager, Textarea, usePager, useToast } from "@/components/ui";
import { OwnerActions } from "@/features/corrections";
import { useCanPay } from "@/features/finance/PaymentFields";
import { canWorkAt, usePeople, useSetCaretaker } from "@/features/daily/api";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, relative } from "@/lib/format";
import { type Site, type Unit, type UnitBatch, type UnitStatus, useArchiveUnit, useCatalog, useRestoreUnit, useUnitActivity, useUnitCost, useUpdateUnit } from "./api";
import { BUILDS, BuildField } from "./BuildField";
import { SizeFields, type SizeState, describeSize, noSize, sizeBody, sizeFromUnit } from "./SizeFields";
import { UnitCostFields, type UnitCostState, noUnitCost, unitCostBody, unitCostReady } from "./CostFields";
import { kindIcon, STATUS_LOOK, STATUS_ORDER } from "./look";

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const fmt = (n: number | null, unit = "") => (n == null ? "—" : `${n.toLocaleString("en-NG")}${unit}`);

export function UnitDrawer({ unit, sites, batches = [], onClose, onStock }: {
  unit: Unit | null; sites: Site[]; batches?: UnitBatch[]; onClose: () => void; onStock?: (unitId: string) => void;
}) {
  const ws = useCurrentWorkspace();
  const catalog = useCatalog();
  const update = useUpdateUnit(ws.orgId);
  const archive = useArchiveUnit(ws.orgId);
  const restore = useRestoreUnit(ws.orgId);
  const pg = usePager(10, [unit?.id]);
  const activity = useUnitActivity(ws.orgId, unit?.id ?? null, pg.params);
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<UnitStatus | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [costing, setCosting] = useState(false);
  const canPay = useCanPay();
  const [f, setF] = useState({ code: "", name: "", site: "", kind: "", purpose: "", capacity: "", notes: "", build: "" });
  const [size, setSize] = useState<SizeState>(noSize);

  useEffect(() => {
    setEditing(false); setPending(null); setNote(""); setError(null);
    if (unit) setF({ code: unit.code, name: unit.name ?? "", site: unit.site_id, kind: unit.kind, purpose: unit.purpose ?? "",
      capacity: unit.capacity?.toString() ?? "", notes: unit.notes ?? "", build: unit.build ?? "" });
    if (unit) setSize(sizeFromUnit(unit));
  }, [unit]);

  if (!unit) return null;
  const canSetup = ws.can("farm.setup");
  const canEdit = ws.can("farm.edit") || canSetup;
  const kinds = catalog.data?.kinds ?? {};
  const statuses = catalog.data?.statuses;
  const Icon = kindIcon(unit.kind);
  const site = sites.find((s) => s.id === unit.site_id);
  const archived = !!unit.archived_at;

  const run = async (fn: () => Promise<unknown>, done: string, close = false) => {
    setError(null);
    try { await fn(); toast(done); if (close) onClose(); } catch (e) { setError(e instanceof ApiError ? e.message : "Something went wrong."); }
  };
  const setStatus = () => pending && run(async () => {
    await update.mutateAsync({ id: unit.id, status: pending, status_note: note.trim() || null });
    setPending(null); setNote("");
  }, `${unit.code} is now ${statuses?.[pending]?.toLowerCase() ?? pending}`);
  const save = () => run(async () => {
    await update.mutateAsync({ id: unit.id, code: f.code, name: f.name || null, site_id: f.site, kind: f.kind, purpose: f.purpose || null,
      capacity: num(f.capacity), build: kinds[f.kind]?.water ? f.build || null : null, ...sizeBody(size, !!kinds[f.kind]?.water), notes: f.notes || null });
    setEditing(false);
  }, `Saved ${f.code}`);

  return (
    <Dialog open={!!unit} onClose={onClose} side title={`${unit.code}${unit.name ? ` · ${unit.name}` : ""}`}
      eyebrow={`${kinds[unit.kind]?.label ?? unit.kind} · ${site?.name ?? ""}`}
      footer={editing ? <>
        <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        <Button variant="primary" loading={update.isPending} onClick={save}>Save</Button>
      </> : canSetup ? <>
        {archived
          ? <Button loading={restore.isPending} onClick={() => run(() => restore.mutateAsync(unit.id), `Restored ${unit.code}`, true)}><RotateCcw size={16} /> Restore</Button>
          : <Button variant="ghost" loading={archive.isPending} onClick={() => run(() => archive.mutateAsync(unit.id), `Archived ${unit.code}`, true)}><Archive size={16} /> Archive</Button>}
        <OwnerActions kind="unit" id={unit.id} compact edit={false} onDeleted={onClose} />
        {canPay && !archived && <Button variant="ghost" onClick={() => setCosting(true)}><Wallet size={16} /> What it cost</Button>}
        {!archived && <Button variant="primary" onClick={() => setEditing(true)}><Pencil size={16} /> Edit</Button>}
      </> : undefined}>
      {costing && <UnitCostDialog unit={unit} onClose={() => setCosting(false)} />}
      <div className="flex flex-col gap-5">
        {error && <Alert tone="crit">{error}</Alert>}
        {archived && <Alert tone="warn">Archived {relative(unit.archived_at!)}. Its history is kept; it does not count against your plan.</Alert>}
        {editing ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code" htmlFor="e-code"><Input id="e-code" value={f.code} maxLength={20} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
              <Field label="Name" htmlFor="e-name"><Input id="e-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Kind" htmlFor="e-kind"><Select id="e-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                {Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
              <Field label="Site" htmlFor="e-site"><Select id="e-site" value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })}>
                {sites.filter((s) => s.status === "active").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
              <Field label="Used for" htmlFor="e-purpose"><Select id="e-purpose" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })}>
                <option value="">Not set</option>{Object.entries(catalog.data?.purposes ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              <Field label={`Capacity (${kinds[f.kind]?.counts ?? "head"})`} htmlFor="e-cap"><Input id="e-cap" inputMode="numeric" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value.replace(/\D/g, "") })} /></Field>
            </div>
            <SizeFields value={size} onChange={setSize} water={!!kinds[f.kind]?.water} idPrefix="e-size" />
            <BuildField id="e-build" kind={f.kind} purpose={f.purpose} build={f.build} onChange={(build) => setF({ ...f, build })} size={size} />
            <Field label="Notes" htmlFor="e-notes"><Textarea id="e-notes" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className={cn("grid h-12 w-12 place-items-center rounded-2xl border", STATUS_LOOK[unit.status].tile)}><Icon size={22} /></span>
              <div>
                <Badge tone={STATUS_LOOK[unit.status].badge} dot>{statuses?.[unit.status] ?? unit.status}</Badge>
                <div className="mt-1 text-[12.5px] text-ink-3">{unit.status_changed_at ? `Since ${relative(unit.status_changed_at)}` : ""}{unit.status_note ? ` · ${unit.status_note}` : ""}</div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-surface-2 p-4 text-[13.5px]">
              <div><dt className="text-ink-3">Used for</dt><dd className="font-semibold">{unit.purpose ? catalog.data?.purposes[unit.purpose] : "—"}</dd></div>
              <div><dt className="text-ink-3">Capacity</dt><dd className="font-semibold">{fmt(unit.capacity, ` ${kinds[unit.kind]?.counts ?? ""}`)}</dd></div>
              {(() => {
                const d = describeSize(unit, !!kinds[unit.kind]?.water);
                return <>
                  {d.dims && <div><dt className="text-ink-3">Size</dt><dd className="font-semibold">{d.dims}</dd></div>}
                  <div><dt className="text-ink-3">Floor</dt><dd className="font-semibold">{d.area ?? "—"}</dd></div>
                  {kinds[unit.kind]?.water && <div><dt className="text-ink-3">Water</dt><dd className="font-semibold">{d.water ?? "—"}</dd></div>}
                </>;
              })()}
              <div><dt className="text-ink-3">Site</dt><dd className="font-semibold">{site ? `${site.name} (${site.code})` : "—"}</dd></div>
              {kinds[unit.kind]?.water && <div><dt className="text-ink-3">Built</dt><dd className="font-semibold">{unit.build ? BUILDS[unit.build] : "—"}</dd></div>}
            </dl>
            {unit.stock_advice && <p className="rounded-xl border border-line p-3 text-[13px] text-ink-2">
              Room for about <b className="tnum">{unit.stock_advice.good.toLocaleString("en-NG")}</b> catfish to {unit.stock_advice.harvest_g / 1000} kg,
              {" "}<b className="tnum">{unit.stock_advice.most.toLocaleString("en-NG")}</b> at most ({unit.stock_advice.rate}, from {unit.stock_advice.basis}).
              {unit.stock_advice.assumed && ` Worked out as ${unit.stock_advice.build === "earthen" ? "an earthen pond" : "a tarpaulin or concrete tank"}; set how it is built for a better figure.`}
              {unit.capacity ? ` Your own capacity of ${unit.capacity.toLocaleString("en-NG")} is what Oko checks when you stock.` : ""}</p>}
            {unit.notes && <p className="whitespace-pre-line text-[13.5px] text-ink-2">{unit.notes}</p>}
            {!archived && <LooksAfter unit={unit} />}

            {!archived && (
              <div className="flex flex-col gap-2">
                <div className="eyebrow flex items-center gap-1.5"><Layers size={13} /> Batches here</div>
                {batches.length ? (
                  <ul className="flex flex-col gap-2">
                    {batches.map((b) => (
                      <li key={b.id}><Link href={`/w/${ws.orgId}/batches/${b.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 hover:bg-surface-2">
                        <span><b className="font-mono">{b.code}</b> <span className="text-[12.5px] text-ink-3">· {Math.floor(b.age_days / 7)} weeks old</span></span>
                        <b className="tnum">{b.count.toLocaleString("en-NG")}</b></Link></li>
                    ))}
                  </ul>
                ) : <p className="text-[13px] text-ink-3">No animals in this unit.</p>}
                {ws.can("farm.approve") && onStock && (
                  <div><Button size="sm" variant={batches.length ? "ghost" : "primary"} onClick={() => onStock(unit.id)}><Plus size={14} /> {batches.length ? "Stock another batch here" : "Stock this unit"}</Button></div>
                )}
              </div>
            )}

            {canEdit && !archived && (
              <div className="flex flex-col gap-2">
                <div className="eyebrow">Change status</div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_ORDER.filter((s) => s !== unit.status && (batches.length ? s === "stocked" || s === "quarantine" : s !== "stocked")).map((s) => (
                    <button key={s} type="button" onClick={() => setPending(pending === s ? null : s)} aria-pressed={pending === s}
                      className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold",
                        pending === s ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-ink-3")}>
                      <span className={cn("h-2 w-2 rounded-full", STATUS_LOOK[s].dot)} />{statuses?.[s] ?? s}
                    </button>
                  ))}
                </div>
                {pending && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Field label="Note (optional)" htmlFor="status-note" className="flex-1"><Input id="status-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)}
                      placeholder={pending === "resting" ? "Drained and limed" : pending === "maintenance" ? "Roof repair" : pending === "quarantine" ? "Sick birds isolated" : ""} /></Field>
                    <Button variant="primary" loading={update.isPending} onClick={setStatus}>Mark {statuses?.[pending]?.toLowerCase()}</Button>
                  </div>
                )}
                <p className="text-[12.5px] text-ink-3">{batches.length ? "While animals are in it, the unit stays stocked (or quarantine). It goes to resting when the batch leaves." : "“Stocked” is set automatically when a batch is stocked here."}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="eyebrow flex items-center gap-1.5"><History size={13} /> History</div>
              {activity.isLoading ? <p className="text-ink-3">Loading…</p> : !activity.data?.items.length ? <p className="text-ink-3">Nothing yet.</p> : (
                <ol className="flex flex-col">
                  {activity.data.items.map((a, i) => (
                    <li key={i} className="border-t border-line py-2 text-[13.5px] first:border-0">
                      <div>{a.summary}</div>
                      <div className="text-[12px] text-ink-3">{a.actor_name ?? "Oko"} · {relative(a.created_at)}</div>
                    </li>
                  ))}
                </ol>
              )}
              <Pager {...pg.bind(activity.data?.total, activity.isFetching)} noun="entries" />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

/** For a unit added before its cost was known: record what it cost to build or buy (or add an aerator, a roof). */
function UnitCostDialog({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const save = useUnitCost(ws.orgId);
  const toast = useToast();
  const [cost, setCost] = useState<UnitCostState>(noUnitCost);
  const [error, setError] = useState<string | null>(null);
  const body = unitCostBody(cost, true);
  return (
    <Dialog open onClose={onClose} title="What it cost" eyebrow={unit.code}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={save.isPending} disabled={!body || !unitCostReady(cost, true)} onClick={async () => {
          if (!body) return;
          setError(null);
          try { await save.mutateAsync({ id: unit.id, ...body }); toast(`Cost recorded for ${unit.code}`); onClose(); }
          catch (e) { setError(e instanceof ApiError ? e.message : "Could not save"); }
        }}>Save</Button></>}>
      <div className="flex flex-col gap-3">
        {error && <Alert tone="crit">{error}</Alert>}
        <UnitCostFields value={cost} onChange={setCost} open />
      </div>
    </Dialog>
  );
}


/** Who looks after this unit: its tasks go to them on Today. */
function LooksAfter({ unit }: { unit: Unit }) {
  const ws = useCurrentWorkspace();
  const canSet = ws.can("farm.approve");
  const people = usePeople(ws.orgId, canSet);
  const set = useSetCaretaker(ws.orgId);
  const toast = useToast();
  if (!canSet) return null;
  const team = (people.data ?? []).filter((p) => canWorkAt(p, unit.id));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5">
      <label htmlFor="u-caretaker" className="text-[13.5px]"><b>Looked after by</b><span className="block text-[12px] text-ink-3">Its tasks show as theirs on Today</span></label>
      <div className="w-full sm:w-[220px]"><Select id="u-caretaker" className="h-9 text-[13px]" value={unit.caretaker_id ?? ""} disabled={set.isPending}
        onChange={async (e) => {
          const id = e.target.value || null;
          try { await set.mutateAsync({ unitId: unit.id, user_id: id }); toast(id ? `${unit.code} is looked after by ${team.find((p) => p.user_id === id)?.name}` : `${unit.code}: anyone on shift`); }
          catch (er) { toast(er instanceof ApiError ? er.message : "Could not save", "crit"); }
        }}>
        <option value="">Anyone on shift</option>
        {team.map((p) => <option key={p.user_id} value={p.user_id}>{p.me ? `Me (${p.name})` : p.name}</option>)}
      </Select></div>
    </div>
  );
}
