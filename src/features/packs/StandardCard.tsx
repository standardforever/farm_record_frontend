"use client";

import { ArrowUpCircle, CheckCircle2, CircleDashed, Clock, Syringe, TriangleAlert } from "lucide-react";
import { Alert, Badge, Button, Card, useToast } from "@/components/ui";
import { LineChart } from "@/components/charts/LineChart";
import { useCurrentWorkspace } from "@/features/workspaces";
import { formatDate } from "@/lib/format";
import { type Dose, useStandard, useUpgradePack } from "./api";

const STATUS: Record<Dose["status"], { label: string; tone: "good" | "warn" | "crit" | "neutral" | "info"; icon: typeof Clock }> = {
  done: { label: "Done", tone: "good", icon: CheckCircle2 },
  skipped: { label: "Skipped", tone: "warn", icon: TriangleAlert },
  due: { label: "Due today", tone: "warn", icon: Clock },
  overdue: { label: "Overdue", tone: "crit", icon: TriangleAlert },
  upcoming: { label: "Upcoming", tone: "neutral", icon: CircleDashed },
  before_arrival: { label: "Before arrival", tone: "info", icon: CheckCircle2 },
};

const ageText = (days: number, unit: string) => (unit === "weeks" ? `week ${Math.floor(days / 7)}` : `day ${days}`);

/** A batch against its breed standard: weight, feed, phase, vaccinations and the curves. */
export function StandardCard({ batchId, active }: { batchId: string; active: boolean }) {
  const ws = useCurrentWorkspace();
  const q = useStandard(ws.orgId, batchId);
  const upgrade = useUpgradePack(ws.orgId, batchId);
  const toast = useToast();
  const s = q.data;
  if (!s) return null;
  const unit = s.pack.age_unit;
  const pct = s.weight_vs_standard_pct;
  const doses = [...s.vaccinations, ...s.checks].sort((a, b) => a.day - b.day);
  const weeks = unit === "weeks";

  return (
    <Card title={`Against the standard · ${s.breed?.name ?? s.pack.name}`}
      meta={`${s.pack.name} pack v${s.pack.version} · ${ageText(s.age_days, unit)} (${s.age_days} days old)`}>
      <div className="flex flex-col gap-4">
        {s.pack.status === "reference" && <p className="text-[12px] text-ink-3">{s.pack.review_note}</p>}
        {active && s.pack.latest_version > s.pack.version && ws.can("farm.approve") && (
          <Alert tone="info" title={`A newer ${s.pack.name} standard (v${s.pack.latest_version}) is available`}
            action={<Button size="sm" loading={upgrade.isPending} onClick={async () => { await upgrade.mutateAsync(); toast("Now using the newest standard"); }}>
              <ArrowUpCircle size={14} /> Use it</Button>}>This batch keeps v{s.pack.version} until you switch.</Alert>
        )}

        <dl className="grid grid-cols-2 gap-3 text-[13.5px] sm:grid-cols-4">
          <div><dt className="text-ink-3">Expected weight now</dt><dd className="font-display text-[20px] font-bold tnum">{s.expected_weight_g != null ? `${Math.round(s.expected_weight_g).toLocaleString("en-NG")} g` : "—"}</dd></div>
          <div><dt className="text-ink-3">Latest weigh-in</dt><dd className="font-display text-[20px] font-bold tnum">{s.latest_weight_g != null ? `${s.latest_weight_g.toLocaleString("en-NG")} g` : "—"}</dd>
            {pct != null && <dd className={pct < 90 ? "text-crit" : pct < 97 ? "text-warn" : "text-good"}><b>{pct}%</b> of standard at day {s.latest_weight_age}</dd>}</div>
          <div><dt className="text-ink-3">Feed per head so far</dt><dd className="font-display text-[20px] font-bold tnum">{s.actual_feed_g_per_head != null ? `${Math.round(s.actual_feed_g_per_head).toLocaleString("en-NG")} g` : "—"}</dd>
            {s.expected_feed_g_per_head != null && <dd className="text-ink-3">standard {Math.round(s.expected_feed_g_per_head).toLocaleString("en-NG")} g</dd>}
            {s.average_alive != null && s.actual_feed_g_per_head != null && <dd className="text-[12px] text-ink-3">per animal alive on average ({s.average_alive.toLocaleString("en-NG")}); the dead are taken out from the day they died</dd>}</div>
          <div><dt className="text-ink-3">Feed now</dt><dd className="font-semibold">{s.phase_now?.name ?? "—"}{s.phase_now?.protein_pct ? ` · ${s.phase_now.protein_pct}% protein` : ""}</dd>
            {s.next_phase && <dd className="text-ink-3">{s.next_phase.name} from {formatDate(s.next_phase.on)}</dd>}</div>
        </dl>
        {s.phase_now?.note && <p className="-mt-2 text-[12.5px] text-ink-3">{s.phase_now.note}</p>}

        {s.growth_standard.length > 1 && (
          <LineChart title="Average weight by age" xLabel={weeks ? "Week" : "Day"} yLabel="grams"
            formatX={(d) => (weeks ? String(Math.round(d / 7)) : String(d))} formatY={(g) => (g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g}`)}
            series={[
              { name: "Standard", color: "var(--series-1)", points: s.growth_standard },
              ...(s.growth_actual.length ? [{ name: "This batch", color: "var(--series-2)", points: s.growth_actual, markers: true }] : []),
            ]} />
        )}
        {s.growth_actual.length === 0 && <p className="-mt-2 text-[12.5px] text-ink-3">Log a weigh-in from Today to see this batch on the chart.</p>}
        {s.lay_standard && (
          <LineChart title="Laying rate by week of age (hen-day %)" xLabel="Week" yLabel="%" formatY={(v) => `${v}`}
            series={[
              { name: "Standard", color: "var(--series-1)", points: s.lay_standard },
              ...(s.lay_actual?.length ? [{ name: "This flock", color: "var(--series-2)", points: s.lay_actual, markers: true }] : []),
            ]} />
        )}

        {doses.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="eyebrow flex items-center gap-1.5"><Syringe size={13} /> Vaccinations and checks</div>
            <ul className="flex flex-col">
              {doses.map((d) => {
                const st = STATUS[d.status];
                return (
                  <li key={`${d.day}-${d.name}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line py-2 first:border-0">
                    <span className="w-[84px] shrink-0 text-[12.5px] text-ink-3">{ageText(d.day, unit)} · {formatDate(d.due_on)}</span>
                    <span className="min-w-0 flex-1 text-[13.5px]"><b>{d.name}</b>{d.route ? <span className="text-ink-3"> · {d.route}</span> : null}</span>
                    <Badge tone={st.tone}><st.icon size={12} /> {st.label}</Badge>
                  </li>
                );
              })}
            </ul>
            <p className="text-[12px] text-ink-3">Each dose is a task in Today on its date. Tick it there when it is done.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
