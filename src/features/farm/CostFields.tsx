"use client";

import { useState } from "react";
import { ChevronDown, Wallet } from "lucide-react";
import { Field, Input, Segmented, Select } from "@/components/ui";
import { localDay } from "@/features/daily/api";
import { type PaymentChoice, PaymentFields, noPayment, paymentBody, paymentReady, useCanPay } from "@/features/finance/PaymentFields";
import { cn, naira } from "@/lib/format";
import { type CostInput, RENT_PERIODS, type RentPeriod } from "./api";

const dec = (v: string) => v.replace(/[^\d.]/g, "");
const addMonths = (iso: string, months: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** A closed, optional section: the form stays as short as before for anyone who skips it. */
function Optional({ title, summary, children, open: startOpen = false }: { title: string; summary?: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="rounded-xl border border-line">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-[13.5px] font-semibold">
        <Wallet size={15} className="text-ink-3" />
        <span className="flex-1">{title} <span className="font-normal text-ink-3">(optional{summary ? `, ${summary}` : ""})</span></span>
        <ChevronDown size={16} className={cn("text-ink-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="flex flex-col gap-3 border-t border-line px-3 pb-3 pt-3">{children}</div>}
    </div>
  );
}

// ---- the land a site is on -------------------------------------------------------------------------------------

export type LandState = { tenure: "" | "bought" | "rented" | "own"; amount: string; on: string; period: RentPeriod; from: string; to: string; pay: PaymentChoice };
export const noLand = (): LandState => {
  const today = localDay();
  return { tenure: "", amount: "", on: today, period: "yearly", from: today, to: addMonths(today, 12), pay: noPayment() };
};

/** The site's tenure and rent terms, and (for people in Finance) what was paid: land price or rent paid ahead. */
export function landBody(s: LandState, canPay: boolean): { tenure?: Exclude<LandState["tenure"], ""> | null; rent_amount?: number | null; rent_period?: RentPeriod | null; cost?: CostInput } {
  if (!s.tenure) return {};
  const amount = Number(s.amount) || 0;
  const out: ReturnType<typeof landBody> = { tenure: s.tenure || null };
  if (s.tenure === "rented") Object.assign(out, { rent_amount: amount || null, rent_period: s.period });
  const pay = paymentBody(s.pay, canPay && amount > 0 && s.tenure !== "own");
  if (pay) out.cost = { amount, on: s.on, payment: pay, ...(s.tenure === "rented" ? { covers_from: s.from, covers_to: s.to } : {}) };
  return out;
}
export const landReady = (s: LandState, canPay: boolean) =>
  !s.tenure || s.tenure === "own" || paymentReady(s.pay, canPay && (Number(s.amount) || 0) > 0) && (s.tenure !== "rented" || !s.amount || s.to >= s.from);

export function LandFields({ value: s, onChange }: { value: LandState; onChange: (s: LandState) => void }) {
  const canPay = useCanPay();
  const set = (p: Partial<LandState>) => onChange({ ...s, ...p });
  const amount = Number(s.amount) || 0;
  const summary = s.tenure === "bought" ? (amount ? `bought, ${naira(amount)}` : "bought") : s.tenure === "rented" ? (amount ? `rented, ${naira(amount)}` : "rented")
    : s.tenure === "own" ? "family or own land" : undefined;
  return (
    <Optional title="The land" summary={summary}>
      <Segmented value={s.tenure} onChange={(v) => set({ tenure: v as LandState["tenure"] })}
        options={[{ value: "bought", label: "Bought" }, { value: "rented", label: "Rented" }, { value: "own", label: "Family or own land" }]} />
      {s.tenure === "own" && <p className="text-[12.5px] text-ink-3">Nothing to pay. You can change this later.</p>}
      {s.tenure === "bought" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Price paid (₦)" htmlFor="land-amount"><Input id="land-amount" inputMode="decimal" value={s.amount} onChange={(e) => set({ amount: dec(e.target.value) })} /></Field>
            <Field label="Bought on" htmlFor="land-on"><Input id="land-on" type="date" max={localDay()} value={s.on} onChange={(e) => set({ on: e.target.value })} /></Field>
          </div>
          <p className="text-[12.5px] text-ink-3">Counted as money put into the farm, not a running cost. Finance → Payback shows how much of it profit has paid back.</p>
        </>
      )}
      {s.tenure === "rented" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rent (₦)" htmlFor="rent-amount"><Input id="rent-amount" inputMode="decimal" value={s.amount} onChange={(e) => set({ amount: dec(e.target.value) })} /></Field>
            <Field label="Paid" htmlFor="rent-period">
              <Select id="rent-period" value={s.period} onChange={(e) => {
                const period = e.target.value as RentPeriod;
                set({ period, to: addMonths(s.from, RENT_PERIODS[period].months) });
              }}>{Object.entries(RENT_PERIODS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
            </Field>
          </div>
          {canPay && amount > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Paid on" htmlFor="rent-on"><Input id="rent-on" type="date" max={localDay()} value={s.on} onChange={(e) => set({ on: e.target.value })} /></Field>
              <Field label="It covers from" htmlFor="rent-from"><Input id="rent-from" type="date" value={s.from}
                onChange={(e) => set({ from: e.target.value, to: e.target.value ? addMonths(e.target.value, RENT_PERIODS[s.period].months) : s.to })} /></Field>
              <Field label="Until" htmlFor="rent-to"><Input id="rent-to" type="date" min={s.from} value={s.to} onChange={(e) => set({ to: e.target.value })} /></Field>
            </div>
          )}
          <p className="text-[12.5px] text-ink-3">Rent is a running cost. Profit counts it month by month over the period it covers, so one big payment does not make one month look like a loss. Oko reminds you before it runs out.</p>
        </>
      )}
      {canPay && amount > 0 && (s.tenure === "bought" || s.tenure === "rented") && (
        <PaymentFields value={s.pay} onChange={(pay) => set({ pay })} amount={amount} what={s.tenure === "bought" ? "the land" : "the rent"} purchasedOn={s.on} />
      )}
      {!canPay && amount > 0 && <p className="text-[12.5px] text-ink-3">Someone with access to Finance can record what was paid.</p>}
    </Optional>
  );
}

// ---- what units cost ---------------------------------------------------------------------------------------------

export type UnitCostState = { amount: string; on: string; note: string; pay: PaymentChoice };
export const noUnitCost = (): UnitCostState => ({ amount: "", on: localDay(), note: "", pay: noPayment() });
export const unitCostBody = (s: UnitCostState, canPay: boolean): CostInput | undefined => {
  const amount = Number(s.amount) || 0;
  const pay = paymentBody(s.pay, canPay && amount > 0);
  return pay ? { amount, on: s.on, note: s.note || null, payment: pay } : undefined;
};
export const unitCostReady = (s: UnitCostState, canPay: boolean) => paymentReady(s.pay, canPay && (Number(s.amount) || 0) > 0);

export function UnitCostFields({ value: s, onChange, count = 1, open }: { value: UnitCostState; onChange: (s: UnitCostState) => void; count?: number; open?: boolean }) {
  const canPay = useCanPay();
  if (!canPay) return null;
  const set = (p: Partial<UnitCostState>) => onChange({ ...s, ...p });
  const amount = Number(s.amount) || 0;
  return (
    <Optional title={count > 1 ? "What did they cost?" : "What did it cost?"} summary={amount ? naira(amount) : undefined} open={open}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={count > 1 ? `Total for all ${count} (₦)` : "Cost (₦)"} htmlFor="uc-amount" hint={count > 1 && amount ? `${naira(amount / count)} each` : undefined}>
          <Input id="uc-amount" inputMode="decimal" value={s.amount} onChange={(e) => set({ amount: dec(e.target.value) })} /></Field>
        <Field label="Built or bought on" htmlFor="uc-on"><Input id="uc-on" type="date" max={localDay()} value={s.on} onChange={(e) => set({ on: e.target.value })} /></Field>
        <Field label="What for" htmlFor="uc-note" hint="Optional"><Input id="uc-note" value={s.note} onChange={(e) => set({ note: e.target.value })} placeholder="Tarpaulin, cages, roofing" /></Field>
      </div>
      <p className="text-[12.5px] text-ink-3">Building or buying houses, ponds, cages or tanks is money put into the farm, not a running cost. Finance → Payback shows how much of it profit has paid back{count > 1 ? ", for each one" : ""}.</p>
      {amount > 0 && <PaymentFields value={s.pay} onChange={(pay) => set({ pay })} amount={amount} what={count > 1 ? "them" : "it"} purchasedOn={s.on} />}
    </Optional>
  );
}
