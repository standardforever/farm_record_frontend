"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { Alert, Badge, Button, Dialog, Field, Input, Select, useToast } from "@/components/ui";
import { localDay } from "@/features/daily/api";
import { type PaymentChoice, PaymentFields, noPayment, paymentBody, paymentReady, useCanPay } from "@/features/finance/PaymentFields";
import { PaidBadge } from "@/features/inventory/ItemSheet";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { naira } from "@/lib/format";
import { RENT_PERIODS, type RentPeriod, type SiteWithUnits, useSiteLand, useSiteRent, useUpdateSite } from "./api";

const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const dec = (v: string) => v.replace(/[^\d.]/g, "");

/** Under a site's name: how the land is held, what was invested, and where the rent stands. */
export function SiteLand({ site }: { site: SiteWithUnits }) {
  const ws = useCurrentWorkspace();
  const canPay = useCanPay();
  const [open, setOpen] = useState<"rent" | "land" | "tenure" | null>(null);
  const m = site.money;
  const finance = ws.can("finance.view");
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
      {site.tenure === "bought" && <Badge>Land bought</Badge>}
      {site.tenure === "own" && <Badge>Family or own land</Badge>}
      {site.tenure === "rented" && <Badge>Rented{site.rent_amount ? `: ${naira(site.rent_amount)} ${RENT_PERIODS[site.rent_period ?? "yearly"].label.toLowerCase()}` : ""}</Badge>}
      {!site.tenure && ws.can("farm.setup") && <button type="button" className="cursor-pointer font-semibold text-brand" onClick={() => setOpen("tenure")}>Bought or rented land? Add it</button>}
      {finance && m?.land && <PaidBadge p={m.land} />}
      {finance && !!m?.invested && <span>Invested here: <b className="tnum">{naira(m.invested)}</b></span>}
      {site.tenure === "rented" && m && (m.rent_paid_until
        ? <Badge tone={m.rent_overdue ? "crit" : m.rent_due_soon ? "warn" : "neutral"}>
            {m.rent_overdue ? <AlertTriangle size={11} /> : <CalendarClock size={11} />} Rent {m.rent_overdue ? "ran out" : "paid until"} {day(m.rent_paid_until)}</Badge>
        : finance && <Badge tone="warn">No rent recorded</Badge>)}
      {canPay && site.tenure === "rented" && <Button size="sm" variant="ghost" onClick={() => setOpen("rent")}>Pay rent</Button>}
      {canPay && site.tenure === "bought" && !m?.land && <Button size="sm" variant="ghost" onClick={() => setOpen("land")}>Record the price</Button>}
      {open === "rent" && <RentDialog site={site} onClose={() => setOpen(null)} />}
      {open === "land" && <LandPriceDialog site={site} onClose={() => setOpen(null)} />}
      {open === "tenure" && <TenureDialog site={site} onClose={() => setOpen(null)} onNext={(t) => setOpen(t === "bought" && canPay ? "land" : t === "rented" && canPay ? "rent" : null)} />}
    </div>
  );
}

function TenureDialog({ site, onClose, onNext }: { site: SiteWithUnits; onClose: () => void; onNext: (t: string) => void }) {
  const ws = useCurrentWorkspace();
  const update = useUpdateSite(ws.orgId);
  const [t, setT] = useState<"bought" | "rented" | "own">("bought");
  const [rent, setRent] = useState({ amount: "", period: "yearly" as RentPeriod });
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onClose={onClose} title="The land" eyebrow={site.name}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={update.isPending} onClick={async () => {
        try {
          await update.mutateAsync({ id: site.id, tenure: t, ...(t === "rented" ? { rent_amount: Number(rent.amount) || null, rent_period: rent.period } : {}) });
          onNext(t);
        } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save"); }
      }}>Continue</Button></>}>
      <div className="flex flex-col gap-3">
        {error && <Alert tone="crit">{error}</Alert>}
        <Field label="The land is" htmlFor="tn-kind"><Select id="tn-kind" value={t} onChange={(e) => setT(e.target.value as typeof t)}>
          <option value="bought">Bought</option><option value="rented">Rented or leased</option><option value="own">Family or own land (no cost)</option></Select></Field>
        {t === "rented" && <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rent (₦)" htmlFor="tn-rent"><Input id="tn-rent" inputMode="decimal" value={rent.amount} onChange={(e) => setRent({ ...rent, amount: dec(e.target.value) })} /></Field>
          <Field label="Paid" htmlFor="tn-period"><Select id="tn-period" value={rent.period} onChange={(e) => setRent({ ...rent, period: e.target.value as RentPeriod })}>
            {Object.entries(RENT_PERIODS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
        </div>}
      </div>
    </Dialog>
  );
}

