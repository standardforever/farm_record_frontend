"use client";

import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/format";
import { type Hold, holdWhen, PRODUCT_LABEL } from "./api";

type HoldLike = Pick<Hold, "batch_id" | "batch_code" | "unit_codes" | "product" | "until" | "clear_on" | "reason"> & Partial<Hold>;

/** Batches whose animals, eggs or milk may not be sold or eaten. Used on Health, Today and batch pages. */
export function HoldList({ holds, title = "Do not sell or eat", compact, showBatch = true }: {
  holds: HoldLike[]; title?: string; compact?: boolean; showBatch?: boolean;
}) {
  if (!holds.length) return null;
  return (
    <section role="alert" aria-label={title} className="rounded-[14px] border border-[color-mix(in_oklab,var(--crit)_35%,transparent)] bg-crit-soft p-3.5 sm:p-4">
      <h2 className="flex items-center gap-2 text-[14px] font-bold text-crit"><ShieldAlert size={17} className="shrink-0" /> {title}</h2>
      <ul className={cn("mt-2 flex flex-col", compact ? "gap-1.5" : "gap-2.5")}>
        {holds.map((h, i) => (
          <li key={`${h.batch_id}-${h.source_id ?? i}-${h.product}`} className="text-[13.5px] leading-snug text-ink">
            <b>{showBatch && <>{h.batch_code}{h.unit_codes.length ? ` (${h.unit_codes.join(", ")})` : ""} · </>}{PRODUCT_LABEL[h.product]}</b>{" "}
            <span className="whitespace-nowrap">{holdWhen(h)}</span>
            {!compact && <span className="block text-[12.5px] text-ink-2">{h.reason}{h.via_batch_code ? ` — animals came from ${h.via_batch_code}` : ""}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
