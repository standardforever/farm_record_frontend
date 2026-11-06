"use client";

import { useEffect, useRef, useState } from "react";
import { type CorrectionKind, OwnerActions } from "@/features/corrections";
import { Camera, Plus, X } from "lucide-react";
import { Alert, Badge, Button, Dialog, Field, Input, PageLoader, Pager, Segmented, Select, Textarea, useSlice, useToast } from "@/components/ui";
import { useBatches } from "@/features/batches";
import { localDay, uploadPhoto } from "@/features/daily/api";
import { shrinkPhoto } from "@/features/daily/device";
import { useFormEvidence } from "@/features/evidence/useFormEvidence";
import { newId } from "@/features/offline/queue";
import { useFarmMap } from "@/features/farm";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, naira } from "@/lib/format";
import {
  type Account, type Employee, day, monthRange, useAccounts, useAddExpense, useFinance, useFinanceCatalog, useReconcile, useReconciliations, useSaveAccount,
  useSaveEmployee, useStatement, useTransfer,
} from "./api";

/** Which record each statement line is, for owner corrections. */
const LINE_KIND: Record<string, CorrectionKind> = { receipt: "payment", expense: "expense", payroll: "pay_run", transfer_in: "account_transfer", transfer_out: "account_transfer" };

const dec = (v: string) => v.replace(/[^\d.-]/g, "");
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Could not save.");

function Shell({ open, onClose, title, children, save, saving, disabled, error, label = "Save", wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; save: () => void; saving: boolean; disabled?: boolean; error: string | null; label?: string; wide?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} eyebrow="Finance" wide={wide}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={disabled} onClick={save}>{label}</Button></>}>
      <div className="flex flex-col gap-4">{error && <Alert tone="crit">{error}</Alert>}{children}</div>
    </Dialog>
  );
}

