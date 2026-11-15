"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarHeart } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { localDay } from "@/features/daily/api";
import { useCurrentWorkspace } from "@/features/workspaces";
import { cn } from "@/lib/format";
import { type Upcoming, shortDate, useHerdOverview } from "./api";
import { ItemAction, actionFor } from "./Actions";

/** Today: breeding jobs that are late or due within a week (births, checks, weaning). Hidden when there are none. */
export function HerdToday() {
  const ws = useCurrentWorkspace();
  const q = useHerdOverview(ws.orgId);
  const [doing, setDoing] = useState<{ item: Upcoming; act: "check" | "birth" | "wean" | "mate" } | null>(null);
  const today = localDay();
  const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const items = (q.data?.items ?? []).filter((i) => i.kind !== "ready" && (i.late || i.kind === "overdue" || i.on <= week)).slice(0, 6);
  if (!items.length) return null;
  const edit = ws.can("farm.edit");
  return (
    <Card title={<span className="flex items-center gap-2"><CalendarHeart size={17} className="text-brand" /> Breeding</span>}
      action={<Link href={`/w/${ws.orgId}/herd`} className="text-[13px] font-semibold text-brand">All</Link>}>
      <ul className="flex flex-col">
        {items.map((i) => {
          const a = actionFor(i.kind);
          return (
            <li key={`${i.kind}-${i.animal_id}`} className="flex items-center gap-3 border-t border-line py-2 first:border-0 first:pt-0">
              <div className="min-w-0 flex-1">
                <b className="text-[13.5px]">{i.title}</b>
                <span className={cn("ml-2 text-[12px] font-semibold", i.late || i.kind === "overdue" ? "text-crit" : "text-ink-3")}>{i.on === today ? "Today" : shortDate(i.on)}</span>
              </div>
              {edit && a && <Button size="sm" variant="ghost" onClick={() => setDoing({ item: i, act: a.act })}>{a.label}</Button>}
            </li>
          );
        })}
      </ul>
      {doing && <ItemAction item={doing.item} act={doing.act} onClose={() => setDoing(null)} />}
    </Card>
  );
}
