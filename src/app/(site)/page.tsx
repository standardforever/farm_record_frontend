import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Banknote, CloudSun, HeartPulse, Layers, Package, ShieldCheck, Smartphone, UsersRound, WifiOff,
} from "lucide-react";
import { EMAIL, PHONE, WHATSAPP } from "./site";

export const metadata: Metadata = {
  title: { absolute: "Oko: farm records for Nigerian livestock farmers" },
  description: "Daily records, animal health, feed stock, sales and profit per batch for poultry and fish farms. Works on any phone, even without network.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Oko: farm records that work where your farm is",
    description: "Daily records, animal health, feed stock, sales and profit per batch. Works on any phone, even without network.",
    type: "website", siteName: "Oko", locale: "en_NG",
    images: [{ url: "/landing/og.png", width: 1200, height: 630, alt: "Oko on a phone: today's farm work and a heat alert" }],
  },
  twitter: { card: "summary_large_image" },
};

// Someone already signed in on this phone (or opening the installed app) goes straight to their farm.
const SKIP = `try{if(localStorage.getItem("oko.me.v1")||matchMedia("(display-mode: standalone)").matches)location.replace("/app")}catch(e){}`;

const FEATURES = [
  { icon: Smartphone, title: "A day's work in five minutes", body: "Feed, deaths, eggs, weights and water checks in a few taps. Workers see only their houses and ponds, in Simple mode with big buttons." },
  { icon: Layers, title: "Every batch, start to finish", body: "From day-old chicks or fingerlings to sale: count, survival, feed conversion and growth against the breed standard." },
  { icon: HeartPulse, title: "Health you can prove", body: "Vaccination schedules per breed, treatments and sick-animal reports with photos. Animals under drug withdrawal cannot be sold." },
  { icon: Package, title: "Feed stock by delivery", body: "Know what is in the store, what runs low and what each batch really ate, at the price of the bags it came from." },
  { icon: Banknote, title: "Sales, credit and profit", body: "Invoices, who owes you and since when, expenses, wages and profit per batch, reconciled to the naira." },
  { icon: CloudSun, title: "Weather turned into jobs", body: "A hot day or heavy rain tomorrow puts the right jobs on today's list for your birds or fish, a day ahead." },
  { icon: WifiOff, title: "Works without network", body: "Keep recording in the pen or at the pond. Everything sends itself, once, when the phone finds signal." },
  { icon: UsersRound, title: "Your team, your rules", body: "Owner, manager, supervisor, worker, and guests like your vet or lender, each seeing only what you allow." },
];

