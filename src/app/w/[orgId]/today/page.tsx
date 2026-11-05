"use client";

import { useMemo, useState } from "react";
import { OwnerActions } from "@/features/corrections";
import {
  AlertTriangle, Camera, CheckCircle2, ChevronLeft, ChevronRight, Circle, CloudOff, Droplets, Egg, MessageSquareText,
  NotebookPen, Scale, Settings2, Skull, Stethoscope, ThermometerSun, Undo2, Wheat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, PageLoader, useToast } from "@/components/ui";
import {
  type QuickKind, type TodayTask, CompleteSheet, HandoverDialog, localDay, PlanDialog, ProofPhoto,
  QUICK, QuickLog, shiftDay, useAcknowledge, useDailyCatalog, useToday, useUndo, useVoidRecord,
} from "@/features/daily";
import { useAuth } from "@/features/auth";
import { save as saveOffline, useSync } from "@/features/offline";
import { ReasonDialog } from "@/features/batches";
import { HoldList, ReportCaseDialog } from "@/features/health";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, formatDate, relative } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";

const ICON: Record<QuickKind, LucideIcon> = { feed: Wheat, deaths: Skull, weight: Scale, eggs: Egg, water: Droplets, note: NotebookPen };

export default function TodayPage() {
  return <RequirePermission permission="farm.view"><Inner /></RequirePermission>;
}

