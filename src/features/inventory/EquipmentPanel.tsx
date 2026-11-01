"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { Alert, Badge, Button, Dialog, EmptyState, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { localDay } from "@/features/daily/api";
import { useFarmMap } from "@/features/farm";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { naira } from "@/lib/format";
import { type Equipment, useEquipment, useInventoryCatalog, useSaveEquipment, useServiced } from "./api";

const day = (iso: string | null) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—");
const TONE: Record<string, "good" | "warn" | "crit" | "neutral"> = { working: "good", needs_service: "warn", broken: "crit", retired: "neutral" };

export function EquipmentPanel() {
  const ws = useCurrentWorkspace();
  const cat = useInventoryCatalog();
  const list = useEquipment(ws.orgId);
  const [editing, setEditing] = useState<Equipment | "new" | null>(null);
  const [servicing, setServicing] = useState<Equipment | null>(null);
  const edit = ws.can("inventory.edit");
  const canService = edit || ws.can("farm.edit");
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px] text-ink-3">Generators, pumps, aerators and other kit: where it is, its state and when it is due a service.</p>
        {edit && <Button variant="primary" onClick={() => setEditing("new")}>Add equipment</Button>}
      </div>
      {list.data && list.data.length === 0 ? <EmptyState icon={<Wrench size={22} />} title="No equipment yet" body="Add the generator first: it is the one that stops the farm when it fails." /> : (
        <ul className="grid gap-2 md:grid-cols-2">
          {list.data?.map((e) => (
            <li key={e.id} className="rounded-xl border border-line bg-surface p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-[14.5px]">{e.name}</b>
                <Badge tone={TONE[e.status]}>{cat.data?.equipment_status[e.status] ?? e.status}</Badge>
                {e.service_due && e.status !== "broken" && <Badge tone="warn">Service due {day(e.next_service_on)}</Badge>}
              </div>
              <p className="mt-0.5 text-[12.5px] text-ink-3">{[cat.data?.equipment_kinds[e.kind], e.unit_code ?? e.site_name, e.serial && `S/N ${e.serial}`,
                e.cost != null && naira(e.cost)].filter(Boolean).join(" · ")}</p>
              <p className="text-[12.5px] text-ink-3">Last service {day(e.last_service_on)} · next {day(e.next_service_on)}</p>
              <div className="mt-2 flex gap-1.5">
                {canService && <Button size="sm" onClick={() => setServicing(e)}>Mark serviced</Button>}
                {edit && <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>Edit</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <EquipmentDialog e={editing} onClose={() => setEditing(null)} />
      <ServicedDialog e={servicing} onClose={() => setServicing(null)} />
    </>
  );
}

function EquipmentDialog({ e, onClose }: { e: Equipment | "new" | null; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const cat = useInventoryCatalog();
  const farm = useFarmMap(ws.orgId, false, !!e);
  const save = useSaveEquipment(ws.orgId);
  const toast = useToast();
  const blank = { name: "", kind: "generator", unit: "", serial: "", bought: "", cost: "", status: "working", next: "", notes: "" };
  const [f, setF] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!e) return;
    setError(null);
    setF(e === "new" ? blank : { name: e.name, kind: e.kind, unit: e.unit_id ?? "", serial: e.serial ?? "", bought: e.bought_on ?? "", cost: e.cost?.toString() ?? "",
      status: e.status, next: e.next_service_on ?? "", notes: e.notes ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e]);
  if (!e) return null;
  const units = (farm.data?.sites ?? []).flatMap((s) => s.units.filter((u) => !u.archived_at));
  return (
    <Dialog open={!!e} onClose={onClose} title={e === "new" ? "Add equipment" : `Edit ${e.name}`} eyebrow="Equipment"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={f.name.trim().length < 2} onClick={async () => {
        setError(null);
        try {
          await save.mutateAsync({ ...(e !== "new" ? { id: e.id } : {}), name: f.name.trim(), kind: f.kind, unit_id: f.unit || null, serial: f.serial || null,
            bought_on: f.bought || null, ...(ws.can("finance.view") ? { cost: f.cost ? Number(f.cost) : null } : {}), status: f.status,
            next_service_on: f.next || null, notes: f.notes || null });
          toast(e === "new" ? `Added ${f.name}` : `Saved ${f.name}`); onClose();
        } catch (err) { setError(err instanceof ApiError ? err.message : "Could not save."); }
      }}>Save</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="e-name"><Input id="e-name" value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} placeholder="Mikano 20 kVA" /></Field>
          <Field label="Kind" htmlFor="e-kind"><Select id="e-kind" value={f.kind} onChange={(x) => setF({ ...f, kind: x.target.value })}>
            {Object.entries(cat.data?.equipment_kinds ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Where" htmlFor="e-unit"><Select id="e-unit" value={f.unit} onChange={(x) => setF({ ...f, unit: x.target.value })}>
            <option value="">Whole farm</option>{units.map((u) => <option key={u.id} value={u.id}>{u.code}{u.name ? ` · ${u.name}` : ""}</option>)}</Select></Field>
          <Field label="State" htmlFor="e-status"><Select id="e-status" value={f.status} onChange={(x) => setF({ ...f, status: x.target.value })}>
            {Object.entries(cat.data?.equipment_status ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Next service" htmlFor="e-next" hint="You get a reminder a week before"><Input id="e-next" type="date" value={f.next} onChange={(x) => setF({ ...f, next: x.target.value })} /></Field>
          <Field label="Serial number" htmlFor="e-serial" hint="Optional"><Input id="e-serial" value={f.serial} onChange={(x) => setF({ ...f, serial: x.target.value })} /></Field>
          <Field label="Bought on" htmlFor="e-bought" hint="Optional"><Input id="e-bought" type="date" max={localDay()} value={f.bought} onChange={(x) => setF({ ...f, bought: x.target.value })} /></Field>
          {ws.can("finance.view") && <Field label="Cost (₦)" htmlFor="e-cost" hint="Optional"><Input id="e-cost" inputMode="decimal" value={f.cost} onChange={(x) => setF({ ...f, cost: x.target.value.replace(/[^\d.]/g, "") })} /></Field>}
        </div>
        <Field label="Notes" htmlFor="e-notes" hint="Optional"><Textarea id="e-notes" rows={2} value={f.notes} onChange={(x) => setF({ ...f, notes: x.target.value })} /></Field>
      </div>
    </Dialog>
  );
}

function ServicedDialog({ e, onClose }: { e: Equipment | null; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const serviced = useServiced(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ on: localDay(), next: "", note: "" });
  useEffect(() => { if (e) setF({ on: localDay(), next: "", note: "" }); }, [e]);
  if (!e) return null;
  return (
    <Dialog open={!!e} onClose={onClose} title={`Serviced ${e.name}`} eyebrow="Equipment"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={serviced.isPending} onClick={async () => {
        try { await serviced.mutateAsync({ id: e.id, on: f.on, next_on: f.next || null, note: f.note || null }); toast(`Serviced: ${e.name}`); onClose(); }
        catch (err) { toast(err instanceof ApiError ? err.message : "Could not save", "crit"); }
      }}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Serviced on" htmlFor="sv-on"><Input id="sv-on" type="date" max={localDay()} value={f.on} onChange={(x) => setF({ ...f, on: x.target.value })} /></Field>
        <Field label="Next service" htmlFor="sv-next" hint="Optional"><Input id="sv-next" type="date" value={f.next} onChange={(x) => setF({ ...f, next: x.target.value })} /></Field>
        <Field label="What was done" htmlFor="sv-note" hint="Optional" className="sm:col-span-2"><Input id="sv-note" value={f.note} onChange={(x) => setF({ ...f, note: x.target.value })} placeholder="Oil and filter changed" /></Field>
      </div>
    </Dialog>
  );
}
