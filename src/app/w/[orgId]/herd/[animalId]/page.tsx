"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Baby, Heart, LogOut, MoveRight, PawPrint, Pencil, Stethoscope } from "lucide-react";
import { Alert, Badge, Button, Card, Dialog, Field, Input, PageLoader, Select, Textarea, useToast } from "@/components/ui";
import { type AnimalDetail, type Mating, ageText, shortDate, useAnimal, useAnimals, useHerdCatalog, useMatingAction, useUpdateAnimal } from "@/features/herd/api";
import { BirthDialog, CheckDialog, EndDialog, ExitDialog, MateDialog, MoveDialog, WeanDialog } from "@/features/herd/Dialogs";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";

const STATUS: Record<Mating["status"], [string, "neutral" | "good" | "warn" | "crit" | "info" | "brand"]> = {
  served: ["Mated", "info"], pregnant: ["Pregnant", "brand"], empty: ["Not pregnant", "neutral"], born: ["Gave birth", "good"], lost: ["Lost", "crit"],
};
const longDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

export default function AnimalPage() {
  const { animalId } = useParams<{ animalId: string }>();
  const ws = useCurrentWorkspace();
  const q = useAnimal(ws.orgId, animalId);
  const cat = useHerdCatalog();
  const [open, setOpen] = useState<"" | "mate" | "check" | "birth" | "wean" | "end" | "exit" | "move" | "edit" | "undo">("");
  const [mat, setMat] = useState<Mating | null>(null);
  if (q.isLoading) return <PageLoader />;
  if (!q.data) return <Alert tone="crit">{q.error instanceof ApiError ? q.error.message : "Could not load this animal."}</Alert>;
  const a = q.data;
  const w = cat.data?.words[a.species];
  const c = cat.data?.cycles[a.species];
  const edit = ws.can("farm.edit") && a.status === "active";
  const live = a.matings.filter((m) => !m.voided_at);
  const current = live.find((m) => m.status === "served" || m.status === "pregnant") ?? null;
  const nursing = live.find((m) => m.status === "born" && !m.weaned_on && (m.born_alive ?? 0) > 0) ?? null;
  const go = (k: typeof open, m: Mating | null = null) => { setMat(m); setOpen(k); };
  const close = () => setOpen("");

  return (
    <>
      <Link href={`/w/${ws.orgId}/herd`} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={15} /> Breeding</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">{a.sex === "female" ? (w?.female ?? "Female") : (w?.male ?? "Male")} · {a.species}{a.breed ? ` · ${a.breed}` : ""}</div>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 font-display text-[28px] font-bold">
            <span className="font-mono">{a.tag}</span>{a.name && <span className="text-ink-2">{a.name}</span>}
            {a.status !== "active" ? <Badge>{a.status === "consumed" ? "Used at home" : a.status[0].toUpperCase() + a.status.slice(1)}{a.status_on ? ` ${shortDate(a.status_on)}` : ""}</Badge>
              : a.state && <Badge tone={a.state_tone}>{a.state}</Badge>}
          </h1>
          <p className="mt-1 text-ink-2">{ageText(a.age_days)}{a.born_on ? ` · born ${longDate(a.born_on)}${a.born_estimated ? " (about)" : ""}` : ""} · in <Link className="font-semibold text-brand" href={`/w/${ws.orgId}/batches/${a.batch_id}`}>{a.batch_code}</Link></p>
        </div>
        {edit && (
          <div className="flex flex-wrap gap-2">
            {a.sex === "female" && !current && <Button variant="primary" onClick={() => go("mate")}><Heart size={16} /> Record {w?.mate ?? "mating"}</Button>}
            {current && <Button onClick={() => go("check", current)}><Stethoscope size={16} /> Pregnancy check</Button>}
            {current && <Button variant="primary" onClick={() => go("birth", current)}><Baby size={16} /> Record {w?.birth ?? "birth"}</Button>}
            {nursing && <Button onClick={() => go("wean", nursing)}><PawPrint size={16} /> Wean</Button>}
          </div>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {current && c && (
            <Card title={current.status === "pregnant" ? "Pregnant" : "Mated, waiting for a check"} meta={`Due about ${longDate(current.due_on)}`}>
              <Timeline m={current} cycle={c} />
              {edit && <button type="button" className="mt-3 text-[12.5px] font-semibold text-ink-3 hover:text-crit" onClick={() => go("end", current)}>She lost it, or this was entered by mistake</button>}
            </Card>
          )}
          {a.sex === "female" && (
            <Card title={`${w?.birth ? w.birth[0].toUpperCase() + w.birth.slice(1) : "Breeding"} history`} meta={a.litters ? `${a.litters} litter${a.litters > 1 ? "s" : ""}, ${a.young_total} born alive` : undefined} flush>
              {!live.length ? <p className="px-4 pb-4 text-[13.5px] text-ink-3">Nothing recorded yet.</p> : (
                <ul className="divide-y divide-line">
                  {live.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[13.5px]">
                      <span className="w-[92px] shrink-0 font-semibold">{shortDate(m.mated_on)}</span>
                      <span className="min-w-0 flex-1 text-ink-2">with {m.sire_tag ?? m.sire_name ?? (m.method === "ai" ? "AI" : "an outside male")}
                        {m.status === "born" && <> · <b className="text-ink">{m.born_alive} alive</b>{m.born_dead ? `, ${m.born_dead} dead` : ""} on {shortDate(m.ended_on!)}{m.young_batch_code ? ` into ${m.young_batch_code}` : ""}{m.weaned_on ? ` · weaned ${m.weaned} on ${shortDate(m.weaned_on)}` : ""}</>}
                        {(m.status === "served" || m.status === "pregnant") && <> · due {shortDate(m.due_on)}</>}
                      </span>
                      <Badge tone={STATUS[m.status][1]}>{STATUS[m.status][0]}</Badge>
                      {m.status === "born" && ws.can("farm.approve") && !m.weaned_on && <button type="button" className="text-[12px] text-ink-3 hover:text-crit" onClick={() => go("undo", m)}>Undo</button>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          {a.sex === "male" && a.sired.length > 0 && (
            <Card title="Matings" meta={`${a.sired.length}`} flush>
              <ul className="divide-y divide-line">{a.sired.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13.5px]"><span><b>{shortDate(m.mated_on)}</b> · {m.dam_tag}</span><Badge tone={STATUS[m.status][1]}>{STATUS[m.status][0]}{m.status === "born" ? `: ${m.born_alive}` : ""}</Badge></li>
              ))}</ul>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Family">
            <dl className="grid grid-cols-2 gap-3 text-[13.5px]">
              <div><dt className="text-[12px] text-ink-3">Mother</dt><dd>{a.dam ? <Link className="font-mono font-semibold text-brand" href={`/w/${ws.orgId}/herd/${a.dam.id}`}>{a.dam.tag}</Link> : "Not recorded"}</dd></div>
              <div><dt className="text-[12px] text-ink-3">Father</dt><dd>{a.sire ? <Link className="font-mono font-semibold text-brand" href={`/w/${ws.orgId}/herd/${a.sire.id}`}>{a.sire.tag}</Link> : a.sire_name ?? "Not recorded"}</dd></div>
            </dl>
            {a.offspring.length > 0 && (
              <div className="mt-4"><div className="mb-1.5 text-[12px] text-ink-3">Offspring tagged ({a.offspring.length})</div>
                <div className="flex flex-wrap gap-1.5">{a.offspring.map((o) => (
                  <Link key={o.id} href={`/w/${ws.orgId}/herd/${o.id}`} className={cn("rounded-full border border-line px-2.5 py-1 font-mono text-[12.5px] font-semibold hover:border-brand", o.status !== "active" && "text-ink-3 line-through")}>
                    {o.sex === "female" ? "♀" : "♂"} {o.tag}</Link>))}</div></div>
            )}
          </Card>
          {c && a.sex === "female" && (
            <Card title={`Guide for ${a.species}`} meta="Starting points; your vet knows your animals">
              <ul className="flex flex-col gap-1.5 text-[13px] text-ink-2">
                <li>First mating at about <b className="text-ink">{Math.round(c.first_mating_f / 30.4)} months</b>, when well grown</li>
                <li>Pregnancy lasts about <b className="text-ink">{c.gestation} days</b></li>
                {c.cycle ? <li>Comes on heat every <b className="text-ink">{c.cycle} days</b> when not pregnant</li> : <li>Rabbits ovulate when mated: re-mate if the check is negative</li>}
                <li>Wean at about <b className="text-ink">{c.wean < 60 ? `${Math.round(c.wean / 7)} weeks` : `${Math.round(c.wean / 30.4)} months`}</b>; mate again about {c.rebreed} days after giving birth</li>
                <li>Usually {c.litter[0] === c.litter[1] ? c.litter[0] : `${c.litter[0]}–${c.litter[1]}`} {w?.young} per birth</li>
              </ul>
            </Card>
          )}
          {edit && (
            <Card title="Changes">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => go("edit")}><Pencil size={15} /> Edit details</Button>
                <Button size="sm" variant="ghost" onClick={() => go("move")}><MoveRight size={15} /> Move group</Button>
                <Button size="sm" variant="ghost" onClick={() => go("exit")}><LogOut size={15} /> Sold, died or culled</Button>
              </div>
            </Card>
          )}
          {a.notes && <Card title="Notes"><p className="whitespace-pre-line text-[13.5px]">{a.notes}</p></Card>}
        </div>
      </div>

      <MateDialog open={open === "mate"} onClose={close} dam={a} />
      <CheckDialog open={open === "check"} onClose={close} m={mat} dam={a} />
      <BirthDialog open={open === "birth"} onClose={close} m={mat} dam={a} />
      <WeanDialog open={open === "wean"} onClose={close} m={mat} dam={a} />
      <EndDialog open={open === "end"} onClose={close} m={mat} dam={a} />
      <ExitDialog open={open === "exit"} onClose={close} a={a} />
      <MoveDialog open={open === "move"} onClose={close} a={a} />
      <EditDialog open={open === "edit"} onClose={close} a={a} />
      <UndoBirth open={open === "undo"} onClose={close} m={mat} />
    </>
  );
}

function Timeline({ m, cycle }: { m: Mating; cycle: { cycle: number | null; check: number; prepare: number; gestation: number } }) {
  const add = (n: number) => { const d = new Date(m.mated_on + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const today = new Date().toISOString().slice(0, 10);
  const steps = [
    { on: m.mated_on, label: "Mated" },
    ...(cycle.cycle ? [{ on: add(cycle.cycle), label: "Heat watch" }] : []),
    { on: add(cycle.check), label: m.checked_on ? "Checked: pregnant" : "Pregnancy check" },
    { on: add(cycle.gestation - cycle.prepare), label: "Get ready" },
    { on: m.due_on, label: "Due" },
  ];
  const pct = Math.min(100, Math.max(0, ((Date.parse(today) - Date.parse(m.mated_on)) / (Date.parse(m.due_on) - Date.parse(m.mated_on))) * 100));
  return (
    <div>
      <div className="relative mb-2 h-2 rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Through the pregnancy">
        <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {steps.map((s) => (
          <li key={s.label} className={cn("rounded-[12px] border px-2.5 py-2 text-[12.5px]", s.on < today ? "border-line text-ink-3" : "border-brand/30 bg-brand-soft/40")}>
            <b className={cn("block", s.on >= today && "text-ink")}>{s.label}</b>{shortDate(s.on)}
          </li>
        ))}
      </ol>
    </div>
  );
}

function EditDialog({ a, open, onClose }: { a: AnimalDetail; open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const save = useUpdateAnimal(ws.orgId);
  const females = useAnimals(ws.orgId, { sex: "female", species: a.species, status: "all" }, open);
  const males = useAnimals(ws.orgId, { sex: "male", species: a.species, status: "all" }, open);
  const toast = useToast();
  const [f, setF] = useState({ tag: a.tag, name: a.name ?? "", born: a.born_on ?? "", breed: a.breed ?? "", dam: a.dam?.id ?? "", sire: a.sire?.id ?? "", notes: a.notes ?? "" });
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onClose={onClose} title="Edit details" eyebrow={a.tag}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={async () => {
        try {
          await save.mutateAsync({ id: a.id, tag: f.tag, name: f.name || null, born_on: f.born || null, breed: f.breed || null, dam_id: f.dam || null, sire_id: f.sire || null, notes: f.notes || null });
          toast("Saved"); onClose();
        } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save."); }
      }}>Save</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tag" htmlFor="e-tag"><Input id="e-tag" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value.toUpperCase() })} /></Field>
          <Field label="Name" htmlFor="e-name"><Input id="e-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Born on" htmlFor="e-born"><Input id="e-born" type="date" value={f.born} onChange={(e) => setF({ ...f, born: e.target.value })} /></Field>
          <Field label="Breed" htmlFor="e-breed"><Input id="e-breed" value={f.breed} onChange={(e) => setF({ ...f, breed: e.target.value })} /></Field>
          <Field label="Mother" htmlFor="e-dam"><Select id="e-dam" value={f.dam} onChange={(e) => setF({ ...f, dam: e.target.value })}>
            <option value="">Not recorded</option>{females.data?.filter((x) => x.id !== a.id).map((x) => <option key={x.id} value={x.id}>{x.tag}</option>)}</Select></Field>
          <Field label="Father" htmlFor="e-sire"><Select id="e-sire" value={f.sire} onChange={(e) => setF({ ...f, sire: e.target.value })}>
            <option value="">Not recorded</option>{males.data?.filter((x) => x.id !== a.id).map((x) => <option key={x.id} value={x.id}>{x.tag}</option>)}</Select></Field>
        </div>
        <Field label="Notes" htmlFor="e-notes"><Textarea id="e-notes" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}

function UndoBirth({ m, open, onClose }: { m: Mating | null; open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const act = useMatingAction(ws.orgId);
  const toast = useToast();
  const [why, setWhy] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onClose={onClose} title="Undo this birth record" eyebrow="Entered by mistake"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" loading={act.isPending} disabled={why.trim().length < 3} onClick={async () => {
        try { await act.mutateAsync({ id: m!.id, action: "undo-birth", reason: why }); toast("Birth record undone"); onClose(); }
        catch (e) { setError(e instanceof ApiError ? e.message : "Could not undo."); }
      }}>Undo</Button></>}>
      <div className="flex flex-col gap-3">
        {error && <Alert tone="crit">{error}</Alert>}
        <p className="text-[13.5px] text-ink-2">The young come off {m?.young_batch_code}&apos;s count, any tagged young are removed, and she shows as pregnant again.</p>
        <Field label="Why" htmlFor="u-why"><Input id="u-why" value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}
