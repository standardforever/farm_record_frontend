"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

/** A modal on desktop and a bottom sheet on phones. `side` turns it into a right drawer. */
export function Dialog({ open, onClose, title, eyebrow, children, footer, side, wide }: {
  open: boolean; onClose: () => void; title: string; eyebrow?: string; children: ReactNode; footer?: ReactNode; side?: boolean; wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Drawn at the end of <body>, never inside the page or another drawer: a dialog opened from a drawer must sit fully on
  // top of it, not boxed into the drawer's space and showing through it.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // Keep the latest onClose without re-running the open effect: parents pass a new function on every
  // render, and re-running would move focus back to the first field while someone is typing.
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const last = document.activeElement as HTMLElement | null;
    // Escape closes only the dialog on top (a dialog can open over a drawer).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const all = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (all[all.length - 1] === panel.current) close.current();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      if (panel.current && !panel.current.contains(document.activeElement)) {
        panel.current.querySelector<HTMLElement>("input,select,textarea,button:not([data-close])")?.focus();
      }
    }, 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      last?.focus?.();
    };
  }, [open]);
  if (!open || !ready) return null;
  return createPortal(
    <div className={cn("fixed inset-0 z-[90] flex bg-[var(--scrim)] animate-[fade_.15s_ease]",
      side ? "justify-end" : "items-end justify-center sm:items-center sm:p-4")}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title}
        className={cn("flex max-h-full flex-col overflow-hidden bg-surface shadow-[var(--shadow)]",
          side ? "h-full w-full max-w-[480px] animate-[slide-in_.22s_ease] pt-[env(safe-area-inset-top)]"
            : cn("max-h-[92dvh] w-full rounded-t-[20px] animate-[rise_.22s_ease] sm:rounded-[18px]", wide ? "sm:max-w-[720px]" : "sm:max-w-[560px]"))}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h3 className="truncate text-[18px] font-semibold">{title}</h3>
          </div>
          <button data-close onClick={onClose} aria-label="Close"
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[10px] border border-line hover:bg-surface-2"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5 pb-[calc(14px+env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
