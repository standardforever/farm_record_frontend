"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card } from "@/components/ui";
import { cn, formatDate, naira } from "@/lib/format";
import { type Plan, SELL_LABEL } from "./api";

const big = (x: number) => (Math.abs(x) >= 1_000_000 ? `₦${(x / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m` : naira(x));

function Row({ label, value, strong, tone }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; tone?: "good" | "crit" }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5 text-[13.5px]", strong && "border-t border-line pt-2.5 font-semibold")}>
      <span className="text-ink-2">{label}</span>
      <span className={cn("font-mono tnum", tone === "good" && "text-good", tone === "crit" && "text-crit")}>{value}</span>
    </div>
  );
}

/** What the plan adds up to: cost, what comes back, the cash needed, and the shopping list. */
export function Results({ plan }: { plan: Plan }) {
  const r = plan.result;
  if (!r) return null;
  const counts = plan.pack.counts || "animals";
  const money = r.total_cost != null;
  const unit = SELL_LABEL[r.sell_unit];

  return (
    <div className="flex flex-col gap-3">
      {money && (
        <Card>
          <div className="flex flex-col gap-1" aria-live="polite">
            <span className="text-[12.5px] font-medium text-ink-2">This batch will cost about</span>
            <span className="font-display text-[30px] font-bold leading-tight tnum" data-testid="plan-total">{naira(r.total_cost!)}</span>
            {r.revenue != null ? (
              <p className="text-[13.5px] text-ink-2">and bring in about <b className="tnum text-ink">{naira(r.revenue)}</b>:{" "}
                <b className={cn("tnum", (r.profit ?? 0) >= 0 ? "text-good" : "text-crit")} data-testid="plan-profit">
                  {(r.profit ?? 0) >= 0 ? `${naira(r.profit!)} profit` : `${naira(-r.profit!)} loss`}</b>{r.margin_pct != null ? ` (${r.margin_pct}%)` : ""}.</p>
            ) : <p className="text-[13.5px] text-ink-3">Add a selling price to see the profit.</p>}
          </div>
          <div className="mt-3 border-t border-line pt-2">
            <Row label="Animals" value={r.costs?.animals != null ? naira(r.costs.animals) : "—"} />
            <Row label="Feed" value={naira(r.costs?.feed ?? 0)} />
            {!!r.costs?.vaccines && <Row label="Vaccines" value={naira(r.costs.vaccines)} />}
            {!!r.costs?.vitamins && <Row label="Vitamins and drugs" value={naira(r.costs.vitamins)} />}
            {!!r.costs?.other && <Row label="Other" value={naira(r.costs.other)} />}
            {r.break_even != null && <Row strong label={<>Break-even price <span className="font-normal text-ink-3">(sell above this to make money)</span></>}
              value={<span data-testid="plan-break-even">{naira(r.break_even)} {unit}</span>} />}
            {r.cost_per_head != null && r.sell_unit !== "each" && <Row label={`Cost per ${counts === "fish" ? "fish" : "bird"}`} value={naira(r.cost_per_head)} />}
          </div>
        </Card>
      )}

      {money && <CashNote plan={plan} />}

      {!!r.missing?.length && (
        <div className="flex gap-2 rounded-xl border border-line bg-surface-2 p-3 text-[13px] text-ink-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ink-3" />
          <span><b>Not counted yet</b> (no price): {r.missing.join("; ")}.</span>
        </div>
      )}

      <Card title="What to expect" meta={`From ${plan.breed_name ?? "the breed"} guide figures`}>
        <Row label={`${counts[0].toUpperCase()}${counts.slice(1)} at the end`} value={`${r.end_alive.toLocaleString("en-NG")} of ${r.count.toLocaleString("en-NG")}`} />
        <Row label="Selling day" value={`${formatDate(r.sell_on)} (${r.days} days)`} />
        {r.weight_end_g != null && r.sell_unit !== "crate" && <Row label="Average weight then" value={`${(r.weight_end_g / 1000).toFixed(2)} kg`} />}
        {r.kg_total != null && r.sell_unit === "kg" && <Row label="Total to sell" value={`${Math.round(r.kg_total).toLocaleString("en-NG")} kg`} />}
        {r.crates != null && <Row label="Eggs" value={`${r.crates.toLocaleString("en-NG")} crates`} />}
        <Row label="Feed in total" value={`${r.feed_kg.toLocaleString("en-NG")} kg`} />
        {r.feed_per_kg_gain != null && <Row label={<>Feed per kg of weight gained <span className="text-ink-3">(lower is better)</span></>} value={`${r.feed_per_kg_gain} kg`} />}
      </Card>

      {r.feed && r.feed.length > 0 && (
        <Card flush title="Feed to buy">
          <ul className="divide-y divide-line">{r.feed.map((x) => (
            <li key={x.phase} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-[13.5px]">
              <span className="min-w-0 flex-1"><b>{x.name || x.phase}</b>
                <span className="block text-[12px] text-ink-3">{x.name ? `${x.phase} · ` : ""}day {x.from_day}–{x.to_day} · {formatDate(x.from_on)} to {formatDate(x.to_on)}</span></span>
              <span className="text-right font-mono tnum"><b>{x.bags}</b> bags of {x.kg_per_bag} kg
                {x.own_bags && <span className="block font-sans text-[11.5px] text-ink-3">your number · guide says {x.worked_out_bags}</span>}</span>
              {money && <span className="w-[100px] text-right font-mono tnum">{x.cost != null ? naira(x.cost) : "—"}</span>}
            </li>))}
          </ul>
        </Card>
      )}

      {r.vaccines && r.vaccines.length > 0 && (
        <Card flush title="Vaccines">
          <ul className="divide-y divide-line">{r.vaccines.map((v) => (
            <li key={v.name + v.day} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-[13.5px]">
              <span className="min-w-0 flex-1">{v.product || v.name}<span className="block text-[12px] text-ink-3">Day {v.day} · {formatDate(v.on)} · {v.doses.toLocaleString("en-NG")} doses</span></span>
              <span className="font-mono tnum">{v.bottles != null ? `${v.bottles} bottle${v.bottles === 1 ? "" : "s"}` : "—"}</span>
              {money && <span className="w-[100px] text-right font-mono tnum">{v.cost != null ? naira(v.cost) : "—"}</span>}
            </li>))}
          </ul>
        </Card>
      )}
      <p className="px-1 text-[12px] text-ink-3">An estimate: it assumes the {counts} eat and grow like the {plan.breed_name} guide, and losses spread over the batch.
        Real {counts} differ, so keep some money spare.</p>
    </div>
  );
}

