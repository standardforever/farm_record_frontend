"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Dialog, Field, Input, Segmented, Select, Textarea, useToast } from "@/components/ui";
import { useFarmMap } from "@/features/farm";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError, get } from "@/lib/api";
import { cn } from "@/lib/format";
import { newId, save as saveOffline } from "@/features/offline/queue";
import { refOf } from "@/features/evidence/api";
import { useFormEvidence } from "@/features/evidence/useFormEvidence";

export type QuickKind = "feed" | "deaths" | "weight" | "eggs" | "water" | "note";
export const QUICK: { kind: QuickKind; label: string; hint: string }[] = [
  { kind: "feed", label: "Feed", hint: "kg or bags" },
  { kind: "deaths", label: "Deaths", hint: "count and cause" },
  { kind: "weight", label: "Weigh", hint: "sample average" },
  { kind: "eggs", label: "Eggs", hint: "collected, cracked" },
  { kind: "water", label: "Water", hint: "pH, oxygen…" },
  { kind: "note", label: "Note", hint: "anything seen" },
];
const TITLE: Record<QuickKind, string> = { feed: "Log feed", deaths: "Log deaths", weight: "Log a weigh-in", eggs: "Log eggs", water: "Log water quality", note: "Write an observation" };
const CAUSES = ["Disease", "Heat stress", "Low oxygen", "Predator", "Injury", "Pile-up", "Unknown"];
const LAST_FEED = "oko.lastFeed";

type FeedItem = { id: string; name: string; unit: string; pack_size: number | null; in_stock: number };

const n = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));
const digits = (v: string) => v.replace(/[^\d.]/g, "");

