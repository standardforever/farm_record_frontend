"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDownLeft, Landmark, Plus } from "lucide-react";
import { Alert, Badge, Button, Card, Dialog, EmptyState, Field, Input, PageLoader, Segmented, Select, Textarea, useToast } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { OwnerActions } from "@/features/corrections";
import { localDay } from "@/features/daily/api";
import { useFormEvidence } from "@/features/evidence/useFormEvidence";
import { newId } from "@/features/offline/queue";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, naira } from "@/lib/format";
import { type Loan, type LoansOwed, useAccounts, useAddLoan, useAddMoneyIn, useFinanceCatalog, useLoan, useLoans, useMoneyIn, useRepayLoan } from "./api";
import { AccountDialog } from "./FinanceDialogs";

const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const dec = (v: string) => v.replace(/[^\d.]/g, "");
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Could not save. Try again.");

/** Which account; with none yet, add one without leaving the form. */
function AccountField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const ws = useCurrentWorkspace();
  const accounts = useAccounts(ws.orgId);
  const [adding, setAdding] = useState(false);
  const list = accounts.data ?? [];
  // Choose the first account whenever none is chosen (also after the form resets itself on opening).
  useEffect(() => { if (!value && list.length) onChange(list[0].id); });
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex flex-col gap-1.5">
        {list.length > 0 && <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {list.map((a) => <option key={a.id} value={a.id}>{a.name} ({naira(a.balance)})</option>)}</Select>}
        <div><Button size="sm" variant="ghost" onClick={() => setAdding(true)}><Plus size={14} /> {list.length ? "Another account" : "Add an account"}</Button></div>
      </div>
      <AccountDialog open={adding} onClose={async () => {
        setAdding(false);
        const known = new Set(list.map((a) => a.id));
        const fresh = (await accounts.refetch()).data?.find((a) => !known.has(a.id));
        if (fresh) onChange(fresh.id);
      }} />
    </Field>
  );
}

/** Money dated before the account starts counting is already inside its opening balance: say so. */
function BeforeStart({ accountId, on, what }: { accountId: string; on: string; what: string }) {
  const ws = useCurrentWorkspace();
  const acc = useAccounts(ws.orgId).data?.find((a) => a.id === accountId);
  if (!acc || !on || on >= acc.opening_on) return null;
  return <Alert tone="info" title={`${acc.name} starts counting on ${day(acc.opening_on)}`}>
    {what} came in before that, so it is taken as already in the account&apos;s opening balance: the balance will not go up again. {what === "The loan" ? "What you owe is still kept." : ""}
  </Alert>;
}

function Foot({ onClose, save, saving, disabled, label = "Save" }: { onClose: () => void; save: () => void; saving: boolean; disabled?: boolean; label?: string }) {
  return <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={disabled} onClick={save}>{label}</Button></>;
}

// ---- money in ------------------------------------------------------------------------------------------------

/** Money in other than a sale: the owner's own money, a grant, other income. Loans have their own form. */
export function MoneyInDialog({ open, onClose, onLoan }: { open: boolean; onClose: () => void; onLoan: () => void }) {
  const ws = useCurrentWorkspace();
  const me = useAuth().me;
  const cat = useFinanceCatalog();
  const add = useAddMoneyIn(ws.orgId);
  const toast = useToast();
  const blank = { kind: "capital", amount: "", account: "", on: localDay(), source: "", reference: "", note: "" };
  const [f, setF] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const evidence = useFormEvidence("money_in", { hint: "The bank alert, the grant letter or a receipt. Optional." });
  const resetEvidence = evidence.reset;
  useEffect(() => { if (open) { setF({ ...blank, source: me?.user.full_name ?? "" }); setError(null); resetEvidence(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const inProfit = cat.data?.money_in_in_profit.includes(f.kind);
  const save = async () => {
    setError(null);
    try {
      const m = await add.mutateAsync({ kind: f.kind, amount: Number(f.amount), account_id: f.account, received_on: f.on, source: f.source || null,
        reference: f.reference || null, note: f.note || null, client_id: newId() });
      await evidence.attach({ record_id: m.id }, m.number);
      toast(`${naira(m.amount)} into ${m.account_name}`); onClose();
    } catch (e) { setError(errMsg(e)); }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Money in" eyebrow="Finance"
      footer={<Foot onClose={onClose} save={save} saving={add.isPending} disabled={!(Number(f.amount) > 0) || !f.account} />}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-2">What is it?</span>
          <Segmented value={f.kind} onChange={(v) => setF({ ...f, kind: v })}
            options={[{ value: "capital", label: "My own money" }, { value: "grant", label: "Grant" }, { value: "other_income", label: "Other income" }]} />
          <p className="text-[12.5px] text-ink-3">
            {f.kind === "capital" ? "Money you put into the farm. It adds to the account; it is not income, so profit does not change."
              : inProfit ? "Counts as income in profit, under the whole farm." : ""}
            {" "}Borrowed money? <button type="button" className="cursor-pointer font-semibold text-brand" onClick={() => { onClose(); onLoan(); }}>Record a loan</button> so what you owe is kept.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₦)" htmlFor="mi-amount"><Input id="mi-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: dec(e.target.value) })} /></Field>
          <Field label="Date" htmlFor="mi-on"><Input id="mi-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        </div>
        <AccountField id="mi-account" label="Into which account" value={f.account} onChange={(v) => setF((x) => ({ ...x, account: v }))} />
        <BeforeStart accountId={f.account} on={f.on} what="This money" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From" htmlFor="mi-source" hint="Who it came from"><Input id="mi-source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></Field>
          <Field label="Reference" htmlFor="mi-ref" hint="Optional"><Input id="mi-ref" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="Transfer ref" /></Field>
        </div>
        <Field label="Note" htmlFor="mi-note" hint="Optional"><Input id="mi-note" maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        {evidence.field}
      </div>
    </Dialog>
  );
}

