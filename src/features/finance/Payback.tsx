"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, Sprout } from "lucide-react";
import { Badge, Card, EmptyState, PageLoader } from "@/components/ui";
import { OwnerActions } from "@/features/corrections";
import { useCurrentWorkspace } from "@/features/workspaces";
import { cn, naira } from "@/lib/format";
import { type Payback, type RentDue, usePayback } from "./api";

const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

/** In words a farmer reads at a glance: put in, back so far, how long to go. */
function Summary({ p }: { p: Payback }) {
  const pct = p.recovered_pct ?? 0;
  const done = p.net_invested > 0 && p.left <= 0;
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[15px]">
        You have put <b className="tnum">{naira(p.net_invested)}</b> into the farm{p.sold ? ` (after ${naira(p.sold)} got back from selling)` : ""}.{" "}
        {done ? <b className="text-good">Profit has paid it all back.</b>
          : p.profit_since < 0
            ? <>Nothing has come back yet: since {p.since ? day(p.since) : "then"} the farm has made a <b className="tnum text-crit">loss of {naira(-p.profit_since)}</b> (sales less running costs), so that has to be made up first.</>
            : <><b className="tnum">{naira(p.recovered)}</b> ({pct}%) has come back as profit{p.since ? ` since ${day(p.since)}` : ""}.</>}
      </p>
      <Bar pct={pct} label={`${pct}% paid back`} />
      {!done && (
        <p className="text-[13px] text-ink-2">
          {p.months_to_go != null && p.avg_monthly_profit && p.avg_monthly_profit > 0
            ? <>About <b>{p.months_to_go < 1 ? "less than a month" : `${Math.ceil(p.months_to_go)} month${Math.ceil(p.months_to_go) === 1 ? "" : "s"}`}</b> to go, at the average profit of the last months ({naira(p.avg_monthly_profit)} a month).</>
            : p.avg_monthly_profit != null && p.avg_monthly_profit <= 0
              ? <span className="inline-flex items-center gap-1 text-warn"><AlertTriangle size={13} /> Profit has not been positive lately, so nothing is being paid back.</span>
              : "A full month of records is needed to estimate how long it will take."}
        </p>
      )}
    </div>
  );
}

/** On the Finance overview. */
export function PaybackCard({ onOpen }: { onOpen: () => void }) {
  const ws = useCurrentWorkspace();
  const q = usePayback(ws.orgId);
  const p = q.data;
  if (!p || !p.invested) return null;
  return (
    <Card title="Is the farm paying for itself?" action={<button type="button" className="cursor-pointer text-[13px] font-semibold text-brand" onClick={onOpen}>Details</button>}>
      <Summary p={p} />
    </Card>
  );
}

export function RentDueCard({ rent }: { rent: RentDue[] }) {
  const ws = useCurrentWorkspace();
  if (!rent.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {rent.map((r) => (
        <Link key={r.site_id} href={`/w/${ws.orgId}/farm`} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface p-4 hover:shadow-[var(--shadow)]">
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", r.overdue ? "bg-crit-soft text-crit" : "bg-maize-soft text-warn")}>
            {r.overdue ? <AlertTriangle size={17} /> : <CalendarClock size={17} />}</span>
          <span className="text-[13.5px]"><b>Rent for {r.site_name} {r.overdue ? "ran out" : "runs out"} {r.paid_until ? day(r.paid_until) : ""}</b>
            <span className="block text-ink-2">{r.amount ? `${naira(r.amount)} due. ` : ""}Pay it from the farm map, so profit and the account stay right.</span></span>
        </Link>
      ))}
    </div>
  );
}

export function PaybackPanel() {
  const ws = useCurrentWorkspace();
  const q = usePayback(ws.orgId);
  const p = q.data;
  if (q.isLoading || !p) return <PageLoader />;
  if (!p.invested) {
    return (
      <Card>
        <EmptyState icon={<Sprout size={22} />} title="Nothing recorded as put into the farm yet"
          body="When you add a site or units, the optional “The land” and “What did it cost?” sections record land bought, ponds, pens, cages and buildings. For ones already added, open the farm map: each site and unit has a button for it. Oko then shows how much of it profit has paid back."
          action={<Link href={`/w/${ws.orgId}/farm`} className="inline-flex h-10 items-center rounded-[10px] bg-brand px-4 text-[13.5px] font-semibold text-on-brand">Open the farm map</Link>} />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Card title="Is the farm paying for itself?"><Summary p={p} />
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
          <div><dt className="text-ink-3">Put in</dt><dd className="font-mono font-semibold tnum">{naira(p.invested)}</dd></div>
          {p.sold > 0 && <div><dt className="text-ink-3">Got back by selling</dt><dd className="font-mono font-semibold tnum">{naira(p.sold)}</dd></div>}
          <div><dt className="text-ink-3">Profit since</dt><dd className={cn("font-mono font-semibold tnum", p.profit_since < 0 && "text-crit")}>{naira(p.profit_since)}</dd></div>
          <div><dt className="text-ink-3">Still to come back</dt><dd className="font-mono font-semibold tnum">{naira(p.left)}</dd></div>
          {p.rent_per_month > 0 && <div><dt className="text-ink-3">Rent (in profit already)</dt><dd className="font-mono tnum">{naira(p.rent_per_month)} / month</dd></div>}
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card flush title="By site">
          <ul className="divide-y divide-line">{p.by_site.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-[13.5px]"><span className="flex-1">{s.name}</span><span className="font-mono tnum">{naira(s.invested)}</span></li>))}
          </ul>
        </Card>
        {p.by_unit.length > 0 && (
          <Card flush title="By house, pond or cage" meta="What each cost, against the profit of the batches kept in it">
            <ul className="divide-y divide-line">{p.by_unit.map((u) => (
              <li key={u.id} className="flex flex-col gap-1.5 px-4 py-2.5 text-[13.5px]">
                <div className="flex items-center gap-3"><b className="flex-1 font-mono">{u.name}</b>
                  <span className="text-[12.5px] text-ink-3">cost {naira(u.invested)} · batches made <span className={cn("tnum", (u.profit ?? 0) < 0 && "text-crit")}>{naira(u.profit ?? 0)}</span></span></div>
                <Bar pct={u.recovered_pct ?? 0} label={`${u.name}: ${u.recovered_pct ?? 0}% paid back`} />
              </li>))}
            </ul>
          </Card>
        )}
      </div>

      <Card flush title="What was put in" meta="Land, buildings, ponds, cages and equipment">
        <ul className="divide-y divide-line">{p.items.map((i) => (
          <li key={i.expense_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13.5px]">
            <span className="w-[92px] shrink-0 font-mono text-[12px] text-ink-3">{day(i.on)}</span>
            <span className="min-w-0 flex-1">{i.description}
              <span className="block text-[12px] text-ink-3">{i.number}{i.site_name ? ` · ${i.site_name}` : ""}{i.units.length > 1 ? ` · ${i.units.length} units` : ""}</span></span>
            {i.status === "owed" && <Badge tone="warn">Owed</Badge>}
            {i.status === "pending" && <Badge tone="warn">Waiting for approval</Badge>}
            <span className="font-mono font-semibold tnum">{naira(i.amount)}</span>
            <OwnerActions kind="expense" id={i.expense_id} compact />
          </li>))}
        </ul>
      </Card>
      {p.notes.map((n) => <p key={n} className="text-[12.5px] text-ink-3">{n}</p>)}
    </div>
  );
}
