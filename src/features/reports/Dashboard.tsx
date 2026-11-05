"use client";

import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, ClipboardCheck, HeartPulse, Minus, Package, Wallet } from "lucide-react";
import { BarChart } from "@/components/charts/BarChart";
import { Badge, Card, PageLoader, Stat } from "@/components/ui";
import { useCatalog } from "@/features/farm";
import { useCurrentWorkspace } from "@/features/workspaces";
import { cn, naira } from "@/lib/format";
import { type DayPoint, useDashboard } from "./api";

const day = (iso: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => new Date(iso + "T12:00:00").toLocaleDateString("en-NG", o);
const n = (v: number, d = 0) => v.toLocaleString("en-NG", { maximumFractionDigits: d });

/** This week against last week, in words a farmer reads at a glance. Fewer deaths is good; more feed is neither. */
function Change({ now, before, goodWhenDown }: { now: number; before: number; goodWhenDown?: boolean }) {
  if (!before && !now) return <span className="text-ink-3">nothing either week</span>;
  if (!before) return <span className="text-ink-3">none the week before</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  const tone = goodWhenDown === undefined || pct === 0 ? "text-ink-3" : (pct < 0) === goodWhenDown ? "text-good" : "text-crit";
  return <span className={cn("inline-flex items-center gap-0.5", tone)}><Icon size={13} aria-hidden />{Math.abs(pct)}% {pct >= 0 ? "more" : "fewer"} than the week before</span>;
}

/** The farm at a glance: the first thing the owner and field agents see. */
export function FarmDashboard() {
  const ws = useCurrentWorkspace();
  const q = useDashboard(ws.orgId);
  const catalog = useCatalog();
  const base = `/w/${ws.orgId}`;
  if (q.isLoading || !q.data) return <PageLoader />;
  const d = q.data;
  const a = d.animals!, p = d.production!;
  const species = (k: string) => catalog.data?.purposes[k] ?? k;
  const series = (k: keyof DayPoint) => p.daily.map((x) => ({ label: day(x.on, { weekday: "short", day: "numeric", month: "short" }), short: day(x.on), value: Number(x[k]) }));
  const eggs = p.eggs_7d > 0 || p.eggs_prev_7d > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat hero label="Animals on the farm" value={n(a.now)}
          sub={Object.entries(a.by_species).map(([k, v]) => `${n(v)} ${species(k).toLowerCase()}`).join(" · ") || `${a.active_batches} batches`} />
        <Stat label="Lost this week" value={n(a.deaths_7d)}
          sub={<><span className="block">{a.mortality_7d_pct != null ? `${a.mortality_7d_pct}% of the animals` : "—"}</span><Change now={a.deaths_7d} before={a.deaths_prev_7d} goodWhenDown /></>} />
        <Stat label="Feed this week" value={`${n(p.feed_kg_7d)} kg`} sub={<Change now={p.feed_kg_7d} before={p.feed_kg_prev_7d} />} />
        {d.money ? <Stat label="Profit this month" value={naira(d.money.month_profit)} sub={`${naira(d.money.month_sales)} sales · ${naira(d.money.month_costs)} costs`} />
          : eggs ? <Stat label="Eggs this week" value={n(p.eggs_7d)} sub={<Change now={p.eggs_7d} before={p.eggs_prev_7d} />} />
          : <Stat label="Batches running" value={a.active_batches} sub="Active now" />}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="The last four weeks" meta="Every day's records across the farm. Hover a bar, or use the table button.">
            <div className={cn("grid gap-6", eggs ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
              <BarChart title="Animals lost" unit="lost" data={series("deaths")} color="var(--series-2)" />
              <BarChart title="Feed" unit="kg" data={series("feed_kg")} />
              {eggs && <BarChart title="Eggs" unit="eggs" data={series("eggs")} />}
            </div>
          </Card>

          <Card flush title="Batches" meta={d.batches?.length ? "Running now. Open one for its full record, or its report." : undefined}
            action={<Link href={`${base}/reports`} className="text-[13px] font-semibold text-brand">Reports <ArrowRight size={13} className="inline" /></Link>}>
            {!d.batches?.length ? <p className="px-4 pb-4 text-[13.5px] text-ink-3">No batches running. <Link className="font-semibold text-brand" href={`${base}/batches`}>Stock a batch</Link> to start.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[13px]">
                  <thead className="text-left text-[12px] text-ink-3"><tr>
                    <th className="px-4 py-2 font-semibold">Batch</th><th className="px-2 py-2 text-right font-semibold">Age</th>
                    <th className="px-2 py-2 text-right font-semibold">Now</th><th className="px-2 py-2 text-right font-semibold">Survival</th>
                    <th className="px-2 py-2 text-right font-semibold">Weight</th><th className="px-2 py-2 text-right font-semibold">FCR</th>
                    {d.money && <th className="px-4 py-2 text-right font-semibold">Result so far</th>}
                  </tr></thead>
                  <tbody className="divide-y divide-line">
                    {d.batches.map((x) => (
                      <tr key={x.id} className="hover:bg-surface-2/60">
                        <td className="px-4 py-2"><Link href={`${base}/batches/${x.id}`} className="font-mono font-semibold hover:text-brand">{x.code}</Link>
                          <span className="block text-[12px] text-ink-3">{species(x.species)}{x.breed ? ` · ${x.breed}` : ""}</span></td>
                        <td className="px-2 py-2 text-right tnum">{x.age_days} d</td>
                        <td className="px-2 py-2 text-right font-semibold tnum">{n(x.current)}</td>
                        <td className={cn("px-2 py-2 text-right tnum", x.survival_pct != null && x.survival_pct < 90 && "text-crit")}>{x.survival_pct != null ? `${x.survival_pct}%` : "—"}</td>
                        <td className="px-2 py-2 text-right tnum">{x.latest_avg_weight_g ? (x.latest_avg_weight_g >= 1000 ? `${n(x.latest_avg_weight_g / 1000, 2)} kg` : `${n(x.latest_avg_weight_g)} g`) : "—"}</td>
                        <td className="px-2 py-2 text-right tnum">{x.fcr ?? "—"}</td>
                        {d.money && <td className={cn("px-4 py-2 text-right font-mono tnum", (x.result_so_far ?? 0) < 0 ? "text-crit" : "text-good")}>{x.result_so_far != null ? naira(x.result_so_far) : "—"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {d.today && (
            <SideCard icon={<ClipboardCheck size={17} />} title="Today" href={`${base}/today`}
              lines={[`${d.today.done} of ${d.today.total} jobs done`, d.today.overdue ? `${d.today.overdue} missed from earlier days` : null,
                d.today.missing_feed.length ? `No feed logged yet: ${d.today.missing_feed.join(", ")}` : null]}
              warn={!!d.today.overdue || !!d.today.missing_feed.length} />
          )}
          {d.health && (
            <SideCard icon={<HeartPulse size={17} />} title="Health" href={`${base}/health`}
              lines={[d.health.open_cases ? `${d.health.open_cases} sick-animal report${d.health.open_cases > 1 ? "s" : ""} open` : "No sick animals reported",
                d.health.doses_due ? `${d.health.doses_due} vaccination${d.health.doses_due > 1 ? "s" : ""} due${d.health.doses_overdue ? `, ${d.health.doses_overdue} missed` : ""}` : null,
                ...d.health.holds.slice(0, 3).map((h) => `${h.batch_code ?? "A batch"}: no ${h.product === "all" ? "sales" : h.product} until ${h.until ? day(h.until) : "cleared"}`)]}
              warn={!!d.health.open_cases || !!d.health.doses_overdue || d.health.holds.length > 0} />
          )}
          {d.stock && (
            <SideCard icon={<Package size={17} />} title="Stock" href={`${base}/stock`}
              lines={d.stock.count ? d.stock.alerts.slice(0, 4).map((x) => x.title) : ["Nothing low or expiring"]} warn={d.stock.count > 0} />
          )}
          {(d.sales || d.money) && (
            <SideCard icon={<Wallet size={17} />} title="Money" href={`${base}/${d.money ? "finance" : "sales"}`}
              lines={[d.sales ? `${naira(d.sales.month_received)} received this month` : null,
                d.sales?.outstanding ? `${naira(d.sales.outstanding)} owed to you${d.sales.overdue ? `, ${naira(d.sales.overdue)} overdue` : ""}` : d.sales ? "Nobody owes you" : null,
                d.money ? `${naira(d.money.cash)} in ${d.money.accounts} account${d.money.accounts === 1 ? "" : "s"}` : null]}
              warn={!!d.sales?.overdue} />
          )}
        </div>
      </div>
    </div>
  );
}

function SideCard({ icon, title, href, lines, warn }: { icon: React.ReactNode; title: string; href: string; lines: (string | null)[]; warn?: boolean }) {
  return (
    <Link href={href} className="group rounded-[14px] border border-line bg-surface p-4 hover:shadow-[var(--shadow)]">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg", warn ? "bg-maize-soft text-warn" : "bg-brand-soft text-brand")}>{icon}</span>
        <b className="text-[14.5px]">{title}</b>
        {warn && <Badge tone="warn" className="ml-1"><AlertTriangle size={11} /> Look</Badge>}
        <ArrowRight size={15} className="ml-auto text-ink-3 group-hover:text-ink" />
      </div>
      <ul className="mt-2 flex flex-col gap-1 text-[13.5px] text-ink-2">{lines.filter(Boolean).map((l) => <li key={l}>{l}</li>)}</ul>
    </Link>
  );
}
