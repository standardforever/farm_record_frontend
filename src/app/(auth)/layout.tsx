import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";

const POINTS = [
  "Daily records in under five minutes, even offline",
  "Vets, suppliers and buyers who know your farm",
  "Your data stays yours: share it only when you choose",
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-side p-10 text-side-ink lg:flex">
        <Logo />
        <div className="max-w-[460px]">
          <h1 className="font-display text-[44px] font-bold leading-[1.05] text-white">Run your farm.<br />Grow with your records.</h1>
          <ul className="mt-7 flex flex-col gap-3 text-[15px]">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-maize" />{p}</li>
            ))}
          </ul>
        </div>
        <p className="text-[12.5px] text-side-ink-2">Made for Nigerian livestock farmers · English, Pidgin, Hausa, Yorùbá, Igbo</p>
        <svg className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] opacity-[.08]" viewBox="0 0 200 200" aria-hidden>
          <circle cx="100" cy="100" r="98" fill="none" stroke="#fff" strokeWidth="1" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="#fff" strokeWidth="1" />
          <circle cx="100" cy="100" r="42" fill="none" stroke="#fff" strokeWidth="1" />
        </svg>
      </div>
      <div className="flex flex-col justify-center px-[max(20px,env(safe-area-inset-left))] py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-8 lg:hidden"><Logo dark /></div>
          {children}
        </div>
      </div>
    </div>
  );
}
