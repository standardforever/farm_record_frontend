"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Alert, Button, Checkbox, Dialog, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { useBatches } from "@/features/batches";
import { useQueryClient } from "@tanstack/react-query";
import { localDay } from "@/features/daily/api";
import { shrinkPhoto } from "@/features/daily/device";
import { newId, save as saveOffline } from "@/features/offline/queue";
import { refOf } from "@/features/evidence/api";
import { useFormEvidence } from "@/features/evidence/useFormEvidence";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import { useHealthCatalog } from "./api";

const groupOf = (groups: Record<string, string[]> | undefined, species?: string) =>
  (species && Object.entries(groups ?? {}).find(([, s]) => s.includes(species))?.[0]) || "other";

/** Anyone logging daily work can report sick animals: what they see, how many, a photo. */
export function ReportCaseDialog({ open, onClose, batchId, unitId }: { open: boolean; onClose: () => void; batchId?: string; unitId?: string | null }) {
  const ws = useCurrentWorkspace();
  const cat = useHealthCatalog();
  const batches = useBatches(ws.orgId, "active", open);
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ batch: "", unit: "", on: localDay(), affected: "", description: "", suspected: "", hold: false });
  const [signs, setSigns] = useState<string[]>([]);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const evidence = useFormEvidence("health_case", { hint: "More photos, a lab result or the vet's note (PDF). Optional." });
  const resetEvidence = evidence.reset;

  useEffect(() => {
    if (!open) return;
    setF({ batch: batchId ?? "", unit: unitId ?? "", on: localDay(), affected: "", description: "", suspected: "", hold: false });
    setSigns([]); setPhoto(null); setError(null); resetEvidence();
  }, [open, batchId, unitId, resetEvidence]);

  const batch = batches.data?.find((b) => b.id === f.batch);
  const units = (batch?.units ?? []).filter((u) => !u.ended_on);
  const options = cat.data?.signs[groupOf(cat.data?.groups, batch?.species)] ?? [];
  const toggle = (s: string) => setSigns((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  const pick = async (file?: File) => {
    if (!file) return;
    try { const blob = await shrinkPhoto(file); setPhoto({ blob, url: URL.createObjectURL(blob) }); } catch (e) { setError((e as Error).message); }
  };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const code = batches.data?.find((b) => b.id === f.batch)?.code ?? "the batch";
      const cid = newId();
      const r = await saveOffline(ws.orgId, "health.case", { batch_id: f.batch, unit_id: f.unit || (units.length === 1 ? units[0].unit_id : null), opened_on: f.on, signs,
        affected: f.affected ? Number(f.affected) : null, description: f.description || null, suspected: f.suspected || null, hold_sales: f.hold },
        `Sick animals in ${code}`, { photo: photo?.blob, clientId: cid });
      await evidence.attach(refOf(r, cid), `sick animals in ${code}`);
      qc.invalidateQueries({ queryKey: ["health", ws.orgId] }); qc.invalidateQueries({ queryKey: ["farm", ws.orgId] });
      toast(r.status === "queued" ? `Saved on this phone. The report for ${code} sends when you are back online.`
        : f.hold ? `Reported. Sales from ${code} are on hold` : `Reported for ${code}`);
      onClose();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save."); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Report sick animals" eyebrow="Health"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={busy} disabled={!f.batch || (!signs.length && f.description.trim().length < 3)} onClick={save}>Report</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Batch" htmlFor="c-batch">
            <Select id="c-batch" value={f.batch} disabled={!!batchId} onChange={(e) => { setF({ ...f, batch: e.target.value, unit: "" }); setSigns([]); }}>
              <option value="">Choose a batch</option>
              {batches.data?.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.units.filter((u) => !u.ended_on).map((u) => u.unit_code).join(", ")}</option>)}
            </Select>
          </Field>
          <Field label="Unit" htmlFor="c-unit">
            <Select id="c-unit" value={f.unit} disabled={units.length < 2} onChange={(e) => setF({ ...f, unit: e.target.value })}>
              <option value="">{units.length === 1 ? units[0].unit_code : "Not sure / several"}</option>
              {units.length > 1 && units.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.unit_code}</option>)}
            </Select>
          </Field>
          <Field label="Since" htmlFor="c-on"><Input id="c-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        </div>
        {batch && (
          <div>
            <span className="text-[12.5px] font-semibold text-ink-2">What do you see?</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {options.map((s) => (
                <button key={s} type="button" aria-pressed={signs.includes(s)} onClick={() => toggle(s)}
                  className={cn("rounded-full border px-3 py-1.5 text-[13px]", signs.includes(s) ? "border-crit bg-crit-soft font-semibold text-crit" : "border-line bg-surface text-ink-2 hover:border-ink-3")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <Field label="How many look sick" htmlFor="c-affected" hint="Rough count"><Input id="c-affected" inputMode="numeric" value={f.affected} onChange={(e) => setF({ ...f, affected: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Anything else" htmlFor="c-desc" hint={signs.length ? "Optional" : "Describe it if none of the above fit"}>
            <Textarea id="c-desc" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Started in the corner by the door…" />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take a photo" onChange={(e) => pick(e.target.files?.[0])} />
          {photo ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="Sick animals" className="max-h-48 rounded-xl border border-line" />
              <button type="button" aria-label="Remove photo" onClick={() => setPhoto(null)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-[var(--scrim)] text-white"><X size={16} /></button>
            </div>
          ) : <div><Button size="sm" onClick={() => fileRef.current?.click()}><Camera size={15} /> Add a photo for the vet</Button></div>}
        </div>
        <div className="rounded-xl border border-line p-3">
          <Checkbox checked={f.hold} onChange={(v) => setF({ ...f, hold: v })} label="Hold all sales from this batch"
            description="Nothing from it can be sold or eaten until a supervisor or vet closes this case or lifts the hold." />
        </div>
        {evidence.field}
      </div>
    </Dialog>
  );
}
