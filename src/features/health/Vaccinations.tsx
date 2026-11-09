"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import { Badge, useToast } from "@/components/ui";
import { useComplete } from "@/features/daily";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import { type Dose, shortDay } from "./api";

const STATUS: Record<Dose["status"], { label: string; tone: "crit" | "warn" | "neutral" | "good" }> = {
  overdue: { label: "Missed", tone: "crit" }, due: { label: "Today", tone: "warn" }, upcoming: { label: "Coming", tone: "neutral" },
  done: { label: "Given", tone: "good" }, skipped: { label: "Skipped", tone: "neutral" },
};

/** The vaccination calendar from each batch's guide or plan. Given doses open their record. */
export function Vaccinations({ doses }: { doses: Dose[] }) {
  const ws = useCurrentWorkspace();
  const complete = useComplete(ws.orgId);
  const toast = useToast();
  const canTick = ws.can("farm.edit") || ws.can("farm.approve");
  const groups = useMemo(() => {
    const order: [string, (x: Dose) => boolean][] = [
      ["Missed: give as soon as you can", (x) => x.status === "overdue"], ["Today", (x) => x.status === "due"],
      ["Next three weeks", (x) => x.status === "upcoming"], ["Given", (x) => x.status === "done" || x.status === "skipped"],
    ];
    return order.map(([label, f]) => [label, doses.filter(f)] as const).filter(([, xs]) => xs.length);
  }, [doses]);
  if (!doses.length) return (
    <p className="text-[13.5px] text-ink-3">No vaccinations planned. Stock a batch of broilers or layers (or follow a plan) and its vaccines appear here and on Today.{" "}
      <Link href={`/w/${ws.orgId}/batches`} className="text-brand underline">Batches</Link></p>
  );
  const give = async (x: Dose) => {
    try { await complete.mutateAsync({ taskId: x.task_id, on: x.due_on }); toast(`Recorded: ${x.vaccine} for ${x.batch_code}`); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not save", "crit"); }
  };
  return (
    <div className="flex flex-col gap-4">
      {groups.map(([label, xs]) => (
        <section key={label}>
          <h3 className={cn("eyebrow mb-1", label.startsWith("Missed") && "text-crit")}>{label}</h3>
          <ul className="flex flex-col divide-y divide-line">
            {xs.map((x) => {
              const s = STATUS[x.status];
              const tickable = canTick && (x.status === "overdue" || x.status === "due");
              const inner = (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{x.vaccine}</div>
                    <div className="text-[12.5px] text-ink-3">{x.batch_code}{x.unit_code ? ` · ${x.unit_code}` : ""}{x.route ? ` · ${x.route}` : ""}
                      {x.done_on && ` · given ${shortDay(x.done_on)}${x.done_by_name ? ` by ${x.done_by_name}` : ""}`}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <span className="font-mono text-[11.5px] text-ink-3">{shortDay(x.due_on)}</span>
                  </div>
                </>
              );
              return (
                <li key={x.task_id} className="flex items-center gap-3 py-2">
                  {tickable ? (
                    <button type="button" aria-label={`Mark ${x.vaccine} for ${x.batch_code} given`} onClick={() => give(x)} disabled={complete.isPending}
                      className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-3 hover:text-brand"><Circle size={22} /></button>
                  ) : x.status === "done" ? <CheckCircle2 size={22} className="mx-[5px] shrink-0 text-good" /> : <Circle size={22} className="mx-[5px] shrink-0 text-line" />}
                  {x.treatment_id ? (
                    <Link href={`/w/${ws.orgId}/health/treatments/${x.treatment_id}`} className="-my-1 flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 hover:bg-surface-2">
                      {inner}<ChevronRight size={17} className="shrink-0 text-ink-3" aria-hidden /></Link>
                  ) : <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
