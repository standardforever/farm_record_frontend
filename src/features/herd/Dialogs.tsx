"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Dialog, Field, Input, Segmented, Select, Textarea, useToast } from "@/components/ui";
import { type Batch, useBatches } from "@/features/batches";
import { localDay } from "@/features/daily/api";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import {
  type Animal, type Mating, BREEDING, addDays, shortDate, useAnimals, useExitAnimal, useHerdCatalog, useHerdSettings, useMate, useMatingAction, useMoveAnimal,
  useSaveHerdSettings, useTagAnimals, useCycle,
} from "./api";

const err = (e: unknown) => (e instanceof ApiError ? e.message : "Could not save.");
const int = (v: string) => v.replace(/\D/g, "");

function Foot({ onClose, onSave, busy, disabled, label = "Save" }: { onClose: () => void; onSave: () => void; busy: boolean; disabled?: boolean; label?: string }) {
  return <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={disabled} onClick={onSave}>{label}</Button></>;
}

/** Running groups of animals that are kept one by one. */
export function useBreedingGroups(open: boolean, species?: string) {
  const ws = useCurrentWorkspace();
  const q = useBatches(ws.orgId, "active", open);
  return (q.data ?? []).filter((b) => BREEDING.includes(b.species) && (!species || b.species === species));
}

function UnitPick({ b, value, onChange, label = "Which pen" }: { b?: Batch; value: string; onChange: (v: string) => void; label?: string }) {
  const units = (b?.units ?? []).filter((u) => !u.ended_on);
  if (units.length < 2) return null;
  return (
    <Field label={label} htmlFor="h-unit"><Select id="h-unit" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose…</option>{units.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.unit_code} · {u.count}</option>)}
    </Select></Field>
  );
}

type Row = { tag: string; sex: "female" | "male"; name: string; age: string; ageUnit: "months" | "years"; born: string };
const blankRow = (sex: "female" | "male" = "female"): Row => ({ tag: "", sex, name: "", age: "", ageUnit: "months", born: "" });

