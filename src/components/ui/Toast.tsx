"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

type Toast = { id: number; message: string; tone: "good" | "crit" };
const Ctx = createContext<(message: string, tone?: "good" | "crit") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: "good" | "crit" = "good") => {
    const id = Date.now() + Math.random();
    // Keep at most two on screen: quick logging on a phone should not bury the page under messages.
    setItems((s) => [...s.slice(-1), { id, message, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4 max-[819px]:bottom-[calc(88px+env(safe-area-inset-bottom))]"
        aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-none flex max-w-full items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-[13.5px] font-semibold text-bg shadow-[var(--shadow)] animate-[rise_.2s_ease]">
            {t.tone === "good" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