function CashNote({ plan }: { plan: Plan }) {
  const r = plan.result!;
  const need = r.suggested_cash ?? 0;
  if (!r.peak_cash) return null;
  const weekOf = (w: number | null | undefined) => r.weeks?.find((x) => x.week === w);
  const short = r.short_by != null && r.short_by > 0;
  const tone = r.available == null ? "info" : short ? (r.short_from_week != null ? "crit" : "warn") : "good";
  const Icon = tone === "good" ? CheckCircle2 : tone === "info" ? Info : AlertTriangle;
  return (
    <div data-testid="plan-cash" className={cn("flex gap-2.5 rounded-xl border p-3.5 text-[13.5px]",
      tone === "good" && "border-good/40 bg-good-soft", tone === "warn" && "border-maize/50 bg-maize-soft", tone === "crit" && "border-crit/40 bg-crit-soft",
      tone === "info" && "border-line bg-surface")}>
      <Icon size={18} className={cn("mt-0.5 shrink-0", tone === "good" ? "text-good" : tone === "info" ? "text-ink-3" : tone === "warn" ? "text-warn" : "text-crit")} />
      <span>
        You need about <b className="tnum">{big(r.peak_cash)}</b> before the money from selling comes in.
        Keep <b className="tnum">{big(need)}</b> to allow for prices going up.{" "}
        {r.available == null ? "Add your cash box or bank under Finance to check you have it."
          : short ? <>Your accounts have <b className="tnum">{big(r.available)}</b>: about <b className="tnum">{big(r.short_by!)}</b> short
            {r.short_from_week != null ? <>, running out in <b>{weekOf(r.short_from_week)?.label.toLowerCase()}</b>{weekOf(r.short_from_week)?.from_on ? ` (from ${formatDate(weekOf(r.short_from_week)!.from_on)})` : ""}</> : ""}.</>
            : <>Your accounts have <b className="tnum">{big(r.available)}</b>: enough.</>}
      </span>
    </div>
  );
}
