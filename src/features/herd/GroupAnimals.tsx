"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import type { Batch } from "@/features/batches";
import { useCurrentWorkspace } from "@/features/workspaces";
import { BREEDING, ageText, useAnimals } from "./api";
import { TagDialog } from "./Dialogs";

/** Batch page: the animals of this group kept one by one, and how many are still untagged. */
export function GroupAnimals({ b }: { b: Batch }) {
  const ws = useCurrentWorkspace();
  const show = BREEDING.includes(b.species);
  const q = useAnimals(ws.orgId, { batch_id: b.id }, show);
  const [tagging, setTagging] = useState(false);
  if (!show || !q.data) return null;
  const rows = q.data;
  const left = b.current - rows.length;
  const edit = b.status === "active" && ws.can("farm.edit");
  return (
    <Card title="Animals in this group" meta={rows.length ? `${rows.length} tagged${left > 0 ? `, ${left} not tagged` : ""}` : "Tag breeding animals to follow each one"}
      action={edit && left > 0 ? <Button size="sm" variant="ghost" onClick={() => setTagging(true)}><Plus size={15} /> Tag animals</Button> : undefined}>
      {!rows.length ? (
        <p className="text-[13.5px] text-ink-3">Feed, costs and counts stay on the group. Tag the does, ewes, sows, cows or bucks you breed from, and Oko plans their heat, pregnancy checks and births.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map((a) => (
            <li key={a.id}>
              <Link href={`/w/${ws.orgId}/herd/${a.id}`} className="flex items-center gap-2.5 rounded-[12px] border border-line px-3 py-2 hover:border-brand">
                <span className={a.sex === "female" ? "text-brand" : "text-ink-3"} aria-label={a.sex}>{a.sex === "female" ? "♀" : "♂"}</span>
                <span className="min-w-0 flex-1"><b className="font-mono text-[13.5px]">{a.tag}</b><span className="ml-1.5 text-[12px] text-ink-3">{ageText(a.age_days)}</span></span>
                {a.state && <Badge tone={a.state_tone} className="whitespace-normal text-right">{a.state}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <TagDialog open={tagging} onClose={() => setTagging(false)} batchId={b.id} />
    </Card>
  );
}