/** One sheet for every quick log. Saved through the offline queue, so a weak network never loses a log. */
export function QuickLog({ kind, on, presetUnit, open, onClose, onSaved }: {
  kind: QuickKind | null; on: string; presetUnit?: string | null; open: boolean; onClose: () => void; onSaved?: (unitId: string) => void;
}) {
  const ws = useCurrentWorkspace();
  const qc = useQueryClient();
  const farm = useFarmMap(ws.orgId, false, open);
  const toast = useToast();
  const [unit, setUnit] = useState("");
  const [batch, setBatch] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [feedMode, setFeedMode] = useState<"kg" | "bags">("bags");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const evidence = useFormEvidence("farm_record", { hint: "A photo of the feed bags, the dead birds, the scale or the water test. It is sent with the record, even with no network." });
  const resetEvidence = evidence.reset;
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  // Feed from stock: the feed log takes it off its delivery lots and prices it onto the batch.
  // (Same query key as the Stock screens, so they share the list.)
  const stockOn = kind === "feed" && ws.has("inventory") && ws.can("inventory.view");
  const feeds = useQuery({ queryKey: ["inventory", ws.orgId, "items", "feed"], enabled: open && stockOn,
    queryFn: () => get<FeedItem[]>(`/organizations/${ws.orgId}/inventory/items?category=feed`) });
  const feedItems = (feeds.data ?? []).filter((i) => i.unit === "kg" || (i.unit === "bag" && i.pack_size));
  const occupied = useMemo(() => farm.data?.unit_batches ?? {}, [farm.data]);
  const units = useMemo(() => {
    const all = (farm.data?.sites ?? []).flatMap((s) => s.units.filter((u) => !u.archived_at));
    const needAnimals = kind && kind !== "water" && kind !== "note";
    return (needAnimals ? all.filter((u) => occupied[u.id]?.length) : all)
      .sort((a, b) => Number(!!occupied[b.id]?.length) - Number(!!occupied[a.id]?.length));
  }, [farm.data, kind, occupied]);
  const batches = unit ? occupied[unit] ?? [] : [];

  useEffect(() => {
    if (!open) return;
    setError(null); setBatch(""); resetEvidence();
    let last: Record<string, string> = {};
    try { last = JSON.parse(localStorage.getItem(LAST_FEED) ?? "{}"); } catch { /* ignore */ }
    setF({ bag_kg: last.bag_kg ?? "25", feed_name: last.feed_name ?? "", item: last.item ?? "", sample_size: "20" });
    setUnit(presetUnit ?? "");
  }, [open, kind, presetUnit, resetEvidence]);
  useEffect(() => { if (open && !unit && units.length === 1) setUnit(units[0].id); }, [open, unit, units]);
  // Keep the remembered feed only if it is still in the list; with one feed, pick it.
  useEffect(() => {
    if (!open || !feeds.data) return;
    setF((x) => {
      const keep = feedItems.find((i) => i.id === x.item) ?? (feedItems.length === 1 ? feedItems[0] : undefined);
      return { ...x, item: keep?.id ?? "", ...(keep?.pack_size ? { bag_kg: String(keep.pack_size) } : {}) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, feeds.data]);

  if (!kind) return null;
  const batchId = batch || (batches.length === 1 ? batches[0].id : "");
  const needsBatch = kind !== "water" && kind !== "note";
  const ready = !!unit && (!needsBatch || !!batchId) && (() => {
    switch (kind) {
      case "feed": return feedMode === "kg" ? !!n(f.kg ?? "") : !!n(f.bags ?? "") && !!n(f.bag_kg ?? "");
      case "deaths": return !!n(f.count ?? "");
      case "weight": return !!n(f.avg ?? "");
      case "eggs": return n(f.crates ?? "") !== undefined || n(f.eggs ?? "") !== undefined;
      case "water": return ["ph", "do", "temp", "ammonia", "nitrite"].some((k) => n(f[k] ?? "") !== undefined);
      case "note": return !!f.note?.trim();
    }
  })();
  const eggs = (n(f.crates ?? "") ?? 0) * 30 + (n(f.eggs ?? "") ?? 0);
  const fromStock = feedItems.find((i) => i.id === f.item);
  const feedKg = feedMode === "kg" ? n(f.kg ?? "") ?? 0 : (n(f.bags ?? "") ?? 0) * (n(f.bag_kg ?? "") ?? 0);
  const stockKg = fromStock ? (fromStock.unit === "bag" ? fromStock.in_stock * (fromStock.pack_size ?? 0) : fromStock.in_stock) : 0;
  const code = units.find((u) => u.id === unit)?.code ?? "";

  const save = async () => {
    setError(null); setBusy(true);
    try {
      let op = "farm.record";
      let params: Record<string, string> = {};
      let body: Record<string, unknown> = { kind, unit_id: unit, occurred_on: on, note: f.note?.trim() || null };
      let label = "";
      if (kind === "deaths") {
        op = "farm.batch_event"; params = { batch_id: batchId };
        body = { kind: "died", unit_id: unit, quantity: n(f.count!), occurred_on: on, reason: f.reason || null, note: f.note?.trim() || null };
        label = `${Number(f.count).toLocaleString("en-NG")} died in ${code}`;
      } else {
        body.batch_id = batchId || null;
        if (kind === "feed") {
          Object.assign(body, feedMode === "kg" ? { quantity_kg: n(f.kg!) } : { bags: n(f.bags!), bag_kg: n(f.bag_kg!) },
            fromStock ? { stock_item_id: fromStock.id, feed_name: fromStock.name } : { feed_name: f.feed_name || null });
          try { localStorage.setItem(LAST_FEED, JSON.stringify({ bag_kg: f.bag_kg, feed_name: f.feed_name, item: f.item })); } catch { /* ignore */ }
          label = `Feed for ${code}: ${feedMode === "kg" ? `${f.kg} kg` : `${f.bags} × ${f.bag_kg} kg`}`;
        } else if (kind === "weight") { Object.assign(body, { avg_weight_g: n(f.avg!), sample_size: n(f.sample_size ?? "") }); label = `Weigh-in ${code}: ${f.avg} g`; }
        else if (kind === "eggs") { Object.assign(body, { eggs, cracked: n(f.cracked ?? "") ?? 0 }); label = `${eggs} eggs from ${code}`; }
        else if (kind === "water") { Object.assign(body, { ph: n(f.ph ?? ""), do_mg_l: n(f.do ?? ""), temp_c: n(f.temp ?? ""), ammonia: n(f.ammonia ?? ""), nitrite: n(f.nitrite ?? "") }); label = `Water in ${code}`; }
        else label = `Note on ${code}`;
      }
      const cid = newId();
      const res = await saveOffline(ws.orgId, op, body, label, { params, clientId: cid });
      await evidence.attach(refOf(res, cid), label, op === "farm.batch_event" ? "batch_event" : "farm_record");
      toast(res.status === "queued" ? `Saved on this phone: ${label}` : `${label} ✓`);
      qc.invalidateQueries({ queryKey: ["farm", ws.orgId] });
      onSaved?.(unit);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save.");
    } finally { setBusy(false); }
  };

  const big = "h-12 text-[18px] tnum";
  return (
    <Dialog open={open} onClose={onClose} title={TITLE[kind]} eyebrow="Quick log"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" size="lg" loading={busy} disabled={!ready} onClick={save}>Save</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        {farm.data && units.length === 0 ? (
          <Alert tone="warn">{needsBatch ? "No unit has animals in it. Stock a batch first." : "There are no units yet."}</Alert>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink-2">Which unit?</span>
            <div className="flex flex-wrap gap-2">
              {units.map((u) => (
                <button key={u.id} type="button" onClick={() => { setUnit(u.id); setBatch(""); }} aria-pressed={unit === u.id}
                  className={cn("min-w-[64px] cursor-pointer rounded-xl border px-3 py-2 text-left font-mono font-semibold", unit === u.id ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-ink-3")}>
                  {u.code}{occupied[u.id]?.length ? <span className="block font-sans text-[11px] font-normal text-ink-3">{occupied[u.id].reduce((a, b) => a + b.count, 0).toLocaleString("en-NG")}</span> : null}
                </button>
              ))}
            </div>
          </div>
        )}
        {needsBatch && batches.length > 1 && (
          <Field label="Which batch?" htmlFor="q-batch"><Select id="q-batch" value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="">Choose…</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.count.toLocaleString("en-NG")}</option>)}</Select></Field>
        )}

        {kind === "feed" && (<>
          <Segmented value={feedMode} onChange={setFeedMode} options={[{ value: "bags", label: "Bags" }, { value: "kg", label: "Kilograms" }]} />
          {feedMode === "bags" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bags" htmlFor="q-bags"><Input id="q-bags" className={big} inputMode="decimal" value={f.bags ?? ""} onChange={(e) => set("bags", digits(e.target.value))} placeholder="2 or 1.5" /></Field>
              <Field label="Bag size (kg)" htmlFor="q-bagkg"><Input id="q-bagkg" className={big} inputMode="decimal" value={f.bag_kg ?? ""} onChange={(e) => set("bag_kg", digits(e.target.value))} /></Field>
            </div>
          ) : <Field label="Kilograms" htmlFor="q-kg"><Input id="q-kg" className={big} inputMode="decimal" value={f.kg ?? ""} onChange={(e) => set("kg", digits(e.target.value))} /></Field>}
          {feedItems.length > 0 && (
            <Field label="Which feed" htmlFor="q-item" hint={fromStock ? `${Math.max(stockKg, 0).toLocaleString("en-NG")} kg in stock` : "Not from stock: no cost goes on the batch"}>
              <Select id="q-item" value={f.item ?? ""} onChange={(e) => {
                const it = feedItems.find((i) => i.id === e.target.value);
                setF((x) => ({ ...x, item: e.target.value, ...(it?.pack_size ? { bag_kg: String(it.pack_size) } : {}) }));
              }}>
                {feedItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                <option value="">Other feed (not in stock)</option>
              </Select>
            </Field>
          )}
          {fromStock && feedKg > stockKg && <Alert tone="warn">That is more than the {Math.max(stockKg, 0).toLocaleString("en-NG")} kg recorded in stock. It is still saved; record the delivery in Stock and it will be covered and priced.</Alert>}
          {!fromStock && <Field label="Feed" htmlFor="q-feed" hint="Optional, e.g. Starter, Grower, 4 mm floating"><Input id="q-feed" value={f.feed_name ?? ""} maxLength={80} onChange={(e) => set("feed_name", e.target.value)} /></Field>}
        </>)}

        {kind === "deaths" && (<>
          <Field label="How many died" htmlFor="q-count"><Input id="q-count" className={big} inputMode="numeric" value={f.count ?? ""} onChange={(e) => set("count", e.target.value.replace(/\D/g, ""))} /></Field>
          <div className="flex flex-wrap gap-2">{CAUSES.map((c) => (
            <button key={c} type="button" onClick={() => set("reason", f.reason === c ? "" : c)} aria-pressed={f.reason === c}
              className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-[13px] font-semibold", f.reason === c ? "border-brand bg-brand-soft text-brand" : "border-line")}>{c}</button>))}</div>
        </>)}

        {kind === "weight" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Average weight (g)" htmlFor="q-avg"><Input id="q-avg" className={big} inputMode="decimal" value={f.avg ?? ""} onChange={(e) => set("avg", digits(e.target.value))} /></Field>
            <Field label="How many weighed" htmlFor="q-sample"><Input id="q-sample" className={big} inputMode="numeric" value={f.sample_size ?? ""} onChange={(e) => set("sample_size", e.target.value.replace(/\D/g, ""))} /></Field>
          </div>
        )}

        {kind === "eggs" && (<>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full crates (30)" htmlFor="q-crates"><Input id="q-crates" className={big} inputMode="numeric" value={f.crates ?? ""} onChange={(e) => set("crates", e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Loose eggs" htmlFor="q-eggs"><Input id="q-eggs" className={big} inputMode="numeric" value={f.eggs ?? ""} onChange={(e) => set("eggs", e.target.value.replace(/\D/g, ""))} /></Field>
          </div>
          <p className="-mt-2 text-[13px] text-ink-2">Total: <b className="tnum">{eggs.toLocaleString("en-NG")}</b> eggs</p>
          <Field label="Cracked or broken" htmlFor="q-cracked"><Input id="q-cracked" inputMode="numeric" value={f.cracked ?? ""} onChange={(e) => set("cracked", e.target.value.replace(/\D/g, ""))} /></Field>
        </>)}

        {kind === "water" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[["ph", "pH", "6.5–8.5"], ["do", "Oxygen (mg/L)", "above 4"], ["temp", "Temperature (°C)", "26–30"], ["ammonia", "Ammonia (mg/L)", "below 0.5"], ["nitrite", "Nitrite (mg/L)", "below 0.3"]].map(([k, label, hint]) => (
              <Field key={k} label={label} htmlFor={`q-${k}`} hint={`Good: ${hint}`}><Input id={`q-${k}`} inputMode="decimal" value={f[k] ?? ""} onChange={(e) => set(k, digits(e.target.value))} /></Field>
            ))}
          </div>
        )}

        <Field label={kind === "note" ? "What did you see?" : "Note"} htmlFor="q-note" hint={kind === "note" ? undefined : "Optional"}>
          {kind === "note" ? <Textarea id="q-note" rows={3} value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} placeholder="Birds panting in H2 by noon" />
            : <Input id="q-note" value={f.note ?? ""} maxLength={300} onChange={(e) => set("note", e.target.value)} />}
        </Field>
        {evidence.field}
      </div>
    </Dialog>
  );
}
