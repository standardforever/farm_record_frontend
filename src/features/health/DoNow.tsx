"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Pill, ShieldAlert, Stethoscope, Syringe } from "lucide-react";
import { Button, Card, useToast } from "@/components/ui";
import { useComplete } from "@/features/daily";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import { type Dose, type Overview, courseNow, holdWhen, PRODUCT_LABEL, shortDay, today } from "./api";

type Item = { key: string; tone: "crit" | "warn" | "brand"; icon: React.ReactNode; title: React.ReactNode; sub: React.ReactNode; href?: string; dose?: Dose };

/** Everything in Health that needs someone now, most urgent first. */
export function DoNow({ d }: { d: Overview }) {
  const ws = useCurrentWorkspace();
  const complete = useComplete(ws.orgId);
  const toast = useToast();
  const canTick = ws.can("farm.edit") || ws.can("farm.approve");
  const on = today();
  const w = (p: string) => `/w/${ws.orgId}${p}`;
  const where = (code: string | null, unit: string | null) => `${code ?? ""}${unit ? ` · ${unit}` : ""}`;

  const items: Item[] = [
    ...d.vaccinations.filter((x) => x.status === "overdue").map((x): Item => ({
      key: `v-${x.task_id}`, tone: "crit", icon: <Syringe size={16} />, dose: x,
      title: <>{x.vaccine} was due {shortDay(x.due_on)}</>, sub: <>{where(x.batch_code, x.unit_code)}{x.route ? ` · ${x.route}` : ""} · give it as soon as you can</> })),
    ...d.open_cases.map((c): Item => ({
      key: `c-${c.id}`, tone: "crit", icon: <Stethoscope size={16} />, href: w(`/health/cases/${c.id}`),
      title: <>Sick: {c.diagnosis ?? c.suspected ?? (c.signs.slice(0, 2).join(", ") || "animals reported sick")}</>,
      sub: <>{where(c.batch_code, c.unit_code)}{c.affected ? ` · ${c.affected.toLocaleString()} affected` : ""} · since {shortDay(c.opened_on)}{c.diagnosis ? "" : " · no diagnosis yet"}</> })),
    ...d.vaccinations.filter((x) => x.status === "due").map((x): Item => ({
      key: `v-${x.task_id}`, tone: "warn", icon: <Syringe size={16} />, dose: x,
      title: <>{x.vaccine} today</>, sub: <>{where(x.batch_code, x.unit_code)}{x.route ? ` · ${x.route}` : ""}</> })),
    ...d.recent.flatMap((t): Item[] => {
      const c = courseNow(t, on);
      return c ? [{ key: `t-${t.id}`, tone: "brand", icon: <Pill size={16} />, href: w(`/health/treatments/${t.id}`),
        title: <>{t.product}: day {c.day} of {c.of}</>, sub: <>{where(t.batch_code, t.unit_code)}{t.dose ? ` · ${t.dose}` : ""}{t.route ? ` · ${t.route}` : ""} · last day {shortDay(t.end_on)}</> }] : [];
    }),
    ...d.holds.map((h): Item => ({
      key: `h-${h.batch_id}-${h.source_id}-${h.product}`, tone: "crit", icon: <ShieldAlert size={16} />,
      href: w(h.source === "case" ? `/health/cases/${h.source_id}` : `/health/treatments/${h.source_id}`),
      title: <>Do not sell or eat: {PRODUCT_LABEL[h.product].toLowerCase()} from {h.batch_code}{h.unit_codes.length ? ` (${h.unit_codes.join(", ")})` : ""}</>,
      sub: <>{holdWhen(h)} · {h.reason}{h.via_batch_code ? ` (animals came from ${h.via_batch_code})` : ""}</> })),
  ];

  const give = async (x: Dose) => {
    try { await complete.mutateAsync({ taskId: x.task_id, on: x.due_on }); toast(`Recorded: ${x.vaccine} for ${x.batch_code}`); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not save", "crit"); }
  };

  if (!items.length) {
    return (
      <div className="flex items-center gap-2.5 rounded-[14px] border border-line bg-surface px-4 py-3.5 text-[14px]" data-testid="do-now">
        <CheckCircle2 size={18} className="text-good" /><span><b>Nothing needs doing.</b> <span className="text-ink-2">No sick animals, no vaccines due, everything may be sold.</span></span>
      </div>
    );
  }
  return (
    <Card flush title="Do now" meta={`${items.length} thing${items.length === 1 ? "" : "s"}`}>
      <ul className="divide-y divide-line" data-testid="do-now">
        {items.map((it) => {
          const body = (
            <>
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                it.tone === "crit" ? "bg-crit-soft text-crit" : it.tone === "warn" ? "bg-maize-soft text-warn" : "bg-brand-soft text-brand")}>
                {it.tone === "crit" && !it.href && !it.dose ? <AlertTriangle size={16} /> : it.icon}</span>
              <span className="min-w-0 flex-1"><b className="block text-[14px]">{it.title}</b><span className="block text-[12.5px] text-ink-3">{it.sub}</span></span>
            </>
          );
          return (
            <li key={it.key}>
              {it.href ? (
                <Link href={it.href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">{body}<ChevronRight size={17} className="shrink-0 text-ink-3" aria-hidden /></Link>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">{body}
                  {it.dose && canTick && <Button size="sm" variant={it.tone === "crit" ? "primary" : "secondary"} disabled={complete.isPending}
                    aria-label={`Mark ${it.dose.vaccine} for ${it.dose.batch_code} given`} onClick={() => give(it.dose!)}>Given</Button>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
