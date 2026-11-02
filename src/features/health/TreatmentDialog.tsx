"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Dialog, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { useBatches } from "@/features/batches";
import { localDay } from "@/features/daily/api";
import { newId } from "@/features/offline/queue";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import { type Product, PRODUCT_LABEL, planHold, shortDay, useCreateTreatment, useHealthCatalog, useProductHints } from "./api";

const KIND_ORDER = ["medication", "dewormer", "vaccination", "supplement", "other"];
const SHORT: Record<string, string> = { medication: "Medicine", dewormer: "Dewormer", vaccination: "Vaccine", supplement: "Vitamins", other: "Other" };
const int = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v))));

/** Record a medicine, dewormer, vaccine or supplement. Medicines and dewormers must say how long to wait before selling. */
export function TreatmentDialog({ open, onClose, batchId, caseId }: { open: boolean; onClose: () => void; batchId?: string; caseId?: string | null }) {
  const ws = useCurrentWorkspace();
  const cat = useHealthCatalog();
  const batches = useBatches(ws.orgId, "active", open);
  const hints = useProductHints(ws.orgId, open);
  const create = useCreateTreatment(ws.orgId);
  const toast = useToast();
  const blank = { batch: "", unit: "", kind: "medication", product: "", ingredient: "", dose: "", route: "", given_on: localDay(), course: "1",
    meat: "", eggs: "", milk: "", given_by: "", lot: "", animals: "", notes: "" };
  const [f, setF] = useState(blank);
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof blank, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setF({ ...blank, batch: batchId ?? "" }); setError(null); setFilledFrom(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, batchId]);

  const batch = batches.data?.find((b) => b.id === f.batch);
  const products = useMemo<Product[]>(() => (batch ? cat.data?.products_by_species[batch.species] ?? ["meat"] : ["meat"]), [batch, cat.data]);
  const required = cat.data?.withdrawal_required.includes(f.kind) ?? false;
  const units = (batch?.units ?? []).filter((u) => !u.ended_on);
  const missing = required ? products.filter((p) => f[p].trim() === "") : [];
  const holds = useMemo(() => products.map((p) => ({ p, h: planHold(f.given_on, Number(f.course) || 1, int(f[p])) })).filter((x) => x.h),
    [products, f]);

  const pickProduct = (name: string) => {
    set("product", name);
    const h = hints.data?.find((x) => x.product.toLowerCase() === name.trim().toLowerCase());
    if (!h) { setFilledFrom(null); return; }
    setF((x) => ({ ...x, product: name, kind: h.kind, ingredient: h.active_ingredient ?? x.ingredient, route: h.route ?? x.route, dose: h.dose ?? x.dose,
      meat: h.withdrawal_meat_days?.toString() ?? x.meat, eggs: h.withdrawal_eggs_days?.toString() ?? x.eggs, milk: h.withdrawal_milk_days?.toString() ?? x.milk }));
    setFilledFrom(h.last_used);
  };

  const save = async () => {
    setError(null);
    try {
      const t = await create.mutateAsync({
        batch_id: f.batch, unit_id: f.unit || null, case_id: caseId ?? null, kind: f.kind, product: f.product.trim(),
        active_ingredient: f.ingredient || null, dose: f.dose || null, route: f.route || null, given_on: f.given_on,
        course_days: Math.max(1, Number(f.course) || 1), animals: int(f.animals), given_by: f.given_by || null, product_lot: f.lot || null,
        withdrawal_meat_days: int(f.meat), withdrawal_eggs_days: int(f.eggs), withdrawal_milk_days: int(f.milk), notes: f.notes || null, client_id: newId(),
      });
      const last = Object.values(t.held_until).sort().pop();
      toast(last ? `Recorded. ${t.batch_code} is held until ${shortDay(last)}` : `Recorded ${t.product} for ${t.batch_code}`);
      onClose();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save."); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Record a treatment" eyebrow="Health"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={create.isPending} disabled={!f.batch || f.product.trim().length < 2 || missing.length > 0} onClick={save}>Save</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Batch" htmlFor="t-batch">
            <Select id="t-batch" value={f.batch} disabled={!!batchId} onChange={(e) => setF((x) => ({ ...x, batch: e.target.value, unit: "" }))}>
              <option value="">Choose a batch</option>
              {batches.data?.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.units.filter((u) => !u.ended_on).map((u) => u.unit_code).join(", ")}</option>)}
            </Select>
          </Field>
          <Field label="Which unit" htmlFor="t-unit" hint={units.length > 1 ? "Leave on “All” if the whole batch got it" : undefined}>
            <Select id="t-unit" value={f.unit} disabled={units.length < 2} onChange={(e) => set("unit", e.target.value)}>
              <option value="">All of the batch</option>
              {units.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.unit_code}</option>)}
            </Select>
          </Field>
        </div>
        <div role="radiogroup" aria-label="What was given" className="flex flex-wrap gap-1.5">
          {KIND_ORDER.filter((k) => cat.data?.kinds[k]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={f.kind === k} onClick={() => set("kind", k)}
              className={cn("rounded-full border px-3 py-1.5 text-[13px] font-semibold", f.kind === k ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-ink-2 hover:border-ink-3")}>
              {SHORT[k]}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" htmlFor="t-product" hint={filledFrom ? `Filled from your entry on ${shortDay(filledFrom)}. Check the label.` : "As written on the pack"}>
            <Input id="t-product" list="t-products" value={f.product} onChange={(e) => pickProduct(e.target.value)} placeholder="Oxytetracycline 20%" autoComplete="off" />
            <datalist id="t-products">{hints.data?.map((h) => <option key={h.product} value={h.product} />)}</datalist>
          </Field>
          <Field label="Active ingredient" htmlFor="t-ingredient" hint="Optional"><Input id="t-ingredient" value={f.ingredient} onChange={(e) => set("ingredient", e.target.value)} /></Field>
          <Field label="Dose" htmlFor="t-dose" hint="Optional"><Input id="t-dose" value={f.dose} onChange={(e) => set("dose", e.target.value)} placeholder="1 g per 2 litres" /></Field>
          <Field label="How it was given" htmlFor="t-route">
            <Select id="t-route" value={f.route} onChange={(e) => set("route", e.target.value)}>
              <option value="">Choose…</option>{cat.data?.routes.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="First day given" htmlFor="t-given"><Input id="t-given" type="date" max={localDay()} value={f.given_on} onChange={(e) => set("given_on", e.target.value)} /></Field>
          <Field label="For how many days" htmlFor="t-course"><Input id="t-course" inputMode="numeric" value={f.course} onChange={(e) => set("course", e.target.value.replace(/\D/g, ""))} /></Field>
        </div>

        <fieldset className="rounded-xl border border-line p-3.5">
          <legend className="px-1 text-[13px] font-bold">Withdrawal period {required ? "(required)" : "(if the label gives one)"}</legend>
          <p className="mb-3 text-[12.5px] text-ink-3">Days to wait after the last dose before selling or eating. Read it from the label or ask your vet. Enter 0 only if the label says there is none.</p>
          <div className={cn("grid gap-3", products.length > 1 ? "grid-cols-2" : "grid-cols-1 sm:max-w-[220px]")}>
            {products.map((p) => (
              <Field key={p} label={`${PRODUCT_LABEL[p]} (days)`} htmlFor={`t-wd-${p}`}>
                <Input id={`t-wd-${p}`} inputMode="numeric" value={f[p]} onChange={(e) => set(p, e.target.value.replace(/\D/g, ""))}
                  aria-invalid={missing.includes(p) && f.product.length > 1} />
              </Field>
            ))}
          </div>
          {holds.length > 0 && (
            <p role="status" className="mt-3 text-[13px] font-semibold text-crit">
              {holds.map(({ p, h }) => `${PRODUCT_LABEL[p]}: held until ${shortDay(h!.until)}, sell from ${shortDay(h!.clear_on)}`).join(" · ")}
            </p>
          )}
          {!batch && <p className="mt-2 text-[12px] text-ink-3">Choose the batch to see which products need a withdrawal period.</p>}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Given by" htmlFor="t-by" hint="Vet or staff name"><Input id="t-by" value={f.given_by} onChange={(e) => set("given_by", e.target.value)} /></Field>
          <Field label="Pack lot / batch no." htmlFor="t-lot" hint="Optional"><Input id="t-lot" value={f.lot} onChange={(e) => set("lot", e.target.value)} /></Field>
          <Field label="Animals treated" htmlFor="t-animals" hint="Optional"><Input id="t-animals" inputMode="numeric" value={f.animals} onChange={(e) => set("animals", e.target.value.replace(/\D/g, ""))} /></Field>
        </div>
        <Field label="Notes" htmlFor="t-notes" hint="Optional"><Textarea id="t-notes" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}
