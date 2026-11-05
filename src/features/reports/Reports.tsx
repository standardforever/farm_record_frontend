"use client";

import { type ReactNode, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Mail, Printer } from "lucide-react";
import { BarChart } from "@/components/charts/BarChart";
import { Alert, Button, Card, Checkbox, Field, PageLoader, Select, Toggle, useToast } from "@/components/ui";
import { useBatchPage } from "@/features/batches";
import { useCatalog } from "@/features/farm";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, naira } from "@/lib/format";
import { type ReportEmail, useBatchReport, useMonthly, useReportEmail, useSaveReportEmail, useSendTestReport, useWeekly } from "./api";

const day = (iso: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => new Date(iso + "T12:00:00").toLocaleDateString("en-NG", o);
const n = (v: number | null | undefined, d = 0) => v == null ? "—" : v.toLocaleString("en-NG", { maximumFractionDigits: d });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, k: number) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + k); return iso(d); };
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** CSV for spreadsheets: what the person sees, one row per line. */
function downloadCsv(name: string, header: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const blob = new Blob([[header, ...rows].map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Toolbar({ children, onCsv }: { children?: ReactNode; onCsv?: () => void }) {
  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2">
      {children}
      <span className="ml-auto flex gap-2">
        {onCsv && <Button size="sm" onClick={onCsv}><Download size={14} /> Spreadsheet (CSV)</Button>}
        <Button size="sm" variant="primary" onClick={() => window.print()}><Printer size={14} /> Print or save as PDF</Button>
      </span>
    </div>
  );
}

/** The printable sheet: plain on paper, the farm's name at the top. */
function Sheet({ farm, title, period, children }: { farm: string; title: string; period: string; children: ReactNode }) {
  return (
    <div className="print-doc rounded-[16px] border border-line bg-surface p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b border-line pb-4">
        <div><div className="eyebrow">{farm}</div><h2 className="mt-1 font-display text-[24px] font-bold">{title}</h2></div>
        <div className="text-right text-[13px] text-ink-2">{period}<span className="block text-[11.5px] text-ink-3">From Oko records · printed {day(iso(new Date()), { day: "numeric", month: "short", year: "numeric" })}</span></div>
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="break-inside-avoid"><h3 className="mb-2 text-[15px] font-bold">{title}</h3>{children}</section>;
}

function Figures({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([k, v]) => <div key={k} className="rounded-xl border border-line px-3 py-2.5"><dt className="text-[12px] text-ink-3">{k}</dt><dd className="mt-0.5 text-[18px] font-bold tnum">{v}</dd></div>)}
    </dl>
  );
}

function Table({ head, rows, right = [] }: { head: string[]; rows: ReactNode[][]; right?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead className="text-left text-[12px] text-ink-3"><tr>{head.map((h, i) => <th key={h} className={cn("border-b border-line px-2 py-1.5 font-semibold first:pl-0", right.includes(i) && "text-right")}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{rows.map((r, j) => <tr key={j}>{r.map((c, i) => <td key={i} className={cn("px-2 py-1.5 first:pl-0", right.includes(i) && "text-right tnum")}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// ---- weekly ---------------------------------------------------------------------------------------------------------

export function WeeklyReport({ initialEnd }: { initialEnd?: string }) {
  const ws = useCurrentWorkspace();
  const catalog = useCatalog();
  const today = iso(new Date());
  const [end, setEnd] = useState(initialEnd ?? addDays(today, -1));
  const q = useWeekly(ws.orgId, end);
  const r = q.data;
  const species = (k: string) => catalog.data?.purposes[k] ?? k;
  return (
    <>
      <Toolbar onCsv={r ? () => downloadCsv(`oko-week-${r.end}.csv`, ["Batch", "Species", "At start", "Added", "Lost (died)", "Culled", "Missing", "Sold or used", "At end", "Feed kg", "Eggs", "Avg weight g", "FCR"],
        r.batches.map((b) => [b.code, species(b.species), b.start_count, b.added, b.died, b.culled, b.missing, b.sold, b.end_count, b.feed_kg, b.eggs, b.latest_avg_weight_g, b.fcr])) : undefined}>
        <Button size="sm" aria-label="Previous week" onClick={() => setEnd(addDays(end, -7))}><ChevronLeft size={15} /></Button>
        <span className="text-[13.5px] font-semibold">{r ? `${day(r.start)} – ${day(r.end, { day: "numeric", month: "short", year: "numeric" })}` : "…"}</span>
        <Button size="sm" aria-label="Next week" disabled={end >= today} onClick={() => setEnd(addDays(end, 7) > today ? today : addDays(end, 7))}><ChevronRight size={15} /></Button>
      </Toolbar>
      {!r ? <PageLoader /> : (
        <Sheet farm={r.farm} title="Weekly farm summary" period={`${day(r.start)} – ${day(r.end, { day: "numeric", month: "short", year: "numeric" })}`}>
          <Figures items={[["Animals lost", n(r.totals.deaths)], ["Feed", `${n(r.totals.feed_kg)} kg`],
            [r.totals.eggs ? "Eggs" : "Jobs done", r.totals.eggs ? n(r.totals.eggs) : n(r.jobs.done)],
            r.sales ? ["Sales", naira(r.sales.invoiced)] : ["Jobs skipped", n(r.jobs.skipped)]]} />
          <Section title="Batches">
            {!r.batches.length ? <p className="text-[13.5px] text-ink-3">No batches on the farm in this week.</p> : (
              <Table right={[1, 2, 3, 4, 5, 6, 7]} head={["Batch", "At start", "Lost", "Sold", "At end", "Feed kg", r.totals.eggs ? "Eggs" : "Weight", "FCR"]}
                rows={r.batches.map((b) => [<span key="c"><b className="font-mono">{b.code}</b><span className="block text-[11.5px] text-ink-3">{species(b.species)}</span></span>,
                  n(b.start_count + b.added), n(b.died + b.culled + b.missing), n(b.sold), <b key="e">{n(b.end_count)}</b>, n(b.feed_kg),
                  r.totals.eggs ? n(b.eggs) : b.latest_avg_weight_g ? `${n(b.latest_avg_weight_g)} g` : "—", b.fcr ?? "—"])} />
            )}
          </Section>
          <Section title="Day by day">
            <div className="grid gap-6 sm:grid-cols-2">
              <BarChart title="Animals lost" unit="lost" color="var(--series-2)" height={130}
                data={r.daily.map((x) => ({ label: day(x.on, { weekday: "short", day: "numeric" }), short: day(x.on, { weekday: "short" }), value: x.deaths }))} />
              <BarChart title="Feed" unit="kg" height={130}
                data={r.daily.map((x) => ({ label: day(x.on, { weekday: "short", day: "numeric" }), short: day(x.on, { weekday: "short" }), value: x.feed_kg }))} />
            </div>
          </Section>
          {r.health && (
            <Section title="Health">
              <p className="text-[13.5px] text-ink-2">{r.health.treatments.length} treatment{r.health.treatments.length === 1 ? "" : "s"} given · {r.health.cases_opened} sick-animal report{r.health.cases_opened === 1 ? "" : "s"}
                {r.health.holds.length ? ` · ${r.health.holds.length} withdrawal hold${r.health.holds.length > 1 ? "s" : ""} on` : ""}</p>
              {r.health.treatments.length > 0 && <ul className="mt-1.5 text-[13px] text-ink-2">{r.health.treatments.map((t, i) => <li key={i}>{day(t.on)} · {t.product}</li>)}</ul>}
            </Section>
          )}
          {(r.sales || r.money) && (
            <Section title="Money">
              <p className="text-[13.5px] text-ink-2">{[r.sales && `Sales ${naira(r.sales.invoiced)}`, r.sales && `money received ${naira(r.sales.received)}`, r.money && `expenses ${naira(r.money.expenses)}`].filter(Boolean).join(" · ")}</p>
            </Section>
          )}
        </Sheet>
      )}
    </>
  );
}

// ---- monthly money -------------------------------------------------------------------------------------------------

export function MonthlyReport({ initialMonth }: { initialMonth?: string }) {
  const ws = useCurrentWorkspace();
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(initialMonth ?? thisMonth);
  const q = useMonthly(ws.orgId, month);
  const r = q.data;
  const shift = (k: number) => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 1 + k, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const label = new Date(month + "-01T12:00:00").toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  if (q.isError) return <Alert tone="warn" title={(q.error as ApiError).message} />;
  return (
    <>
      <Toolbar onCsv={r ? () => downloadCsv(`oko-money-${month}.csv`, ["Line", "Amount (₦)"],
        [...r.pnl.revenue.map((x) => [x.label, x.total]), ["Total sales", r.pnl.total_revenue.total], ...r.pnl.costs.map((x) => [x.label, -x.total]),
          ["Total costs", -r.pnl.total_costs.total], ["Profit", r.pnl.profit.total]]) : undefined}>
        <Button size="sm" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={15} /></Button>
        <span className="text-[13.5px] font-semibold">{label}</span>
        <Button size="sm" aria-label="Next month" disabled={month >= thisMonth} onClick={() => shift(1)}><ChevronRight size={15} /></Button>
      </Toolbar>
      {!r ? <PageLoader /> : (
        <Sheet farm={r.farm} title="Money for the month" period={label + (r.end < `${month}-28` ? ` (to ${day(r.end)})` : "")}>
          <Figures items={[["Sales", naira(r.pnl.total_revenue.total)], ["Costs", naira(r.pnl.total_costs.total)],
            ["Profit", <span key="p" className={r.pnl.profit.total < 0 ? "text-crit" : "text-good"}>{naira(r.pnl.profit.total)}</span>],
            ["Money in the accounts", naira(r.accounts.reduce((s, a) => s + a.closing, 0))]]} />
          <Section title="Profit and loss">
            <Table right={[1]} head={["", "₦"]} rows={[
              ...r.pnl.revenue.map((x) => [x.label, naira(x.total)]), [<b key="s">Total sales</b>, <b key="t">{naira(r.pnl.total_revenue.total)}</b>],
              ...r.pnl.costs.map((x) => [x.label, naira(-x.total)]), [<b key="c">Total costs</b>, <b key="u">{naira(-r.pnl.total_costs.total)}</b>],
              [<b key="p">Profit</b>, <b key="v" className={r.pnl.profit.total < 0 ? "text-crit" : ""}>{naira(r.pnl.profit.total)}</b>]]} />
            <ul className="mt-2 text-[11.5px] text-ink-3">{r.pnl.notes.map((x) => <li key={x}>· {x}</li>)}</ul>
          </Section>
          {r.accounts.length > 0 && (
            <Section title="Cash and bank">
              <Table right={[1, 2]} head={["Account", "Start of month", "End"]} rows={r.accounts.map((a) => [a.name, naira(a.opening), <b key="c">{naira(a.closing)}</b>])} />
            </Section>
          )}
          {r.expenses_by_category.length > 0 && (
            <Section title="Expenses by kind">
              <Table right={[1]} head={["Kind", "₦"]} rows={r.expenses_by_category.map((e) => [e.label, naira(e.amount)])} />
            </Section>
          )}
          {r.batches.length > 0 && (
            <Section title="Batches (from arrival to date)">
              <Table right={[1, 2, 3, 4]} head={["Batch", "Sales", "Costs", "Profit", "Margin"]}
                rows={r.batches.map((b) => [<b key="c" className="font-mono">{b.code}</b>, naira(b.revenue), naira(b.costs),
                  <span key="p" className={b.profit < 0 ? "text-crit" : ""}>{naira(b.profit)}</span>, b.margin_pct != null ? `${b.margin_pct}%` : "—"])} />
            </Section>
          )}
          {r.aging.customers.length > 0 && (
            <Section title="Who owes you (end of month)">
              <Table right={[1]} head={["Customer", "Owes"]} rows={r.aging.customers.map((c) => [c.customer_name, naira(c.total)])} />
            </Section>
          )}
        </Sheet>
      )}
    </>
  );
}

// ---- one batch -----------------------------------------------------------------------------------------------------

export function BatchReportView({ initialId }: { initialId?: string }) {
  const ws = useCurrentWorkspace();
  const catalog = useCatalog();
  const list = useBatchPage(ws.orgId, { page: 1, page_size: 100 });
  const [id, setId] = useState<string | null>(initialId ?? null);
  useEffect(() => { if (!id && list.data?.items[0]) setId(list.data.items[0].id); }, [id, list.data]);
  const q = useBatchReport(ws.orgId, id);
  const r = q.data;
  const s = (r?.batch.summary ?? {}) as Record<string, number | null>;
  return (
    <>
      <Toolbar onCsv={r ? () => downloadCsv(`oko-${r.batch.code}.csv`, ["Week", "From", "Lost", "Feed kg", "Eggs"],
        r.weeks.map((w) => [w.week, w.from, w.deaths, w.feed_kg, w.eggs])) : undefined}>
        <Select aria-label="Batch" className="h-9 w-auto min-w-[200px]" value={id ?? ""} onChange={(e) => setId(e.target.value)}>
          {(list.data?.items ?? []).map((b) => <option key={b.id} value={b.id}>{b.code} · {catalog.data?.purposes[b.species] ?? b.species}{b.status === "closed" ? " (closed)" : ""}</option>)}
        </Select>
      </Toolbar>
      {!id ? <p className="text-[13.5px] text-ink-3">No batches yet.</p> : !r ? <PageLoader /> : (
        <Sheet farm={r.farm} title={`Batch ${r.batch.code}${r.batch.status === "closed" ? " · close-out" : ""}`}
          period={`${day(r.batch.started_on, { day: "numeric", month: "short", year: "numeric" })} – ${r.batch.closed_on ? day(r.batch.closed_on, { day: "numeric", month: "short", year: "numeric" }) : "now"}`}>
          <Figures items={[["Stocked", n(s.total_in)], [r.batch.status === "closed" ? "Sold" : "Now", n(r.batch.status === "closed" ? s.sold : r.batch.current)],
            ["Survival", s.survival_pct != null ? `${s.survival_pct}%` : "—"], ["FCR", s.fcr ?? "—"]]} />
          {r.money && <Figures items={[["Sales", naira(s.sales_amount ?? 0)], ["Costs", naira(s.cost_so_far ?? 0)],
            ["Result", <span key="r" className={(s.result_so_far ?? 0) < 0 ? "text-crit" : "text-good"}>{naira(s.result_so_far ?? 0)}</span>],
            ["Cost per animal stocked", s.cost_per_head_in != null ? naira(s.cost_per_head_in) : "—"]]} />}
          <Section title="Week by week">
            <Table right={[1, 2, 3]} head={["Week", "Lost", "Feed kg", "Eggs"]} rows={r.weeks.map((w) => [`Week ${w.week} (from ${day(w.from)})`, n(w.deaths), n(w.feed_kg), n(w.eggs)])} />
          </Section>
          {r.weights.length > 0 && <Section title="Weigh-ins">
            <Table right={[1, 2]} head={["Day", "Average", "Weighed"]} rows={r.weights.map((w) => [day(w.on), `${n(w.avg_g)} g`, n(w.sample)])} /></Section>}
          {r.losses.length > 0 && <Section title="Losses">
            <Table right={[2]} head={["Day", "What", "How many", "Cause"]} rows={r.losses.map((x) => [day(x.on), x.kind, n(x.quantity), x.reason ?? ""])} /></Section>}
          {r.treatments.length > 0 && <Section title="Vaccinations and treatments">
            <Table head={["Day", "Product", "Dose", "How"]} rows={r.treatments.map((t) => [day(t.on), t.product, t.dose ?? "", t.route ?? ""])} /></Section>}
          {r.expenses.length > 0 && <Section title="Expenses charged to it">
            <Table right={[2]} head={["Day", "What", "₦"]} rows={r.expenses.map((e) => [day(e.on), e.description, naira(e.amount)])} /></Section>}
          {r.batch.close_note && <Section title="Close-out note"><p className="text-[13.5px] text-ink-2">{r.batch.close_note}</p></Section>}
        </Sheet>
      )}
    </>
  );
}

// ---- by email ------------------------------------------------------------------------------------------------------

export function ReportEmailSettings() {
  const ws = useCurrentWorkspace();
  const q = useReportEmail(ws.orgId);
  const save = useSaveReportEmail(ws.orgId);
  const test = useSendTestReport(ws.orgId);
  const toast = useToast();
  const [form, setForm] = useState<Pick<ReportEmail, "weekly" | "monthly"> | null>(null);
  useEffect(() => { if (q.data) setForm({ weekly: q.data.weekly, monthly: q.data.monthly }); }, [q.data]);
  if (!q.data || !form) return <PageLoader />;
  const d = q.data;
  const canEdit = ws.can("workspace.manage");
  const owners = d.people.filter((p) => p.owner).map((p) => p.id);
  const chosen = (which: "weekly" | "monthly") => new Set(form[which].to ?? owners);
  const toggle = (which: "weekly" | "monthly", id: string, on: boolean) => {
    const s = chosen(which); if (on) { s.add(id); } else { s.delete(id); }
    setForm({ ...form, [which]: { ...form[which], to: [...s] } });
  };
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); if (ok) toast(ok); } catch (e) { toast(e instanceof ApiError ? e.message : "Could not do that", "crit"); }
  };
  const hours = Array.from({ length: 17 }, (_, i) => i + 5);
  const block = (which: "weekly" | "monthly", title: string, sub: string) => (
    <Card title={title} meta={sub} action={<Toggle checked={form[which].enabled} disabled={!canEdit} label={`Send the ${which} report`}
      onChange={(v) => setForm({ ...form, [which]: { ...form[which], enabled: v } })} />}>
      <div className={cn("flex flex-col gap-3", !form[which].enabled && "opacity-55")}>
        <div className="flex flex-wrap gap-3">
          {which === "weekly" ? (
            <Field label="Day" htmlFor="w-day"><Select id="w-day" disabled={!canEdit} value={form.weekly.weekday} onChange={(e) => setForm({ ...form, weekly: { ...form.weekly, weekday: Number(e.target.value) } })}>
              {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}</Select></Field>
          ) : (
            <Field label="Day of the month" htmlFor="m-day"><Select id="m-day" disabled={!canEdit} value={form.monthly.day} onChange={(e) => setForm({ ...form, monthly: { ...form.monthly, day: Number(e.target.value) } })}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((k) => <option key={k} value={k}>{k}</option>)}</Select></Field>
          )}
          <Field label="Time (Nigeria)" htmlFor={`${which}-hour`}><Select id={`${which}-hour`} disabled={!canEdit} value={form[which].hour} onChange={(e) => setForm({ ...form, [which]: { ...form[which], hour: Number(e.target.value) } })}>
            {hours.map((h) => <option key={h} value={h}>{`${h % 12 || 12}:00 ${h < 12 ? "am" : "pm"}`}</option>)}</Select></Field>
        </div>
        <div>
          <div className="mb-1 text-[13px] font-semibold">Who gets it</div>
          {d.people.filter((p) => p[which]).map((p) => (
            <Checkbox key={p.id} disabled={!canEdit || !p.email} checked={chosen(which).has(p.id)} onChange={(v) => toggle(which, p.id, v)}
              label={p.name} description={`${p.role}${p.email ? ` · ${p.email}` : " · no email address"}`} />
          ))}
          <p className="mt-1 text-[12px] text-ink-3">Only people who may see this report are listed. Each copy shows what that person&apos;s role allows.</p>
        </div>
        <div><Button size="sm" loading={test.isPending} onClick={() => run(async () => { const r = await test.mutateAsync(which); toast(`Sent to ${r.to}`); }, "")}>
          <Mail size={14} /> Email it to me now</Button></div>
      </div>
    </Card>
  );
  return (
    <div className="flex max-w-[760px] flex-col gap-4">
      {!canEdit && <Alert tone="info" title="Only the owner or co-owner can change these." />}
      {block("weekly", "Weekly farm summary", "Animals, feed, losses, health and money for the last seven days.")}
      {d.finance && block("monthly", "Monthly money report", "Profit and loss, cash and who owes you, for the month just ended.")}
      {canEdit && <div><Button variant="primary" loading={save.isPending} onClick={() => run(() => save.mutateAsync(form), "Report emails saved")}>Save</Button></div>}
    </div>
  );
}
