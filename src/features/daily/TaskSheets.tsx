"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, MapPin, Plus, X } from "lucide-react";
import { Alert, Button, Dialog, Field, Input, Segmented, Select, Textarea, Toggle, useToast } from "@/components/ui";
import { useCatalog, useFarmMap } from "@/features/farm";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError, blobUrl } from "@/lib/api";
import { cn } from "@/lib/format";
import { type TodayTask, uploadPhoto, useComplete, useCreateTask, useDailyCatalog, useHandover, useSuggest, useTasks, useUpdateTask } from "./api";
import { type Fix, locate, shrinkPhoto } from "./device";
import { newId } from "./queue";

const errMsg = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

/** Tick a task off with the proof it asks for (photo, location), or skip it with a reason. */
export function CompleteSheet({ task, on, onClose }: { task: TodayTask | null; on: string; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const complete = useComplete(ws.orgId);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"done" | "skipped">("done");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needPhoto = task?.proof === "photo" || task?.proof === "photo_gps";
  const needGps = task?.proof === "gps" || task?.proof === "photo_gps";

  useEffect(() => {
    if (!task) return;
    setMode("done"); setNote(""); setPhoto(null); setFix(null); setError(null);
    if (task.proof === "gps" || task.proof === "photo_gps") getFix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  async function getFix() {
    setLocating(true); setError(null);
    try { setFix(await locate()); } catch (e) { setError(errMsg(e)); } finally { setLocating(false); }
  }
  const pick = async (file?: File) => {
    if (!file) return;
    setError(null);
    try { const blob = await shrinkPhoto(file); setPhoto({ blob, url: URL.createObjectURL(blob) }); } catch (e) { setError(errMsg(e)); }
  };
  if (!task) return null;
  const ready = mode === "skipped" ? note.trim().length >= 3 : (!needPhoto || !!photo) && (!needGps || !!fix);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      let media_id: string | null = null;
      if (mode === "done" && photo) media_id = (await uploadPhoto(ws.orgId, photo.blob, newId())).id;
      await complete.mutateAsync({ taskId: task.id, on: task.due_on ?? on, status: mode, note: note.trim() || null, media_id, ...(mode === "done" && fix ? fix : {}), client_id: newId() });
      toast(mode === "done" ? `Done: ${task.title}` : `Skipped: ${task.title}`);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 0 ? "No connection. Photos and location need the network: try again in a moment." : errMsg(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!task} onClose={onClose} title={task.title} eyebrow={[task.unit_code ?? task.site_name ?? "Whole farm", task.time_slot].join(" · ")}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="lg" loading={busy} disabled={!ready} onClick={save}>{mode === "done" ? "Mark done" : "Skip"}</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        {task.details && <p className="text-ink-2">{task.details}</p>}
        <Segmented value={mode} onChange={setMode} options={[{ value: "done", label: "Done" }, { value: "skipped", label: "Could not do it" }]} />
        {mode === "done" && needPhoto && (
          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold text-ink-2">Photo (required)</span>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take a photo" onChange={(e) => pick(e.target.files?.[0])} />
            {photo ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="Proof" className="max-h-56 rounded-xl border border-line" />
                <button type="button" aria-label="Remove photo" onClick={() => setPhoto(null)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-[var(--scrim)] text-white"><X size={16} /></button>
                <p className="mt-1 text-[12px] text-ink-3">{Math.round(photo.blob.size / 1024)} KB</p>
              </div>
            ) : <Button onClick={() => fileRef.current?.click()}><Camera size={16} /> Take a photo</Button>}
          </div>
        )}
        {mode === "done" && needGps && (
          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            <MapPin size={18} className={fix ? "text-good" : "text-ink-3"} />
            <span className="flex-1 text-[13.5px]">{fix ? `Location recorded (±${fix.accuracy_m} m)` : locating ? "Getting your location…" : "Location needed"}</span>
            {!fix && <Button size="sm" loading={locating} onClick={getFix}>Try again</Button>}
          </div>
        )}
        <Field label={mode === "skipped" ? "Why? (required)" : "Note"} htmlFor="c-note" hint={mode === "skipped" ? undefined : "Optional"}>
          <Textarea id="c-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "skipped" ? "No feed left in store" : ""} />
        </Field>
      </div>
    </Dialog>
  );
}

/** Show a proof photo (fetched with the person's token). */
export function ProofPhoto({ mediaId }: { mediaId: string }) {
  const ws = useCurrentWorkspace();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let gone = false; let made: string | null = null;
    blobUrl(`/organizations/${ws.orgId}/farm/media/${mediaId}`).then((u) => { made = u; if (!gone) setUrl(u); }).catch(() => null);
    return () => { gone = true; if (made) URL.revokeObjectURL(made); };
  }, [mediaId, ws.orgId]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Proof photo" className="h-14 w-14 rounded-lg border border-line object-cover" /></a>
    : <span className="grid h-14 w-14 place-items-center rounded-lg bg-surface-2"><Camera size={16} className="text-ink-3" /></span>;
}

export function HandoverDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const cat = useDailyCatalog();
  const save = useHandover(ws.orgId);
  const toast = useToast();
  const hour = new Date().getHours();
  const [shift, setShift] = useState(hour < 12 ? "morning" : hour < 18 ? "afternoon" : "night");
  const [note, setNote] = useState("");
  const [issue, setIssue] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setNote(""); setIssues([]); setIssue(""); setError(null); } }, [open]);
  const add = () => { if (issue.trim()) { setIssues([...issues, issue.trim()]); setIssue(""); } };
  return (
    <Dialog open={open} onClose={onClose} title="Hand over to the next shift" eyebrow="Today"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={note.trim().length < 3}
        onClick={async () => { try { await save.mutateAsync({ shift, note: note.trim(), issues, client_id: newId() }); toast("Handover saved"); onClose(); } catch (e) { setError(errMsg(e)); } }}>Save handover</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <Field label="Your shift" htmlFor="h-shift"><Select id="h-shift" value={shift} onChange={(e) => setShift(e.target.value)}>
          {Object.entries(cat.data?.shifts ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="What should the next shift know?" htmlFor="h-note"><Textarea id="h-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="H2 drinker leaking, fixed with tape. 3 birds weak in H1 corner. Feed store has 6 bags left." /></Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-2">Open issues</span>
          <div className="flex gap-2"><Input aria-label="Add an issue" value={issue} onChange={(e) => setIssue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder="Generator needs diesel" />
            <Button onClick={add} disabled={!issue.trim()}><Plus size={16} /></Button></div>
          {issues.length > 0 && <ul className="flex flex-wrap gap-2">{issues.map((i, k) => (
            <li key={k} className="flex items-center gap-1 rounded-full bg-warn-soft px-3 py-1 text-[13px] text-warn">{i}
              <button type="button" aria-label={`Remove ${i}`} onClick={() => setIssues(issues.filter((_, j) => j !== k))}><X size={13} /></button></li>))}</ul>}
        </div>
      </div>
    </Dialog>
  );
}

/** Plan the routine: suggested tasks per species for chosen units, your own tasks, and stopping old ones. */
export function PlanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const cat = useDailyCatalog();
  const farmCat = useCatalog();
  const farm = useFarmMap(ws.orgId, false, open);
  const tasks = useTasks(ws.orgId, open);
  const suggest = useSuggest(ws.orgId);
  const create = useCreateTask(ws.orgId);
  const update = useUpdateTask(ws.orgId);
  const toast = useToast();
  const [tab, setTab] = useState<"suggested" | "own" | "all">("suggested");
  const [species, setSpecies] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [t, setT] = useState({ title: "", where: "", repeat: "daily", days: [] as number[], every: "3", slot: "morning", proof: "none", kind: "" });
  const [error, setError] = useState<string | null>(null);
  const units = useMemo(() => (farm.data?.sites ?? []).flatMap((s) => s.units.filter((u) => !u.archived_at)), [farm.data]);
  const unitCode = (id: string | null) => units.find((u) => u.id === id)?.code;
  useEffect(() => {
    if (!open || !farm.data) return;
    setError(null);
    const ub = farm.data.unit_batches;
    const first = Object.values(ub).flat()[0]?.species ?? "";
    const sp = cat.data?.suggested_for.includes(first) ? first : cat.data?.suggested_for[0] ?? "";
    setSpecies(sp);
    setChosen(new Set(Object.entries(ub).filter(([, bs]) => bs.some((b) => b.species === sp)).map(([id]) => id)));
  }, [open, farm.data, cat.data]);
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Dialog open={open} onClose={onClose} title="Plan the daily routine" eyebrow="Today" wide
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <Segmented value={tab} onChange={setTab} options={[{ value: "suggested", label: "Suggested" }, { value: "own", label: "Add your own" }, { value: "all", label: `All tasks${tasks.data ? ` (${tasks.data.length})` : ""}` }]} />
        {tab === "suggested" && (
          <div className="flex flex-col gap-3">
            <Field label="For" htmlFor="p-species"><Select id="p-species" value={species} onChange={(e) => setSpecies(e.target.value)}>
              {(cat.data?.suggested_for ?? []).map((s) => <option key={s} value={s}>{farmCat.data?.purposes[s] ?? s}</option>)}</Select></Field>
            <div className="flex flex-col gap-1.5"><span className="text-[12.5px] font-semibold text-ink-2">Units</span>
              <div className="flex flex-wrap gap-2">{units.map((u) => (
                <button key={u.id} type="button" aria-pressed={chosen.has(u.id)} onClick={() => { const n = new Set(chosen); if (n.has(u.id)) n.delete(u.id); else n.add(u.id); setChosen(n); }}
                  className={cn("cursor-pointer rounded-xl border px-3 py-1.5 font-mono font-semibold", chosen.has(u.id) ? "border-brand bg-brand-soft text-brand" : "border-line")}>{u.code}</button>))}</div></div>
            <p className="text-[12.5px] text-ink-3">Adds feeding, water checks, removing dead animals (with a photo), weighing and more. Tasks already there are not added twice. You can change or stop any of them later.</p>
            <div><Button variant="primary" loading={suggest.isPending} disabled={!species || chosen.size === 0} onClick={async () => {
              try { const made = await suggest.mutateAsync({ species, unit_ids: [...chosen] }); toast(made.length ? `Added ${made.length} tasks` : "Those routines are already planned"); }
              catch (e) { setError(errMsg(e)); }
            }}><Check size={16} /> Add suggested routine</Button></div>
          </div>
        )}
        {tab === "own" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Task" htmlFor="t-title" className="sm:col-span-2"><Input id="t-title" value={t.title} maxLength={120} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="Lock the feed store" /></Field>
            <Field label="Where" htmlFor="t-where"><Select id="t-where" value={t.where} onChange={(e) => setT({ ...t, where: e.target.value })}>
              <option value="">Whole farm</option>{units.map((u) => <option key={u.id} value={u.id}>{u.code}{u.name ? ` · ${u.name}` : ""}</option>)}</Select></Field>
            <Field label="Time of day" htmlFor="t-slot"><Select id="t-slot" value={t.slot} onChange={(e) => setT({ ...t, slot: e.target.value })}>
              {Object.entries(cat.data?.time_slots ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="How often" htmlFor="t-repeat"><Select id="t-repeat" value={t.repeat} onChange={(e) => setT({ ...t, repeat: e.target.value })}>
              {Object.entries(cat.data?.repeats ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Proof" htmlFor="t-proof"><Select id="t-proof" value={t.proof} onChange={(e) => setT({ ...t, proof: e.target.value })}>
              {Object.entries(cat.data?.proofs ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            {t.repeat === "weekly" && <div className="flex flex-wrap gap-2 sm:col-span-2">{DAYS.map((d, i) => (
              <button key={d} type="button" aria-pressed={t.days.includes(i)} onClick={() => setT({ ...t, days: t.days.includes(i) ? t.days.filter((x) => x !== i) : [...t.days, i] })}
                className={cn("cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold", t.days.includes(i) ? "border-brand bg-brand-soft text-brand" : "border-line")}>{d}</button>))}</div>}
            {t.repeat === "every_n" && <Field label="Every how many days" htmlFor="t-every"><Input id="t-every" inputMode="numeric" value={t.every} onChange={(e) => setT({ ...t, every: e.target.value.replace(/\D/g, "") })} /></Field>}
            <Field label="Opens a quick log" htmlFor="t-kind" hint="Optional: ticking it asks for the record"><Select id="t-kind" value={t.kind} onChange={(e) => setT({ ...t, kind: e.target.value })}>
              <option value="">No</option>{Object.entries(cat.data?.record_kinds ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <div className="sm:col-span-2"><Button variant="primary" loading={create.isPending} disabled={t.title.trim().length < 2 || (t.repeat === "weekly" && !t.days.length)} onClick={async () => {
              try {
                await create.mutateAsync({ title: t.title.trim(), unit_id: t.where || null, repeat: t.repeat, weekdays: t.repeat === "weekly" ? t.days : null,
                  every_n: t.repeat === "every_n" ? Number(t.every) : null, time_slot: t.slot, proof: t.proof, record_kind: t.kind || null });
                toast(`Added: ${t.title.trim()}`); setT({ ...t, title: "" });
              } catch (e) { setError(errMsg(e)); }
            }}><Plus size={16} /> Add task</Button></div>
          </div>
        )}
        {tab === "all" && (
          <ul className="flex max-h-[360px] flex-col overflow-y-auto">
            {(tasks.data ?? []).map((x) => (
              <li key={x.id} className="flex items-center gap-3 border-t border-line py-2 first:border-0">
                <span className="min-w-0 flex-1"><b>{x.title}</b><span className="block text-[12.5px] text-ink-3">{unitCode(x.unit_id) ?? "Whole farm"} · {cat.data?.time_slots[x.time_slot]} · {cat.data?.repeats[x.repeat]}{x.proof !== "none" ? ` · ${cat.data?.proofs[x.proof]}` : ""}</span></span>
                <Toggle checked={x.active} label={`Keep ${x.title}`} onChange={async (v) => { try { await update.mutateAsync({ id: x.id, active: v }); } catch (e) { setError(errMsg(e)); } }} />
              </li>
            ))}
            {tasks.data?.length === 0 && <li className="py-3 text-ink-3">No tasks yet.</li>}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

