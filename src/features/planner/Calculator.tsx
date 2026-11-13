"use client";

import { StartSizeField } from "@/features/packs";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Field, Input, Select } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, naira } from "@/lib/format";
import { type Plan, type PlanInputs, useUpdatePlan } from "./api";

const dec = (v: string) => v.replace(/[^\d.]/g, "");
const int = (v: string) => v.replace(/\D/g, "");
const s = (n: number | null | undefined) => (n == null ? "" : String(n));
const n = (v: string) => (v.trim() === "" ? null : Number(v));

type Row<K extends string> = Record<K, string>;
type Form = {
  count: string; start_on: string; age: string; animal_price: string; mortality_pct: string; sell_price: string; spent_price: string; sell_day: string;
  feeds: (Row<"phase" | "name" | "price" | "kg" | "bags">)[];
  vaccines: (Row<"name" | "product" | "price" | "doses">)[];
  vitamins: (Row<"name" | "pack_size" | "price" | "days_per_pack" | "days_used">)[];
  others: (Row<"label" | "amount" | "day">)[];
};

function toForm(p: Plan): Form {
  const i = p.inputs;
  return {
    count: String(p.count), start_on: p.start_on, age: String(p.age_at_start_days), animal_price: s(i.animal_price), mortality_pct: s(i.mortality_pct),
    sell_price: s(i.sell_price), spent_price: s(i.spent_price), sell_day: s(i.sell_day),
    feeds: (i.feeds ?? []).map((f) => ({ phase: f.phase, name: f.name ?? "", price: s(f.price_per_bag), kg: s(f.kg_per_bag), bags: s(f.bags) })),
    vaccines: (i.vaccines ?? []).map((v) => ({ name: v.name, product: v.product ?? "", price: s(v.price_per_bottle), doses: s(v.doses_per_bottle) })),
    vitamins: (i.vitamins ?? []).map((v) => ({ name: v.name, pack_size: v.pack_size ?? "", price: s(v.price), days_per_pack: s(v.days_per_pack), days_used: s(v.days_used) })),
    others: (i.others ?? []).map((o) => ({ label: o.label, amount: s(o.amount), day: s(o.day) })),
  };
}

function toInputs(f: Form, p: Plan): PlanInputs {
  return {
    animal_price: n(f.animal_price), mortality_pct: n(f.mortality_pct) ?? p.hints.mortality_pct, sell_price: n(f.sell_price), sell_unit: p.hints.sell_unit,
    spent_price: n(f.spent_price), sell_day: n(f.sell_day) ?? p.hints.sell_day,
    feeds: f.feeds.map((x) => ({ phase: x.phase, name: x.name || null, price_per_bag: n(x.price), kg_per_bag: n(x.kg) || p.hints.bag_kg, bags: n(x.bags) })),
    vaccines: f.vaccines.map((v) => ({ name: v.name, product: v.product || null, price_per_bottle: n(v.price), doses_per_bottle: n(v.doses) || null })),
    vitamins: f.vitamins.filter((v) => v.name && n(v.price) != null && Number(v.days_per_pack) > 0)
      .map((v) => ({ name: v.name, pack_size: v.pack_size || null, price: Number(v.price), days_per_pack: Number(v.days_per_pack), days_used: n(v.days_used) || null })),
    others: f.others.filter((o) => o.label && n(o.amount) != null).map((o) => ({ label: o.label, amount: Number(o.amount), day: Number(o.day) || 0 })),
  };
}

