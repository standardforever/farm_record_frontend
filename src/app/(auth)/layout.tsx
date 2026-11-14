import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { ByStandeva, Logo } from "@/components/layout/Logo";

const POINTS = [
  "Daily records in under five minutes, even offline",
  "Health, stock, sales and profit for every batch",
  "Your data stays yours: share it only when you choose",
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="navy-hero hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <Logo />
        <div className="max-w-[480px]">
          <p className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[.04] px-4 py-1.5 text-[13px] text-[#98a5bd]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#2ee6a6]" /> Built for Nigerian livestock farms
          </p>
          <h1 className="mt-6 font-display text-[46px] font-bold leading-[1.02] tracking-[-0.04em] text-white">
            Run your farm.<br /><span className="grad-text">Grow with your records.</span>
          </h1>
          <ul className="mt-8 flex flex-col gap-3.5 text-[15.5px] text-[#c9d3e6]">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#2f5bff]"><Check size={12} strokeWidth={3.5} className="text-white" /></span>{p}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-[#98a5bd]">
          <span>English, Pidgin, Hausa, Yorùbá, Igbo</span>
          <a href="https://www.standeva.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">A product of <b className="font-display font-semibold text-white">standeva<span className="text-[#5c8bff]">.</span></b></a>
        </div>
      </div>
      <div className="flex flex-col justify-center px-[max(20px,env(safe-area-inset-left))] py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-8 lg:hidden"><Logo dark /></div>
          {children}
          <ByStandeva dark className="mt-10 justify-center lg:hidden" />
        </div>
      </div>
    </div>
  );
}
