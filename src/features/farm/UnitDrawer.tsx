"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, History, Layers, Pencil, Plus, RotateCcw } from "lucide-react";
import { Alert, Badge, Button, Dialog, Field, Input, Select, Pager, Textarea, usePager, useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, relative } from "@/lib/format";
import { type Site, type Unit, type UnitBatch, type UnitStatus, useArchiveUnit, useCatalog, useRestoreUnit, useUnitActivity, useUpdateUnit } from "./api";
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
  const [f, setF] = useState({ code: "", name: "", site: "", kind: "", purpose: "", capacity: "", area: "", volume: "", notes: "" });

  useEffect(() => {
    setEditing(false); setPending(null); setNote(""); setError(null);
    if (unit) setF({ code: unit.code, name: unit.name ?? "", site: unit.site_id, kind: unit.kind, purpose: unit.purpose ?? "",
      capacity: unit.capacity?.toString() ?? "", area: unit.area_m2?.toString() ?? "", volume: unit.volume_m3?.toString() ?? "", notes: unit.notes ?? "" });
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
      capacity: num(f.capacity), area_m2: num(f.area), volume_m3: kinds[f.kind]?.water ? num(f.volume) : null, notes: f.notes || null });
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
        {!archived && <Button variant="primary" onClick={() => setEditing(true)}><Pencil size={16} /> Edit</Button>}
      </> : undefined}>
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
              <Field label="Area (m²)" htmlFor="e-area"><Input id="e-area" inputMode="decimal" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Field>
              {kinds[f.kind]?.water && <Field label="Water volume (m³)" htmlFor="e-vol"><Input id="e-vol" inputMode="decimal" value={f.volume} onChange={(e) => setF({ ...f, volume: e.target.value })} /></Field>}
            </div>
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
              <div><dt className="text-ink-3">Area</dt><dd className="font-semibold">{fmt(unit.area_m2, " m²")}</dd></div>
              {kinds[unit.kind]?.water && <div><dt className="text-ink-3">Water volume</dt><dd className="font-semibold">{fmt(unit.volume_m3, " m³")}</dd></div>}
              <div><dt className="text-ink-3">Site</dt><dd className="font-semibold">{site ? `${site.name} (${site.code})` : "—"}</dd></div>
            </dl>
            {unit.notes && <p className="whitespace-pre-line text-[13.5px] text-ink-2">{unit.notes}</p>}

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
