"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Fuel, Gauge, Plus, Wrench } from "lucide-react";
import { Alert, Badge, Button, Dialog, EmptyState, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { canWorkAt, localDay, usePeople } from "@/features/daily/api";
import { useFormEvidence } from "@/features/evidence/useFormEvidence";
import { useFarmMap } from "@/features/farm";
import { type PaymentChoice, PaymentFields, noPayment, paymentBody, paymentReady, useCanPay } from "@/features/finance/PaymentFields";
import { useAccounts } from "@/features/finance/api";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, naira } from "@/lib/format";
import {
  type Equipment, type EquipmentEventKind, type InventoryCatalog, useEquipment, useEquipmentEvent, useInventoryCatalog, useRetireEquipment, useSaveEquipment,
} from "./api";

export const day = (iso: string | null) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—");
const TONE: Record<string, "good" | "warn" | "crit" | "neutral"> = { working: "good", needs_service: "warn", broken: "crit", retired: "neutral" };
const POULTRY = ["broilers", "layers", "noiler", "turkeys"], FISH = ["catfish", "tilapia", "fingerlings"], ANIMALS = ["goats", "sheep", "cattle", "pigs", "rabbits"];
const dec = (v: string) => v.replace(/[^\d.]/g, "");

/** Kinds grouped for the picker, with the groups that fit this farm first (poultry houses → poultry kit…). */
function useKindGroups(cat: InventoryCatalog | undefined) {
  const ws = useCurrentWorkspace();
  const farm = useFarmMap(ws.orgId, false);
  return useMemo(() => {
    if (!cat) return [];
    const units = (farm.data?.sites ?? []).flatMap((s) => s.units);
    const has = (xs: string[]) => units.some((u) => u.purpose && xs.includes(u.purpose));
    const mine = [has(POULTRY) || units.some((u) => ["house", "cage_block", "brooder"].includes(u.kind)) ? "poultry" : null,
      has(FISH) || units.some((u) => ["pond", "tank"].includes(u.kind)) ? "fish" : null, has(ANIMALS) ? "animals" : null].filter(Boolean) as string[];
    const order = [...mine, "water", "power", "feed", ...Object.keys(cat.equipment_groups).filter((g) => !mine.includes(g) && !["water", "power", "feed"].includes(g))];
    return [...new Set(order)].map((g) => [cat.equipment_groups[g], Object.entries(cat.equipment_info).filter(([, i]) => i.group === g)] as const)
      .filter(([, ks]) => ks.length);
  }, [cat, farm.data]);
}