/** Tag animals already counted in a group: one row each. */
export function TagDialog({ open, onClose, batchId }: { open: boolean; onClose: () => void; batchId?: string }) {
  const ws = useCurrentWorkspace();
  const groups = useBreedingGroups(open);
  const tagged = useAnimals(ws.orgId, {}, open);
  const save = useTagAnimals(ws.orgId);
  const toast = useToast();
  const [group, setGroup] = useState("");
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setGroup(batchId ?? ""); setRows([blankRow()]); setError(null); } }, [open, batchId]);
  const g = groups.find((x) => x.id === group);
  const done = (tagged.data ?? []).filter((a) => a.batch_id === group).length;
  const free = g ? g.current - done : 0;
  const set = (i: number, k: keyof Row, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const next = (prev: string) => { const m = prev.match(/^(.*?)(\d+)$/); return m ? m[1] + String(Number(m[2]) + 1).padStart(m[2].length, "0") : ""; };
  const ok = !!g && rows.length > 0 && rows.length <= free && rows.every((r) => r.tag.trim());
  return (
    <Dialog open={open} onClose={onClose} title="Tag animals" eyebrow="Breeding" wide
      footer={<Foot onClose={onClose} busy={save.isPending} disabled={!ok} label={`Save ${rows.length}`} onSave={async () => {
        setError(null);
        try {
          const today = localDay();
          await save.mutateAsync({ batch_id: group, animals: rows.map((r) => {
            const n = Number(r.age);
            const born = r.born || (n > 0 ? addDays(today, -Math.round(n * (r.ageUnit === "years" ? 365 : 30.4))) : null);
            return { tag: r.tag, sex: r.sex, name: r.name || null, born_on: born, born_estimated: !r.born && n > 0 };
          }) });
          toast(`Tagged ${rows.length} in ${g!.code}`); onClose();
        } catch (e) { setError(err(e)); }
      }} />}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <Field label="Group" htmlFor="h-group" hint={g ? `${g.current} in ${g.code}, ${done} tagged, ${free} still to tag` : "The batch they are counted in"}>
          <Select id="h-group" value={group} disabled={!!batchId} onChange={(e) => setGroup(e.target.value)}>
            <option value="">Choose a group</option>
            {groups.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.current} {b.species}</option>)}
          </Select>
        </Field>
        {!groups.length && open && <Alert tone="info">Stock a batch of goats, sheep, pigs, cattle or rabbits first (Batches → Stock a batch), then tag them here.</Alert>}
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-[14px] border border-line p-2.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_200px_auto] sm:items-start">
              <Field label="Tag or ear number" htmlFor={`h-tag-${i}`}><Input id={`h-tag-${i}`} value={r.tag} onChange={(e) => set(i, "tag", e.target.value.toUpperCase())} placeholder="G-001" /></Field>
              <div className="self-end sm:mt-[26px] sm:self-start"><Segmented value={r.sex} onChange={(v) => set(i, "sex", v)} options={[{ value: "female", label: "Female" }, { value: "male", label: "Male" }]} /></div>
              <Field label="Name (optional)" htmlFor={`h-name-${i}`}><Input id={`h-name-${i}`} value={r.name} onChange={(e) => set(i, "name", e.target.value)} /></Field>
              <Field label="About how old" htmlFor={`h-age-${i}`}>
                <div className="flex gap-1.5"><div className="min-w-[56px] flex-1"><Input id={`h-age-${i}`} inputMode="numeric" value={r.age} onChange={(e) => set(i, "age", int(e.target.value))} /></div>
                  <div className="w-[118px] shrink-0"><Select aria-label="Unit" value={r.ageUnit} onChange={(e) => set(i, "ageUnit", e.target.value)}><option value="months">months</option><option value="years">years</option></Select></div></div>
              </Field>
              <button type="button" aria-label={`Remove row ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
                className="self-start p-2 text-ink-3 hover:text-crit disabled:opacity-30 max-sm:col-start-2 max-sm:row-start-1 sm:mt-[28px]"><Trash2 size={17} /></button>
            </div>
          ))}
        </div>
        <Button variant="ghost" disabled={rows.length >= free} onClick={() => setRows((x) => [...x, { ...blankRow(x[x.length - 1]?.sex), tag: next(x[x.length - 1]?.tag ?? "") }])}>
          <Plus size={16} /> Add another
        </Button>
      </div>
    </Dialog>
  );
}

/** Mate a female: with a male on the farm, a male from outside, or AI. Shows when she is due. */
export function MateDialog({ open, onClose, dam }: { open: boolean; onClose: () => void; dam?: Animal | null }) {
  const ws = useCurrentWorkspace();
  const cat = useHerdCatalog();
  const females = useAnimals(ws.orgId, { sex: "female" }, open && !dam);
  const [damId, setDamId] = useState("");
  const d = dam ?? females.data?.find((a) => a.id === damId);
  const males = useAnimals(ws.orgId, { sex: "male", species: d?.species }, open && !!d);
  const mate = useMate(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ sires: [] as string[], method: "natural", name: "", on: localDay(), notes: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setDamId(dam?.id ?? ""); setF({ sires: [], method: "natural", name: "", on: localDay(), notes: "" }); setError(null); } }, [open, dam]);
  // One male on the farm: pick him.
  useEffect(() => { if (open && f.method === "natural" && !f.sires.length && males.data?.length === 1) setF((x) => ({ ...x, sires: [males.data![0].id] })); }, [open, males.data, f.method, f.sires.length]);
  const c = useCycle(ws.orgId, d?.species);
  const w = d ? cat.data?.words[d.species] : undefined;
  const due = c ? addDays(f.on, c.gestation) : null;
  return (
    <Dialog open={open} onClose={onClose} title={w ? `Record ${w.mate}` : "Record a mating"} eyebrow={d ? `${d.tag}${d.name ? ` · ${d.name}` : ""}` : "Breeding"}
      footer={<Foot onClose={onClose} busy={mate.isPending} disabled={!d || (f.method === "natural" && !f.sires.length)} onSave={async () => {
        setError(null);
        try {
          await mate.mutateAsync({ dam_id: d!.id, method: f.method, mated_on: f.on, notes: f.notes || null,
            ...(f.method === "natural" ? { sires: f.sires.map((id) => ({ sire_id: id })) } : { sire_name: f.name || null }) });
          toast(`${d!.tag}: due about ${shortDate(due!)}`); onClose();
        } catch (e) { setError(err(e)); }
      }} />}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        {!dam && (
          <Field label="Female" htmlFor="h-dam"><Select id="h-dam" value={damId} onChange={(e) => setDamId(e.target.value)}>
            <option value="">Choose…</option>
            {females.data?.filter((a) => BREEDING.includes(a.species)).map((a) => <option key={a.id} value={a.id}>{a.tag}{a.name ? ` (${a.name})` : ""} · {a.state}</option>)}
          </Select></Field>
        )}
        <Segmented value={f.method} onChange={(v) => setF({ ...f, method: v })} options={[{ value: "natural", label: "Our male" }, { value: "outside", label: "Outside male" }, { value: "ai", label: "AI" }]} />
        {f.method === "natural" ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink-2">{w ? `Which ${w.male}` : "Which male"}<span className="font-normal text-ink-3"> · pick more than one if several ran with her</span></span>
            {males.data && !males.data.length && <p className="text-[12.5px] text-ink-3">No males tagged yet. Tag him first, or pick Outside male.</p>}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Males">
              {males.data?.map((m) => {
                const on = f.sires.includes(m.id);
                return (
                  <button key={m.id} type="button" aria-pressed={on} onClick={() => setF({ ...f, sires: on ? f.sires.filter((x) => x !== m.id) : [...f.sires, m.id] })}
                    className={cn("rounded-full border px-3.5 py-1.5 font-mono text-[13.5px] font-semibold", on ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand/50")}>
                    ♂ {m.tag}{m.name ? <span className="font-sans font-normal"> · {m.name}</span> : null}
                  </button>
                );
              })}
            </div>
            {f.sires.length > 1 && <p className="text-[12.5px] text-ink-3">The father of each young will be one of these. You can say which when you tag them, if you know.</p>}
          </div>
        ) : (
          <Field label={f.method === "ai" ? "Semen or bull used" : "Whose male"} htmlFor="h-sire-name" hint="Optional"><Input id="h-sire-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        )}
        <Field label="Date" htmlFor="h-on"><Input id="h-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        {c && due && (
          <div className="rounded-[14px] bg-brand-soft p-3.5 text-[13.5px]">
            <b className="text-brand">Due about {shortDate(due)}</b> <span className="text-ink-2">({c.gestation} days; anywhere from {shortDate(addDays(f.on, c.gestation_range[0]))} to {shortDate(addDays(f.on, c.gestation_range[1]))})</span>
            <ul className="mt-1.5 list-disc pl-5 text-ink-2">
              {c.cycle && <li>Watch for heat around {shortDate(addDays(f.on, c.cycle))}. On heat means it did not take.</li>}
              <li>Pregnancy check from {shortDate(addDays(f.on, c.check))}: {c.check_how.toLowerCase()}.</li>
              <li>{c.prepare_what} by {shortDate(addDays(due, -c.prepare))}.</li>
            </ul>
          </div>
        )}
        <Field label="Notes" htmlFor="h-notes" hint="Optional"><Textarea id="h-notes" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}

export function CheckDialog({ m, dam, open, onClose }: { m: Mating | null; dam: Animal | { tag: string; species: string } | null; open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const act = useMatingAction(ws.orgId);
  const toast = useToast();
  const [on, setOn] = useState(localDay());
  const [result, setResult] = useState<"yes" | "no">("yes");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setOn(localDay()); setResult("yes"); setError(null); } }, [open]);
  return (
    <Dialog open={open} onClose={onClose} title="Pregnancy check" eyebrow={dam?.tag}
      footer={<Foot onClose={onClose} busy={act.isPending} onSave={async () => {
        try { await act.mutateAsync({ id: m!.id, action: "check", pregnant: result === "yes", on }); toast(result === "yes" ? `${dam?.tag}: pregnant` : `${dam?.tag}: not pregnant. Mate her again on her next heat.`); onClose(); }
        catch (e) { setError(err(e)); }
      }} />}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <Segmented value={result} onChange={setResult} options={[{ value: "yes", label: "Pregnant" }, { value: "no", label: "Not pregnant (came on heat)" }]} />
        <Field label="Checked on" htmlFor="h-check-on"><Input id="h-check-on" type="date" max={localDay()} value={on} onChange={(e) => setOn(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

/** Kidding, lambing, farrowing, calving or kindling: how many, into which group, and tag some now if wanted. */
export function BirthDialog({ m, dam, open, onClose }: { m: Mating | null; dam: Animal | null; open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const cat = useHerdCatalog();
  const groups = useBreedingGroups(open, dam?.species);
  const act = useMatingAction(ws.orgId);
  const toast = useToast();
  const w = dam ? cat.data?.words[dam.species] : undefined;
  const [f, setF] = useState({ on: localDay(), alive: "", dead: "", group: "", unit: "" });
  const [young, setYoung] = useState<{ tag: string; sex: "female" | "male"; sire_id?: string }[]>([]);
  const sires = useMemo(() => [...new Map((m?.services ?? []).filter((x) => x.sire_id).map((x) => [x.sire_id!, x.sire_tag ?? "?"])).entries()], [m]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setF({ on: localDay(), alive: "", dead: "", group: dam?.batch_id ?? "", unit: "" }); setYoung([]); setError(null); } }, [open, dam]);
  const g = groups.find((x) => x.id === f.group);
  const alive = Number(f.alive || 0), dead = Number(f.dead || 0);
  const needUnit = (g?.units ?? []).filter((u) => !u.ended_on).length > 1;
  return (
    <Dialog open={open} onClose={onClose} title={`Record ${w?.birth ?? "the birth"}`} eyebrow={dam?.tag}
      footer={<Foot onClose={onClose} busy={act.isPending} disabled={alive + dead === 0 || !g || (needUnit && !f.unit && alive > 0) || young.some((y) => !y.tag.trim())} onSave={async () => {
        setError(null);
        try {
          await act.mutateAsync({ id: m!.id, action: "birth", on: f.on, alive, dead, batch_id: f.group, unit_id: f.unit || null, tag: young });
          toast(`${dam?.tag}: ${alive} ${w?.young ?? "young"} born alive, added to ${g!.code}`); onClose();
        } catch (e) { setError(err(e)); }
      }} />}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <Field label="Date" htmlFor="h-b-on"><Input id="h-b-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Born alive" htmlFor="h-alive"><Input id="h-alive" inputMode="numeric" className="h-12 text-[18px]" value={f.alive} onChange={(e) => setF({ ...f, alive: int(e.target.value) })} /></Field>
          <Field label="Born dead" htmlFor="h-dead"><Input id="h-dead" inputMode="numeric" className="h-12 text-[18px]" value={f.dead} onChange={(e) => setF({ ...f, dead: int(e.target.value) })} /></Field>
        </div>
        <Field label={`Group the ${w?.young ?? "young"} join`} htmlFor="h-b-group" hint="They are added to this group's count. Usually the mother's group until weaning.">
          <Select id="h-b-group" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value, unit: "" })}>
            {groups.map((b) => <option key={b.id} value={b.id}>{b.code}{b.id === dam?.batch_id ? " (mother's group)" : ""} · {b.current}</option>)}
          </Select>
        </Field>
        <UnitPick b={g} value={f.unit} onChange={(v) => setF({ ...f, unit: v })} />
        <div>
          <div className="mb-1.5 flex items-center justify-between"><b className="text-[13.5px]">Tag them now</b><span className="text-[12.5px] text-ink-3">Optional; you can tag them later</span></div>
          {young.map((y, i) => (
            <div key={i} className="mb-2 flex items-center gap-2">
              <Input aria-label={`Tag ${i + 1}`} value={y.tag} placeholder={`${dam?.tag ?? "K"}-${i + 1}`} className="min-w-0 flex-1"
                onChange={(e) => setYoung((x) => x.map((z, j) => (j === i ? { ...z, tag: e.target.value.toUpperCase() } : z)))} />
              <Segmented value={y.sex} onChange={(v) => setYoung((x) => x.map((z, j) => (j === i ? { ...z, sex: v } : z)))} options={[{ value: "female", label: "F" }, { value: "male", label: "M" }]} />
              {sires.length > 1 && (
                <div className="w-[118px] shrink-0"><Select aria-label={`Father of ${y.tag || `young ${i + 1}`}`} value={y.sire_id ?? ""}
                  onChange={(e) => setYoung((x) => x.map((z, j) => (j === i ? { ...z, sire_id: e.target.value || undefined } : z)))}>
                  <option value="">Father?</option>{sires.map(([id, tag]) => <option key={id} value={id}>{tag}</option>)}
                </Select></div>
              )}
              <button type="button" aria-label="Remove" onClick={() => setYoung((x) => x.filter((_, j) => j !== i))} className="p-1.5 text-ink-3 hover:text-crit"><Trash2 size={16} /></button>
            </div>
          ))}
          <Button size="sm" variant="ghost" disabled={young.length >= alive} onClick={() => setYoung((x) => [...x, { tag: `${dam?.tag ?? "K"}-${x.length + 1}`, sex: "female" }])}><Plus size={15} /> Tag one</Button>
        </div>
      </div>
    </Dialog>
  );
}

export function WeanDialog({ m, dam, open, onClose }: { m: Mating | null; dam: Animal | null; open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const cat = useHerdCatalog();
  const groups = useBreedingGroups(open, dam?.species);
  const act = useMatingAction(ws.orgId);
  const toast = useToast();
  const w = dam ? cat.data?.words[dam.species] : undefined;
  const [f, setF] = useState({ on: localDay(), count: "", to: "", from: "", toUnit: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setF({ on: localDay(), count: String(m?.born_alive ?? ""), to: "", from: "", toUnit: "" }); setError(null); } }, [open, m]);
  const src = groups.find((x) => x.id === m?.young_batch_id), dst = groups.find((x) => x.id === f.to);
  return (
    <Dialog open={open} onClose={onClose} title={`Wean ${w?.young ?? "the young"}`} eyebrow={dam?.tag}
      footer={<Foot onClose={onClose} busy={act.isPending} disabled={f.count === ""} onSave={async () => {
        setError(null);
        try {
          await act.mutateAsync({ id: m!.id, action: "wean", on: f.on, count: Number(f.count), to_batch_id: f.to || null, from_unit_id: f.from || null, to_unit_id: f.toUnit || null });
          toast(`Weaned ${f.count}${dst ? `, moved to ${dst.code}` : ""}`); onClose();
        } catch (e) { setError(err(e)); }
      }} />}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="h-w-on"><Input id="h-w-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
          <Field label="How many weaned" htmlFor="h-w-n" hint={m ? `${m.born_alive} born alive` : undefined}><Input id="h-w-n" inputMode="numeric" value={f.count} onChange={(e) => setF({ ...f, count: int(e.target.value) })} /></Field>
        </div>
        <Field label="Move them to another group" htmlFor="h-w-to" hint="Optional: for example your growers' pen">
          <Select id="h-w-to" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value, toUnit: "" })}>
            <option value="">Leave them where they are{src ? ` (${src.code})` : ""}</option>
            {groups.filter((b) => b.id !== m?.young_batch_id).map((b) => <option key={b.id} value={b.id}>{b.code} · {b.current}</option>)}
          </Select>
        </Field>
        {dst && <><UnitPick b={src} value={f.from} onChange={(v) => setF({ ...f, from: v })} label="From which pen" /><UnitPick b={dst} value={f.toUnit} onChange={(v) => setF({ ...f, toUnit: v })} label="Into which pen" /></>}
      </div>
    </Dialog>
  );
}

export function EndDialog({ m, dam, open, onClose }: { m: Mating | null; dam: { tag: string } | null; open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const act = useMatingAction(ws.orgId);
  const toast = useToast();
  const [kind, setKind] = useState<"lost" | "void">("lost");
  const [on, setOn] = useState(localDay());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setKind("lost"); setOn(localDay()); setNote(""); setError(null); } }, [open]);
  return (
    <Dialog open={open} onClose={onClose} title="Pregnancy did not go on" eyebrow={dam?.tag}
      footer={<Foot onClose={onClose} busy={act.isPending} disabled={kind === "void" && note.trim().length < 3} onSave={async () => {
        try {
          await act.mutateAsync(kind === "lost" ? { id: m!.id, action: "lost", on, note: note || null } : { id: m!.id, action: "void", reason: note });
          toast(kind === "lost" ? "Recorded as lost" : "Mating removed"); onClose();
        } catch (e) { setError(err(e)); }
      }} />}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <Segmented value={kind} onChange={setKind} options={[{ value: "lost", label: "She lost it (abortion)" }, { value: "void", label: "Entered by mistake" }]} />
        {kind === "lost" && <Field label="Date" htmlFor="h-l-on"><Input id="h-l-on" type="date" max={localDay()} value={on} onChange={(e) => setOn(e.target.value)} /></Field>}
        <Field label={kind === "lost" ? "What happened" : "Why"} htmlFor="h-l-note" hint={kind === "lost" ? "Optional" : undefined}><Input id="h-l-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

const EXIT = [{ value: "sold", label: "Sold" }, { value: "died", label: "Died" }, { value: "culled", label: "Culled" }, { value: "consumed", label: "Used at home" }];

export function ExitDialog({ a, open, onClose }: { a: Animal | null; open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const groups = useBreedingGroups(open, a?.species);
  const save = useExitAnimal(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ kind: "sold", on: localDay(), amount: "", reason: "", unit: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setF({ kind: "sold", on: localDay(), amount: "", reason: "", unit: "" }); setError(null); } }, [open]);
  const g = groups.find((x) => x.id === a?.batch_id);
  return (
    <Dialog open={open} onClose={onClose} title="Leaves the farm" eyebrow={a?.tag}
      footer={<Foot onClose={onClose} busy={save.isPending} onSave={async () => {
        setError(null);
        try {
          await save.mutateAsync({ id: a!.id, kind: f.kind, on: f.on, unit_id: f.unit || null, reason: f.reason || null, amount: f.kind === "sold" && f.amount ? Number(f.amount) : null });
          toast(`${a!.tag}: ${EXIT.find((x) => x.value === f.kind)!.label.toLowerCase()}`); onClose();
        } catch (e) { setError(err(e)); }
      }} />}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What happened">
          {EXIT.map((x) => (
            <button key={x.value} type="button" role="radio" aria-checked={f.kind === x.value} onClick={() => setF({ ...f, kind: x.value })}
              className={cn("rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold", f.kind === x.value ? "border-brand bg-brand-soft text-brand" : "border-line")}>{x.label}</button>
          ))}
        </div>
        <Field label="Date" htmlFor="h-x-on"><Input id="h-x-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        {f.kind === "sold" && <Field label="Sold for (₦)" htmlFor="h-x-amt" hint="Optional. To invoice a buyer, sell from Sales instead."><Input id="h-x-amt" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: int(e.target.value) })} /></Field>}
        <UnitPick b={g} value={f.unit} onChange={(v) => setF({ ...f, unit: v })} />
        <Field label={f.kind === "sold" ? "Buyer or note" : "Cause or note"} htmlFor="h-x-why" hint="Optional"><Input id="h-x-why" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        <p className="text-[12.5px] text-ink-3">One comes off {a?.batch_code}&apos;s count.</p>
      </div>
    </Dialog>
  );
}

export function MoveDialog({ a, open, onClose }: { a: Animal | null; open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const groups = useBreedingGroups(open, a?.species);
  const save = useMoveAnimal(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ to: "", on: localDay(), from: "", toUnit: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setF({ to: "", on: localDay(), from: "", toUnit: "" }); setError(null); } }, [open]);
  const src = groups.find((x) => x.id === a?.batch_id), dst = groups.find((x) => x.id === f.to);
  const others = useMemo(() => groups.filter((b) => b.id !== a?.batch_id), [groups, a]);
  return (
    <Dialog open={open} onClose={onClose} title="Move to another group" eyebrow={a?.tag}
      footer={<Foot onClose={onClose} busy={save.isPending} disabled={!f.to} onSave={async () => {
        setError(null);
        try { await save.mutateAsync({ id: a!.id, to_batch_id: f.to, on: f.on, from_unit_id: f.from || null, to_unit_id: f.toUnit || null }); toast(`${a!.tag} moved to ${dst!.code}`); onClose(); }
        catch (e) { setError(err(e)); }
      }} />}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        {!others.length && <Alert tone="info">No other running group of {a?.species}. Stock one in Batches first.</Alert>}
        <Field label="To group" htmlFor="h-m-to"><Select id="h-m-to" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value, toUnit: "" })}>
          <option value="">Choose…</option>{others.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.current}</option>)}</Select></Field>
        <Field label="Date" htmlFor="h-m-on"><Input id="h-m-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        <UnitPick b={src} value={f.from} onChange={(v) => setF({ ...f, from: v })} label="From which pen" />
        <UnitPick b={dst} value={f.toUnit} onChange={(v) => setF({ ...f, toUnit: v })} label="Into which pen" />
      </div>
    </Dialog>
  );
}

/** Served again before the result is known: same male or another. The due date moves to the last service. */
export function ServeDialog({ m, dam, open, onClose }: { m: Mating | null; dam: Animal | null; open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const cat = useHerdCatalog();
  const males = useAnimals(ws.orgId, { sex: "male", species: dam?.species }, open && !!dam);
  const act = useMatingAction(ws.orgId);
  const toast = useToast();
  const w = dam ? cat.data?.words[dam.species] : undefined;
  const [f, setF] = useState({ sire: "", method: "natural", name: "", on: localDay() });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setF({ sire: m?.services[m.services.length - 1]?.sire_id ?? "", method: "natural", name: "", on: localDay() }); setError(null); } }, [open, m]);
  const c = useCycle(ws.orgId, dam?.species);
  return (
    <Dialog open={open} onClose={onClose} title="Served again" eyebrow={dam?.tag}
      footer={<Foot onClose={onClose} busy={act.isPending} disabled={f.method === "natural" && !f.sire} onSave={async () => {
        setError(null);
        try {
          const r = await act.mutateAsync({ id: m!.id, action: "services", served_on: f.on, method: f.method,
            sire_id: f.method === "natural" ? f.sire : null, sire_name: f.method !== "natural" ? f.name || null : null });
          toast(`${dam?.tag}: due about ${shortDate(r.due_on)}`); onClose();
        } catch (e) { setError(err(e)); }
      }} />}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <p className="text-[13.5px] text-ink-2">Use this when she was served again before you knew if she held: on the same heat, or by another {w?.male ?? "male"}.</p>
        <Segmented value={f.method} onChange={(v) => setF({ ...f, method: v })} options={[{ value: "natural", label: "Our male" }, { value: "outside", label: "Outside male" }, { value: "ai", label: "AI" }]} />
        {f.method === "natural" ? (
          <Field label={w ? `Which ${w.male}` : "Which male"} htmlFor="h-sv-sire"><Select id="h-sv-sire" value={f.sire} onChange={(e) => setF({ ...f, sire: e.target.value })}>
            <option value="">Choose…</option>{males.data?.map((x) => <option key={x.id} value={x.id}>{x.tag}{x.name ? ` (${x.name})` : ""}</option>)}</Select></Field>
        ) : <Field label={f.method === "ai" ? "Semen or bull used" : "Whose male"} htmlFor="h-sv-name" hint="Optional"><Input id="h-sv-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>}
        <Field label="Date" htmlFor="h-sv-on"><Input id="h-sv-on" type="date" min={m?.mated_on} max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        {c && <p className="text-[13px] text-ink-2">New due date: <b className="text-brand">{shortDate(addDays(f.on, c.gestation))}</b> ({c.gestation} days from this service)</p>}
      </div>
    </Dialog>
  );
}

const FIELDS: { key: string; label: string; unit: "days" | "months" }[] = [
  { key: "first_mating_f", label: "First mating, females", unit: "months" },
  { key: "first_mating_m", label: "First use, males", unit: "months" },
  { key: "gestation", label: "Pregnancy length", unit: "days" },
  { key: "cycle", label: "Heat cycle", unit: "days" },
  { key: "check", label: "Pregnancy check after mating", unit: "days" },
  { key: "prepare", label: "Get ready before birth", unit: "days" },
  { key: "wean", label: "Wean at", unit: "days" },
  { key: "rebreed", label: "Mate again after birth", unit: "days" },
  { key: "rebreed_after_wean", label: "Mate again after weaning", unit: "days" },
  { key: "overdue", label: "Call it overdue after the due date", unit: "days" },
];
const SPECIES_LABEL: Record<string, string> = { goats: "Goats", sheep: "Sheep", pigs: "Pigs", cattle: "Cattle", rabbits: "Rabbits" };

/** The farm's own breeding numbers per species; empty means the default. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const q = useHerdSettings(ws.orgId, open);
  const save = useSaveHerdSettings(ws.orgId);
  const toast = useToast();
  const [sp, setSp] = useState("goats");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const cur = q.data?.[sp];
  useEffect(() => {
    if (!cur) return;
    const own = new Set(cur.changed);
    setVals(Object.fromEntries(FIELDS.map((f) => {
      const v = cur.values[f.key];
      return [f.key, own.has(f.key) && typeof v === "number" ? String(f.unit === "months" ? Math.round(v / 30.4) : v) : ""];
    })));
    setError(null);
  }, [cur, sp]);
  const shown = FIELDS.filter((f) => cur && f.key in cur.defaults && cur.defaults[f.key] !== null);
  return (
    <Dialog open={open} onClose={onClose} title="Breeding numbers" eyebrow="Your farm" wide
      footer={<Foot onClose={onClose} busy={save.isPending} onSave={async () => {
        setError(null);
        try {
          const values = Object.fromEntries(shown.map((f) => {
            const n = vals[f.key] === "" ? null : Number(vals[f.key]);
            return [f.key, n == null ? null : f.unit === "months" ? Math.round(n * 30.4) : n];
          }));
          await save.mutateAsync({ species: sp, values }); toast(`Saved for ${SPECIES_LABEL[sp].toLowerCase()}`); onClose();
        } catch (e) { setError(err(e)); }
      }} />}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <p className="text-[13.5px] text-ink-2">Oko plans heat watches, checks, due dates and weaning from these. Leave a box empty to use the suggested number. Changes apply to new matings and to what is still ahead.</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(SPECIES_LABEL).map((k) => (
            <button key={k} type="button" aria-pressed={sp === k} onClick={() => setSp(k)}
              className={cn("rounded-full border px-3 py-1 text-[13px] font-semibold", sp === k ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2")}>{SPECIES_LABEL[k]}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((f) => {
            const d = cur!.defaults[f.key] as number;
            const def = f.unit === "months" ? `${Math.round(d / 30.4)} months` : `${d} days`;
            return (
              <Field key={f.key} label={`${f.label} (${f.unit})`} htmlFor={`hs-${f.key}`} hint={`Suggested: ${def}`}>
                <Input id={`hs-${f.key}`} inputMode="numeric" placeholder={f.unit === "months" ? String(Math.round(d / 30.4)) : String(d)} value={vals[f.key] ?? ""}
                  onChange={(e) => setVals({ ...vals, [f.key]: e.target.value.replace(/\D/g, "") })} />
              </Field>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
