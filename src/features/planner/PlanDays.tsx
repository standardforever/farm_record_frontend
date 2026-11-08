"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, Coins, Pencil, Plus, RotateCcw, Search, StickyNote, Syringe, Trash2, Wheat } from "lucide-react";
import { Alert, Badge, Button, Card, Dialog, Field, Input, Textarea, useToast } from "@/components/ui";
import { shiftDay } from "@/features/daily/api";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, formatDate, naira } from "@/lib/format";
import { type Plan, type PlanDay, useAddDay, useDeleteDay, useEditDay } from "./api";

const ICON = { prepare: ClipboardCheck, feed_phase: Wheat, vaccination: Syringe, check: Search, harvest: Coins, custom: StickyNote };
const KIND = { prepare: "Before they arrive", feed_phase: "Feed change", vaccination: "Vaccination", check: "Check", harvest: "Selling", custom: "Your own" };

const weekLabel = (d: PlanDay, age0: number) => (d.day < age0 ? "Before they arrive" : `Week ${Math.floor((d.day - age0) / 7) + 1}`);

/** The plan day by day. Nothing is fixed: move, rename, take out or add any day. */
export function PlanDays({ plan }: { plan: Plan }) {
  const ws = useCurrentWorkspace();
  const edit = useEditDay(ws.orgId, plan.id);
  const remove = useDeleteDay(ws.orgId, plan.id);
  const toast = useToast();
  const canEdit = ws.can("farm.approve");
  const [editing, setEditing] = useState<PlanDay | "new" | null>(null);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});  // ticks show at once, even on a slow connection
  const today = new Date().toISOString().slice(0, 10);

  const groups: [string, PlanDay[]][] = [];
  for (const d of plan.days) {
    const label = weekLabel(d, plan.age_at_start_days);
    const g = groups.find(([l]) => l === label);
    if (g) g[1].push(d); else groups.push([label, [d]]);
  }

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    try { await fn(); if (done) toast(done); } catch (e) { toast(e instanceof ApiError ? e.message : "Could not change the plan.", "crit"); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[640px] text-[13px] text-ink-2">
          {plan.batch_id ? `${plan.batch_code} follows this plan: changes here move its tasks in Today.` : "When you stock the batch from this plan, these days become its tasks in Today."}
          {" "}Move any day to suit your farm; feed changes and vaccines moved here change the feed and vaccine bill too.</p>
        {canEdit && <Button size="sm" onClick={() => setEditing("new")}><Plus size={15} /> Add a day</Button>}
      </div>
      {groups.map(([label, items]) => (
        <Card key={label} flush title={label} meta={items[0] && !items[0].before_stock ? `From ${formatDate(shiftDay(plan.start_on, Math.floor((items[0].day - plan.age_at_start_days) / 7) * 7))}` : undefined}>
          <ul className="divide-y divide-line">
            {items.map((d) => {
              const Icon = ICON[d.kind];
              const past = !!plan.batch_id && d.on < today;
              return (
                <li key={d.id} data-day={d.id} className={cn("flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-3", (d.removed || past) && "opacity-55")}>
                  {d.kind === "prepare" ? (
                    <input type="checkbox" aria-label={`Done: ${d.title}`} disabled={!canEdit} checked={ticked[d.id] ?? !!d.done}
                      onChange={(e) => {
                        const done = e.target.checked;
                        setTicked((t) => ({ ...t, [d.id]: done }));
                        act(() => edit.mutateAsync({ item: d.id, done }).catch((err) => { setTicked((t) => ({ ...t, [d.id]: !done })); throw err; }));
                      }}
                      className="mt-1 h-[18px] w-[18px] shrink-0 accent-[var(--brand)]" />
                  ) : (
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                      d.kind === "vaccination" ? "bg-water-soft text-water" : d.kind === "harvest" ? "bg-good-soft text-good" : d.kind === "feed_phase" ? "bg-maize-soft text-warn" : "bg-surface-2 text-ink-2")}>
                      <Icon size={16} /></span>
                  )}
                  <div className="min-w-0 flex-1 basis-[220px]">
                    <div className={cn("text-[14px] font-semibold", (d.removed || (d.kind === "prepare" && (ticked[d.id] ?? d.done))) && "line-through")}>{d.title}</div>
                    <div className="text-[12.5px] text-ink-3">{formatDate(d.on)} · day {d.day} · {KIND[d.kind]}</div>
                    {d.note && <div className="mt-0.5 text-[12.5px] text-ink-2">{d.note}</div>}
                    {d.moved_note && !d.removed && <div className="mt-1 text-[12.5px] text-warn">{d.moved_note} Check with your vet or supplier if unsure.</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {d.removed && <Badge>Taken out</Badge>}
                    {!d.removed && d.edited && d.kind !== "custom" && d.kind !== "prepare" && <Badge tone="maize">Changed</Badge>}
                    {canEdit && !past && (
                      <>
                        {!d.removed && <button type="button" aria-label={`Change ${d.title}`} onClick={() => setEditing(d)}
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"><Pencil size={15} /></button>}
                        {d.kind === "custom" ? (
                          <button type="button" aria-label={`Delete ${d.title}`} onClick={() => act(() => remove.mutateAsync(d.id), "Day deleted")}
                            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-crit"><Trash2 size={15} /></button>
                        ) : d.kind !== "harvest" && (
                          d.removed
                            ? <Button size="sm" variant="ghost" onClick={() => act(() => edit.mutateAsync({ item: d.id, removed: false }))}><RotateCcw size={14} /> Put back</Button>
                            : <button type="button" aria-label={`Take out ${d.title}`} onClick={() => act(() => edit.mutateAsync({ item: d.id, removed: true }), "Taken out of the plan")}
                              className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-crit"><Trash2 size={15} /></button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      <DayDialog plan={plan} day={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function DayDialog({ plan, day, onClose }: { plan: Plan; day: PlanDay | "new" | null; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const edit = useEditDay(ws.orgId, plan.id);
  const add = useAddDay(ws.orgId, plan.id);
  const [f, setF] = useState({ day: "", title: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  const isNew = day === "new";
  useEffect(() => {
    if (!day) return;
    setError(null);
    setF(day === "new" ? { day: String(plan.age_at_start_days + 7), title: "", note: "" } : { day: String(day.day), title: day.title, note: day.note ?? "" });
  }, [day, plan.age_at_start_days]);
  const n = Number(f.day);
  const valid = f.day.trim() !== "" && !Number.isNaN(n) && f.title.trim().length > 0;
  const on = valid ? shiftDay(plan.start_on, n - plan.age_at_start_days) : null;
  const harvest = day && day !== "new" && day.kind === "harvest";

  const save = async () => {
    setError(null);
    try {
      if (isNew) await add.mutateAsync({ day: n, title: f.title.trim(), note: f.note || null });
      else if (day) await edit.mutateAsync({ item: day.id, day: n, title: f.title.trim(), note: f.note || null });
      onClose();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save."); }
  };

  return (
    <Dialog open={!!day} onClose={onClose} title={isNew ? "Add a day" : "Change this day"} eyebrow="Plan"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!valid} loading={edit.isPending || add.isPending} onClick={save}>{isNew ? "Add" : "Save"}</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Age (day)" htmlFor="pd-day" hint={on ? formatDate(on) : undefined}>
            <Input id="pd-day" inputMode="numeric" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value.replace(/[^\d-]/g, "").replace(/(?!^)-/g, "") })} /></Field>
          <Field label="Or pick the date" htmlFor="pd-date">
            <Input id="pd-date" type="date" value={on ?? ""} onChange={(e) => {
              if (!e.target.value) return;
              const diff = Math.round((new Date(e.target.value + "T12:00:00").getTime() - new Date(plan.start_on + "T12:00:00").getTime()) / 86400000);
              setF({ ...f, day: String(plan.age_at_start_days + diff) });
            }} /></Field>
        </div>
        <Field label="What" htmlFor="pd-title"><Input id="pd-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Deworm, call the buyer, clean drinkers…" /></Field>
        <Field label="Note" htmlFor="pd-note" hint="Optional"><Textarea id="pd-note" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        {harvest && <p className="text-[12.5px] text-ink-3">Moving the selling day changes how long you feed them, so the feed bill and profit change too.</p>}
        {day && day !== "new" && day.usual_day != null && day.kind !== "harvest" && day.kind !== "prepare" &&
          <p className="text-[12.5px] text-ink-3">The guide says day {day.usual_day}.</p>}
      </div>
    </Dialog>
  );
}

/** Money out and in, week by week, and what to buy each week. */
export function PlanCash({ plan }: { plan: Plan }) {
  const r = plan.result;
  if (!r?.weeks) return null;
  const short = r.short_from_week;
  return (
    <Card flush title="Week by week" meta={r.available != null ? `Your accounts have ${naira(r.available)} now` : "What to buy each week, and the money it takes"}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead><tr className="border-b border-line text-left text-[12px] text-ink-3">
            <th className="px-4 py-2 font-semibold">Week</th><th className="px-2 py-2 font-semibold">Buy or do</th>
            <th className="px-2 py-2 text-right font-semibold">Money out</th><th className="px-2 py-2 text-right font-semibold">Money in</th>
            <th className="px-4 py-2 text-right font-semibold">Spent so far</th></tr></thead>
          <tbody>{r.weeks.map((w) => {
            const over = short != null && w.week >= short && r.available != null && w.spent_so_far - w.back_so_far + w.in > r.available;
            return (
              <tr key={w.week} className={cn("border-b border-line align-top last:border-0", over && "bg-crit-soft")}>
                <td className="whitespace-nowrap px-4 py-2.5"><b>{w.label}</b>{w.from_on && <div className="text-[12px] text-ink-3">{formatDate(w.from_on)}</div>}</td>
                <td className="px-2 py-2.5 text-ink-2">{w.buy.length ? w.buy.join(" · ") : "—"}</td>
                <td className="px-2 py-2.5 text-right font-mono tnum">{w.out ? naira(w.out) : "—"}</td>
                <td className="px-2 py-2.5 text-right font-mono tnum text-good">{w.in ? naira(w.in) : "—"}</td>
                <td className={cn("px-4 py-2.5 text-right font-mono tnum", over && "font-semibold text-crit")}>{naira(w.spent_so_far)}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </Card>
  );
}
