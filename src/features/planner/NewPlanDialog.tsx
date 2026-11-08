"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Dialog, Field, Input, Select } from "@/components/ui";
import { useCatalog } from "@/features/farm";
import { usePacks } from "@/features/packs";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { localDay, shiftDay } from "@/features/daily/api";
import { SPECIES_PLANNED, useCreatePlan } from "./api";

/** Start a plan: just what, how many and when. Prices come next, on the plan itself. */
export function NewPlanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const router = useRouter();
  const packs = usePacks();
  const names = useCatalog();
  const create = useCreatePlan(ws.orgId);
  const [f, setF] = useState({ species: "broilers", breed_key: "", count: "", start_on: shiftDay(localDay(), 14), age: "" });
  const [error, setError] = useState<string | null>(null);
  const pack = packs.data?.find((p) => p.key === f.species);
  useEffect(() => { if (open) setError(null); }, [open]);
  useEffect(() => { setF((x) => ({ ...x, breed_key: pack?.breeds[0]?.key ?? "" })); }, [pack]);
  const valid = f.species && Number(f.count) > 0 && f.start_on;

  const save = async () => {
    setError(null);
    try {
      const p = await create.mutateAsync({ species: f.species, breed_key: f.breed_key || null, count: Number(f.count), start_on: f.start_on, age_at_start_days: Number(f.age) || 0 });
      onClose();
      router.push(`/w/${ws.orgId}/batches/plans/${p.id}`);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not start the plan."); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Plan a batch" eyebrow="Batches"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} loading={create.isPending} onClick={save}>Next: prices</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <p className="text-[13.5px] text-ink-2">Before you buy anything: see what a batch will cost, how much feed and how many vaccines it needs, when to buy them, and whether you have the money. Nothing is recorded until you stock it.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What" htmlFor="np-species"><Select id="np-species" value={f.species} onChange={(e) => setF({ ...f, species: e.target.value })}>
            {SPECIES_PLANNED.map((k) => <option key={k} value={k}>{names.data?.purposes[k] ?? k}</option>)}</Select></Field>
          {pack && <Field label="Breed" htmlFor="np-breed" hint="Not sure? Keep “Typical”"><Select id="np-breed" value={f.breed_key} onChange={(e) => setF({ ...f, breed_key: e.target.value })}>
            {pack.breeds.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}</Select></Field>}
          <Field label={`How many ${f.species === "catfish" ? "fish" : "birds"}`} htmlFor="np-count">
            <Input id="np-count" inputMode="numeric" value={f.count} onChange={(e) => setF({ ...f, count: e.target.value.replace(/\D/g, "") })} placeholder="500" /></Field>
          <Field label="When they arrive" htmlFor="np-start"><Input id="np-start" type="date" value={f.start_on} onChange={(e) => setF({ ...f, start_on: e.target.value })} /></Field>
          {f.species !== "broilers" && <Field label="Age when they arrive (days)" htmlFor="np-age" hint={f.species === "layers" ? "0 for day-old chicks; about 112 for point-of-lay" : "0 for fingerlings of about 5 g"}>
            <Input id="np-age" inputMode="numeric" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value.replace(/\D/g, "") })} placeholder="0" /></Field>}
        </div>
        <p className="text-[12.5px] text-ink-3">The planner covers broilers, layers and catfish for now.</p>
      </div>
    </Dialog>
  );
}