/** Recent money in, on the Cash and bank tab. */
export function MoneyInList({ onAdd }: { onAdd: () => void }) {
  const ws = useCurrentWorkspace();
  const q = useMoneyIn(ws.orgId);
  const rows = q.data ?? [];
  return (
    <Card title="Money in (not from sales)" meta="Your own money, loans received, grants and other income."
      action={ws.can("finance.edit") ? <Button size="sm" onClick={onAdd}><Plus size={14} /> Money in</Button> : undefined}>
      {q.isLoading ? <PageLoader /> : !rows.length ? <p className="text-[13.5px] text-ink-3">Nothing yet. Sales payments show under each account.</p> : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.slice(0, 20).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13.5px]">
              <span className="w-[86px] shrink-0 font-mono text-[12px] text-ink-3">{day(m.received_on)}</span>
              <span className="min-w-0 flex-1"><b>{m.kind_label}</b>{m.source ? ` · ${m.source}` : ""}
                <span className="block text-[12px] text-ink-3">{m.number} · into {m.account_name}{m.in_profit ? " · counts as income" : ""}</span></span>
              <span className="font-mono font-semibold text-good tnum">+{naira(m.amount)}</span>
              {!m.loan_id && <OwnerActions kind="money_in" id={m.id} compact />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---- loans -----------------------------------------------------------------------------------------------------

export function LoanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const cat = useFinanceCatalog();
  const add = useAddLoan(ws.orgId);
  const toast = useToast();
  const blank = { lender: "", amount: "", account: "", on: localDay(), rate: "", interest: "", each: "", frequency: "monthly", first: "", last: "", reference: "", note: "" };
  const [f, setF] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const evidence = useFormEvidence("loan", { hint: "The loan agreement or offer letter, and the repayment schedule. Optional." });
  const resetEvidence = evidence.reset;
  useEffect(() => { if (open) { setF(blank); setError(null); resetEvidence(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = (v: string) => (v ? Number(v) : null);
  const save = async () => {
    setError(null);
    try {
      const l = await add.mutateAsync({ lender: f.lender.trim(), amount: Number(f.amount), account_id: f.account, received_on: f.on, interest_rate_pct: n(f.rate),
        interest_total: n(f.interest), repayment_amount: n(f.each), frequency: f.frequency, first_due_on: f.first || null, final_due_on: f.last || null,
        reference: f.reference || null, note: f.note || null, client_id: newId() });
      await evidence.attach({ record_id: l.id }, l.number);
      toast(`${l.number}: ${naira(l.amount)} from ${l.lender} into ${l.account_name}`); onClose();
    } catch (e) { setError(errMsg(e)); }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Loan received" eyebrow="Finance" wide
      footer={<Foot onClose={onClose} save={save} saving={add.isPending} disabled={f.lender.trim().length < 2 || !(Number(f.amount) > 0) || !f.account} />}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <p className="text-[13px] text-ink-2">The money goes into the account but is not income. Each repayment is split: paying back the loan is not a cost, the interest is.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Lender" htmlFor="ln-lender"><Input id="ln-lender" value={f.lender} onChange={(e) => setF({ ...f, lender: e.target.value })} placeholder="LAPO Microfinance" /></Field>
          <Field label="Amount borrowed (₦)" htmlFor="ln-amount"><Input id="ln-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: dec(e.target.value) })} /></Field>
          <Field label="Received on" htmlFor="ln-on"><Input id="ln-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        </div>
        <AccountField id="ln-account" label="Paid into which account" value={f.account} onChange={(v) => setF((x) => ({ ...x, account: v }))} />
        <BeforeStart accountId={f.account} on={f.on} what="The loan" />
        <fieldset className="grid gap-4 rounded-xl border border-line p-3.5 sm:grid-cols-2">
          <legend className="px-1 text-[12.5px] font-semibold text-ink-2">Repayment terms (optional, for reminders)</legend>
          <Field label="Interest rate (% a year)" htmlFor="ln-rate"><Input id="ln-rate" inputMode="decimal" value={f.rate} onChange={(e) => setF({ ...f, rate: dec(e.target.value) })} /></Field>
          <Field label="Total interest agreed (₦)" htmlFor="ln-int" hint="If it is a fixed (flat) amount"><Input id="ln-int" inputMode="decimal" value={f.interest} onChange={(e) => setF({ ...f, interest: dec(e.target.value) })} /></Field>
          <Field label="Each repayment (₦)" htmlFor="ln-each"><Input id="ln-each" inputMode="decimal" value={f.each} onChange={(e) => setF({ ...f, each: dec(e.target.value) })} /></Field>
          <Field label="How often" htmlFor="ln-freq"><Select id="ln-freq" value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })}>
            {Object.entries(cat.data?.loan_frequencies ?? { monthly: "Every month" }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label={f.frequency === "once" ? "Due on" : "First repayment due"} htmlFor="ln-first"><Input id="ln-first" type="date" min={f.on} value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} /></Field>
          <Field label="Last repayment due" htmlFor="ln-last" hint="Optional"><Input id="ln-last" type="date" min={f.first || f.on} value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })} /></Field>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reference" htmlFor="ln-ref" hint="Optional"><Input id="ln-ref" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
          <Field label="Note" htmlFor="ln-note" hint="Optional"><Input id="ln-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </div>
        {evidence.field}
      </div>
    </Dialog>
  );
}

export function RepayDialog({ loan, onClose }: { loan: Loan | null; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const repay = useRepayLoan(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ on: localDay(), account: "", principal: "", interest: "", reference: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!loan) return;
    setError(null);
    // Suggest the instalment, split by the interest still to pay over the payments left (a flat loan), or all as the loan.
    const each = loan.next_amount ?? 0;
    const left = loan.interest_left ?? 0;
    const paymentsLeft = loan.repayment_amount ? Math.max(1, Math.ceil((loan.outstanding + left) / loan.repayment_amount)) : 1;
    const interest = Math.min(each, Math.round((left / paymentsLeft) * 100) / 100);
    setF({ on: localDay(), account: loan.account_id ?? "", principal: each ? String(Math.min(loan.outstanding, Math.round((each - interest) * 100) / 100)) : "",
      interest: interest ? String(interest) : "", reference: "" });
  }, [loan]);
  if (!loan) return null;
  const p = Number(f.principal) || 0, i = Number(f.interest) || 0;
  const save = async () => {
    setError(null);
    try {
      const l = await repay.mutateAsync({ id: loan.id, paid_on: f.on, account_id: f.account, principal: p, interest: i, reference: f.reference || null, client_id: newId() });
      toast(l.outstanding <= 0 ? `${l.lender}: fully repaid` : `${naira(p + i)} paid to ${l.lender}; ${naira(l.outstanding)} still owed`); onClose();
    } catch (e) { setError(errMsg(e)); }
  };
  return (
    <Dialog open onClose={onClose} title="Repayment" eyebrow={`${loan.number} · ${loan.lender}`}
      footer={<Foot onClose={onClose} save={save} saving={repay.isPending} disabled={!(p + i > 0) || !f.account || p > loan.outstanding + 0.009} label={`Pay ${naira(p + i)}`} />}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <p className="text-[13px] text-ink-2">{naira(loan.outstanding)} still owed{loan.interest_left ? `, and ${naira(loan.interest_left)} of the agreed interest` : ""}.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pays back the loan (₦)" htmlFor="rp-principal" hint="Not a cost"><Input id="rp-principal" inputMode="decimal" value={f.principal} onChange={(e) => setF({ ...f, principal: dec(e.target.value) })} /></Field>
          <Field label="Interest and charges (₦)" htmlFor="rp-interest" hint="A cost in profit"><Input id="rp-interest" inputMode="decimal" value={f.interest} onChange={(e) => setF({ ...f, interest: dec(e.target.value) })} /></Field>
          <Field label="Paid on" htmlFor="rp-on"><Input id="rp-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
          <Field label="Reference" htmlFor="rp-ref" hint="Optional"><Input id="rp-ref" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
        </div>
        <AccountField id="rp-account" label="Paid from" value={f.account} onChange={(v) => setF((x) => ({ ...x, account: v }))} />
        {p > loan.outstanding + 0.009 && <Alert tone="warn">Only {naira(loan.outstanding)} is still owed. Put the rest under interest and charges if it was a charge.</Alert>}
      </div>
    </Dialog>
  );
}