/** Money out: what for, how much, charged to what, paid from where (or still owed). */
export function ExpenseDialog({ open, onClose, batchId }: { open: boolean; onClose: () => void; batchId?: string }) {
  const ws = useCurrentWorkspace();
  const cat = useFinanceCatalog();
  const accounts = useAccounts(ws.orgId, open);
  const batches = useBatches(ws.orgId, "active", open);
  const farm = useFarmMap(ws.orgId, false, open && ws.can("farm.view"));
  const add = useAddExpense(ws.orgId);
  const limit = useFinance(ws.orgId, open && ws.can("finance.view")).data?.approval_limit;
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const blank = { on: localDay(), category: "fuel", description: "", amount: "", payee: "", charge: "farm", batch: "", unit: "", account: "", paid: "now", reference: "" };
  const [f, setF] = useState(blank);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const evidence = useFormEvidence("expense", { hint: "Anything beyond the receipt photo: the invoice as a PDF, a quotation, a link. Optional." });
  useEffect(() => {
    if (!open) return;
    setError(null); setPhoto(null); evidence.reset();
    setF({ ...blank, charge: batchId ? "batch" : "farm", batch: batchId ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, batchId]);
  useEffect(() => { if (open && !f.account && accounts.data?.length) setF((x) => ({ ...x, account: accounts.data!.find((a) => a.kind === "cash")?.id ?? accounts.data![0].id })); }, [open, accounts.data, f.account]);
  const units = (farm.data?.sites ?? []).flatMap((s) => s.units.filter((u) => !u.archived_at));
  const cashOnly = cat.data?.cash_only[f.category];
  const amount = Number(f.amount) || 0;
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const media_id = photo ? (await uploadPhoto(ws.orgId, photo.blob, newId())).id : null;
      const e = await add.mutateAsync({ spent_on: f.on, category: f.category, description: f.description.trim(), amount, payee: f.payee || null,
        batch_id: f.charge === "batch" ? f.batch || null : null, unit_id: f.charge === "unit" ? f.unit || null : null,
        account_id: f.paid === "now" ? f.account || null : null, reference: f.reference || null, media_id, client_id: newId() });
      await evidence.attach({ record_id: e.id }, e.number);
      toast(e.status === "pending" ? `${e.number} saved. It waits for approval (over the limit).` : `${e.number}: ${naira(e.amount)} recorded`);
      onClose();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Shell open={open} onClose={onClose} title="Record an expense" save={save} saving={busy} error={error}
      disabled={f.description.trim().length < 2 || !amount || (f.charge === "batch" && !f.batch) || (f.charge === "unit" && !f.unit) || (f.paid === "now" && !f.account)}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
        <Field label="What for" htmlFor="x-cat" hint={cashOnly ? `Not counted as a cost: ${cashOnly}.` : undefined}>
          <Select id="x-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <optgroup label="Running costs">{Object.entries(cat.data?.expense_categories ?? {}).filter(([k]) => !cat.data?.cash_only[k]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</optgroup>
            <optgroup label="Money out, not a running cost">{Object.entries(cat.data?.expense_categories ?? {}).filter(([k]) => cat.data?.cash_only[k]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</optgroup>
          </Select></Field>
        <Field label="Amount (₦)" htmlFor="x-amount"><Input id="x-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Description" htmlFor="x-desc" className="sm:col-span-2"><Input id="x-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Diesel for the generator, 20 litres" /></Field>
        <Field label="Date" htmlFor="x-on"><Input id="x-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] font-semibold text-ink-2">Charge it to</span>
        <Segmented value={f.charge} onChange={(v) => setF({ ...f, charge: v })} options={[{ value: "farm", label: "Whole farm" }, { value: "batch", label: "A batch" }, { value: "unit", label: "A unit" }]} />
        {f.charge === "batch" && <Select aria-label="Batch" value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })}>
          <option value="">Choose a batch</option>{batches.data?.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.species}</option>)}</Select>}
        {f.charge === "unit" && <Select aria-label="Unit" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
          <option value="">Choose a unit</option>{units.map((u) => <option key={u.id} value={u.id}>{u.code}{u.name ? ` · ${u.name}` : ""}</option>)}</Select>}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] font-semibold text-ink-2">Paid?</span>
        <Segmented value={f.paid} onChange={(v) => setF({ ...f, paid: v })} options={[{ value: "now", label: "Paid" }, { value: "owed", label: "Not yet (we owe it)" }]} />
        {f.paid === "now" && (accounts.data?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select aria-label="Paid from" value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })}>
              {accounts.data.map((a) => <option key={a.id} value={a.id}>From {a.name} ({naira(a.balance)})</option>)}</Select>
            <Input aria-label="Reference" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="Transfer ref (optional)" />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-maize-soft px-3 py-2 text-[13px]">
            <span className="flex-1">Which account was it paid from? Add your bank account, cash box or mobile money once.</span>
            <Button size="sm" onClick={() => setAddingAccount(true)}><Plus size={14} /> Add an account</Button>
          </div>
        ))}
        <AccountDialog open={addingAccount} onClose={async () => {
          setAddingAccount(false);
          const r = await accounts.refetch();
          if (r.data?.length) setF((x) => ({ ...x, account: x.account || r.data![0].id }));
        }} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paid to" htmlFor="x-payee" hint="Optional"><Input id="x-payee" value={f.payee} onChange={(e) => setF({ ...f, payee: e.target.value })} /></Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-2">Receipt</span>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Photo of the receipt"
            onChange={async (e) => { const file = e.target.files?.[0]; if (file) { try { const blob = await shrinkPhoto(file); setPhoto({ blob, url: URL.createObjectURL(blob) }); } catch (x) { setError((x as Error).message); } } }} />
          {photo ? <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="Receipt" className="h-16 rounded-lg border border-line" />
            <button type="button" aria-label="Remove photo" onClick={() => setPhoto(null)} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--scrim)] text-white"><X size={13} /></button>
          </div> : <div><Button size="sm" onClick={() => fileRef.current?.click()}><Camera size={15} /> Photo of the receipt</Button></div>}
        </div>
      </div>
      {evidence.field}
      {!ws.can("finance.approve") && limit != null && amount > limit && <Alert tone="warn">Over {naira(limit)}, so it waits for someone who can approve spending.</Alert>}
    </Shell>
  );
}

