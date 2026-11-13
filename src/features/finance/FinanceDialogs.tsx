"use client";

import { useEffect, useRef, useState } from "react";
import { type CorrectionKind, OwnerActions } from "@/features/corrections";
import { Camera, Plus, X } from "lucide-react";
import { Alert, Badge, Button, Dialog, Field, Input, PageLoader, Pager, Segmented, Select, Textarea, useSlice, useToast } from "@/components/ui";
import { useBatches } from "@/features/batches";
import { localDay, uploadPhoto } from "@/features/daily/api";
import { shrinkPhoto } from "@/features/daily/device";
import { useFormEvidence } from "@/features/evidence/useFormEvidence";
import { AccountStartNote } from "./AccountStartNote";
import { newId } from "@/features/offline/queue";
import { useCatalog, useFarmMap } from "@/features/farm";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, naira } from "@/lib/format";
import {
  type Account, type Employee, day, monthRange, useAccounts, useAddExpense, useFinance, useFinanceCatalog, useReconcile, useReconciliations, useSaveAccount,
  useSaveEmployee, useStatement, useTransfer, useChargeExpense, type Expense, type WorksOn,
} from "./api";

/** Which record each statement line is, for owner corrections. */
const LINE_KIND: Record<string, CorrectionKind> = { receipt: "payment", expense: "expense", payroll: "pay_run", transfer_in: "account_transfer", transfer_out: "account_transfer", money_in: "money_in" };

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
  const blank = { on: localDay(), category: "fuel", description: "", amount: "", payee: "", charge: "farm", picked: [] as string[], split: "even", parts: {} as Record<string, string>, account: "", paid: "now", reference: "", from: "", to: "" };
  const [f, setF] = useState(blank);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const evidence = useFormEvidence("expense", { hint: "Anything beyond the receipt photo: the invoice as a PDF, a quotation, a link. Optional." });
  useEffect(() => {
    if (!open) return;
    setError(null); setPhoto(null); evidence.reset();
    setF({ ...blank, charge: batchId ? "batch" : "farm", picked: batchId ? [batchId] : [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, batchId]);
  useEffect(() => { if (open && !f.account && accounts.data?.length) setF((x) => ({ ...x, account: accounts.data!.find((a) => a.kind === "cash")?.id ?? accounts.data![0].id })); }, [open, accounts.data, f.account]);
  const units = (farm.data?.sites ?? []).flatMap((s) => s.units.filter((u) => !u.archived_at));
  const cashOnly = cat.data?.cash_only[f.category];
  const amount = Number(f.amount) || 0;
  const choices: Choice[] = f.charge === "batch" ? (batches.data ?? []).map((b) => ({ id: b.id, code: b.code, sub: b.species, head: b.current }))
    : f.charge === "unit" ? units.map((u) => ({ id: u.id, code: u.code, sub: u.name ?? "", size: u.area_m2 ?? u.volume_m3, area: u.area_m2 != null })) : [];
  const picked = choices.filter((c) => f.picked.includes(c.id));
  const many = picked.length > 1;
  const split = shareOut(amount, picked, f.split, f.parts);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const media_id = photo ? (await uploadPhoto(ws.orgId, photo.blob, newId())).id : null;
      const covers = f.category === "rent" && f.from && f.to ? { covers_from: f.from, covers_to: f.to } : {};
      const e = await add.mutateAsync({ ...covers, spent_on: f.on, category: f.category, description: f.description.trim(), amount, payee: f.payee || null,
        ...(f.charge === "batch" ? { batch_ids: f.picked } : f.charge === "unit" ? { unit_ids: f.picked } : {}),
        ...(many ? { split: f.split, ...(f.split === "amounts" ? { split_amounts: Object.fromEntries(picked.map((c) => [c.id, Number(f.parts[c.id]) || 0])) } : {}) } : {}),
        account_id: f.paid === "now" ? f.account || null : null, reference: f.reference || null, media_id, client_id: newId() });
      await evidence.attach({ record_id: e.id }, e.number);
      toast(e.status === "pending" ? `${e.number} saved. It waits for approval (over the limit).` : `${e.number}: ${naira(e.amount)} recorded`);
      onClose();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Shell open={open} onClose={onClose} title="Record an expense" save={save} saving={busy} error={error}
      disabled={f.description.trim().length < 2 || !amount || (f.charge !== "farm" && !picked.length) || (many && !!split.problem) || (f.paid === "now" && !f.account)}>
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
        <Segmented value={f.charge} onChange={(v) => setF({ ...f, charge: v, picked: [], split: "even", parts: {} })}
          options={[{ value: "farm", label: "Whole farm" }, { value: "batch", label: "Batches" }, { value: "unit", label: "Houses, ponds or pens" }]} />
        {f.charge !== "farm" && <SharePicker kind={f.charge as "batch" | "unit"} choices={choices} picked={f.picked} split={f.split} parts={f.parts}
          result={split} onChange={(x) => setF({ ...f, ...x })} />}
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
        {f.paid === "now" && <AccountStartNote accountId={f.account} on={f.on} flow="out" />}
        {f.category === "rent" && (
          <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
            <span className="text-[13px] font-semibold">Paid ahead for a period? <span className="font-normal text-ink-3">(optional)</span></span>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="It covers from" htmlFor="x-from"><Input id="x-from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
              <Field label="Until" htmlFor="x-to"><Input id="x-to" type="date" min={f.from} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
            </div>
            <p className="text-[12px] text-ink-3">Profit then counts it month by month over that time. For a site&apos;s rent, &ldquo;Pay rent&rdquo; on the farm map fills this in.</p>
          </div>
        )}
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
            {!!d.before_start?.length && (
              <Alert tone="warn" title={`${d.before_start.length} record${d.before_start.length > 1 ? "s are" : " is"} dated before this account starts counting (${d.account.opening_on})`}>
                <p className="mb-1.5">They are taken as already in the opening balance, so they do not change it. If one happened on or after that day, correct its date.</p>
                <ul className="flex flex-col gap-1">{d.before_start.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-2"><span className="font-mono text-[12px]">{x.on}</span>
                    <span className="min-w-0 flex-1">{x.number} · {x.description}</span><span className="font-mono tnum">{naira(x.amount)}</span>
                    <OwnerActions kind={x.kind} id={x.id} compact evidence={false} /></li>))}</ul>
              </Alert>
            )}
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
  const [works, setWorks] = useState<WorksOn>({ kind: "farm" });
  const active = useBatches(ws.orgId, "active", open);
  const closed = useBatches(ws.orgId, "closed", open);
  const farm = useFarmMap(ws.orgId, false, open && ws.can("farm.view"));
  const names = useCatalog();
  const kinds = [...new Set([...(active.data ?? []), ...(closed.data ?? [])].map((b) => b.species))];
  const speciesChoices = kinds.length ? kinds : ["catfish", "broilers", "layers"];
  const unitChoices = (farm.data?.sites ?? []).flatMap((x) => x.units.filter((u) => !u.archived_at));
  const toggle = (list: string[] | undefined, v: string) => (list ?? []).includes(v) ? (list ?? []).filter((x) => x !== v) : [...(list ?? []), v];
  const worksOk = works.kind === "farm" || (works.kind === "species" ? !!works.species?.length : !!works.unit_ids?.length);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setError(null);
    setF(employee ? { name: employee.name, phone: employee.phone ?? "", job_title: employee.job_title ?? "", pay_basis: employee.pay_basis, rate: String(employee.rate),
      bank_name: employee.bank_name ?? "", account_number: employee.account_number ?? "" } : { name: "", phone: "", job_title: "", pay_basis: "monthly", rate: "", bank_name: "", account_number: "" });
    setWorks(employee?.works_on ?? { kind: "farm" });
  }, [open, employee]);
  return (
    <Shell open={open} onClose={onClose} title={employee ? `Edit ${employee.name}` : "Add to payroll"} saving={save.isPending} error={error}
      disabled={f.name.trim().length < 2 || !Number(f.rate) || !worksOk} save={async () => {
        setError(null);
        try {
          await save.mutateAsync({ ...(employee ? { id: employee.id } : {}), name: f.name.trim(), phone: f.phone || null, job_title: f.job_title || null,
            pay_basis: f.pay_basis as Employee["pay_basis"], rate: Number(f.rate), bank_name: f.bank_name || null, account_number: f.account_number || null,
            works_on: works.kind === "farm" ? { kind: "farm" } : works.kind === "species" ? { kind: "species", species: works.species } : { kind: "units", unit_ids: works.unit_ids } });
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
      <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
        <span className="text-[13px] font-semibold">Looks after</span>
        <Segmented value={works.kind} onChange={(v) => setWorks({ kind: v as WorksOn["kind"], species: [], unit_ids: [] })}
          options={[{ value: "farm", label: "The whole farm" }, { value: "species", label: "Kinds of animals" }, { value: "units", label: "Houses, ponds or pens" }]} />
        {works.kind === "species" && <Chips label="Animals" items={speciesChoices.map((k) => ({ id: k, label: names.data?.purposes[k] ?? k }))}
          on={works.species ?? []} toggle={(k) => setWorks({ ...works, species: toggle(works.species, k) })} />}
        {works.kind === "units" && <Chips label="Units" items={unitChoices.map((u) => ({ id: u.id, label: u.code, sub: u.name ?? undefined }))}
          on={works.unit_ids ?? []} toggle={(k) => setWorks({ ...works, unit_ids: toggle(works.unit_ids, k) })} />}
        <p className="text-[12.5px] text-ink-3">{works.kind === "farm"
          ? "Their pay is a whole-farm cost, shared by the batches running each month by how many animals each had and for how long."
          : "Each month, their pay goes to the batches they looked after, by how many animals each had and for how long. It is part of those batches' costs and results."}</p>
      </div>
    </Shell>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return status === "pending" ? <Badge tone="warn">Waiting for approval</Badge> : status === "rejected" ? <Badge tone="crit">Rejected</Badge> : null;
}


function Chips({ label, items, on, toggle }: { label: string; items: { id: string; label: string; sub?: string }[]; on: string[]; toggle: (id: string) => void }) {
  if (!items.length) return <p className="text-[12.5px] text-ink-3">Nothing to choose yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {items.map((c) => {
        const sel = on.includes(c.id);
        return (
          <button key={c.id} type="button" aria-pressed={sel} onClick={() => toggle(c.id)}
            className={cn("rounded-lg border px-2.5 py-1 text-[13px] transition-colors", sel ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line hover:bg-surface-2")}>
            {c.label}{c.sub ? <span className="font-normal text-ink-3"> · {c.sub}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Change what a recorded expense is charged to: the whole farm, or one or several batches or houses/ponds/pens,
 * shared out. The payment itself does not change. */
export function ChargeDialog({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const open = !!expense;
  const active = useBatches(ws.orgId, "active", open);
  const closed = useBatches(ws.orgId, "closed", open);
  const farm = useFarmMap(ws.orgId, false, open && ws.can("farm.view"));
  const charge = useChargeExpense(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ charge: "farm", picked: [] as string[], split: "even", parts: {} as Record<string, string>, reason: "" });
  const [error, setError] = useState<string | null>(null);
  const opened = expense?.id ?? null;
  useEffect(() => {
    if (!expense) return;
    setError(null);
    const sh = expense.shares ?? [];
    const kind = sh.length ? sh[0].kind : expense.batch_id ? "batch" : expense.unit_id ? "unit" : "farm";
    const ids = sh.length ? sh.map((x) => x.id) : expense.batch_id ? [expense.batch_id] : expense.unit_id ? [expense.unit_id] : [];
    setF({ charge: kind, picked: ids, split: sh.length ? "amounts" : "even",
      parts: Object.fromEntries(sh.map((x) => [x.id, String(x.amount)])), reason: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);
  const units = (farm.data?.sites ?? []).flatMap((s) => s.units.filter((u) => !u.archived_at));
  // Running batches, plus any closed one this expense already touches (an old cost can still belong to a finished batch).
  const bs = [...(active.data ?? []), ...(closed.data ?? []).filter((b) => f.picked.includes(b.id) || (closed.data ?? []).length <= 12)];
  const choices: Choice[] = f.charge === "batch" ? bs.map((b) => ({ id: b.id, code: b.code, sub: b.status === "closed" ? `${b.species}, closed` : b.species, head: b.current }))
    : f.charge === "unit" ? units.map((u) => ({ id: u.id, code: u.code, sub: u.name ?? "", size: u.area_m2 ?? u.volume_m3, area: u.area_m2 != null })) : [];
  const picked = choices.filter((c) => f.picked.includes(c.id));
  const many = picked.length > 1;
  const split = shareOut(expense?.amount ?? 0, picked, f.split, f.parts);
  return (
    <Shell open={open} onClose={onClose} title="Charge it to" saving={charge.isPending} error={error} label="Save"
      disabled={f.reason.trim().length < 3 || (f.charge !== "farm" && !picked.length) || (many && !!split.problem)}
      save={async () => {
        if (!expense) return;
        setError(null);
        try {
          await charge.mutateAsync({ id: expense.id, reason: f.reason.trim(),
            ...(f.charge === "batch" ? { batch_ids: f.picked } : f.charge === "unit" ? { unit_ids: f.picked } : {}),
            ...(many ? { split: f.split, ...(f.split === "amounts" ? { split_amounts: Object.fromEntries(picked.map((c) => [c.id, Number(f.parts[c.id]) || 0])) } : {}) } : {}) });
          toast(`${expense.number} charged again`); onClose();
        } catch (e) { setError(errMsg(e)); }
      }}>
      {expense && <p className="text-[13.5px] text-ink-2"><b className="font-mono">{expense.number}</b> · {expense.description} · <b className="tnum">{naira(expense.amount)}</b>.
        The payment stays as it is; only who carries the cost changes.</p>}
      <Segmented value={f.charge} onChange={(v) => setF({ ...f, charge: v, picked: [], split: "even", parts: {} })}
        options={[{ value: "farm", label: "Whole farm" }, { value: "batch", label: "Batches" }, { value: "unit", label: "Houses, ponds or pens" }]} />
      {f.charge === "farm" && <p className="text-[12.5px] text-ink-3">A whole-farm cost is shared by the batches running at the time, by how many animals each had and for how long. It shows on each batch as its share of farm costs.</p>}
      {f.charge === "unit" && <p className="text-[12.5px] text-ink-3">The batches in those houses, ponds or pens at the time carry it, as their share of farm costs.</p>}
      {f.charge !== "farm" && <SharePicker kind={f.charge as "batch" | "unit"} choices={choices} picked={f.picked} split={f.split} parts={f.parts}
        result={split} onChange={(x) => setF({ ...f, ...x })} />}
      <Field label="Why" htmlFor="ch-why" hint="Kept in the audit trail"><Input id="ch-why" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="It was for both ponds" /></Field>
    </Shell>
  );
}

type Choice = { id: string; code: string; sub?: string; head?: number; size?: number | null; area?: boolean };
type Shared = { parts: Record<string, number>; problem: string | null };

/** Each picked batch's or unit's part, the way the server will work it out (so the form can show it before saving). */
function shareOut(total: number, picked: Choice[], how: string, typed: Record<string, string>): Shared {
  if (picked.length < 2 || !total) return { parts: {}, problem: null };
  const cents = Math.round(total * 100);
  let w: number[];
  if (how === "amounts") {
    w = picked.map((c) => Math.round((Number(typed[c.id]) || 0) * 100));
    const sum = w.reduce((a, b) => a + b, 0);
    if (sum !== cents) return { parts: Object.fromEntries(picked.map((c, i) => [c.id, w[i] / 100])), problem: sum < cents ? `${naira((cents - sum) / 100)} still to share out` : `${naira((sum - cents) / 100)} too much` };
    return { parts: Object.fromEntries(picked.map((c, i) => [c.id, w[i] / 100])), problem: null };
  }
  if (how === "head") {
    w = picked.map((c) => c.head ?? 0);
    if (!w.some(Boolean)) return { parts: {}, problem: "These batches have no animals now" };
  } else if (how === "size") {
    const missing = picked.filter((c) => !c.size).map((c) => c.code);
    if (missing.length) return { parts: {}, problem: `${missing.join(", ")} ${missing.length === 1 ? "has" : "have"} no size yet` };
    if (new Set(picked.map((c) => c.area)).size > 1) return { parts: {}, problem: "Some are measured by floor area, some by water volume" };
    w = picked.map((c) => c.size ?? 0);
  } else w = picked.map(() => 1);
  const sum = w.reduce((a, b) => a + b, 0);
  const out = w.slice(0, -1).map((x) => Math.round((cents * x) / sum));
  out.push(cents - out.reduce((a, b) => a + b, 0));
  return { parts: Object.fromEntries(picked.map((c, i) => [c.id, out[i] / 100])), problem: null };
}

/** Pick one or several batches (or units); with several, how the amount is shared between them. */
function SharePicker({ kind, choices, picked, split, parts, result, onChange }: {
  kind: "batch" | "unit"; choices: Choice[]; picked: string[]; split: string; parts: Record<string, string>; result: Shared;
  onChange: (x: { picked?: string[]; split?: string; parts?: Record<string, string> }) => void;
}) {
  const many = picked.length > 1;
  const toggle = (id: string) => onChange({ picked: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] });
  if (!choices.length) return <p className="text-[13px] text-ink-3">{kind === "batch" ? "No batches running now." : "No houses, ponds or pens yet."}</p>;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={kind === "batch" ? "Batches" : "Units"}>
        {choices.map((c) => {
          const on = picked.includes(c.id);
          return (
            <button key={c.id} type="button" aria-pressed={on} onClick={() => toggle(c.id)}
              className={cn("rounded-lg border px-2.5 py-1 text-[13px] transition-colors", on ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line hover:bg-surface-2")}>
              <span className="font-mono">{c.code}</span>{c.sub ? <span className="font-normal text-ink-3"> · {c.sub}</span> : null}
            </button>
          );
        })}
      </div>
      {!picked.length && <p className="text-[12.5px] text-ink-3">Tap one, or several if they share it.</p>}
      {many && (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <span className="text-[12.5px] font-semibold text-ink-2">Share it between the {picked.length}</span>
          <Segmented value={split} onChange={(v) => onChange({ split: v })} options={[{ value: "even", label: "Evenly" },
            kind === "batch" ? { value: "head", label: "By animals" } : { value: "size", label: "By size" }, { value: "amounts", label: "Type amounts" }]} />
          <ul className="flex flex-col gap-1">
            {choices.filter((c) => picked.includes(c.id)).map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1"><b className="whitespace-nowrap font-mono">{c.code}</b>
                  {split === "head" && c.head != null && <span className="text-ink-3"> · {c.head.toLocaleString()} now</span>}
                  {split === "size" && c.size ? <span className="text-ink-3"> · {c.size.toLocaleString()} {c.area ? "m²" : "m³"}</span> : null}</span>
                {split === "amounts"
                  ? <div className="w-36 shrink-0"><Input aria-label={`${c.code} part`} inputMode="decimal" className="text-right" value={parts[c.id] ?? ""}
                      onChange={(e) => onChange({ parts: { ...parts, [c.id]: e.target.value.replace(/[^\d.]/g, "") } })} /></div>
                  : <span className="font-mono tnum">{result.parts[c.id] != null ? naira(result.parts[c.id]) : "—"}</span>}
              </li>
            ))}
          </ul>
          {result.problem && <p className="text-[12.5px] text-warn">{result.problem}{split === "size" && result.problem.includes("size") ? ". Add it on the farm map, or split another way." : "."}</p>}
          <p className="text-[12px] text-ink-3">One payment out of the account; each one carries its part in its costs and profit.</p>
        </div>
      )}
    </div>
  );
}
