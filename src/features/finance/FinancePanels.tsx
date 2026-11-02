"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Check, Plus, UserPlus, X } from "lucide-react";
import { Alert, Badge, Button, Card, Dialog, Field, Input, PageLoader, Pager, Select, Textarea, usePager, useSlice, useToast } from "@/components/ui";
import { localDay } from "@/features/daily/api";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, naira } from "@/lib/format";
import {
  type Account, type Employee, type Expense, type PayRun, type PnlRow, day, monthLabel, monthRange, useAccounts, useBatchProfits, useCashFlow, useDecideExpense,
  useEmployees, useExpenses, useFinance, useFinanceCatalog, usePayExpense, usePayPayRun, usePayRuns, usePnl, useSaveFinanceSettings, useSavePayRun, useUnitProfits,
  useVoidExpense,
} from "./api";
import { AccountDialog, AccountSheet, EmployeeDialog, StatusBadge, TransferDialog } from "./FinanceDialogs";

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Could not save.");
const signed = (v: number) => <span className={cn("font-mono tnum", v < 0 ? "text-crit" : undefined)}>{naira(v)}</span>;

/** Choose an account and a date, then pay (an owed bill or a pay run). */
export function PayDialog({ open, onClose, title, amount, onPay }: {
  open: boolean; onClose: () => void; title: string; amount: number; onPay: (account_id: string, paid_on: string) => Promise<unknown>;
}) {
  const ws = useCurrentWorkspace();
  const accounts = useAccounts(ws.orgId, open);
  const [f, setF] = useState({ account: "", on: localDay() });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setError(null); setF({ account: accounts.data?.find((a) => a.kind === "bank")?.id ?? accounts.data?.[0]?.id ?? "", on: localDay() }); } }, [open, accounts.data]);
  return (
    <Dialog open={open} onClose={onClose} title={title} eyebrow="Finance"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!f.account} onClick={async () => {
        setBusy(true); setError(null);
        try { await onPay(f.account, f.on); onClose(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
      }}>Pay {naira(amount)}</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Paid from" htmlFor="pay-acc"><Select id="pay-acc" value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })}>
            {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.name} ({naira(a.balance)})</option>)}</Select></Field>
          <Field label="On" htmlFor="pay-on"><Input id="pay-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        </div>
      </div>
    </Dialog>
  );
}

