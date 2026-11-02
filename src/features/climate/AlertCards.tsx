"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, CloudSun, ThermometerSun, X } from "lucide-react";
import { Badge, Button, useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { cn } from "@/lib/format";
import { type ClimateAlert, dayName, useClimate, useDismissAlert } from "./api";
import { weatherOf } from "./Weather";

export function AlertCard({ a }: { a: ClimateAlert }) {
  const ws = useCurrentWorkspace();
  const dismiss = useDismissAlert(ws.orgId);
  const toast = useToast();
  const danger = a.level === "danger";
  return (
    <article className={cn("rounded-2xl border p-4", danger ? "border-crit/50 bg-crit-soft/40" : "border-warn/50 bg-maize-soft/50")}>
      <div className="flex items-start gap-3">
        <AlertTriangle size={22} className={cn("mt-0.5 shrink-0", danger ? "text-crit" : "text-warn")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={danger ? "crit" : "warn"}>{danger ? "Serious" : "Watch"}</Badge>
            <span className="text-[12.5px] font-semibold text-ink-2">{dayName(a.on_date)} · {a.site_name}</span>
          </div>
          <h3 className="mt-1 text-[16px] font-bold">{a.title}</h3>
          <p className="text-[13.5px] text-ink-2">{a.why}</p>
          {a.jobs.length > 0 && <ul className="mt-2 flex list-disc flex-col gap-0.5 pl-5 text-[13.5px]">{a.jobs.map((j) => <li key={j}>{j}</li>)}</ul>}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px] text-ink-3">
            {a.dismissed ? <span>Dismissed: its jobs were taken off Today.</span>
              : a.tasks ? <Link href={`/w/${ws.orgId}/today`} className="font-semibold text-brand underline-offset-2 hover:underline">{a.tasks} job{a.tasks > 1 ? "s" : ""} on Today{a.tasks_done ? ` · ${a.tasks_done} done` : ""}</Link>
              : <span>No jobs added (automatic jobs are off).</span>}
            {!a.dismissed && ws.can("farm.edit") && (
              <Button size="sm" variant="ghost" loading={dismiss.isPending} onClick={async () => { await dismiss.mutateAsync(a.id); toast("Alert dismissed"); }}>
                <X size={14} /> Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Home card: the next alert, or tomorrow's weather when all is calm. */
export function ClimateHomeCard({ big }: { big?: boolean }) {
  const ws = useCurrentWorkspace();
  const on = ws.has("climate") && ws.has("farm") && ws.can("farm.view");
  const c = useClimate(ws.orgId, on);
  if (!on || !c.data) return null;
  const live = c.data.alerts.filter((a) => !a.dismissed);
  const site = c.data.sites.find((s) => s.has_animals && s.days.length) ?? c.data.sites.find((s) => s.days.length);
  if (!live.length && !site) return null;
  const first = live[0];
  const tomorrow = site?.days[1] ?? site?.days[0];
  const W = tomorrow ? weatherOf(tomorrow.code).icon : CloudSun;
  return (
    <Link href={`/w/${ws.orgId}/climate`} className={cn("flex items-center gap-3 rounded-2xl border p-4",
      first ? (first.level === "danger" ? "border-crit/50 bg-crit-soft/40" : "border-warn/50 bg-maize-soft/50") : "border-line bg-surface")}>
      <span className={cn("grid shrink-0 place-items-center rounded-xl", big ? "h-11 w-11" : "h-10 w-10",
        first ? (first.level === "danger" ? "bg-crit-soft text-crit" : "bg-maize-soft text-warn") : "bg-water-soft text-water")}>
        {first ? <ThermometerSun size={24} /> : <W size={24} />}
      </span>
      <span className="min-w-0 flex-1">
        {first ? <>
          <b className={cn("block", big ? "text-[17px]" : "text-[15px]")}>{dayName(first.on_date)}: {first.title}</b>
          <span className="text-[13.5px] text-ink-2">{first.tasks ? `${first.tasks} job${first.tasks > 1 ? "s" : ""} on Today` : first.why}{live.length > 1 ? ` · ${live.length - 1} more alert${live.length > 2 ? "s" : ""}` : ""}</span>
        </> : <>
          <b className={cn("block", big ? "text-[17px]" : "text-[15px]")}>{tomorrow ? `${dayName(tomorrow.on)}: ${weatherOf(tomorrow.code).label}, ${Math.round(tomorrow.t_max ?? 0)}°C` : "Weather"}</b>
          <span className="text-[13.5px] text-ink-2">No weather risk for your animals in the next 3 days.</span>
        </>}
      </span>
      <ChevronRight size={20} className="text-ink-3" />
    </Link>
  );
}