function Inner() {
  const ws = useCurrentWorkspace();
  const { me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [on, setOn] = useState(localDay());
  const today = useToday(ws.orgId, on);
  const cat = useDailyCatalog();
  const undo = useUndo(ws.orgId);
  const ack = useAcknowledge(ws.orgId);
  const voidRec = useVoidRecord(ws.orgId);
  const [log, setLog] = useState<{ kind: QuickKind; unit?: string | null; task?: TodayTask } | null>(null);
  const [ticking, setTicking] = useState<TodayTask | null>(null);
  const [handover, setHandover] = useState(false);
  const [plan, setPlan] = useState(false);
  const [sick, setSick] = useState(false);
  const sync = useSync(ws.orgId);
  const [voiding, setVoiding] = useState<string | null>(null);
  const canLog = ws.can("farm.edit") || ws.can("farm.approve");
  const isToday = on === localDay();

  // Work saved on this phone but not sent yet shows as done here, so nobody does it twice.
  const savedHere = useMemo(() => new Map(sync.ops.filter((o) => o.kind === "farm.task_done" && o.status === "waiting")
    .map((o) => [`${o.params.task_id}|${o.body.on}`, o])), [sync.ops]);

  const groups = useMemo(() => {
    const g = new Map<string, TodayTask[]>();
    for (const t of today.data?.tasks ?? []) { const k = t.overdue ? "overdue" : t.time_slot; g.set(k, [...(g.get(k) ?? []), t]); }
    return [...g.entries()];
  }, [today.data]);

  if (!ws.has("farm")) return <EmptyState title="Farm records are not in your plan" />;
  if (today.isLoading || !today.data) return <PageLoader />;
  const d = today.data;
  const doneHere = d.tasks.filter((t) => !t.completion && savedHere.has(`${t.id}|${t.due_on ?? on}`)).length;
  const done = d.done + doneHere;
  const pct = d.total ? Math.round((100 * done) / d.total) : 0;
  const unread = d.handovers.filter((h) => !h.acknowledged_at && h.from_user !== me?.user.id);

  const tick = async (t: TodayTask) => {
    if (t.record_kind && !t.completion) { setLog({ kind: (t.record_kind === "milk" ? "note" : t.record_kind) as QuickKind, unit: t.unit_id, task: t }); return; }
    if (t.proof !== "none") { setTicking(t); return; }
    await quickTick(t);
  };
  async function quickTick(t: TodayTask, quiet = false) {
    try {
      const r = await saveOffline(ws.orgId, "farm.task_done", { on: t.due_on ?? on, status: "done" }, `Done: ${t.title}`, { params: { task_id: t.id } });
      qc.invalidateQueries({ queryKey: ["farm", ws.orgId] });
      if (r.status === "queued" && !quiet) toast(`Saved on this phone: ${t.title}`);
    } catch (e) { if (!quiet) toast(e instanceof ApiError ? e.message : "Could not save", "crit"); }
  }
  const afterLog = async () => {
    const t = log?.task;
    if (t && t.proof === "none") await quickTick(t, true); // the log itself is saved either way
    else if (t) setTicking(t);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">Today</div>
          <div className="mt-1 flex items-center gap-1">
            <button aria-label="Previous day" className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-surface-2" onClick={() => setOn(shiftDay(on, -1))}><ChevronLeft size={18} /></button>
            <h1 className="px-2 text-[24px] font-bold">{isToday ? "Today" : formatDate(on)}</h1>
            <button aria-label="Next day" disabled={isToday} className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-surface-2 disabled:opacity-40" onClick={() => setOn(shiftDay(on, 1))}><ChevronRight size={18} /></button>
            {!isToday && <Button size="sm" variant="ghost" onClick={() => setOn(localDay())}>Back to today</Button>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canLog && ws.has("health") && <Button onClick={() => setSick(true)}><Stethoscope size={16} /> Report sick</Button>}
          {canLog && <Button onClick={() => setHandover(true)}><MessageSquareText size={16} /> Handover</Button>}
          {ws.can("farm.approve") && <Button onClick={() => setPlan(true)}><Settings2 size={16} /> Plan routine</Button>}
        </div>
      </div>

      {sync.waiting.length > 0 && <div className="mb-3"><Alert tone="warn" title={`${sync.waiting.length} saved on this phone, waiting to send`}
        action={sync.online ? <Button size="sm" loading={sync.syncing} onClick={() => sync.sendNow()}>Send now</Button> : undefined}>
        <span className="flex items-center gap-1.5"><CloudOff size={14} /> They send by themselves when the network is back.</span></Alert></div>}
      {sync.conflicts.length > 0 && <div className="mb-3"><Alert tone="crit" title={`${sync.conflicts.length} saved entr${sync.conflicts.length > 1 ? "ies" : "y"} could not be sent`}>
        Tap the red sync button at the top to see why, then fix or remove {sync.conflicts.length > 1 ? "them" : "it"}.</Alert></div>}

      {unread.map((h) => (
        <div key={h.id} className="mb-3"><Alert tone="info" title={`Handover from ${h.from_name ?? "the last shift"} · ${cat.data?.shifts[h.shift] ?? h.shift}`}
          action={canLog ? <Button size="sm" variant="primary" loading={ack.isPending} onClick={() => ack.mutate(h.id)}>Got it</Button> : undefined}>
          <span className="whitespace-pre-line">{h.note}</span>
          <OwnerActions kind="handover" id={h.id} compact className="float-right" />
          {h.issues?.length ? <span className="mt-1.5 flex flex-wrap gap-1.5">{h.issues.map((i) => <Badge key={i} tone="warn">{i}</Badge>)}</span> : null}
        </Alert></div>
      ))}

      {isToday && d.holds.length > 0 && <div className="mb-3"><HoldList compact holds={d.holds} /></div>}

      {isToday && d.missing_feed.length > 0 && canLog && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-warn/40 bg-warn-soft px-3 py-2.5 text-[13.5px]">
          <AlertTriangle size={16} className="text-warn" /> <b>No feed logged yet:</b>
          {d.missing_feed.map((m) => <button key={m.unit_id} className="rounded-lg border border-warn/40 bg-surface px-2 py-0.5 font-mono font-semibold" onClick={() => setLog({ kind: "feed", unit: m.unit_id })}>{m.unit_code}</button>)}
        </div>
      )}

      {canLog && (
        <section className="mb-5" aria-label="Quick log">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {QUICK.map((q) => {
              const Icon = ICON[q.kind];
              return (
                <button key={q.kind} type="button" onClick={() => setLog({ kind: q.kind })} aria-label={`Log ${q.label === "Weigh" ? "a weigh-in" : q.label.toLowerCase()}`}
                  className="flex cursor-pointer flex-col items-center gap-1 rounded-[14px] border border-line bg-surface px-2 py-3 text-center hover:border-brand hover:bg-brand-soft">
                  <Icon size={22} className="text-brand" /><b className="text-[14px]">{q.label}</b><span className="text-[11px] text-ink-3">{q.hint}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title="Checklist" meta={d.total ? `${done} of ${d.total} done${doneHere ? ` (${doneHere} saved on this phone)` : ""}` : undefined}
          action={d.total ? <span className="font-display text-[20px] font-bold text-brand tnum">{pct}%</span> : undefined}>
          {d.total > 0 && <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>}
          {d.total === 0 ? (
            <EmptyState title="Nothing planned for this day" body={ws.can("farm.approve") ? "Plan a daily routine: feeding, water checks, removing dead animals and more." : "A supervisor plans the routine."}
              action={ws.can("farm.approve") ? <Button variant="primary" onClick={() => setPlan(true)}>Plan routine</Button> : undefined} />
          ) : groups.map(([slot, tasks]) => (
            <div key={slot} className="mb-2">
              <div className={cn("eyebrow mb-1 mt-2", slot === "overdue" && "text-crit")}>{slot === "overdue" ? "Missed — still to do" : cat.data?.time_slots[slot] ?? slot}</div>
              <ul className="flex flex-col">
                {tasks.map((t) => {
                  const here = savedHere.get(`${t.id}|${t.due_on ?? on}`);
                  const c = t.completion ?? (here ? { status: String(here.body.status), note: (here.body.note as string) ?? null, done_by_name: "you", done_at: here.saved_at, media_id: null, local: true } : null);
                  return (
                    <li key={t.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-0">
                      <button type="button" disabled={!canLog || !!c} onClick={() => tick(t)} aria-label={c ? `${t.title}: done` : `Mark ${t.title} done`}
                        className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", c?.status === "done" ? "text-good" : c ? "text-warn" : "text-ink-3 hover:text-brand")}>
                        {c?.status === "done" ? <CheckCircle2 size={26} /> : c ? <AlertTriangle size={22} /> : <Circle size={26} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={cn("font-semibold", c?.status === "done" && "text-ink-3 line-through")}>{t.title}</div>
                        <div className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-3">
                          <span className="font-mono">{t.unit_code ?? t.site_name ?? "Whole farm"}</span>
                          {t.proof !== "none" && !c && <span className="flex items-center gap-1"><Camera size={12} /> {cat.data?.proofs[t.proof]}</span>}
                          {c && <span>{c.status === "done" ? "Done" : `Skipped: ${c.note}`} by {c.done_by_name ?? "someone"} · {relative(c.done_at)}</span>}
                          {c && "local" in c && <Badge tone="warn"><CloudOff size={11} /> Saved on this phone</Badge>}
                          {t.kind === "climate" && <Badge tone="info"><ThermometerSun size={11} /> Weather</Badge>}
                          {t.mine && !c && <Badge tone="brand">Yours</Badge>}
                          {t.overdue && <Badge tone="crit">Overdue · was due {formatDate(t.due_on)}</Badge>}
                        </div>
                      </div>
                      {c?.media_id && <ProofPhoto mediaId={c.media_id} />}
                      {c && !("local" in c) && canLog && <button aria-label={`Undo ${t.title}`} className="text-ink-3 hover:text-ink" onClick={() => undo.mutate({ taskId: t.id, on })}><Undo2 size={16} /></button>}
                      <OwnerActions kind="task" id={t.id} compact />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Card>

        <Card title={isToday ? "Logged today" : `Logged on ${formatDate(on)}`} meta={`${d.records.length} record${d.records.length === 1 ? "" : "s"}`}>
          {d.records.length === 0 ? <p className="text-ink-3">Nothing logged yet.</p> : (
            <ul className="flex flex-col">
              {d.records.map((r) => (
                <li key={r.id} className="flex items-start gap-3 border-t border-line py-2 first:border-0">
                  <span className="min-w-0 flex-1 text-[13.5px]">
                    <b>{cat.data?.record_kinds[r.kind] ?? r.kind}</b> · <span className="font-mono">{r.unit_code}</span>{r.batch_code ? ` · ${r.batch_code}` : ""}
                    <span className="block">{describe(r)}</span>
                    <span className="block text-[12px] text-ink-3">{r.created_by_name} · {relative(r.created_at)}</span>
                  </span>
                  {r.can_void && <Button size="sm" variant="ghost" onClick={() => setVoiding(r.id)}>Void</Button>}
                  <OwnerActions kind="farm_record" id={r.id} compact />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <QuickLog kind={log?.kind ?? null} open={!!log} on={on} presetUnit={log?.unit} onClose={() => setLog(null)} onSaved={afterLog} />
      <CompleteSheet task={ticking} on={on} onClose={() => setTicking(null)} />
      <HandoverDialog open={handover} onClose={() => setHandover(false)} />
      <ReportCaseDialog open={sick} onClose={() => setSick(false)} />
      <PlanDialog open={plan} onClose={() => setPlan(false)} />
      <ReasonDialog title="Void this record" open={!!voiding} onClose={() => setVoiding(null)} saveLabel="Void record" loading={voidRec.isPending}
        hint="It stays in the history, crossed out. You can void your own logs for 24 hours."
        onSave={async (reason) => { await voidRec.mutateAsync({ id: voiding!, reason }); toast("Record voided"); }} />
    </>
  );
}

function describe(r: { kind: string; quantity: string | null; data: Record<string, number | string | null>; note: string | null }) {
  const q = r.quantity != null ? Number(r.quantity) : null;
  const parts: string[] = [];
  if (r.kind === "feed") parts.push(`${q?.toLocaleString("en-NG")} kg${r.data.bags ? ` (${r.data.bags} × ${r.data.bag_kg} kg)` : ""}${r.data.feed_name ? ` ${r.data.feed_name}` : ""}`);
  if (r.kind === "weight") parts.push(`average ${q?.toLocaleString("en-NG")} g${r.data.sample_size ? ` from ${r.data.sample_size}` : ""}`);
  if (r.kind === "eggs") parts.push(`${q?.toLocaleString("en-NG")} eggs${r.data.cracked ? `, ${r.data.cracked} cracked` : ""}`);
  if (r.kind === "water") {
    const fmt: Record<string, (v: unknown) => string> = {
      ph: (v) => `pH ${v}`, do_mg_l: (v) => `O₂ ${v} mg/L`, temp_c: (v) => `${v} °C`, ammonia: (v) => `ammonia ${v} mg/L`, nitrite: (v) => `nitrite ${v} mg/L`,
    };
    parts.push(Object.entries(r.data).map(([k, v]) => (fmt[k] ? fmt[k](v) : `${k} ${v}`)).join(" · "));
  }
  if (r.kind === "milk") parts.push(`${q} L`);
  if (r.note) parts.push(r.note);
  return parts.join(" — ");
}