export function AccountDialog({ open, onClose, account }: { open: boolean; onClose: () => void; account?: Account | null }) {
  const ws = useCurrentWorkspace();
  const cat = useFinanceCatalog();
  const save = useSaveAccount(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ name: "", kind: "bank", bank_name: "", account_number: "", opening_balance: "", opening_on: localDay() });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setError(null);
    setF(account ? { name: account.name, kind: account.kind, bank_name: account.bank_name ?? "", account_number: account.account_number ?? "",
      opening_balance: String(account.opening_balance), opening_on: account.opening_on } : { name: "", kind: "bank", bank_name: "", account_number: "", opening_balance: "", opening_on: monthRange().start });
  }, [open, account]);
  return (
    <Shell open={open} onClose={onClose} title={account ? `Edit ${account.name}` : "Add a money account"} saving={save.isPending} error={error}
      disabled={f.name.trim().length < 2} save={async () => {
        setError(null);
        try {
          await save.mutateAsync(account ? { id: account.id, name: f.name.trim(), bank_name: f.bank_name || null, account_number: f.account_number || null }
            : { name: f.name.trim(), kind: f.kind as Account["kind"], bank_name: f.bank_name || null, account_number: f.account_number || null,
              opening_balance: Number(f.opening_balance) || 0, opening_on: f.opening_on });
          toast(account ? "Saved" : `Added ${f.name}`); onClose();
        } catch (e) { setError(errMsg(e)); }
      }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="a-name"><Input id="a-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="GTBank current" /></Field>
        <Field label="Type" htmlFor="a-kind"><Select id="a-kind" disabled={!!account} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          {Object.entries(cat.data?.account_kinds ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        {f.kind !== "cash" && <><Field label="Bank or provider" htmlFor="a-bank"><Input id="a-bank" value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} /></Field>
          <Field label="Account number" htmlFor="a-num" hint="Optional"><Input id="a-num" inputMode="numeric" value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value.replace(/\D/g, "") })} /></Field></>}
      </div>
      {!account && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Balance at the start (₦)" htmlFor="a-open" hint="From the statement or a count of the cash"><Input id="a-open" inputMode="decimal" value={f.opening_balance} onChange={(e) => setF({ ...f, opening_balance: dec(e.target.value) })} /></Field>
          <Field label="On" htmlFor="a-on" hint="Oko counts money from this day"><Input id="a-on" type="date" max={localDay()} value={f.opening_on} onChange={(e) => setF({ ...f, opening_on: e.target.value })} /></Field>
        </div>
      )}
    </Shell>
  );
}

export function TransferDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const accounts = useAccounts(ws.orgId, open);
  const transfer = useTransfer(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ from: "", to: "", amount: "", on: localDay(), note: "" });
  const [error, setError] = useState<string | null>(null);
  const evidence = useFormEvidence("account_transfer", { hint: "The bank teller or the transfer alert. Optional." });
  const resetEvidence = evidence.reset;
  useEffect(() => {
    if (!open || !accounts.data) return;
    setError(null); resetEvidence();
    const cash = accounts.data.find((a) => a.kind === "cash"), bank = accounts.data.find((a) => a.kind === "bank");
    setF({ from: cash?.id ?? "", to: bank?.id ?? "", amount: "", on: localDay(), note: "" });
  }, [open, accounts.data, resetEvidence]);
  return (
    <Shell open={open} onClose={onClose} title="Move money between accounts" saving={transfer.isPending} error={error} label="Save"
      disabled={!f.from || !f.to || f.from === f.to || !Number(f.amount)} save={async () => {
        setError(null);
        try {
          const t = await transfer.mutateAsync({ from_account_id: f.from, to_account_id: f.to, amount: Number(f.amount), moved_on: f.on, note: f.note || null });
          await evidence.attach({ record_id: t.id }, "transfer between accounts");
          toast("Moved"); onClose();
        }
        catch (e) { setError(errMsg(e)); }
      }}>
      <p className="text-[13px] text-ink-3">For example, cash taken to the bank. It is not income or a cost.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" htmlFor="t-from"><Select id="t-from" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}><option value="">Choose…</option>{accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.name} ({naira(a.balance)})</option>)}</Select></Field>
        <Field label="To" htmlFor="t-to"><Select id="t-to" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}><option value="">Choose…</option>{accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Amount (₦)" htmlFor="t-amount"><Input id="t-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} /></Field>
        <Field label="On" htmlFor="t-on"><Input id="t-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
      </div>
      <Field label="Note" htmlFor="t-note" hint="Optional"><Input id="t-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Teller no. 0041" /></Field>
      {evidence.field}
    </Shell>
  );
}