function Progress({ loan }: { loan: Loan }) {
  const pct = loan.amount ? Math.min(100, (loan.repaid / loan.amount) * 100) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
      aria-label={`${Math.round(pct)}% paid back`}>
      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </div>
  );
}

function DueBadge({ loan }: { loan: Loan }) {
  if (loan.outstanding <= 0) return <Badge tone="good">Repaid {loan.repaid_on ? day(loan.repaid_on) : ""}</Badge>;
  if (!loan.next_due_on) return null;
  return <Badge tone={loan.overdue ? "crit" : loan.due_soon ? "warn" : "neutral"}>{loan.overdue ? "Overdue: " : "Next: "}{loan.next_amount ? `${naira(loan.next_amount)} ` : ""}{loan.overdue ? "was due " : "on "}{day(loan.next_due_on)}</Badge>;
}

export function LoansPanel() {
  const ws = useCurrentWorkspace();
  const q = useLoans(ws.orgId);
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<Loan | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const edit = ws.can("finance.edit");
  const loans = q.data ?? [];
  const owed = loans.reduce((n, l) => n + l.outstanding, 0);
  return (
    <>
      <Card title="Loans" meta={loans.length ? `${naira(owed)} still owed on ${loans.filter((l) => l.outstanding > 0).length} loan${loans.filter((l) => l.outstanding > 0).length === 1 ? "" : "s"}` : undefined}
        action={edit ? <Button size="sm" variant="primary" onClick={() => setAdding(true)}><Plus size={14} /> Loan received</Button> : undefined}>
        {q.isLoading ? <PageLoader /> : !loans.length ? (
          <EmptyState icon={<Landmark size={22} />} title="No loans recorded"
            body="Record money borrowed for the farm: from a bank, a cooperative or family. Oko keeps what you still owe, splits each repayment into the loan and the interest, and shows when the next payment is due." />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {loans.map((l) => (
              <li key={l.id} className={cn("flex flex-col gap-2 py-3", l.outstanding <= 0 && "opacity-70")}>
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <button type="button" className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => setOpen(l.id)}>
                    <b className="text-[14.5px]">{l.lender}</b> <span className="font-mono text-[12px] text-ink-3">{l.number}</span>
                    <span className="block text-[12.5px] text-ink-3">Borrowed {naira(l.amount)} on {day(l.received_on)}{l.interest_rate_pct != null ? ` · ${l.interest_rate_pct}% a year` : ""}</span>
                  </button>
                  <div className="text-right"><div className="font-mono text-[15px] font-bold tnum">{naira(l.outstanding)}</div><div className="text-[12px] text-ink-3">still owed</div></div>
                </div>
                <Progress loan={l} />
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
                  <span>{naira(l.repaid)} paid back · {naira(l.interest_paid)} interest paid</span>
                  <DueBadge loan={l} />
                  {l.waiting_approval > 0 && <Badge tone="warn">{naira(l.waiting_approval)} waiting for approval</Badge>}
                  <span className="ml-auto flex items-center gap-1">
                    {edit && l.outstanding > 0 && <Button size="sm" onClick={() => setPaying(l)}>Repay</Button>}
                    <OwnerActions kind="loan" id={l.id} compact />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <LoanDialog open={adding} onClose={() => setAdding(false)} />
      <RepayDialog loan={paying} onClose={() => setPaying(null)} />
      {open && <LoanSheet id={open} onClose={() => setOpen(null)} onRepay={(l) => setPaying(l)} />}
    </>
  );
}

function LoanSheet({ id, onClose, onRepay }: { id: string; onClose: () => void; onRepay: (l: Loan) => void }) {
  const ws = useCurrentWorkspace();
  const cat = useFinanceCatalog();
  const q = useLoan(ws.orgId, id);
  const l = q.data;
  return (
    <Dialog open onClose={onClose} side title={l ? l.lender : "Loan"} eyebrow={l?.number}>
      {!l ? <PageLoader /> : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line p-3"><div className="text-[12px] text-ink-3">Still owed</div><div className="font-display text-[20px] font-bold tnum">{naira(l.outstanding)}</div></div>
            <div className="rounded-xl border border-line p-3"><div className="text-[12px] text-ink-3">Borrowed</div><div className="font-display text-[20px] font-bold tnum">{naira(l.amount)}</div>
              <div className="text-[12px] text-ink-3">{day(l.received_on)} into {l.account_name}</div></div>
          </div>
          <Progress loan={l} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            <dt className="text-ink-3">Paid back</dt><dd className="tnum">{naira(l.repaid)}</dd>
            <dt className="text-ink-3">Interest paid</dt><dd className="tnum">{naira(l.interest_paid)}{l.interest_left != null ? ` (${naira(l.interest_left)} of the agreed interest left)` : ""}</dd>
            {l.repayment_amount != null && <><dt className="text-ink-3">Repayments</dt><dd>{naira(l.repayment_amount)} {(cat.data?.loan_frequencies[l.frequency] ?? l.frequency).toLowerCase()}</dd></>}
            {l.final_due_on && <><dt className="text-ink-3">Last payment due</dt><dd>{day(l.final_due_on)}</dd></>}
          </dl>
          <div className="flex flex-wrap items-center gap-2"><DueBadge loan={l} />
            {ws.can("finance.edit") && l.outstanding > 0 && <Button size="sm" variant="primary" onClick={() => onRepay(l)}>Repay</Button>}
            <OwnerActions kind="loan" id={l.id} onDeleted={onClose} />
          </div>
          {l.overdue && <Alert tone="crit" title={`A payment was due on ${day(l.next_due_on!)}`}>Record it if it was paid, so what you owe stays right.</Alert>}
          <section>
            <h3 className="eyebrow mb-2">Repayments</h3>
            {!l.repayments.length ? <p className="text-[13.5px] text-ink-3">None yet.</p> : (
              <ul className="flex flex-col divide-y divide-line">
                {l.repayments.map((r) => (
                  <li key={r.group_id} className="flex flex-wrap items-center gap-x-3 py-2 text-[13px]">
                    <span className="w-[86px] font-mono text-[12px] text-ink-3">{r.paid_on ? day(r.paid_on) : "—"}</span>
                    <span className="min-w-0 flex-1">{naira(r.principal)} loan{r.interest ? ` + ${naira(r.interest)} interest` : ""}
                      <span className="block text-[12px] text-ink-3">{r.numbers.join(", ")}{r.account_name ? ` · from ${r.account_name}` : ""}</span></span>
                    {r.status !== "approved" && <Badge tone="warn">{r.status === "pending" ? "Waiting for approval" : "Rejected"}</Badge>}
                    <span className="font-mono font-semibold tnum">−{naira(r.principal + r.interest)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[12px] text-ink-3">To correct a repayment, open it under Expenses.</p>
          </section>
        </div>
      )}
    </Dialog>
  );
}

/** On the Finance overview: what is owed on loans and the next payment. */
export function LoansCard({ loans, onOpen }: { loans: LoansOwed; onOpen: () => void }) {
  if (!loans.loans) return null;
  return (
    <button type="button" onClick={onOpen} className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-surface p-4 text-left hover:shadow-[var(--shadow)]">
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", loans.overdue ? "bg-crit-soft text-crit" : "bg-brand-soft text-brand")}>
        {loans.overdue ? <AlertTriangle size={17} /> : <ArrowDownLeft size={17} />}</span>
      <span className="min-w-0 flex-1 text-[13.5px]"><b>{naira(loans.owed)} owed on {loans.loans} loan{loans.loans > 1 ? "s" : ""}</b>
        {loans.next_due_on && <span className="block text-ink-2">{loans.overdue ? "Overdue: " : "Next: "}{loans.next_amount ? naira(loans.next_amount) : "a payment"} to {loans.next_lender} {loans.overdue ? "was due" : "on"} {day(loans.next_due_on)}</span>}</span>
    </button>
  );
}
