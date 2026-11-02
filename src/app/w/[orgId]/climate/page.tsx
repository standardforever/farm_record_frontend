"use client";

import Link from "next/link";
import { MapPin, RefreshCw } from "lucide-react";
import { Alert, Button, Card, EmptyState, PageHeader, PageLoader, Toggle, useToast } from "@/components/ui";
import { AlertCard, WeekStrip, useClimate, useClimateSettings, useRefreshClimate } from "@/features/climate";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";

export default function ClimatePage() {
  return <RequirePermission permission="farm.view"><Inner /></RequirePermission>;
}

const BY = { gps: "GPS point", ward: "ward centre", lga: "LGA centre" } as Record<string, string>;
const SOURCE = { open_meteo: "Open-Meteo", met_no: "MET Norway", fake: "test data" } as Record<string, string>;

function Inner() {
  const ws = useCurrentWorkspace();
  const c = useClimate(ws.orgId, ws.has("climate"));
  const refresh = useRefreshClimate(ws.orgId);
  const settings = useClimateSettings(ws.orgId);
  const toast = useToast();
  if (!ws.has("climate")) return <EmptyState title="Climate alerts are not in your plan" />;
  if (!c.data) return c.isError ? <Alert tone="crit">Could not load the weather. Try again in a minute.</Alert> : <PageLoader label="Getting the forecast…" />;
  const d = c.data;
  const live = d.alerts.filter((a) => !a.dismissed);
  const done = d.alerts.filter((a) => a.dismissed);
  const updated = d.sites.map((s) => s.fetched_at).filter(Boolean).sort().at(-1);
  const sources = [...new Set(d.sites.map((s) => s.source).filter((x): x is string => !!x))].map((x) => SOURCE[x] ?? x);
  return (
    <>
      <PageHeader eyebrow="Farm" title="Weather and alerts"
        sub="The forecast for each site, checked against your animals. Risky days put the right jobs on Today, a day ahead."
        actions={ws.can("farm.edit") ? <Button loading={refresh.isPending} onClick={async () => { await refresh.mutateAsync(undefined); toast("Forecast checked"); }}><RefreshCw size={16} /> Check now</Button> : undefined} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3" aria-label="Alerts">
          <h2 className="text-[15px] font-bold">Next three days</h2>
          {live.length === 0 ? (
            <Card><p className="text-[14px] text-ink-2">No weather risk for your animals in the next three days.</p></Card>
          ) : live.map((a) => <AlertCard key={a.id} a={a} />)}
          {done.length > 0 && <details className="text-[13px] text-ink-3"><summary className="cursor-pointer">Dismissed ({done.length})</summary>
            <div className="mt-2 flex flex-col gap-2">{done.map((a) => <AlertCard key={a.id} a={a} />)}</div></details>}
        </section>
        <section className="flex flex-col gap-4">
          {d.sites.map((s) => {
            const alertDays = new Map(live.filter((a) => a.site_id === s.site_id).map((a) => [a.on_date, a.level] as const));
            return (
              <Card key={s.site_id} title={s.name} meta={s.located_by ? `${s.place ?? ""} · forecast for the ${BY[s.located_by] ?? s.located_by}` : undefined}>
                {s.located_by ? (s.days.length ? <WeekStrip days={s.days} alertDays={alertDays} /> : <p className="text-[13.5px] text-ink-3">The forecast could not be fetched just now.</p>) : (
                  <p className="flex items-start gap-2 text-[13.5px] text-ink-2"><MapPin size={16} className="mt-0.5 shrink-0 text-ink-3" />
                    <span>Oko needs to know where this site is. <Link href={`/w/${ws.orgId}/farm`} className="font-semibold text-brand underline-offset-2 hover:underline">Add its state and LGA, or use your location</Link>, on the farm map.</span></p>
                )}
                {!s.has_animals && s.located_by && <p className="mt-2 text-[12.5px] text-ink-3">No animals here now, so no alerts.</p>}
              </Card>
            );
          })}
          <Card title="Jobs from alerts">
            <Toggle checked={d.auto_tasks} disabled={!ws.can("farm.approve") || settings.isPending}
              onChange={async (v) => { await settings.mutateAsync({ auto_tasks: v }); toast(v ? "Jobs will be added to Today" : "Alerts only, no jobs"); }}
              label="Add the jobs for each alert to Today automatically" showLabel />
            <p className="mt-2 text-[12.5px] text-ink-3">
              Watch days get the essential jobs; serious days get all of them, plus a &ldquo;get ready&rdquo; job the evening before.
              {" "}Forecast from {sources.join(" and ") || "Open-Meteo or MET Norway"}{updated ? `, checked ${new Date(updated).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}` : ""}.
            </p>
          </Card>
        </section>
      </div>
    </>
  );
}
