import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/format";

export function Alert({ tone = "warn", title, children, action }: { tone?: "warn" | "crit" | "info" | "good"; title?: string; children?: ReactNode; action?: ReactNode }) {
  const t = { warn: "bg-maize-soft", crit: "bg-crit-soft", info: "bg-water-soft", good: "bg-good-soft" }[tone];
  const ic = { warn: "text-warn", crit: "text-crit", info: "text-water", good: "text-good" }[tone];
  return (
    <div className={cn("flex flex-wrap items-start gap-3 rounded-xl px-4 py-3 text-[13.5px]", t)} role={tone === "crit" ? "alert" : undefined}>
      <span className={cn("mt-0.5", ic)}>{tone === "info" ? <Info size={17} /> : <AlertTriangle size={17} />}</span>
      <div className="min-w-[200px] flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className="text-ink-2">{children}</div>}
      </div>
      {action}
    </div>
  );
}