function ExpenseRow({ e, onPay, onVoid }: { e: Expense; onPay?: (e: Expense) => void; onVoid?: (e: Expense) => void }) {
  const ws = useCurrentWorkspace();
  const cat = useFinanceCatalog();
  const decide = useDecideExpense(ws.orgId);
  const toast = useToast();
  const charged = e.batch_code ?? e.unit_code ?? e.site_name ?? "Whole farm";
  return (
    <li className={cn("flex flex-wrap items-center gap-3 py-2.5", e.voided_at && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <b className="font-mono text-[12.5px]">{e.number}</b><span className="truncate text-[14px] font-semibold">{e.description}</span>
          <StatusBadge status={e.status} />{e.voided_at && <Badge tone="crit">Void</Badge>}
          {e.status === "approved" && !e.voided_at && !e.account_id && <Badge tone="warn">Owed</Badge>}
        </div>
        <p className="text-[12.5px] text-ink-3">
          {day(e.spent_on)} · {cat.data?.expense_categories[e.category]?.replace(/ \(.*\)$/, "") ?? e.category} · {charged}{e.payee ? ` · to ${e.payee}` : ""}
          {e.account_name ? ` · from ${e.account_name}` : ""}{e.cash_only ? " · not a running cost" : ""}{e.created_by_name ? ` · by ${e.created_by_name}` : ""}
        </p>
        {e.void_reason && <p className="text-[12px] text-ink-3">Voided: {e.void_reason}</p>}
      </div>
      <b className="font-mono tnum text-[14px]">{naira(e.amount)}</b>
      <div className="flex gap-1.5">
        {e.status === "pending" && ws.can("finance.approve") && <>
          <Button size="sm" variant="primary" loading={decide.isPending} onClick={async () => { try { await decide.mutateAsync({ id: e.id, approve: true }); toast(`${e.number} approved`); } catch (x) { toast(errMsg(x)); } }}><Check size={14} /> Approve</Button>
          <Button size="sm" variant="ghost" onClick={async () => { try { await decide.mutateAsync({ id: e.id, approve: false }); toast(`${e.number} rejected`); } catch (x) { toast(errMsg(x)); } }}><X size={14} /> Reject</Button>
        </>}
        {onPay && e.status === "approved" && !e.voided_at && !e.account_id && ws.can("finance.edit") && <Button size="sm" onClick={() => onPay(e)}>Pay</Button>}
        {onVoid && !e.voided_at && ws.can("finance.edit") && <Button size="sm" variant="ghost" onClick={() => onVoid(e)}>Void</Button>}
      </div>
    </li>
  );
}

function useExpenseActions() {
  const ws = useCurrentWorkspace();
  const pay = usePayExpense(ws.orgId);
  const voidE = useVoidExpense(ws.orgId);
  const toast = useToast();
  const [paying, setPaying] = useState<Expense | null>(null);
  const [voiding, setVoiding] = useState<Expense | null>(null);
  const [reason, setReason] = useState("");
  const dialogs = (
    <>
      <PayDialog open={!!paying} onClose={() => setPaying(null)} title={`Pay ${paying?.number ?? ""}`} amount={paying?.amount ?? 0}
        onPay={async (account_id, paid_on) => { await pay.mutateAsync({ id: paying!.id, account_id, paid_on }); toast(`${paying!.number} paid`); }} />
      <Dialog open={!!voiding} onClose={() => setVoiding(null)} title={`Void ${voiding?.number ?? ""}`} eyebrow="Finance"
        footer={<><Button variant="ghost" onClick={() => setVoiding(null)}>Cancel</Button><Button variant="danger" loading={voidE.isPending} disabled={reason.trim().length < 3} onClick={async () => {
          try { await voidE.mutateAsync({ id: voiding!.id, reason: reason.trim() }); toast(`${voiding!.number} voided`); setVoiding(null); setReason(""); } catch (x) { toast(errMsg(x)); }
        }}>Void expense</Button></>}>
        <Field label="Why" htmlFor="v-reason"><Textarea id="v-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Entered twice" /></Field>
      </Dialog>
    </>
  );
  return { onPay: setPaying, onVoid: (e: Expense) => { setReason(""); setVoiding(e); }, dialogs };
}

export function OverviewPanel({ onAddAccount }: { onAddAccount: () => void }) {
  const ws = useCurrentWorkspace();
  const ov = useFinance(ws.orgId);
  const upg = usePager(10);
  const unpaid = useExpenses(ws.orgId, { unpaid: true, ...upg.params });
  const save = useSaveFinanceSettings(ws.orgId);
  const toast = useToast();
  const { onPay, onVoid, dialogs } = useExpenseActions();
  const [limit, setLimit] = useState<string | null>(null);
  if (!ov.data) return <PageLoader />;
  const d = ov.data;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Waiting for approval" meta={`Expenses over ${naira(d.approval_limit)} need someone who can approve spending.`}
        action={ws.can("finance.approve") ? <Button size="sm" variant="ghost" onClick={() => setLimit(String(d.approval_limit))}>Change limit</Button> : undefined}>
        {d.pending.length === 0 ? <p className="text-[13.5px] text-ink-3">Nothing waiting.</p>
          : <ul className="flex flex-col divide-y divide-line">{d.pending.map((e) => <ExpenseRow key={e.id} e={e} onVoid={onVoid} />)}</ul>}
      </Card>
      <Card title="Bills not paid yet" meta={unpaid.data?.total ? `${naira(d.unpaid_bills)} owed to suppliers` : undefined}>
        {!unpaid.data ? <PageLoader /> : unpaid.data.total === 0 ? <p className="text-[13.5px] text-ink-3">You owe nothing.</p>
          : <ul className="flex flex-col divide-y divide-line">{unpaid.data.items.map((e) => <ExpenseRow key={e.id} e={e} onPay={onPay} />)}</ul>}
        <Pager {...upg.bind(unpaid.data?.total, unpaid.isFetching)} noun="bills" />
      </Card>
      <Card title="Money accounts" className="lg:col-span-2" action={ws.can("finance.edit") ? <Button size="sm" onClick={onAddAccount}><Plus size={14} /> Add account</Button> : undefined}>
        {d.accounts.length === 0 ? <p className="text-[13.5px] text-ink-3">Add your cash box and bank accounts so Oko can tell you how much money you have, and check it against the bank.</p> : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{d.accounts.map((a) => (
            <li key={a.id} className="rounded-xl border border-line p-3">
              <p className="text-[13px] text-ink-3">{a.name}</p><p className="font-mono text-[18px] font-bold tnum">{signed(a.balance)}</p>
              <p className="text-[12px] text-ink-3">{a.last_reconciled_on ? `Checked ${day(a.last_reconciled_on)}${a.last_difference ? `, off by ${naira(a.last_difference)}` : ", matched"}` : "Not checked against a statement yet"}</p>
            </li>))}</ul>
        )}
      </Card>
      {dialogs}
      <Dialog open={limit != null} onClose={() => setLimit(null)} title="Approval limit" eyebrow="Finance"
        footer={<><Button variant="ghost" onClick={() => setLimit(null)}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={async () => {
          try { await save.mutateAsync({ approval_limit: Number(limit) || 0 }); toast("Saved"); setLimit(null); } catch (x) { toast(errMsg(x)); }
        }}>Save</Button></>}>
        <Field label="Expenses above this wait for approval (₦)" htmlFor="lim" hint="People who can approve spending are never held up. 0 means every expense from others waits.">
          <Input id="lim" inputMode="decimal" value={limit ?? ""} onChange={(e) => setLimit(e.target.value.replace(/[^\d.]/g, ""))} /></Field>
      </Dialog>
    </div>
  );
}

