"use client";

import { useBatches } from "@/features/batches";
import { useCurrentWorkspace } from "@/features/workspaces";
import { cn } from "@/lib/format";

/** Pick any number of running batches (none is fine). Batches already picked but now closed stay shown. */
export function BatchPick({ value, onChange, open = true }: { value: string[]; onChange: (v: string[]) => void; open?: boolean }) {
  const ws = useCurrentWorkspace();
  const active = useBatches(ws.orgId, "active", open);
  const all = useBatches(ws.orgId, "", open && value.length > 0);
  const shown = [...(active.data ?? []), ...(all.data ?? []).filter((b) => value.includes(b.id) && b.status !== "active")];
  if (!shown.length) return <p className="text-[13px] text-ink-3">No running batches.</p>;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Batches">
      {shown.map((b) => {
        const on = value.includes(b.id);
        return (
          <button key={b.id} type="button" aria-pressed={on} onClick={() => toggle(b.id)}
            className={cn("rounded-full border px-3 py-1.5 text-left text-[13px] transition-colors",
              on ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line hover:border-brand/50")}>
            {b.code} <span className={cn("font-normal", on ? "text-brand/80" : "text-ink-3")}>· {b.current.toLocaleString("en-NG")} {b.species}{b.status !== "active" ? " · closed" : ""}</span>
          </button>
        );
      })}
    </div>
  );
}

export const ASIDE_HINT = "Optional. Only a label: any batch can still use it, but these batches use it first, and their pages show how long it lasts.";