export default function Landing() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SKIP }} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-side text-side-ink">
        <svg className="pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] opacity-[.07]" viewBox="0 0 200 200" aria-hidden>
          <circle cx="100" cy="100" r="98" fill="none" stroke="#fff" /><circle cx="100" cy="100" r="70" fill="none" stroke="#fff" /><circle cx="100" cy="100" r="42" fill="none" stroke="#fff" />
        </svg>
        <div className="relative mx-auto grid max-w-[1180px] items-center gap-10 px-4 pb-0 pt-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-20">
          <div className="pb-4 md:pb-24">
            <p className="eyebrow !text-maize">For poultry and fish farms in Nigeria</p>
            <h1 className="mt-3 font-display text-[40px] font-bold leading-[1.03] tracking-tight text-white sm:text-[56px]">
              Farm records that work where your farm is.
            </h1>
            <p className="mt-5 max-w-[540px] text-[17px] leading-relaxed text-side-ink">
              Oko keeps your daily records, animal health, feed stock, sales and money in one place, on any phone, even
              with no network. You see what each batch really made, and your workers know what to do today.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="rounded-xl bg-maize px-5 py-3 text-[15.5px] font-bold text-on-maize hover:brightness-105">Create a free account</Link>
              <a href={WHATSAPP} className="rounded-xl border border-white/25 px-5 py-3 text-[15.5px] font-semibold text-white hover:bg-white/10">Talk to us on WhatsApp</a>
            </div>
            <p className="mt-4 text-[13px] text-side-ink-2">Free while we run the pilot. Your records stay yours.</p>
          </div>
          <div className="relative mx-auto flex w-full max-w-[460px] items-end justify-center gap-4 self-end">
            <Phone src="/landing/phone-today.webp" alt="Today's list in Oko: feed, deaths, weigh, eggs, water and the morning checklist" className="hidden w-[46%] translate-y-10 sm:block" />
            <Phone src="/landing/phone-home.webp" alt="Oko home on a phone: everything sent, and tomorrow's heat alert with five jobs" className="w-[62%] sm:w-[54%]" priority />
          </div>
        </div>
      </section>

      {/* Species strip */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-5 text-[14px] text-ink-2 sm:px-6">
          <b className="text-ink">Built today for</b>
          <span>Broilers</span><span>Layers</span><span>Catfish</span>
          <span className="text-ink-3">Next: cattle, goats, sheep, pigs and dairy</span>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-16 sm:px-6 md:py-24">
        <p className="eyebrow">What Oko does</p>
        <h2 className="mt-2 max-w-[720px] font-display text-[32px] font-bold leading-tight sm:text-[40px]">Everything a farm records, in one place, without the notebook.</h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-[16px] border border-line bg-surface p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><f.icon size={20} aria-hidden /></span>
              <h3 className="mt-4 text-[16.5px] font-bold">{f.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Screens */}
      <section className="bg-surface-2">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
          <Screen src="/landing/desk-batch.webp" alt="A broiler batch in Oko: weight against the Ross 308 standard, survival and vaccinations"
            title="See each batch against the standard" body="Weigh a sample and Oko draws it against the breed's growth curve, so you catch a slow batch in week two, not at sale." />
          <Screen src="/landing/desk-profit.webp" alt="Oko finance: profit and loss for the month and profit per batch"
            title="Know what each batch made" body="Sales, feed at the price you paid, medicines, wages and other costs, so the profit per batch and per bird is real." />
        </div>
      </section>

      {/* Made for */}
      <section className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 md:py-24">
        <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div>
            <p className="eyebrow">Made for how farms really work</p>
            <h2 className="mt-2 font-display text-[32px] font-bold leading-tight sm:text-[40px]">Cheap phones, weak signal, busy mornings.</h2>
            <ul className="mt-6 flex flex-col gap-3 text-[15px] text-ink-2">
              {[
                "Opens and works offline; nothing is lost if the phone dies mid-way",
                "Light enough for an entry-level Android on 3G",
                "Naira everywhere, Nigerian time, Nigerian states and LGAs",
                "Simple mode for workers: big buttons, only their own pens",
                "Your vet, buyer or lender sees only what you share, for as long as you choose",
              ].map((t) => <li key={t} className="flex gap-3"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-good" aria-hidden />{t}</li>)}
            </ul>
          </div>
          <Phone src="/landing/phone-weather.webp" alt="Oko weather for the farm: a serious heat warning tomorrow and the jobs it adds" className="mx-auto w-[64%] max-w-[300px]" />
        </div>
      </section>

      {/* Install */}
      <section id="install" className="scroll-mt-20 bg-surface">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 md:py-24">
          <p className="eyebrow">Install</p>
          <h2 className="mt-2 font-display text-[32px] font-bold leading-tight sm:text-[40px]">Put Oko on your phone in a minute.</h2>
          <p className="mt-3 max-w-[640px] text-[15.5px] text-ink-2">No app store needed. Installed, Oko opens from your home screen, full screen, and works without network. Sign in once with network first.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Steps title="Android" steps={["Open Oko in Chrome and sign in", "Tap “Install app” (or ⋮ → Add to Home screen)", "Open Oko from your home screen"]} />
            <Steps title="iPhone" steps={["Open Oko in Safari and sign in", "Tap the Share button, then “Add to Home Screen”", "Open Oko from your home screen (keeps your offline records safe)"]} />
            <Steps title="Computer" steps={["Open Oko in Chrome or Edge", "Click the install icon in the address bar", "Oko opens in its own window"]} />
          </div>
        </div>
      </section>

      {/* Pilot */}
      <section id="pilot" className="scroll-mt-20 bg-side text-side-ink">
        <div className="mx-auto flex max-w-[1180px] flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between md:py-20">
          <div className="max-w-[640px]">
            <h2 className="font-display text-[30px] font-bold leading-tight text-white sm:text-[36px]">We are setting up our first pilot farms.</h2>
            <p className="mt-3 text-[15.5px]">Poultry or fish farm? We will set Oko up with you and your workers, and listen to what you need next.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={WHATSAPP} className="rounded-xl bg-maize px-5 py-3 text-[15.5px] font-bold text-on-maize hover:brightness-105">WhatsApp {PHONE}</a>
            <a href={`mailto:${EMAIL}?subject=${encodeURIComponent("Oko pilot")}`} className="rounded-xl border border-white/25 px-5 py-3 text-[15.5px] font-semibold text-white hover:bg-white/10">Email us</a>
          </div>
        </div>
      </section>
    </>
  );
}

function Phone({ src, alt, className = "", priority }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-[28px] border-[6px] border-[#0b1f16] bg-[#0b1f16] shadow-[0_30px_60px_-20px_rgba(0,0,0,.55)] ${className}`}>
      <Image src={src} alt={alt} width={780} height={1688} priority={priority} sizes="(max-width: 640px) 62vw, 260px" className="h-auto w-full rounded-[22px]" />
    </div>
  );
}

function Screen({ src, alt, title, body }: { src: string; alt: string; title: string; body: string }) {
  return (
    <figure>
      <div className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-[0_20px_50px_-25px_rgba(0,0,0,.35)]">
        <Image src={src} alt={alt} width={1280} height={800} sizes="(max-width: 1024px) 100vw, 560px" className="h-auto w-full" />
      </div>
      <figcaption className="mt-4">
        <b className="block text-[18px]">{title}</b>
        <span className="mt-1 block text-[14.5px] text-ink-2">{body}</span>
      </figcaption>
    </figure>
  );
}

function Steps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-[16px] border border-line p-5">
      <b className="text-[16.5px]">{title}</b>
      <ol className="mt-3 flex flex-col gap-2 text-[14px] text-ink-2">
        {steps.map((s, i) => <li key={s} className="flex gap-2.5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11.5px] font-bold text-brand">{i + 1}</span>{s}</li>)}
      </ol>
    </div>
  );
}