export function ExpensesPanel() {
  const ws = useCurrentWorkspace();
  const cat = useFinanceCatalog();
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const range = monthRange(offset);
  const pg = usePager(20, [offset, status, category]);
  const q = useExpenses(ws.orgId, { ...range, status, category, ...pg.params });
  const { onPay, onVoid, dialogs } = useExpenseActions();
  return (
    <Card title={`Expenses · ${monthLabel(range.start)}`} meta={q.data ? `${q.data.approved_count} approved · ${naira(q.data.approved_total)}` : undefined}
      action={<div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => setOffset(offset - 1)}>‹</Button>
        <Button size="sm" variant="ghost" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>›</Button>
        <select aria-label="Status" className="rounded-lg border border-line bg-surface px-2 py-1 text-[13px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option><option value="pending">Waiting</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="void">Void</option></select>
        <select aria-label="Category" className="rounded-lg border border-line bg-surface px-2 py-1 text-[13px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Every kind</option>{Object.entries(cat.data?.expense_categories ?? {}).map(([k, v]) => <option key={k} value={k}>{v.replace(/ \(.*\)$/, "")}</option>)}</select>
      </div>}>
      {!q.data ? <PageLoader /> : q.data.total === 0 ? <p className="text-[13.5px] text-ink-3">No expenses here.</p>
        : <ul className="flex flex-col divide-y divide-line">{q.data.items.map((e) => <ExpenseRow key={e.id} e={e} onPay={onPay} onVoid={onVoid} />)}</ul>}
      <Pager {...pg.bind(q.data?.total, q.isFetching)} noun="expenses" />
      {dialogs}
    </Card>
  );
}

function PnlTable({ start, end }: { start: string; end: string }) {
  const ws = useCurrentWorkspace();
  const q = usePnl(ws.orgId, start, end);
  if (!q.data) return <PageLoader />;
  const p = q.data;
  const ents = Object.keys(p.enterprises).filter((k) => [...p.revenue, ...p.costs].some((r) => r.by_enterprise[k]));
  const row = (r: PnlRow, cls?: string, neg?: boolean) => (
    <tr key={r.key} className={cls}>
      <th scope="row" className="py-1.5 pr-3 text-left font-normal">{r.label}</th>
      {ents.map((k) => <td key={k} className="px-2 py-1.5 text-right font-mono tnum">{r.by_enterprise[k] ? naira(neg ? -r.by_enterprise[k] : r.by_enterprise[k]) : "—"}</td>)}
      <td className="py-1.5 pl-2 text-right font-mono font-semibold tnum">{signed(neg ? -r.total : r.total)}</td>
    </tr>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-[13px]">
        <thead><tr className="border-b border-line text-[12px] text-ink-3"><th className="py-1.5 text-left font-semibold">{day(p.start)} – {day(p.end)}</th>
          {ents.map((k) => <th key={k} className="px-2 py-1.5 text-right font-semibold">{p.enterprises[k]}</th>)}<th className="py-1.5 pl-2 text-right font-semibold">Total</th></tr></thead>
        <tbody>
          <tr><td colSpan={ents.length + 2} className="pt-2 text-[12px] font-bold uppercase tracking-wide text-ink-3">Money earned</td></tr>
          {p.revenue.map((r) => row(r))}
          {row(p.total_revenue, "border-t border-line font-semibold")}
          <tr><td colSpan={ents.length + 2} className="pt-3 text-[12px] font-bold uppercase tracking-wide text-ink-3">Costs</td></tr>
          {p.costs.map((r) => row(r, undefined, true))}
          {row(p.total_costs, "border-t border-line font-semibold", true)}
          <tr className="border-t-2 border-ink text-[14px] font-bold">
            <th scope="row" className="py-2 text-left">Profit</th>
            {ents.map((k) => <td key={k} className="px-2 py-2 text-right">{signed(p.profit.by_enterprise[k] ?? 0)}</td>)}
            <td className="py-2 pl-2 text-right">{signed(p.profit.total)}</td>
          </tr>
        </tbody>
      </table>
      {p.notes.length > 0 && <ul className="mt-3 flex flex-col gap-1 text-[12.5px] text-ink-3">{p.notes.map((n) => <li key={n}>• {n}</li>)}</ul>}
    </div>
  );
}

