"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button, Input, Segmented, Select } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { naira } from "@/lib/format";
import { useAccounts } from "./api";
import { localDay } from "@/features/daily/api";
import { AccountStartNote } from "./AccountStartNote";
import { AccountDialog } from "./FinanceDialogs";

export type PaymentChoice = { status: "paid" | "owed" | "none"; account: string; reference: string; paidOn: string };
export const noPayment = (): PaymentChoice => ({ status: "paid", account: "", reference: "", paidOn: "" });

/** The API's `payment` for a purchase, or undefined when nothing is to be recorded. */
export function paymentBody(p: PaymentChoice, show: boolean) {
  if (!show || p.status === "none") return undefined;
  return p.status === "owed" ? { status: "owed" as const }
    : { status: "paid" as const, account_id: p.account, reference: p.reference || null, ...(p.paidOn ? { paid_on: p.paidOn } : {}) };
}
export const paymentReady = (p: PaymentChoice, show: boolean) => !show || p.status !== "paid" || !!p.account;

/** Whether this person records payments here: Finance is in the plan and they may edit it. */
export function useCanPay() {
  const ws = useCurrentWorkspace();
  return ws.has("finance") && ws.can("finance.edit");
}

/**
 * "Paid?" on a purchase (a stock delivery, a batch of animals): paid now from an account, owed to the supplier, or
 * not recorded here. Paid takes the money out of that account; Oko counts the cost in profit when the stock is used
 * (or as the batch's purchase), so it is never counted twice. An account can be added without leaving the form.
 */
export function PaymentFields({ value, onChange, amount, what = "it", purchasedOn, paidNote }: {
  value: PaymentChoice; onChange: (p: PaymentChoice) => void; amount: number | null; what?: string;
  /** What paying means here, under the account; the default is for stock bought to be used later. */
  paidNote?: string;
  /** The day of the purchase: the payment date unless another is given. */
  purchasedOn?: string;
}) {
  const ws = useCurrentWorkspace();
  const can = useCanPay();
  const accounts = useAccounts(ws.orgId, can);
  const [adding, setAdding] = useState(false);
  const list = accounts.data ?? [];
  // Choose the first account once they load; with none yet, start on "Don't record" so nothing blocks saving.
  useEffect(() => {
    if (!accounts.data) return;
    if (value.status === "paid" && !value.account) onChange(list.length ? { ...value, account: list[0].id } : { ...value, status: "none" });
  }, [accounts.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!can) return null;
  const known = new Set(list.map((a) => a.id));

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <span className="text-[13px] font-semibold">Paid for {what}?{amount ? <span className="font-normal text-ink-3"> {naira(amount)}</span> : null}</span>
      <Segmented value={value.status} onChange={(v) => onChange({ ...value, status: v as PaymentChoice["status"], account: value.account || list[0]?.id || "" })}
        options={[{ value: "paid", label: "Paid" }, { value: "owed", label: "Owe the supplier" }, { value: "none", label: "Don't record" }]} />
      {value.status === "paid" && (list.length ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Select aria-label="Paid from" value={known.has(value.account) ? value.account : ""} onChange={(e) => onChange({ ...value, account: e.target.value })}>
            {list.map((a) => <option key={a.id} value={a.id}>From {a.name} ({naira(a.balance)})</option>)}</Select>
          <Input aria-label="Paid on" type="date" max={localDay()} value={value.paidOn || purchasedOn || ""} onChange={(e) => onChange({ ...value, paidOn: e.target.value })} />
          <Input aria-label="Payment reference" value={value.reference} onChange={(e) => onChange({ ...value, reference: e.target.value })} placeholder="Transfer ref (optional)" />
        </div>
      ) : null)}
      {value.status === "paid" && <AccountStartNote accountId={value.account} on={value.paidOn || purchasedOn} flow="out" />}
      <p className="text-[12px] text-ink-3">
        {value.status === "paid" ? (list.length ? (paidNote ?? (what === "the animals" ? "Taken out of that account now. The animals count once, as the batch's cost."
          : "Taken out of that account now. It counts as a cost when it is used, not twice.")) : "Add the account it was paid from: a bank account, a cash box or mobile money.")
          : value.status === "owed" ? "Shows under money owed in Finance until you mark it paid."
          : "Nothing goes out of your accounts. Use this if you already recorded the payment as an expense."}
      </p>
      {(value.status === "paid" || !list.length) && (
        <div><Button size="sm" variant="ghost" onClick={() => setAdding(true)}><Plus size={14} /> Add an account</Button></div>
      )}
      <AccountDialog open={adding} onClose={async () => {
        setAdding(false);
        const r = await accounts.refetch();
        const fresh = (r.data ?? []).find((a) => !known.has(a.id));
        if (fresh) onChange({ ...value, status: "paid", account: fresh.id });
      }} />
    </div>
  );
}