function RentDialog({ site, onClose }: { site: SiteWithUnits; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const pay = useSiteRent(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ amount: site.rent_amount ? String(site.rent_amount) : "", on: localDay() });
  const [p, setP] = useState<PaymentChoice>(noPayment);
  const [error, setError] = useState<string | null>(null);
  const body = paymentBody(p, true);
  const from = site.money?.rent_paid_until ? new Date(new Date(site.money.rent_paid_until + "T12:00:00").getTime() + 86400000).toISOString().slice(0, 10) : f.on;
  const period = RENT_PERIODS[site.rent_period ?? "yearly"];
  return (
    <Dialog open onClose={onClose} title="Pay rent" eyebrow={site.name}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={pay.isPending} disabled={!(Number(f.amount) > 0) || !body || !paymentReady(p, true)} onClick={async () => {
          if (!body) return;
          setError(null);
          try {
            const s = await pay.mutateAsync({ id: site.id, amount: Number(f.amount), on: f.on, payment: body });
            toast(`Rent recorded: paid until ${s.money?.rent_paid_until ? day(s.money.rent_paid_until) : ""}`); onClose();
          } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save"); }
        }}>Save</Button></>}>
      <div className="flex flex-col gap-3">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rent paid (₦)" htmlFor="pr-amount"><Input id="pr-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: dec(e.target.value) })} /></Field>
          <Field label="Paid on" htmlFor="pr-on"><Input id="pr-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        </div>
        <p className="text-[12.5px] text-ink-3">Covers {period.label.toLowerCase().replace("every ", "")} from {day(from)}{site.money?.rent_paid_until ? ", straight after the last rent" : ""}. Profit counts it month by month over that time.</p>
        <PaymentFields value={p} onChange={setP} amount={Number(f.amount) || null} what="the rent" purchasedOn={f.on} />
      </div>
    </Dialog>
  );
}

function LandPriceDialog({ site, onClose }: { site: SiteWithUnits; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const save = useSiteLand(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ amount: "", on: localDay() });
  const [p, setP] = useState<PaymentChoice>(noPayment);
  const [error, setError] = useState<string | null>(null);
  const body = paymentBody(p, true);
  return (
    <Dialog open onClose={onClose} title="What the land cost" eyebrow={site.name}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={save.isPending} disabled={!(Number(f.amount) > 0) || !body || !paymentReady(p, true)} onClick={async () => {
          if (!body) return;
          setError(null);
          try { await save.mutateAsync({ id: site.id, amount: Number(f.amount), on: f.on, payment: body }); toast("Land price recorded"); onClose(); }
          catch (e) { setError(e instanceof ApiError ? e.message : "Could not save"); }
        }}>Save</Button></>}>
      <div className="flex flex-col gap-3">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Price paid (₦)" htmlFor="lp-amount"><Input id="lp-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: dec(e.target.value) })} /></Field>
          <Field label="Bought on" htmlFor="lp-on"><Input id="lp-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        </div>
        <p className="text-[12.5px] text-ink-3">Money put into the farm, not a running cost. Finance → Payback shows how much of it profit has paid back.</p>
        <PaymentFields value={p} onChange={setP} amount={Number(f.amount) || null} what="the land" purchasedOn={f.on} />
      </div>
    </Dialog>
  );
}