export function ProfitPanel() {
  const ws = useCurrentWorkspace();
  const [offset, setOffset] = useState(0);
  const [whole, setWhole] = useState(false);
  const range = whole ? { start: `${new Date().getFullYear()}-01-01`, end: localDay() } : monthRange(offset);
  const [status, setStatus] = useState("");
  const batches = useBatchProfits(ws.orgId, status || undefined);
  const units = useUnitProfits(ws.orgId);
  const bs = useSlice(batches.data, 20, [status]);
  const us = useSlice(units.data, 20);
  return (
    <div className="flex flex-col gap-4">
      <Card title="Profit and loss" meta={whole ? `This year so far` : monthLabel(range.start)}
        action={<div className="flex items-center gap-1.5">
          {!whole && <><Button size="sm" variant="ghost" onClick={() => setOffset(offset - 1)}>‹ Earlier</Button>
            <Button size="sm" variant="ghost" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>Later ›</Button></>}
          <Button size="sm" variant={whole ? "primary" : "ghost"} onClick={() => setWhole(!whole)}>{whole ? "Back to months" : "This year"}</Button>
        </div>}>
        <PnlTable start={range.start} end={range.end} />
      </Card>
      <Card title="Profit per batch" meta="Everything sold from the batch, less the animals, the stock used and the expenses charged to it."
        action={<select aria-label="Batches" className="rounded-lg border border-line bg-surface px-2 py-1 text-[13px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All batches</option><option value="active">Running</option><option value="closed">Closed</option></select>}>
        {!batches.data ? <PageLoader /> : batches.data.length === 0 ? <p className="text-[13.5px] text-ink-3">No batches yet.</p> : (
          <><div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead><tr className="border-b border-line text-left text-[12px] text-ink-3">
                <th className="py-1.5 font-semibold">Batch</th><th className="py-1.5 text-right font-semibold">Survival</th><th className="py-1.5 text-right font-semibold">Sales</th>
                <th className="py-1.5 text-right font-semibold">Costs</th><th className="py-1.5 text-right font-semibold">Profit</th><th className="py-1.5 text-right font-semibold">Margin</th>
                <th className="py-1.5 text-right font-semibold">Per head in</th></tr></thead>
              <tbody className="divide-y divide-line">{bs.rows.map((b) => (
                <tr key={b.batch_id}>
                  <td className="py-2"><Link href={`/w/${ws.orgId}/batches/${b.batch_id}`} className="font-mono font-semibold underline-offset-2 hover:underline">{b.code}</Link>
                    <span className="block text-[12px] text-ink-3">{b.species} · {b.days} days{b.status === "closed" ? " · closed" : ""}</span></td>
                  <td className="py-2 text-right tnum">{b.survival_pct != null ? `${b.survival_pct}%` : "—"}</td>
                  <td className="py-2 text-right font-mono tnum">{naira(b.revenue)}</td>
                  <td className="py-2 text-right font-mono tnum" title={Object.entries(b.cost_breakdown).map(([k, v]) => `${k}: ${naira(v)}`).join("\n")}>{naira(b.costs)}</td>
                  <td className="py-2 text-right font-semibold">{signed(b.profit)}</td>
                  <td className="py-2 text-right tnum">{b.margin_pct != null ? `${b.margin_pct}%` : "—"}</td>
                  <td className="py-2 text-right font-mono tnum">{b.profit_per_head_in != null ? signed(b.profit_per_head_in) : "—"}</td>
                </tr>))}</tbody>
            </table>
          </div>
            <Pager {...bs.pager} noun="batches" /></>
        )}
      </Card>
      <Card title="Profit per unit" meta="Each pond, pen or house: its share of the batches kept in it, plus expenses charged to the unit itself.">
        {!units.data ? <PageLoader /> : units.data.length === 0 ? <p className="text-[13.5px] text-ink-3">No units with batches yet.</p> : (
          <><div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead><tr className="border-b border-line text-left text-[12px] text-ink-3"><th className="py-1.5 font-semibold">Unit</th><th className="py-1.5 text-right font-semibold">Batches</th>
                <th className="py-1.5 text-right font-semibold">Sales</th><th className="py-1.5 text-right font-semibold">Costs</th><th className="py-1.5 text-right font-semibold">Profit</th></tr></thead>
              <tbody className="divide-y divide-line">{us.rows.map((u) => (
                <tr key={u.unit_id}><td className="py-2"><b className="font-mono">{u.code}</b>{u.site_name && <span className="block text-[12px] text-ink-3">{u.site_name}</span>}</td>
                  <td className="py-2 text-right tnum">{u.batches}</td><td className="py-2 text-right font-mono tnum">{naira(u.revenue)}</td>
                  <td className="py-2 text-right font-mono tnum">{naira(u.costs + u.unit_expenses)}</td><td className="py-2 text-right font-semibold">{signed(u.profit)}</td></tr>))}</tbody>
            </table>
          </div>
            <Pager {...us.pager} noun="units" /></>
        )}
      </Card>
    </div>
  );
}

export function CashPanel() {
  const ws = useCurrentWorkspace();
  const accounts = useAccounts(ws.orgId);
  const flow = useCashFlow(ws.orgId);
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [moving, setMoving] = useState(false);
  const [open, setOpen] = useState<Account | null>(null);
  const edit = ws.can("finance.edit");
  const max = Math.max(1, ...(flow.data?.months ?? []).flatMap((m) => [m.money_in, m.money_out]));
  return (
    <div className="flex flex-col gap-4">
      <Card title="Accounts" meta="Open one to see every naira in and out, and check it against the statement."
        action={edit ? <div className="flex gap-1.5"><Button size="sm" onClick={() => setMoving(true)} disabled={(accounts.data?.length ?? 0) < 2}><ArrowRightLeft size={14} /> Move money</Button>
          <Button size="sm" variant="primary" onClick={() => setEditing("new")}><Plus size={14} /> Add account</Button></div> : undefined}>
        {!accounts.data ? <PageLoader /> : accounts.data.length === 0 ? <p className="text-[13.5px] text-ink-3">No accounts yet. Start with the cash box and your main bank account.</p> : (
          <ul className="flex flex-col divide-y divide-line">{accounts.data.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <button type="button" onClick={() => setOpen(a)} className="min-w-0 flex-1 text-left">
                <b className="text-[14px]">{a.name}</b>
                <span className="block text-[12.5px] text-ink-3">{a.kind === "cash" ? "Cash" : `${a.bank_name ?? (a.kind === "mobile" ? "Mobile money" : "Bank")}${a.account_number ? ` · ${a.account_number}` : ""}`}
                  {" · "}{a.last_reconciled_on ? `checked ${day(a.last_reconciled_on)}` : "not checked yet"}</span>
              </button>
              <b className="font-mono text-[15px] tnum">{signed(a.balance)}</b>
              {edit && <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>Edit</Button>}
            </li>))}</ul>
        )}
      </Card>
      <Card title="Cash flow" meta={flow.data ? `${naira(flow.data.opening)} at the start, ${naira(flow.data.closing)} now` : undefined}>
        {!flow.data ? <PageLoader /> : (
          <>
            {flow.data.unassigned_receipts > 0 && <div className="mb-3"><Alert tone="warn">{naira(flow.data.unassigned_receipts)} of sales payments are not linked to an account, so they are not counted here.</Alert></div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-[13px]">
                <thead><tr className="border-b border-line text-left text-[12px] text-ink-3"><th className="py-1.5 font-semibold">Month</th><th className="py-1.5 font-semibold">In and out</th>
                  <th className="py-1.5 text-right font-semibold">In</th><th className="py-1.5 text-right font-semibold">Out</th><th className="py-1.5 text-right font-semibold">Net</th></tr></thead>
                <tbody className="divide-y divide-line">{flow.data.months.map((m) => (
                  <tr key={m.month} title={Object.entries(m.out_by_kind).map(([k, v]) => `${k}: ${naira(v)}`).join("\n")}>
                    <td className="py-2">{monthLabel(m.month)}</td>
                    <td className="w-[38%] py-2 pr-3"><div className="flex flex-col gap-[2px]" aria-hidden>
                      <span className="h-[6px] rounded-r-[3px] bg-good" style={{ width: `${(m.money_in / max) * 100}%` }} />
                      <span className="h-[6px] rounded-r-[3px] bg-crit" style={{ width: `${(m.money_out / max) * 100}%` }} /></div></td>
                    <td className="py-2 text-right font-mono tnum">{naira(m.money_in)}</td><td className="py-2 text-right font-mono tnum">{naira(m.money_out)}</td>
                    <td className="py-2 text-right font-semibold">{signed(m.net)}</td></tr>))}</tbody>
              </table>
            </div>
          </>
        )}
      </Card>
      <AccountDialog open={!!editing} onClose={() => setEditing(null)} account={editing === "new" ? null : editing} />
      <TransferDialog open={moving} onClose={() => setMoving(false)} />
      <AccountSheet account={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function PayRunCard({ run, employees }: { run: PayRun | null; employees: Employee[] }) {
  const ws = useCurrentWorkspace();
  const save = useSavePayRun(ws.orgId);
  const pay = usePayPayRun(ws.orgId);
  const toast = useToast();
  const [month, setMonth] = useState(monthRange().start);
  const [days, setDays] = useState<Record<string, string>>({});
  const [ded, setDed] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  useEffect(() => {
    if (!run) return;
    setMonth(run.period);
    setDays(Object.fromEntries(run.lines.filter((l) => l.days != null).map((l) => [l.employee_id, String(l.days)])));
    setDed(Object.fromEntries(run.lines.filter((l) => l.deductions).map((l) => [l.employee_id, String(l.deductions)])));
  }, [run]);
  const draft = !run || run.status === "draft";
  const active = employees.filter((e) => e.active);
  const prepare = async () => {
    try {
      await save.mutateAsync({ period: month, lines: active.map((e) => ({ employee_id: e.id, days: e.pay_basis === "daily" ? Number(days[e.id] ?? 0) : null, deductions: Number(ded[e.id] ?? 0) })) });
      toast("Pay run saved");
    } catch (x) { toast(errMsg(x)); }
  };
  return (
    <Card title={run ? `Wages for ${monthLabel(run.period)}` : "Prepare wages"} meta={run ? (run.status === "paid" ? `Paid ${day(run.paid_on)}` : "Draft: check the days and deductions, then pay.") : undefined}
      action={run?.status === "paid" ? <Badge tone="good">Paid</Badge> : undefined}>
      {draft && !run && <Field label="Month" htmlFor="pr-month" className="mb-3 max-w-[220px]"><Input id="pr-month" type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(`${e.target.value}-01`)} /></Field>}
      {active.length === 0 ? <p className="text-[13.5px] text-ink-3">Add the people you pay first.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-[13px]">
            <thead><tr className="border-b border-line text-left text-[12px] text-ink-3"><th className="py-1.5 font-semibold">Name</th><th className="py-1.5 font-semibold">Days</th>
              <th className="py-1.5 text-right font-semibold">Gross</th><th className="py-1.5 font-semibold">Deductions</th><th className="py-1.5 text-right font-semibold">Net</th></tr></thead>
            <tbody className="divide-y divide-line">{(run?.status === "paid" ? run.lines.map((l) => ({ e: employees.find((x) => x.id === l.employee_id)!, l })) : active.map((e) => ({ e, l: run?.lines.find((x) => x.employee_id === e.id) }))).map(({ e, l }) => {
              const gross = l && run?.status === "paid" ? l.gross : e.pay_basis === "daily" ? (Number(days[e.id] ?? 0) * e.rate) : e.rate;
              const d = l && run?.status === "paid" ? l.deductions : Number(ded[e.id] ?? 0);
              return (
                <tr key={e.id}>
                  <td className="py-2"><b>{e.name}</b><span className="block text-[12px] text-ink-3">{e.pay_basis === "daily" ? `${naira(e.rate)} a day` : `${naira(e.rate)} a month`}</span></td>
                  <td className="py-2">{e.pay_basis === "daily" ? (draft ? <Input aria-label={`Days for ${e.name}`} className="w-[72px]" inputMode="numeric" value={days[e.id] ?? ""} onChange={(x) => setDays({ ...days, [e.id]: x.target.value.replace(/\D/g, "") })} /> : l?.days) : "—"}</td>
                  <td className="py-2 text-right font-mono tnum">{naira(gross)}</td>
                  <td className="py-2">{draft ? <Input aria-label={`Deductions for ${e.name}`} className="w-[110px]" inputMode="decimal" value={ded[e.id] ?? ""} onChange={(x) => setDed({ ...ded, [e.id]: x.target.value.replace(/[^\d.]/g, "") })} placeholder="0" /> : naira(d)}</td>
                  <td className="py-2 text-right font-mono font-semibold tnum">{naira(gross - d)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      {draft && ws.can("finance.edit") && active.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {run && <span className="mr-auto text-[13px] text-ink-3">Saved total: <b className="font-mono">{naira(run.net)}</b></span>}
          <Button loading={save.isPending} onClick={prepare}>{run ? "Save changes" : "Prepare"}</Button>
          {run && ws.can("finance.approve") && <Button variant="primary" onClick={() => setPaying(true)}>Pay wages</Button>}
        </div>
      )}
      {run && <PayDialog open={paying} onClose={() => setPaying(false)} title={`Pay wages for ${monthLabel(run.period)}`} amount={run.net}
        onPay={async (account_id, paid_on) => { await pay.mutateAsync({ id: run.id, account_id, paid_on }); toast("Wages paid"); }} />}
    </Card>
  );
}

export function PayrollPanel() {
  const ws = useCurrentWorkspace();
  const emps = useEmployees(ws.orgId);
  const latest = usePayRuns(ws.orgId, { page: 1, page_size: 3 });  // the draft, if any, is the newest
  const hpg = usePager(10);
  const history = usePayRuns(ws.orgId, hpg.params);
  const [editing, setEditing] = useState<Employee | "new" | null>(null);
  const [fresh, setFresh] = useState(false);
  if (!emps.data || !latest.data) return <PageLoader />;
  const draft = latest.data.items.find((r) => r.status === "draft") ?? null;
  return (
    <div className="flex flex-col gap-4">
      <Card title="People you pay" meta="Permanent staff on a monthly salary and casual workers paid by the day."
        action={ws.can("finance.edit") ? <Button size="sm" variant="primary" onClick={() => setEditing("new")}><UserPlus size={14} /> Add</Button> : undefined}>
        {emps.data.length === 0 ? <p className="text-[13.5px] text-ink-3">Nobody on payroll yet.</p> : (
          <ul className="flex flex-col divide-y divide-line">{emps.data.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1"><b className="text-[14px]">{e.name}</b><span className="block text-[12.5px] text-ink-3">{e.job_title ?? "—"}{e.bank_name ? ` · ${e.bank_name} ${e.account_number ?? ""}` : ""}</span></div>
              <span className="font-mono text-[13.5px] tnum">{naira(e.rate)}<span className="text-ink-3">/{e.pay_basis === "daily" ? "day" : "month"}</span></span>
              {ws.can("finance.edit") && <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>Edit</Button>}
            </li>))}</ul>
        )}
      </Card>
      {(draft || fresh || latest.data.total === 0) ? <PayRunCard run={draft} employees={emps.data} />
        : ws.can("finance.edit") && <div><Button onClick={() => setFresh(true)}><Plus size={15} /> Prepare next month&apos;s wages</Button></div>}
      {(history.data?.total ?? 0) > 0 && (
        <Card title="Pay runs">
          <ul className="flex flex-col divide-y divide-line">{history.data!.items.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
              <span>{monthLabel(r.period)} · {r.lines.length} people · {r.status === "paid" ? `paid ${day(r.paid_on)}` : <Badge tone="warn">Not paid yet</Badge>}</span>
              <b className="font-mono tnum">{naira(r.net)}</b></li>
          ))}</ul>
          <Pager {...hpg.bind(history.data?.total, history.isFetching)} noun="pay runs" />
        </Card>
      )}
      <EmployeeDialog open={!!editing} onClose={() => setEditing(null)} employee={editing === "new" ? null : editing} />
    </div>
  );
}