/** One account: statement for a month with running balance, and the check against the bank statement. */
export function AccountSheet({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const [offset, setOffset] = useState(0);
  const range = monthRange(offset);
  const st = useStatement(ws.orgId, account?.id ?? null, range.start, range.end);
  const recs = useReconciliations(ws.orgId, account?.id ?? null);
  const reconcile = useReconcile(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ balance: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setOffset(0); setF({ balance: "", note: "" }); setError(null); }, [account?.id]);
  const lines = useSlice(st.data?.lines, 20, [account?.id, offset]);
  if (!account) return null;
  const asOf = offset === 0 ? localDay() : range.end;
  const d = st.data;
  const typed = f.balance === "" ? null : Number(f.balance);
  const diff = typed == null || !d ? null : Math.round((typed - d.closing) * 100) / 100;
  return (
    <Dialog open={!!account} onClose={onClose} side title={account.name} eyebrow="Money account">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOffset(offset - 1)}>‹ Earlier</Button>
          <b className="text-[14px]">{new Date(range.start + "T12:00:00").toLocaleDateString("en-NG", { month: "long", year: "numeric" })}</b>
          <Button size="sm" variant="ghost" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>Later ›</Button>
        </div>
        {!d ? <PageLoader /> : (
          <>
            <dl className="grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-xl border border-line p-2.5"><dt className="text-ink-3">Start of month</dt><dd className="font-mono font-semibold tnum">{naira(d.opening)}</dd></div>
              <div className="rounded-xl border border-line p-2.5"><dt className="text-ink-3">End of month</dt><dd className="font-mono font-semibold tnum">{naira(d.closing)}</dd></div>
              <div className="rounded-xl border border-line p-2.5"><dt className="text-ink-3">Money in</dt><dd className="font-mono font-semibold text-good tnum">+{naira(d.money_in)}</dd></div>
              <div className="rounded-xl border border-line p-2.5"><dt className="text-ink-3">Money out</dt><dd className="font-mono font-semibold text-crit tnum">−{naira(d.money_out)}</dd></div>
            </dl>
            {d.unassigned_receipts > 0 && <Alert tone="warn">{naira(d.unassigned_receipts)} of sales payments this month are not linked to any account. Choose the account when recording payments.</Alert>}
            <section className="rounded-xl border border-line p-3">
              <h3 className="text-[13.5px] font-bold">Check against the bank statement</h3>
              <p className="text-[12.5px] text-ink-3">Oko says {naira(d.closing)} on {day(asOf)}. Type what the {account.kind === "cash" ? "cash count" : "statement"} says.</p>
              {error && <div className="mt-2"><Alert tone="crit">{error}</Alert></div>}
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input aria-label="Statement balance" inputMode="decimal" value={f.balance} onChange={(e) => setF({ ...f, balance: dec(e.target.value) })} placeholder="Statement balance (₦)" />
                <Button variant="primary" loading={reconcile.isPending} disabled={typed == null} onClick={async () => {
                  setError(null);
                  try { const r = await reconcile.mutateAsync({ id: account.id, as_of: asOf, statement_balance: typed!, note: f.note || null }); toast(r.difference === 0 ? "Matches the statement" : `Saved: ${naira(r.difference)} difference`); setF({ balance: "", note: "" }); }
                  catch (e) { setError(errMsg(e)); }
                }}>Save check</Button>
              </div>
              {diff != null && <p role="status" className={cn("mt-2 text-[13px] font-semibold", diff === 0 ? "text-good" : "text-crit")}>
                {diff === 0 ? "✓ Matches" : `${naira(Math.abs(diff))} ${diff > 0 ? "more" : "less"} in the ${account.kind === "cash" ? "box" : "bank"} than in Oko. Look for something not recorded (bank charges, a payment).`}</p>}
              {diff != null && diff !== 0 && <Textarea aria-label="Note" className="mt-2" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="What explains it (optional)" />}
              {recs.data?.length ? <ul className="mt-2 text-[12px] text-ink-3">{recs.data.slice(0, 3).map((r) => <li key={r.id}>{day(r.as_of)}: {r.difference === 0 ? "matched" : `${naira(r.difference)} difference`} · {r.created_by_name}</li>)}</ul> : null}
            </section>
            <ul className="flex flex-col divide-y divide-line">
              {d.lines.length === 0 && <li className="py-2 text-[13px] text-ink-3">Nothing moved this month.</li>}
              {lines.rows.map((x) => (
                <li key={`${x.kind}-${x.source_id}`} className="flex items-start gap-3 py-2 text-[13px]">
                  <span className="w-[48px] shrink-0 font-mono text-[12px] text-ink-3">{new Date(x.on + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span>
                  <span className="min-w-0 flex-1">{x.description}{x.reference && <span className="block text-[11.5px] text-ink-3">{x.reference}</span>}</span>
                  <span className="text-right"><span className={cn("block font-mono font-semibold tnum", x.amount > 0 ? "text-good" : "text-crit")}>{x.amount > 0 ? "+" : "−"}{naira(Math.abs(x.amount))}</span>
                    <span className="font-mono text-[11.5px] text-ink-3 tnum">{naira(x.balance)}</span></span>
                  {LINE_KIND[x.kind] && <OwnerActions kind={LINE_KIND[x.kind]} id={x.source_id} compact edit={x.kind !== "payroll"} />}
                </li>
              ))}
            </ul>
            <Pager {...lines.pager} noun="entries" />
          </>
        )}
      </div>
    </Dialog>
  );
}

export function EmployeeDialog({ open, onClose, employee }: { open: boolean; onClose: () => void; employee?: Employee | null }) {
  const ws = useCurrentWorkspace();
  const save = useSaveEmployee(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ name: "", phone: "", job_title: "", pay_basis: "monthly", rate: "", bank_name: "", account_number: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setError(null);
    setF(employee ? { name: employee.name, phone: employee.phone ?? "", job_title: employee.job_title ?? "", pay_basis: employee.pay_basis, rate: String(employee.rate),
      bank_name: employee.bank_name ?? "", account_number: employee.account_number ?? "" } : { name: "", phone: "", job_title: "", pay_basis: "monthly", rate: "", bank_name: "", account_number: "" });
  }, [open, employee]);
  return (
    <Shell open={open} onClose={onClose} title={employee ? `Edit ${employee.name}` : "Add to payroll"} saving={save.isPending} error={error}
      disabled={f.name.trim().length < 2 || !Number(f.rate)} save={async () => {
        setError(null);
        try {
          await save.mutateAsync({ ...(employee ? { id: employee.id } : {}), name: f.name.trim(), phone: f.phone || null, job_title: f.job_title || null,
            pay_basis: f.pay_basis as Employee["pay_basis"], rate: Number(f.rate), bank_name: f.bank_name || null, account_number: f.account_number || null });
          toast(employee ? "Saved" : `Added ${f.name}`); onClose();
        } catch (e) { setError(errMsg(e)); }
      }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="e-name"><Input id="e-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Job" htmlFor="e-job" hint="Optional"><Input id="e-job" value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} placeholder="Pond attendant" /></Field>
        <Field label="Paid" htmlFor="e-basis"><Select id="e-basis" value={f.pay_basis} onChange={(e) => setF({ ...f, pay_basis: e.target.value })}><option value="monthly">Monthly salary</option><option value="daily">Per day worked</option></Select></Field>
        <Field label={f.pay_basis === "daily" ? "Per day (₦)" : "Per month (₦)"} htmlFor="e-rate"><Input id="e-rate" inputMode="decimal" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value.replace(/[^\d.]/g, "") })} /></Field>
        <Field label="Phone" htmlFor="e-phone" hint="Optional"><Input id="e-phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Bank and account no." htmlFor="e-bank" hint="Optional"><div className="flex gap-2"><Input id="e-bank" value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} placeholder="Bank" />
          <Input aria-label="Account number" inputMode="numeric" value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value.replace(/\D/g, "") })} placeholder="0123456789" /></div></Field>
      </div>
    </Shell>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return status === "pending" ? <Badge tone="warn">Waiting for approval</Badge> : status === "rejected" ? <Badge tone="crit">Rejected</Badge> : null;
}
