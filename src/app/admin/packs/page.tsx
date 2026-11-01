"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Alert, Badge, Button, Card, Dialog, Field, Input, PageHeader, PageLoader, Select, Textarea, useToast } from "@/components/ui";
import { type PackSummary, useAddBreed, useAllPackVersions } from "@/features/packs";
import { useAuth } from "@/features/auth";
import { ApiError } from "@/lib/api";

/** Turn pasted rows "day, weight g, feed g" (commas, tabs or spaces) into points. */
function parseRows(text: string, cols: number): number[][] | string {
  const rows = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const out: number[][] = [];
  for (const [i, line] of rows.entries()) {
    const nums = line.split(/[\s,;\t]+/).filter(Boolean).map(Number);
    if (nums.length !== cols || nums.some((n) => Number.isNaN(n))) return `Line ${i + 1} needs ${cols} numbers: “${line}”`;
    out.push(nums);
  }
  return out;
}

export default function Packs() {
  const versions = useAllPackVersions();
  const { me } = useAuth();
  const [adding, setAdding] = useState<PackSummary | null>(null);
  const canEdit = me?.user.platform_role === "super_admin" || me?.user.platform_role === "content";
  const byKey = new Map<string, PackSummary[]>();
  for (const v of versions.data ?? []) byKey.set(v.key, [...(byKey.get(v.key) ?? []), v]);

  return (
    <>
      <PageHeader eyebrow="Oko operations" title="Species packs"
        sub="Growth and lay standards, feed phases and vaccination schedules per species. New batches use the active version; existing batches keep theirs until upgraded." />
      {versions.isLoading ? <PageLoader /> : (
        <div className="grid gap-4 lg:grid-cols-3">
          {[...byKey.entries()].map(([key, vs]) => {
            const cur = vs.find((v) => v.active) ?? vs[0];
            return (
              <Card key={key} title={<span className="flex items-center gap-2">{cur.name} <Badge tone="brand">v{cur.version}</Badge>
                {cur.status === "reference" && <Badge tone="warn">Reference · not vet-reviewed</Badge>}</span>}
                meta={`${cur.vaccinations} vaccinations · ${cur.phases} feed phases`}
                action={canEdit ? <Button size="sm" onClick={() => setAdding(cur)}><Plus size={14} /> Breed</Button> : undefined}>
                <ul className="mb-3 flex flex-col gap-1 text-[13.5px]">{cur.breeds.map((b) => <li key={b.key}><b>{b.name}</b> <span className="font-mono text-[12px] text-ink-3">{b.key}</span></li>)}</ul>
                <div className="eyebrow mb-1">Versions</div>
                <ul className="flex flex-col gap-1 text-[12.5px] text-ink-2">{vs.map((v) => (
                  <li key={v.version}>v{v.version}{v.active ? " (active)" : ""} · {v.source === "file" ? "built in" : "published here"}{v.change_note ? ` · ${v.change_note}` : ""}</li>
                ))}</ul>
              </Card>
            );
          })}
        </div>
      )}
      <AddBreed pack={adding} onClose={() => setAdding(null)} />
    </>
  );
}

function AddBreed({ pack, onClose }: { pack: PackSummary | null; onClose: () => void }) {
  const add = useAddBreed();
  const toast = useToast();
  const [f, setF] = useState({ name: "", key: "", note: "", growth: "", lay: "", change: "", copy: "" });
  const [error, setError] = useState<string | null>(null);
  if (!pack) return null;
  const key = f.key || f.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
  const layers = pack.key === "layers";
  const save = async () => {
    setError(null);
    const growth = parseRows(f.growth, 3);
    if (typeof growth === "string") return setError(growth);
    const lay = f.lay.trim() ? parseRows(f.lay, 2) : null;
    if (typeof lay === "string") return setError(lay);
    try {
      const v = await add.mutateAsync({ pack: pack.key, ...breedBody(key, f.name, f.note, growth, lay), change_note: f.change || null });
      toast(`${pack.name} v${v.version} published with ${f.name}`); setF({ name: "", key: "", note: "", growth: "", lay: "", change: "", copy: "" }); onClose();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not publish."); }
  };
  return (
    <Dialog open={!!pack} onClose={onClose} title={`Add a breed to ${pack.name}`} eyebrow={`Publishes v${pack.version + 1}`} wide
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={add.isPending} disabled={f.name.trim().length < 2 || !f.growth.trim()} onClick={save}>Publish</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Breed name" htmlFor="br-name"><Input id="br-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Arbor Acres" /></Field>
          <Field label="Key" htmlFor="br-key" hint={`Used in the data: ${key || "…"}`}><Input id="br-key" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} placeholder={key} /></Field>
        </div>
        <Field label="Start from" htmlFor="br-copy" hint="Optional: copy a breed's numbers, then edit them"><Select id="br-copy" value={f.copy} onChange={async (e) => {
          const k = e.target.value; setF({ ...f, copy: k });
          if (!k) return;
          const full = await fetchBreed(pack.key, k);
          if (full) setF((x) => ({ ...x, copy: k, growth: full.growth.map((r: number[]) => r.join(", ")).join("\n"), lay: (full.lay ?? []).map((r: number[]) => r.join(", ")).join("\n") }));
        }}><option value="">Empty</option>{pack.breeds.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}</Select></Field>
        <Field label="Growth: one line per age — day, average weight (g), cumulative feed per head (g)" htmlFor="br-growth">
          <Textarea id="br-growth" rows={7} className="font-mono" value={f.growth} onChange={(e) => setF({ ...f, growth: e.target.value })} placeholder={"0, 42, 0\n7, 195, 165\n14, 500, 550"} /></Field>
        {layers && <Field label="Laying: one line per week — week of age, hen-day %" htmlFor="br-lay">
          <Textarea id="br-lay" rows={5} className="font-mono" value={f.lay} onChange={(e) => setF({ ...f, lay: e.target.value })} placeholder={"19, 10\n20, 35\n22, 85"} /></Field>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Note" htmlFor="br-note" hint="Shown to farmers"><Input id="br-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Approximate breeder targets" /></Field>
          <Field label="Why this change" htmlFor="br-change" hint="Kept in the version history"><Input id="br-change" value={f.change} onChange={(e) => setF({ ...f, change: e.target.value })} /></Field>
        </div>
        <p className="text-[12.5px] text-ink-3">Paste straight from a breeder guide or spreadsheet: commas, tabs or spaces all work. Batches already stocked keep their current version.</p>
      </div>
    </Dialog>
  );
}

function breedBody(key: string, name: string, note: string, growth: number[][], lay: number[][] | null) {
  return { key, name: name.trim(), note: note.trim() || undefined, growth, ...(lay ? { lay } : {}) };
}

async function fetchBreed(packKey: string, breedKey: string) {
  const { get } = await import("@/lib/api");
  const pack = await get<{ data: { breeds: { key: string; growth: number[][]; lay?: number[][] }[] } }>(`/farm/packs/${packKey}`);
  return pack.data.breeds.find((b) => b.key === breedKey) ?? null;
}