function Section({ title, sub, children, open: start = true, id }: { title: string; sub?: string; children: React.ReactNode; open?: boolean; id: string }) {
  const [open, setOpen] = useState(start);
  return (
    <section className="rounded-[14px] border border-line bg-surface">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left">
        <span className="flex-1"><span className="text-[14.5px] font-semibold">{title}</span>
          {sub && <span className="block text-[12.5px] text-ink-3">{sub}</span>}</span>
        <ChevronDown size={17} className={cn("text-ink-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div id={id} className="flex flex-col gap-3 border-t border-line px-4 pb-4 pt-3">{children}</div>}
    </section>
  );
}

const Money = ({ id, label, value, onChange, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: React.ReactNode }) => (
  <Field label={label} htmlFor={id} hint={hint}><Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(dec(e.target.value))} placeholder="₦" /></Field>
);

/** The calculator: what the farmer knows (prices, how many, when) in; it saves as they type. */
export function Calculator({ plan, onSaving }: { plan: Plan; onSaving: (s: "saving" | "saved" | string) => void }) {
  const ws = useCurrentWorkspace();
  const update = useUpdatePlan(ws.orgId, plan.id);
  const [f, setF] = useState<Form>(() => toForm(plan));
  const dirty = useRef(false);
  const lastSell = useRef(plan.inputs.sell_day);
  const canEdit = ws.can("farm.approve");
  const linked = !!plan.batch_id;
  const h = plan.hints;
  const counts = plan.pack.counts || "animals";

  // The selling day can also be moved on the day-by-day plan: follow it.
  useEffect(() => {
    if (plan.inputs.sell_day !== lastSell.current) {
      lastSell.current = plan.inputs.sell_day;
      setF((x) => ({ ...x, sell_day: s(plan.inputs.sell_day) }));
    }
    if (linked) setF((x) => ({ ...x, count: String(plan.count), start_on: plan.start_on, age: String(plan.age_at_start_days) }));
  }, [plan.inputs.sell_day, plan.count, plan.start_on, plan.age_at_start_days, linked]);

  const set = (p: Partial<Form>) => { dirty.current = true; setF((x) => ({ ...x, ...p })); };
  const row = <K extends "feeds" | "vaccines" | "vitamins" | "others">(k: K, i: number, p: Partial<Form[K][number]>) =>
    set({ [k]: f[k].map((r, j) => (j === i ? { ...r, ...p } : r)) } as Partial<Form>);

  useEffect(() => {
    if (!dirty.current || !canEdit) return;
    const t = setTimeout(async () => {
      const sell = Number(f.sell_day);
      if (!sell || sell <= Number(f.age || 0) || sell > h.max_day || !Number(f.count)) { onSaving(`Selling age must be between day ${Number(f.age || 0) + 1} and day ${h.max_day}.`); return; }
      onSaving("saving");
      try {
        lastSell.current = sell;
        await update.mutateAsync({
          inputs: toInputs(f, plan),
          ...(linked ? {} : { count: Number(f.count), start_on: f.start_on, age_at_start_days: Number(f.age) || 0 }),
        });
        dirty.current = false;
        onSaving("saved");
      } catch (e) { onSaving(e instanceof ApiError ? e.message : "Could not save."); }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  const removed = new Set(plan.days.filter((d) => d.kind === "vaccination" && d.removed).map((d) => d.ref));
  const before = new Set(plan.days.filter((d) => d.kind === "vaccination" && d.before_stock).map((d) => d.ref));

  return (
    <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-3">
      <Section id="c-batch" title="The batch" sub={linked ? `Follows ${plan.batch_code}: the count and dates come from the batch.` : "How many, and when"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`How many ${counts}`} htmlFor="c-count"><Input id="c-count" inputMode="numeric" disabled={linked} value={f.count} onChange={(e) => set({ count: int(e.target.value) })} /></Field>
          <Field label="Stocking date" htmlFor="c-start"><Input id="c-start" type="date" disabled={linked} value={f.start_on} onChange={(e) => set({ start_on: e.target.value })} /></Field>
          {linked ? <Field label="Age when they arrive (days)" htmlFor="c-age"><Input id="c-age" disabled value={f.age} /></Field>
            : <StartSizeField id="c-age" sizes={plan.pack.start_sizes} age={f.age} daysHint={h.young === "day-old chicks" ? "0 for day-old chicks" : undefined}
                onChange={(age) => set({ age })} />}
          {plan.pack.start_sizes?.length ? <KeepFor age={Number(f.age) || 0} sell={f.sell_day} max={h.max_day} usual={h.sell_day}
              weight={plan.result?.weight_end_g ?? null} onChange={(sell_day) => set({ sell_day })} />
            : <Field label="Sell at age (days)" htmlFor="c-sell-day" hint={`Usually day ${h.sell_day}; up to day ${h.max_day}`}>
                <Input id="c-sell-day" inputMode="numeric" value={f.sell_day} onChange={(e) => set({ sell_day: int(e.target.value) })} /></Field>}
          <Field label="Expected losses (%)" htmlFor="c-mort" hint={`Most farms lose some. ${h.mortality_pct}% is a fair guess for a beginner.`}>
            <Input id="c-mort" inputMode="decimal" value={f.mortality_pct} onChange={(e) => set({ mortality_pct: dec(e.target.value) })} /></Field>
        </div>
        {plan.pack.stocking && Number(f.count) > 0 && <SpaceNeeded count={Number(f.count)} stocking={plan.pack.stocking} />}
      </Section>

      <Section id="c-buy" title={`Buying the ${h.young}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Money id="c-animal" label={h.unit_price_hint + " (₦)"} value={f.animal_price} onChange={(v) => set({ animal_price: v })}
            hint={Number(f.animal_price) && Number(f.count) ? `${naira(Number(f.animal_price) * Number(f.count))} for ${Number(f.count).toLocaleString("en-NG")}` : undefined} />
        </div>
      </Section>

      <Section id="c-feed" title="Feed" sub="One line for each feed the guide uses. Check the bag size on the bag.">
        {f.feeds.map((x, i) => {
          const ph = plan.pack.phases.find((p) => p.name === x.phase);
          const line = plan.result?.feed?.find((l) => l.phase === x.phase);
          const worked = line?.worked_out_bags;
          if (plan.result && !line) return null;  // not used in this plan (e.g. the 1.5 mm feed for juveniles)
          return (
            <div key={x.phase} className="rounded-xl border border-line p-3">
              <div className="mb-2 text-[13.5px]"><b>{x.phase}</b>{ph?.protein_pct ? <span className="text-ink-3"> · {ph.protein_pct}% protein{ph.form ? `, ${ph.form}` : ""}</span> : null}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Feed name or brand" htmlFor={`c-feed-name-${i}`} hint="Optional"><Input id={`c-feed-name-${i}`} value={x.name} onChange={(e) => row("feeds", i, { name: e.target.value })} /></Field>
                <Money id={`c-feed-price-${i}`} label="Price per bag (₦)" value={x.price} onChange={(v) => row("feeds", i, { price: v })} />
                <Field label="Kg per bag" htmlFor={`c-feed-kg-${i}`}><Input id={`c-feed-kg-${i}`} inputMode="decimal" value={x.kg} onChange={(e) => row("feeds", i, { kg: dec(e.target.value) })} /></Field>
                <Field label="Bags" htmlFor={`c-feed-bags-${i}`}
                  hint={worked == null ? undefined : x.bags !== "" && Number(x.bags) !== worked
                    ? <>Worked out: {worked}. <button type="button" className="font-semibold text-brand" onClick={() => row("feeds", i, { bags: "" })}>Use {worked}</button></>
                    : `Worked out from the guide: ${worked}. Change it if you know better.`}>
                  <Input id={`c-feed-bags-${i}`} inputMode="numeric" value={x.bags} placeholder={worked != null ? String(worked) : ""}
                    onChange={(e) => row("feeds", i, { bags: int(e.target.value) })} /></Field>
              </div>
            </div>
          );
        })}
      </Section>

      <Section id="c-sell" title="Selling" sub="What you expect to get. It is only used to work out profit.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Money id="c-sell-price" label={h.sell_unit === "crate" ? `Price of a crate of ${h.eggs_per_crate ?? 30} eggs (₦)` : h.sell_unit === "kg" ? "Price per kg (₦)" : "Price per bird (₦)"}
            value={f.sell_price} onChange={(v) => set({ sell_price: v })} />
          {h.sell_unit === "crate" && <Money id="c-spent" label="Price of each hen at the end (₦)" hint="Optional" value={f.spent_price} onChange={(v) => set({ spent_price: v })} />}
        </div>
      </Section>

      {f.vaccines.length > 0 && (
        <Section id="c-vacc" title="Vaccines" sub="Optional. One bottle treats a set number of birds: see the label." open={false}>
          {f.vaccines.map((v, i) => (
            <div key={v.name} className={cn("rounded-xl border border-line p-3", (removed.has(v.name) || before.has(v.name)) && "opacity-60")}>
              <div className="mb-2 text-[13.5px]"><b>{v.name}</b>{removed.has(v.name) ? <span className="text-ink-3"> · taken out of the plan</span> : before.has(v.name) ? <span className="text-ink-3"> · given before they arrive</span> : null}</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Product" htmlFor={`c-vacc-product-${i}`} hint="Optional"><Input id={`c-vacc-product-${i}`} value={v.product} onChange={(e) => row("vaccines", i, { product: e.target.value })} /></Field>
                <Money id={`c-vacc-price-${i}`} label="Price per bottle (₦)" value={v.price} onChange={(x) => row("vaccines", i, { price: x })} />
                <Field label="Doses per bottle" htmlFor={`c-vacc-doses-${i}`}><Input id={`c-vacc-doses-${i}`} inputMode="numeric" value={v.doses} onChange={(e) => row("vaccines", i, { doses: int(e.target.value) })} /></Field>
              </div>
            </div>
          ))}
          {f.vaccines.length > 1 && f.vaccines[0].price && (
            <button type="button" className="self-start text-[13px] font-semibold text-brand"
              onClick={() => set({ vaccines: f.vaccines.map((v) => (v.price ? v : { ...v, price: f.vaccines[0].price, doses: v.doses || f.vaccines[0].doses })) })}>
              Use {naira(Number(f.vaccines[0].price))} for the ones without a price</button>
          )}
        </Section>
      )}

      <Section id="c-vit" title="Vitamins and drugs" sub="Optional. Ask how long one pack lasts for this many animals, or check the label." open={false}>
        {f.vitamins.map((v, i) => (
          <div key={i} className="grid items-end gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
            <Field label="Name" htmlFor={`c-vit-name-${i}`}><Input id={`c-vit-name-${i}`} value={v.name} onChange={(e) => row("vitamins", i, { name: e.target.value })} placeholder="Multivitamin" /></Field>
            <Field label="Pack size" htmlFor={`c-vit-size-${i}`} hint="Optional"><Input id={`c-vit-size-${i}`} value={v.pack_size} onChange={(e) => row("vitamins", i, { pack_size: e.target.value })} placeholder="100 g" /></Field>
            <Money id={`c-vit-price-${i}`} label="Price per pack (₦)" value={v.price} onChange={(x) => row("vitamins", i, { price: x })} />
            <Field label="One pack lasts (days)" htmlFor={`c-vit-days-${i}`}><Input id={`c-vit-days-${i}`} inputMode="decimal" value={v.days_per_pack} onChange={(e) => row("vitamins", i, { days_per_pack: dec(e.target.value) })} /></Field>
            <Field label="Days given" htmlFor={`c-vit-used-${i}`} hint="Empty: all"><Input id={`c-vit-used-${i}`} inputMode="numeric" value={v.days_used} onChange={(e) => row("vitamins", i, { days_used: int(e.target.value) })} /></Field>
            <button type="button" aria-label={`Remove ${v.name || "this line"}`} className="mb-2 grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-crit"
              onClick={() => set({ vitamins: f.vitamins.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
          </div>
        ))}
        <button type="button" className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-brand"
          onClick={() => set({ vitamins: [...f.vitamins, { name: "", pack_size: "", price: "", days_per_pack: "", days_used: "" }] })}><Plus size={15} /> Add a vitamin or drug</button>
      </Section>

      <Section id="c-other" title="Other costs" sub="Optional. Litter, heating, transport, labour: anything else this batch needs." open={false}>
        <datalist id="c-other-labels">{h.other_costs.map((l) => <option key={l} value={l} />)}</datalist>
        {f.others.map((o, i) => (
          <div key={i} className="grid items-end gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1.6fr_1fr_1fr_auto]">
            <Field label="What" htmlFor={`c-other-label-${i}`}><Input id={`c-other-label-${i}`} list="c-other-labels" value={o.label} onChange={(e) => row("others", i, { label: e.target.value })} /></Field>
            <Money id={`c-other-amount-${i}`} label="Amount (₦)" value={o.amount} onChange={(x) => row("others", i, { amount: x })} />
            <Field label="Paid on day" htmlFor={`c-other-day-${i}`} hint="Before arrival: −3"><Input id={`c-other-day-${i}`} inputMode="numeric" value={o.day}
              onChange={(e) => row("others", i, { day: e.target.value.replace(/[^\d-]/g, "").replace(/(?!^)-/g, "") })} /></Field>
            <button type="button" aria-label={`Remove ${o.label || "this cost"}`} className="mb-2 grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-crit"
              onClick={() => set({ others: f.others.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
          </div>
        ))}
        <button type="button" className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-brand"
          onClick={() => set({ others: [...f.others, { label: "", amount: "", day: "0" }] })}><Plus size={15} /> Add a cost</button>
      </Section>
      <p className="px-1 text-[12px] text-ink-3">Prices are saved with this plan, and your next plan starts with them.</p>
    </fieldset>
  );
}


const MONTH = 30;  // "5½ months" = 165 days, the guide's usual time for juveniles

/** Fish: how long to keep them, in months from arrival, instead of a selling age in days. */
function KeepFor({ age, sell, max, usual, weight, onChange }: { age: number; sell: string; max: number; usual: number; weight: number | null; onChange: (sell: string) => void }) {
  const kept = (Number(sell) || usual) - age;
  const options: number[] = [];
  for (let m = 2; age + Math.round(m * MONTH) <= max; m += 0.5) options.push(m);
  const exact = options.find((m) => Math.round(m * MONTH) === kept);
  const label = (m: number) => `${m % 1 ? `${Math.floor(m)}½` : m} month${m === 1 ? "" : "s"}`;
  return (
    <Field label="Keep them for" htmlFor="c-keep"
      hint={weight ? `About ${weight >= 1000 ? `${(weight / 1000).toLocaleString("en-NG", { maximumFractionDigits: 2 })} kg` : `${Math.round(weight)} g`} each by then (usually ${label(Math.round((usual - age) / MONTH * 2) / 2)}).` : undefined}>
      <Select id="c-keep" value={exact != null ? String(exact) : "days"} onChange={(e) => {
        if (e.target.value !== "days") onChange(String(age + Math.round(Number(e.target.value) * MONTH)));
      }}>
        {options.map((m) => <option key={m} value={m}>{label(m)}</option>)}
        {exact == null && <option value="days">{kept} days</option>}
      </Select>
    </Field>
  );
}

/** Fish: the water they need at harvest size, so a farmer can see before buying whether their ponds are big enough. */
function SpaceNeeded({ count, stocking }: { count: number; stocking: NonNullable<Plan["pack"]["stocking"]> }) {
  const tank = stocking.by_build.tarpaulin ?? stocking.by_build.concrete;
  const earth = stocking.by_build.earthen;
  const n = (x: number) => x.toLocaleString("en-NG", { maximumFractionDigits: x < 10 ? 1 : 0 });
  const ft3 = 35.3147;
  return (
    <div className="mt-3 rounded-xl bg-surface-2 p-3 text-[13px]">
      <b>Space they need at harvest ({stocking.harvest_g >= 1000 ? `${stocking.harvest_g / 1000} kg` : `${stocking.harvest_g} g`} each)</b>
      <ul className="mt-1 flex flex-col gap-0.5 text-ink-2">
        {tank && <li>Tarpaulin or concrete: about <b className="tnum">{n(count / tank.good)} m³</b> of water ({n(count / tank.good * ft3)} ft³) to be comfortable;
          at least {n(count / tank.most)} m³ with the water changed every 1–2 days.</li>}
        {earth && <li>Earthen pond: about <b className="tnum">{n(count / earth.good)} m²</b> of water surface; at least {n(count / earth.most)} m² with an aerator.</li>}
      </ul>
      <p className="mt-1 text-[12px] text-ink-3">For example, a 10 ft × 10 ft tarpaulin filled to 3½ ft holds about 9.9 m³: room for about {n(9.9 * (tank?.good ?? 30))} comfortably, {n(9.9 * (tank?.most ?? 60))} at most.</p>
    </div>
  );
}
