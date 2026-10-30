import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function Card({ title, meta, action, children, className, flush }: {
  title?: ReactNode; meta?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-[14px] border border-line bg-surface", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2.5 px-4 pt-4">
          <div className="min-w-0">
            {title && <h3 className="text-[15.5px] font-semibold">{title}</h3>}
            {meta && <div className="mt-0.5 text-[12.5px] text-ink-3">{meta}</div>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("min-w-0", flush ? "py-2" : "px-4 pb-4 pt-3")}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, hero }: { label: string; value: ReactNode; sub?: ReactNode; hero?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-[14px] border px-4 py-3.5",
      hero ? "border-brand bg-brand text-on-brand" : "border-line bg-surface")}>
      <span className={cn("text-[12.5px] font-medium", hero ? "opacity-85" : "text-ink-2")}>{label}</span>
      <span className="font-display text-[26px] font-bold leading-tight tracking-tight tnum">{value}</span>
      {sub && <span className={cn("text-[12.5px]", hero ? "opacity-85" : "text-ink-3")}>{sub}</span>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-[clamp(24px,3.2vw,32px)] font-bold leading-tight">{title}</h1>
        {sub && <p className="mt-1.5 max-w-[68ch] text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      {icon && <div className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">{icon}</div>}
      <h3 className="text-[16px] font-semibold">{title}</h3>
      {body && <p className="max-w-[46ch] text-[13.5px] text-ink-3">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