/** The equipment register: broken machines first, then the rest. Each opens its own page. */
export function EquipmentPanel() {
  const ws = useCurrentWorkspace();
  const cat = useInventoryCatalog();
  const list = useEquipment(ws.orgId);
  const [adding, setAdding] = useState(false);
  const [logging, setLogging] = useState<{ e: Equipment; kind: EquipmentEventKind } | null>(null);
  const edit = ws.can("inventory.edit");
  const canLog = edit || ws.can("farm.edit");
  const rows = [...(list.data ?? [])].sort((a, b) => (a.status === "broken" ? 0 : a.service_due ? 1 : 2) - (b.status === "broken" ? 0 : b.service_due ? 1 : 2));
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[640px] text-[13px] text-ink-3">Borehole, pumping machine, generator, brooders, aerators, kiln, feed mill… what each cost, what it costs to keep (repairs, parts, fuel), and when it is due a service.</p>
        {edit && <Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} /> Add equipment</Button>}
      </div>
      {list.data && list.data.length === 0 ? (
        <EmptyState icon={<Wrench size={22} />} title="No equipment yet"
          body="Start with what stops the farm when it fails: the generator, the borehole or pumping machine, brooders or aerators." />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {rows.map((e) => (
            <li key={e.id} className={cn("rounded-xl border bg-surface", e.status === "broken" ? "border-[color-mix(in_oklab,var(--crit)_40%,transparent)]" : "border-line")}>
              <Link href={`/w/${ws.orgId}/stock/equipment/${e.id}`} className="block rounded-t-xl p-3.5 hover:bg-surface-2">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[14.5px]">{e.name}</b>
                  <Badge tone={TONE[e.status]}>{cat.data?.equipment_status[e.status] ?? e.status}</Badge>
                  {e.service_due && e.status !== "broken" && <Badge tone="warn">Service due{e.next_service_on ? ` ${day(e.next_service_on)}` : ""}</Badge>}
                  <ChevronRight size={16} className="ml-auto text-ink-3" />
                </div>
                {e.status === "broken" && e.broken_note && (
                  <p className="mt-1 flex items-start gap-1.5 text-[13px] text-crit"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{e.broken_note}{e.broken_since ? ` · since ${day(e.broken_since)}` : ""}</p>
                )}
                <p className="mt-0.5 text-[12.5px] text-ink-3">{[cat.data?.equipment_kinds[e.kind], e.unit_code ?? e.site_name ?? "Whole farm",
                  e.caretaker_name && `looked after by ${e.caretaker_name}`].filter(Boolean).join(" · ")}</p>
                <p className="text-[12.5px] text-ink-3">{[
                  e.next_service_on && `Next service ${day(e.next_service_on)}`, e.hours_to_service != null && `${Math.max(0, e.hours_to_service).toLocaleString()} hours to service`,
                  e.spent_this_year ? `${naira(e.spent_this_year)} to keep this year` : null].filter(Boolean).join(" · ") || "No service planned"}</p>
              </Link>
              {canLog && e.status !== "retired" && (
                <div className="flex flex-wrap gap-1.5 border-t border-line px-3.5 py-2">
                  {e.status === "broken"
                    ? <Button size="sm" variant="primary" onClick={() => setLogging({ e, kind: "repair" })}>Log the repair</Button>
                    : <Button size="sm" onClick={() => setLogging({ e, kind: "service" })}>Serviced</Button>}
                  {["generator", "pump", "vehicle", "feed_mill", "pelletizer"].includes(e.kind) &&
                    <Button size="sm" variant="ghost" onClick={() => setLogging({ e, kind: "fuel" })}><Fuel size={14} /> Fuel</Button>}
                  {(e.hours != null || e.service_every_hours) && <Button size="sm" variant="ghost" onClick={() => setLogging({ e, kind: "hours" })}><Gauge size={14} /> Hours</Button>}
                  {e.status !== "broken" && <Button size="sm" variant="ghost" onClick={() => setLogging({ e, kind: "breakdown" })}>Broke down</Button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <EquipmentDialog e={adding ? "new" : null} onClose={() => setAdding(false)} />
      <LogDialog e={logging?.e ?? null} kind={logging?.kind ?? "service"} onClose={() => setLogging(null)} />
    </>
  );
}

export function EquipmentDialog({ e, onClose }: { e: Equipment | "new" | null; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const cat = useInventoryCatalog();
  const groups = useKindGroups(cat.data);
  const farm = useFarmMap(ws.orgId, false, !!e);
  const people = usePeople(ws.orgId, !!e && ws.can("farm.approve"));
  const save = useSaveEquipment(ws.orgId);
  const toast = useToast();
  const canPay = useCanPay();
  const money = ws.can("finance.view");
  const blank = { name: "", kind: "generator", unit: "", serial: "", bought: "", cost: "", status: "working", every: "90", everyHours: "250", hours: "", hoursLast: "", who: "", notes: "" };
  const [f, setF] = useState(blank);
  const [pay, setPay] = useState<PaymentChoice>(noPayment);
  const [error, setError] = useState<string | null>(null);
  const isNew = e === "new";
  const opened = e === "new" ? "new" : e?.id ?? null;
  useEffect(() => {
    if (!e) return;
    setError(null); setPay(noPayment());
    setF(e === "new" ? blank : {
      name: e.name, kind: e.kind, unit: e.unit_id ?? "", serial: e.serial ?? "", bought: e.bought_on ?? "", cost: e.cost?.toString() ?? "", status: e.status,
      every: e.service_every_days?.toString() ?? "", everyHours: e.service_every_hours?.toString() ?? "", hours: e.hours?.toString() ?? "", hoursLast: "", who: e.caretaker_id ?? "", notes: e.notes ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);  // on opening, not on every refetch (that would wipe what is being typed)
  if (!e) return null;
  const info = cat.data?.equipment_info[f.kind];
  const pickKind = (kind: string) => {
    const i = cat.data?.equipment_info[kind];
    setF({ ...f, kind, ...(isNew ? { every: i?.days?.toString() ?? "", everyHours: i?.hours?.toString() ?? "" } : {}) });
  };
  const units = (farm.data?.sites ?? []).flatMap((s) => s.units.filter((u) => !u.archived_at));
  const team = (people.data ?? []).filter((p) => canWorkAt(p, f.unit || null));
  const cost = Number(f.cost) || 0;
  const showPay = isNew && canPay && cost > 0;
  const hoursKind = !!info?.hours || !!f.everyHours;
  return (
    <Dialog open={!!e} onClose={onClose} title={isNew ? "Add equipment" : `Edit ${e.name}`} eyebrow="Equipment" wide
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending}
        disabled={f.name.trim().length < 2 || !paymentReady(pay, showPay)} onClick={async () => {
          setError(null);
          try {
            await save.mutateAsync({
              ...(isNew ? {} : { id: e.id }), name: f.name.trim(), kind: f.kind, unit_id: f.unit || null, serial: f.serial || null,
              bought_on: f.bought || null, ...(money ? { cost: f.cost ? Number(f.cost) : null } : {}), ...(isNew ? {} : { status: f.status }),
              service_every_days: f.every ? Number(f.every) : null, service_every_hours: f.everyHours ? Number(f.everyHours) : null,
              hours: f.hours ? Number(f.hours) : null, notes: f.notes || null, ...(f.hoursLast ? { hours_at_service: Number(f.hoursLast) } : {}),
              ...(ws.can("farm.approve") ? { caretaker_id: f.who || null } : {}),
              ...(showPay && paymentBody(pay, showPay) ? { payment: paymentBody(pay, showPay) } : {}),
            });
            toast(isNew ? `Added ${f.name}` : `Saved ${f.name}`); onClose();
          } catch (err) { setError(err instanceof ApiError ? err.message : "Could not save."); }
        }}>Save</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What is it" htmlFor="eq-kind"><Select id="eq-kind" value={f.kind} onChange={(x) => pickKind(x.target.value)}>
            {groups.map(([g, ks]) => <optgroup key={g} label={g}>{ks.map(([k, i]) => <option key={k} value={k}>{i.label}</option>)}</optgroup>)}</Select></Field>
          <Field label="Name" htmlFor="eq-name" hint="So you can tell it apart"><Input id="eq-name" value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })}
            placeholder={f.kind === "generator" ? "Mikano 20 kVA" : f.kind === "pump" ? "Pumping machine" : info?.label ?? ""} /></Field>
          <Field label="Where" htmlFor="eq-unit" hint="A house, pond or pen it serves; its cost counts against it in Payback">
            <Select id="eq-unit" value={f.unit} onChange={(x) => setF({ ...f, unit: x.target.value })}>
              <option value="">Whole farm</option>{units.map((u) => <option key={u.id} value={u.id}>{u.code}{u.name ? ` · ${u.name}` : ""}</option>)}</Select></Field>
          {ws.can("farm.approve") && <Field label="Looked after by" htmlFor="eq-who" hint="Service reminders go to them on Today">
            <Select id="eq-who" value={f.who} onChange={(x) => setF({ ...f, who: x.target.value })}>
              <option value="">Anyone on shift</option>{team.map((p) => <option key={p.user_id} value={p.user_id}>{p.me ? `Me (${p.name})` : p.name}</option>)}</Select></Field>}
          {!isNew && <Field label="State" htmlFor="eq-status"><Select id="eq-status" value={f.status} onChange={(x) => setF({ ...f, status: x.target.value })}>
            {Object.entries(cat.data?.equipment_status ?? {}).filter(([k]) => k !== "retired").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>}
        </div>

        <div className="rounded-xl border border-line p-3">
          <b className="text-[13.5px]">Service</b>{info?.hint && <span className="text-[12.5px] text-ink-3"> · {info.hint}</span>}
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <Field label="Every (days)" htmlFor="eq-every" hint={info?.days ? `Usually ${info.days}` : "Empty: no reminder"}>
              <Input id="eq-every" inputMode="numeric" value={f.every} onChange={(x) => setF({ ...f, every: x.target.value.replace(/\D/g, "") })} /></Field>
            {hoursKind && <Field label="Or every (running hours)" htmlFor="eq-every-h" hint={info?.hours ? `Usually ${info.hours}` : undefined}>
              <Input id="eq-every-h" inputMode="numeric" value={f.everyHours} onChange={(x) => setF({ ...f, everyHours: x.target.value.replace(/\D/g, "") })} /></Field>}
            {hoursKind && <Field label="Hour meter now" htmlFor="eq-hours" hint="Optional"><Input id="eq-hours" inputMode="decimal" value={f.hours} onChange={(x) => setF({ ...f, hours: dec(x.target.value) })} /></Field>}
            {hoursKind && isNew && f.hours && <Field label="Hours at its last service" htmlFor="eq-hours-last" hint="If you know it. Empty: count from now">
              <Input id="eq-hours-last" inputMode="decimal" value={f.hoursLast} onChange={(x) => setF({ ...f, hoursLast: dec(x.target.value) })} /></Field>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Bought or built on" htmlFor="eq-bought" hint="Optional"><Input id="eq-bought" type="date" max={localDay()} value={f.bought} onChange={(x) => setF({ ...f, bought: x.target.value })} /></Field>
          {money && <Field label="What it cost (₦)" htmlFor="eq-cost" hint={isNew ? "Optional. Drilling, buying, installing" : "Optional"}>
            <Input id="eq-cost" inputMode="decimal" value={f.cost} onChange={(x) => setF({ ...f, cost: dec(x.target.value) })} /></Field>}
          <Field label="Serial number" htmlFor="eq-serial" hint="Optional"><Input id="eq-serial" value={f.serial} onChange={(x) => setF({ ...f, serial: x.target.value })} /></Field>
        </div>
        {showPay && <PaymentFields value={pay} onChange={setPay} amount={cost} what="it" purchasedOn={f.bought || localDay()}
          paidNote="Taken out of that account now. Buying it is money put into the farm, not a running cost: Finance → Payback shows how much profit has paid back." />}
        <Field label="Notes" htmlFor="eq-notes" hint="Optional"><Textarea id="eq-notes" rows={2} value={f.notes} onChange={(x) => setF({ ...f, notes: x.target.value })} /></Field>
      </div>
    </Dialog>
  );
}

const TITLE: Record<string, (n: string) => string> = {
  service: (n) => `Serviced ${n}`, repair: (n) => `Repair to ${n}`, parts: (n) => `Parts for ${n}`, fuel: (n) => `Fuel for ${n}`,
  hours: (n) => `Hour meter on ${n}`, breakdown: (n) => `${n} broke down`, moved: (n) => `${n} moved`, note: (n) => `Note on ${n}`,
};

/** Log what was done to a machine, or what went wrong. The cost (with Finance) is a running cost, linked to it. */
export function LogDialog({ e, kind: start, onClose }: { e: Equipment | null; kind: EquipmentEventKind; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const log = useEquipmentEvent(ws.orgId);
  const toast = useToast();
  const canPay = useCanPay();
  const [kind, setKind] = useState<EquipmentEventKind>(start);
  const [f, setF] = useState({ on: localDay(), amount: "", litres: "", hours: "", note: "", by: "", fixed: true, next: "" });
  const [pay, setPay] = useState<PaymentChoice>(noPayment);
  const [error, setError] = useState<string | null>(null);
  const evidence = useFormEvidence("equipment", { hint: kind === "breakdown" ? "A photo of the problem helps the mechanic. Optional." : "The receipt or a photo of the work. Optional." });
  const resetEvidence = evidence.reset;
  // Start afresh when opened for a machine, not each time the page refetches it (that would wipe what is being typed).
  const opened = e ? `${e.id}:${start}` : null;
  const [seen, setSeen] = useState<string | null>(null);
  if (opened !== seen) {
    setSeen(opened);
    if (e) {
      setKind(start); setError(null); setPay(noPayment());
      setF({ on: localDay(), amount: "", litres: "", hours: e.hours?.toString() ?? "", note: "", by: "", fixed: true, next: "" });
    }
  }
  useEffect(() => { if (opened) resetEvidence(); }, [opened, resetEvidence]);
  if (!e) return null;
  const costly = ["service", "repair", "parts", "fuel"].includes(kind);
  const amount = Number(f.amount) || 0;
  const showPay = costly && canPay && amount > 0;
  const nextGuess = kind === "service" && e.service_every_days ? (() => { const d = new Date(f.on + "T12:00:00"); d.setDate(d.getDate() + e.service_every_days!); return localDay(d); })() : null;
  const valid = !!f.on && (kind !== "breakdown" || f.note.trim().length > 0) && (kind !== "hours" || f.hours !== "") && paymentReady(pay, showPay);
  return (
    <Dialog open={!!e} onClose={onClose} title={TITLE[kind]?.(e.name) ?? e.name} eyebrow="Equipment"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={log.isPending} disabled={!valid} onClick={async () => {
        setError(null);
        try {
          await log.mutateAsync({
            id: e.id, kind, on: f.on, note: kind === "hours" ? null : f.note.trim() || null,
            done_by: ["service", "repair", "parts", "fuel"].includes(kind) ? f.by.trim() || null : null,
            amount: costly && amount ? amount : null, litres: kind === "fuel" && f.litres ? Number(f.litres) : null,
            hours: f.hours !== "" && (kind === "hours" || kind === "service" || kind === "fuel") && Number(f.hours) !== e.hours ? Number(f.hours) : kind === "hours" ? Number(f.hours) : null,
            fixed: (kind === "repair" || kind === "parts") && e.status === "broken" ? f.fixed : false, next_service_on: kind === "service" && f.next ? f.next : null,
            payment: showPay ? paymentBody(pay, showPay) : null,
          });
          await evidence.attach({ record_id: e.id }, `${e.name}: ${kind}`);
          toast(kind === "breakdown" ? `${e.name} marked broken. The owner will see it.` : `Saved: ${TITLE[kind]?.(e.name)}`); onClose();
        } catch (err) { setError(err instanceof ApiError ? err.message : "Could not save."); }
      }}>Save</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        {start !== "breakdown" && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="What happened">
            {(["service", "repair", "parts", "fuel", "hours", "note"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                className={cn("cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold", kind === k ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2 hover:bg-surface-2")}>
                {{ service: "Service", repair: "Repair", parts: "Parts", fuel: "Fuel", hours: "Hours", note: "Note" }[k]}</button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="When" htmlFor="lg-on"><Input id="lg-on" type="date" max={localDay()} value={f.on} onChange={(x) => setF({ ...f, on: x.target.value })} /></Field>
          {kind === "fuel" && <Field label="Litres" htmlFor="lg-litres" hint="Optional"><Input id="lg-litres" inputMode="decimal" value={f.litres} onChange={(x) => setF({ ...f, litres: dec(x.target.value) })} /></Field>}
          {(kind === "hours" || ((kind === "service" || kind === "fuel") && (e.hours != null || e.service_every_hours))) &&
            <Field label="Hour meter reading" htmlFor="lg-hours" hint={e.hours != null ? `Last: ${e.hours.toLocaleString()}` : undefined}>
              <Input id="lg-hours" inputMode="decimal" value={f.hours} onChange={(x) => setF({ ...f, hours: dec(x.target.value) })} /></Field>}
          {costly && (ws.can("finance.view") ? <Field label={kind === "fuel" ? "Cost (₦)" : "What it cost (₦)"} htmlFor="lg-amount" hint="Optional">
            <Input id="lg-amount" inputMode="decimal" value={f.amount} onChange={(x) => setF({ ...f, amount: dec(x.target.value) })} /></Field> : null)}
          {(kind === "service" || kind === "repair" || kind === "parts" || kind === "fuel") &&
            <Field label={kind === "fuel" ? "Bought from" : "Done by"} htmlFor="lg-by" hint="Optional"><Input id="lg-by" value={f.by} onChange={(x) => setF({ ...f, by: x.target.value })}
              placeholder={kind === "fuel" ? "Filling station" : "Mechanic or vendor"} /></Field>}
          {kind === "service" && <Field label="Next service" htmlFor="lg-next" hint={nextGuess ? `Empty: ${day(nextGuess)}` : "Optional"}>
            <Input id="lg-next" type="date" value={f.next} onChange={(x) => setF({ ...f, next: x.target.value })} /></Field>}
        </div>
        {kind !== "hours" && <Field label={kind === "breakdown" ? "What is wrong" : kind === "fuel" ? "Note" : "What was done"} htmlFor="lg-note"
          hint={kind === "breakdown" ? undefined : "Optional"}>
          <Textarea id="lg-note" rows={2} value={f.note} onChange={(x) => setF({ ...f, note: x.target.value })}
            placeholder={kind === "breakdown" ? "Not pumping, motor hums" : kind === "service" ? "Oil and filter changed" : kind === "repair" ? "Rewound the motor" : ""} /></Field>}
        {(kind === "repair" || kind === "parts") && e.status === "broken" && (
          <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={f.fixed} onChange={(x) => setF({ ...f, fixed: x.target.checked })} className="h-4 w-4 accent-[var(--brand)]" />
            It is working again</label>
        )}
        {showPay && <PaymentFields value={pay} onChange={setPay} amount={amount} what="it" purchasedOn={f.on}
          paidNote={`Taken out of that account now. A running cost of ${e.name}, counted in profit as ${kind === "fuel" ? "fuel" : "repairs and maintenance"}.`} />}
        {costly && !canPay && ws.can("finance.view") === false && <p className="text-[12.5px] text-ink-3">Someone with access to Finance can add what it cost.</p>}
        {evidence.field}
      </div>
    </Dialog>
  );
}

/** Sold, stolen, beyond repair or given away. A sale's money comes off what was put into the farm. */
export function RetireDialog({ e, onClose }: { e: Equipment | null; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const retire = useRetireEquipment(ws.orgId);
  const canPay = useCanPay();
  const toast = useToast();
  const [f, setF] = useState({ on: localDay(), reason: "sold", amount: "", note: "" });
  const accounts = useAccounts(ws.orgId, !!e && canPay);
  const [into, setInto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const opened = e?.id;
  useEffect(() => { if (opened) { setF({ on: localDay(), reason: "sold", amount: "", note: "" }); setError(null); } }, [opened]);
  useEffect(() => { const a = accounts.data?.filter((x) => x.active); if (a?.length === 1) setInto(a[0].id); }, [accounts.data]);
  if (!e) return null;
  const amount = Number(f.amount) || 0;
  const showPay = f.reason === "sold" && canPay && amount > 0;
  return (
    <Dialog open={!!e} onClose={onClose} title={`${e.name} is going`} eyebrow="Equipment"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" loading={retire.isPending}
        disabled={showPay && !into} onClick={async () => {
          setError(null);
          try {
            await retire.mutateAsync({ id: e.id, on: f.on, reason: f.reason, note: f.note || null,
              ...(showPay ? { amount, account_id: into } : {}) });
            toast(`${e.name} retired`); onClose();
          } catch (err) { setError(err instanceof ApiError ? err.message : "Could not save."); }
        }}>Retire it</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Why" htmlFor="rt-reason"><Select id="rt-reason" value={f.reason} onChange={(x) => setF({ ...f, reason: x.target.value })}>
            <option value="sold">Sold</option><option value="beyond_repair">Beyond repair</option><option value="stolen">Stolen</option>
            <option value="given_away">Given away</option><option value="other">Other</option></Select></Field>
          <Field label="When" htmlFor="rt-on"><Input id="rt-on" type="date" max={localDay()} value={f.on} onChange={(x) => setF({ ...f, on: x.target.value })} /></Field>
          {f.reason === "sold" && canPay && <Field label="Sold for (₦)" htmlFor="rt-amount" hint="Optional">
            <Input id="rt-amount" inputMode="decimal" value={f.amount} onChange={(x) => setF({ ...f, amount: dec(x.target.value) })} /></Field>}
        </div>
        {showPay && <Field label="The money went into" htmlFor="rt-into" hint="Money back from a sale is not income: it comes off what you put into the farm (Payback).">
          <Select id="rt-into" value={into} onChange={(x) => setInto(x.target.value)}><option value="">Choose an account</option>
            {(accounts.data ?? []).filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>}
        <Field label="Note" htmlFor="rt-note" hint="Optional"><Input id="rt-note" value={f.note} onChange={(x) => setF({ ...f, note: x.target.value })} /></Field>
        <p className="text-[12.5px] text-ink-3">Its history is kept. Service reminders stop.</p>
      </div>
    </Dialog>
  );
}

/** From Today: anyone on shift reports a machine that stopped working, with a photo. */
export function BreakdownDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const list = useEquipment(ws.orgId);
  const [pick, setPick] = useState("");
  const working = (list.data ?? []).filter((e) => e.status !== "broken" && e.status !== "retired");
  useEffect(() => { if (open) setPick(""); }, [open]);
  const chosen = working.find((e) => e.id === pick) ?? null;
  if (open && chosen) return <LogDialog e={chosen} kind="breakdown" onClose={onClose} />;
  return (
    <Dialog open={open} onClose={onClose} title="A machine stopped working" eyebrow="Today"
      footer={<Button variant="ghost" onClick={onClose}>Cancel</Button>}>
      <div className="flex flex-col gap-2">
        {working.length === 0 ? <p className="text-[13.5px] text-ink-3">No machines on the equipment list yet. The owner adds them under Stock → Equipment.</p>
          : working.map((e) => (
            <button key={e.id} type="button" onClick={() => setPick(e.id)}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left hover:bg-surface-2">
              <Wrench size={16} className="text-ink-3" /><span className="flex-1"><b className="text-[14px]">{e.name}</b>
                <span className="block text-[12.5px] text-ink-3">{e.unit_code ?? e.site_name ?? "Whole farm"}</span></span><ChevronRight size={16} className="text-ink-3" />
            </button>
          ))}
      </div>
    </Dialog>
  );
}
