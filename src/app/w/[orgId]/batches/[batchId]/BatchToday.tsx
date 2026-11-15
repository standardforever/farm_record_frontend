"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, Circle, Droplets, Egg, Milk, NotebookPen, Pill, Scale, Skull, Stethoscope, Wheat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, useToast } from "@/components/ui";
import type { Batch } from "@/features/batches";
import { type QuickKind, type TodayTask, CompleteSheet, localDay, QuickLog, quickFor, useToday } from "@/features/daily";
import { ReportCaseDialog, TreatmentDialog } from "@/features/health";
import { save as saveOffline } from "@/features/offline";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";

const ICON: Record<QuickKind, LucideIcon> = { feed: Wheat, deaths: Skull, weight: Scale, eggs: Egg, water: Droplets, milk: Milk, note: NotebookPen };
const LABEL: Record<QuickKind, string> = { feed: "Feed", deaths: "Deaths", weight: "Weigh", eggs: "Eggs", water: "Water", milk: "Milk", note: "Note" };

type Action = { key: string; label: string; icon: LucideIcon; run: () => void };

function line(r: { kind: string; quantity: string | null; data: Record<string, number | string | null>; note: string | null }) {
  const q = r.quantity != null ? Number(r.quantity) : null;
  switch (r.kind) {
    case "feed": return `Feed ${q?.toLocaleString("en-NG")} kg${r.data.bags ? ` (${r.data.bags} bags)` : ""}`;
    case "weight": return `Weigh-in ${q != null && q >= 1000 ? `${(q / 1000).toLocaleString("en-NG")} kg` : `${q} g`} average`;
    case "eggs": return `${q?.toLocaleString("en-NG")} eggs`;
    case "milk": return `${q} L of milk`;
    case "water": return "Water checked";
    default: return r.note ?? "Note";
  }
}

/** Everything done day to day for one batch, from its own page: quick records, health, and its jobs today. */
export function BatchToday({ b }: { b: Batch }) {
  const ws = useCurrentWorkspace();
  const qc = useQueryClient();
  const toast = useToast();
  const on = localDay();
  const today = useToday(ws.orgId, on);
  const [log, setLog] = useState<{ kind: QuickKind; task?: TodayTask } | null>(null);
  const [treat, setTreat] = useState(false);
  const [sick, setSick] = useState(false);
  const [ticking, setTicking] = useState<TodayTask | null>(null);
  const canLog = ws.can("farm.edit") || ws.can("farm.approve");
  if (!canLog) return null;

  const units = new Set(b.units.filter((u) => !u.ended_on).map((u) => u.unit_id));
  const tasks = (today.data?.tasks ?? []).filter((t) => t.batch_id === b.id || (t.unit_id && units.has(t.unit_id)));
  const records = (today.data?.records ?? []).filter((r) => !r.voided_at && (r.batch_id === b.id || (!r.batch_id && units.has(r.unit_id))));
  const done = tasks.filter((t) => t.completion).length;

  const actions: Action[] = [
    ...quickFor([b.species]).map((k) => ({ key: k, label: LABEL[k], icon: ICON[k], run: () => setLog({ kind: k }) })),
    ...(ws.has("health") && ws.can("health.edit") ? [
      { key: "treat", label: "Treatment", icon: Pill, run: () => setTreat(true) },
      { key: "sick", label: "Sick", icon: Stethoscope, run: () => setSick(true) },
    ] : []),
  ];

  async function quickTick(t: TodayTask) {
    try {
      const r = await saveOffline(ws.orgId, "farm.task_done", { on: t.due_on ?? on, status: "done" }, `Done: ${t.title}`, { params: { task_id: t.id } });
      qc.invalidateQueries({ queryKey: ["farm", ws.orgId] });
      if (r.status === "queued") toast(`Saved on this phone: ${t.title}`);
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not save", "crit"); }
  }
  const tick = (t: TodayTask) => {
    if (t.record_kind && !t.completion) { setLog({ kind: t.record_kind as QuickKind, task: t }); return; }
    if (t.proof !== "none") { setTicking(t); return; }
    void quickTick(t);
  };
  const afterLog = async () => {
    const t = log?.task;
    if (t && t.proof === "none") await quickTick(t);
    else if (t) setTicking(t);
  };

  return (
    <Card title="Record for this batch" meta={`Saved to ${b.code}, and shown on Today with the rest of the farm. Works without network.`}>
      <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
        {actions.map((a) => (
          <button key={a.key} type="button" onClick={a.run} aria-label={`${a.label} for ${b.code}`}
            className="flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border border-line bg-surface px-1.5 py-2 text-center text-[12.5px] font-semibold transition-colors hover:border-brand hover:bg-brand-soft sm:min-w-[88px] sm:flex-1">
            <a.icon size={20} className="text-brand" aria-hidden />{a.label}
          </button>
        ))}
      </div>

      {(tasks.length > 0 || records.length > 0) && (
        <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
          {tasks.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                <b>Jobs today</b><span className="text-ink-3">{done} of {tasks.length} done</span>
              </div>
              <ul className="flex flex-col">
                {tasks.map((t) => {
                  const c = t.completion;
                  return (
                    <li key={t.id} className="flex items-center gap-2.5 border-t border-line py-1.5 first:border-0">
                      <button type="button" disabled={!!c} onClick={() => tick(t)} aria-label={c ? `${t.title}: done` : `Mark ${t.title} done`}
                        className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", c?.status === "done" ? "text-good" : c ? "text-warn" : "text-ink-3 hover:text-brand")}>
                        {c?.status === "done" ? <CheckCircle2 size={22} /> : c ? <AlertTriangle size={19} /> : <Circle size={22} />}
                      </button>
                      <span className={cn("min-w-0 flex-1 text-[13.5px]", c?.status === "done" && "text-ink-3 line-through")}>{t.title}
                        {t.unit_code && <span className="ml-1.5 font-mono text-[11.5px] text-ink-3">{t.unit_code}</span>}
                        {t.overdue && <span className="ml-1.5 text-[11.5px] font-semibold text-crit">missed</span>}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {records.length > 0 && (
            <div>
              <div className="mb-1.5 text-[13px] font-bold">Recorded today</div>
              <ul className="flex flex-col gap-1 text-[13.5px]">
                {records.map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">{line(r)}</span>
                    <span className="shrink-0 font-mono text-[11.5px] text-ink-3">{r.unit_code}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="mt-3 text-[12.5px] text-ink-3"><Link href={`/w/${ws.orgId}/today`} className="font-semibold text-brand hover:underline">See the whole farm&apos;s jobs</Link></p>

      <QuickLog kind={log?.kind ?? null} open={!!log} on={on} presetBatch={b.id} onClose={() => setLog(null)} onSaved={afterLog} />
      <TreatmentDialog open={treat} onClose={() => setTreat(false)} batchId={b.id} />
      <ReportCaseDialog open={sick} onClose={() => setSick(false)} batchId={b.id} />
      <CompleteSheet task={ticking} on={on} onClose={() => setTicking(null)} />
    </Card>
  );
}
