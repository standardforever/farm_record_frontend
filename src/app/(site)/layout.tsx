import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { COMPANY, EMAIL, PHONE, WHATSAPP } from "./site";

/** The public pages: the landing page, privacy and terms. Server-rendered, so search engines and slow phones get
 * the words straight away. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-side/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Oko home" className="shrink-0 [&_small]:hidden sm:[&_small]:block"><Logo /></Link>
          <nav aria-label="Main" className="ml-auto hidden items-center gap-6 text-[14px] font-semibold text-side-ink md:flex">
            <Link href="/#features" className="hover:text-white">What it does</Link>
            <Link href="/#install" className="hover:text-white">Install</Link>
            <Link href="/#pilot" className="hover:text-white">Join the pilot</Link>
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2 md:ml-4">
            <Link href="/login" className="whitespace-nowrap rounded-xl px-2.5 py-2 text-[14px] font-semibold text-side-ink hover:text-white sm:px-3">Sign in</Link>
            <Link href="/register" className="whitespace-nowrap rounded-xl bg-maize px-3 py-2 text-[14px] font-bold text-on-maize hover:brightness-105 sm:px-3.5">Create account</Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-10 text-[14px] sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo dark />
            <p className="mt-3 max-w-sm text-ink-2">Farm records for Nigerian livestock farmers. Works on any phone, even without network.</p>
          </div>
          <div className="flex flex-col gap-2">
            <b className="eyebrow">Talk to us</b>
            <a href={WHATSAPP} className="text-ink-2 hover:text-ink">WhatsApp {PHONE}</a>
            <a href={`mailto:${EMAIL}`} className="text-ink-2 hover:text-ink">{EMAIL}</a>
          </div>
          <div className="flex flex-col gap-2">
            <b className="eyebrow">Oko</b>
            <Link href="/login" className="text-ink-2 hover:text-ink">Sign in</Link>
            <Link href="/privacy" className="text-ink-2 hover:text-ink">Privacy policy</Link>
            <Link href="/terms" className="text-ink-2 hover:text-ink">Terms of use</Link>
          </div>
        </div>
        <div className="border-t border-line py-4 text-center text-[12.5px] text-ink-3">© {new Date().getFullYear()} {COMPANY}. Oko is a product of {COMPANY}.</div>
      </footer>
    </div>
  );
}
