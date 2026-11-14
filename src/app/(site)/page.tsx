import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Banknote, Check, CheckCircle2, CloudSun, Languages, MessageCircle, Plus, ShieldCheck, Smartphone, Stethoscope,
  Tractor, UsersRound, WifiOff,
} from "lucide-react";
import { DayArc } from "./DayArc";
import { PHONE, WHATSAPP } from "./site";

export const metadata: Metadata = {
  title: { absolute: "Oko by StandEva: farm records for Nigerian livestock farmers" },
  description: "Daily records, animal health, feed stock, sales and profit per batch for poultry, fish, goat, sheep, cattle and pig farms in Nigeria. Works on any phone, even without network.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Oko: farm records that work where your farm is",
    description: "Daily records, animal health, feed stock, sales and profit per batch. Works on any phone, even without network.",
    type: "website", siteName: "Oko by StandEva", locale: "en_NG",
    images: [{ url: "/landing/og.png", width: 1200, height: 630, alt: "Oko by StandEva: farm records on a phone" }],
  },
  twitter: { card: "summary_large_image" },
};

// Someone already signed in on this phone (or opening the installed app) goes straight to their farm.
const SKIP = `try{if(localStorage.getItem("oko.me.v1")||matchMedia("(display-mode: standalone)").matches)location.replace("/app")}catch(e){}`;

const ANIMALS = ["Broilers", "Layers", "Catfish", "Tilapia", "Goats", "Sheep", "Cattle", "Pigs", "Rabbits", "Dairy"];

const PEOPLE = [
  {
    icon: Tractor, who: "For the owner",
    lines: [
      "Profit per batch and per animal, with feed at the price you paid",
      "Who owes you and since when; every naira in and out of each account",
      "Feed and drug stock by delivery, with a warning before it runs out",
      "Every farm, house and pond on one screen, from anywhere",
    ],
  },
  {
    icon: UsersRound, who: "For your workers",
    lines: [
      "Simple mode: big buttons, only their own houses, ponds or pens",
      "Feed, deaths, eggs, milk and weights in a few taps",
      "Today's jobs and the vaccines due, in their language",
      "Works with no network, sends itself later",
    ],
  },
  {
    icon: Stethoscope, who: "For your vet, buyer or lender",
    lines: [
      "Vaccination and treatment records you can prove",
      "Animals under drug withdrawal are blocked from sale",
      "They see only what you share, for as long as you choose",
      "Clean batch reports for a loan or a buyer, in one tap",
    ],
  },
];

const MADE_FOR = [
  { icon: WifiOff, title: "No network? Keep going", body: "Oko opens and records offline. Everything sends once the phone finds signal." },
  { icon: Smartphone, title: "Light on cheap phones", body: "Built for an entry-level Android on 3G, installed from the browser, no app store." },
  { icon: Banknote, title: "Naira, Nigerian time", body: "Prices, wages and profit in naira. Nigerian states, LGAs and wards for every site." },
  { icon: Languages, title: "Your workers' language", body: "English, Pidgin, Hausa, Yorùbá and Igbo." },
  { icon: CloudSun, title: "Weather for your farm", body: "Heat and heavy rain warnings for your location, turned into jobs a day ahead." },
  { icon: ShieldCheck, title: "Your records stay yours", body: "Owners decide who sees what. Every change is kept in an audit trail." },
];

const FAQ = [
  { q: "How much does Oko cost?", a: "Oko is free while we run the pilot. We will tell you well before anything changes, and your records stay yours either way." },
  { q: "Which animals can I keep records for?", a: "Broilers, layers, catfish, tilapia, goats, sheep, cattle, pigs, rabbits and dairy. Broilers, layers and catfish also come with growth and feed standards and vaccination plans built in." },
  { q: "Does it really work without network?", a: "Yes. Once you have signed in with network, Oko opens and saves records offline. They send themselves, once, when the phone finds signal." },
  { q: "Can my workers use it on their own phones?", a: "Yes. Invite them by phone number. Each one sees only the houses, ponds or pens you give them, in Simple mode if you like." },
  { q: "Can I bring my old records?", a: "Yes. Start a batch at any age with what you already know, and add past expenses and sales. We can help you set this up on WhatsApp." },
];

export default function Landing() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SKIP }} />

      {/* Hero */}
      <section className="navy-hero overflow-hidden">
        <div className="relative mx-auto grid max-w-[1180px] items-center gap-12 px-4 pt-14 sm:px-6 md:grid-cols-[1.35fr_1fr] md:pt-24">
          <div className="pb-6 md:pb-28">
            <p className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[.04] px-4 py-1.5 text-[13.5px] text-[#98a5bd]">
              <span className="h-2 w-2 rounded-full bg-[#2ee6a6] shadow-[0_0_0_4px_rgba(46,230,166,.15)]" /> For livestock farms across Nigeria
            </p>
            <h1 className="mt-7 font-display text-[44px] font-bold leading-[1] tracking-[-0.045em] text-white sm:text-[68px]">
              Every animal counted.<br /><span className="grad-text">Every naira accounted for.</span>
            </h1>
            <p className="mt-7 max-w-[520px] text-[18px] leading-relaxed text-[#b4c0d6]">
              Oko is the farm record book that lives on your phone. Your workers record the day in minutes, even with no
              network, and you see what each batch really made.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/register" className="glow-hover inline-flex min-h-[52px] items-center rounded-full bg-[#2f5bff] px-8 text-[16px] font-semibold text-white">Start your farm free</Link>
              <a href={WHATSAPP} className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-white/15 px-7 text-[16px] font-semibold text-white transition-colors hover:border-[#5c8bff] hover:bg-white/[.04]">
                <MessageCircle size={18} aria-hidden /> Ask us on WhatsApp
              </a>
            </div>
            <p className="mt-6 text-[14px] text-[#98a5bd]">Free during the pilot. No card, no app store.</p>
          </div>

          <div className="relative mx-auto w-full max-w-[400px] self-end">
            <div className="mx-auto w-[74%] overflow-hidden rounded-t-[34px] border-[7px] border-b-0 border-[#0b1220] bg-[#0b1220] shadow-[0_40px_90px_-20px_rgba(47,91,255,.6)] ring-1 ring-white/10">
              <Image src="/landing/phone-home.webp" alt="Oko on a phone: everything sent to the farm, and tomorrow's heat alert with its jobs" width={780} height={1688} priority sizes="300px" className="h-auto w-full rounded-t-[27px]" />
            </div>
            {/* The one moment on load: a record saved offline, then sent. */}
            <div className="chip-in absolute -left-2 top-[60%] w-[230px] rounded-[16px] border border-white/10 bg-[#0f1830]/95 p-3.5 shadow-[0_20px_40px_-10px_rgba(0,0,0,.6)] backdrop-blur sm:-left-14">
              <p className="text-[12.5px] text-[#98a5bd]">House H1 · morning feed</p>
              <p className="mt-0.5 font-display text-[19px] font-semibold text-white">4 bags · 100 kg</p>
              <div className="relative mt-2 h-6 text-[12.5px] font-medium">
                <span className="sync-wait absolute inset-0 flex items-center gap-1.5 text-[#f0ae45]"><WifiOff size={14} aria-hidden /> Saved on phone, no network</span>
                <span className="sync-done absolute inset-0 flex items-center gap-1.5 text-[#3fcf94]"><CheckCircle2 size={14} aria-hidden /> Sent to the farm</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Animals */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 md:py-14">
          <p className="text-[15px] font-medium text-ink-2">Keep records for</p>
          <p className="mt-2 font-display text-[26px] font-semibold leading-[1.25] tracking-[-0.03em] sm:text-[38px]">
            {ANIMALS.map((a, n) => (
              <span key={a}>{a}{n < ANIMALS.length - 1 && <span className="text-ink-3">{n === ANIMALS.length - 2 ? " and " : ", "}</span>}</span>
            ))}
            <span className="text-brand">.</span>
          </p>
        </div>
      </section>

      {/* A day on the farm */}
      <section id="features" className="navy-hero scroll-mt-20 overflow-hidden">
        <div className="relative mx-auto max-w-[1180px] px-4 py-20 sm:px-6 md:py-28">
          <h2 className="max-w-[640px] font-display text-[36px] font-bold leading-[1.05] tracking-[-0.035em] text-white sm:text-[50px]">From first feed to last count, one day in Oko.</h2>
          <p className="mt-4 max-w-[560px] text-[17px] text-[#98a5bd]">Follow the sun across a working day. Tap a time to see that moment.</p>
          <div className="mt-14"><DayArc /></div>
        </div>
      </section>

      {/* Who it is for */}
      <section className="mx-auto max-w-[1180px] px-4 py-20 sm:px-6 md:py-28">
        <h2 className="max-w-[700px] font-display text-[34px] font-bold leading-[1.06] tracking-[-0.035em] sm:text-[46px]">One record book, and everyone on the farm sees their part.</h2>
        <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
          {PEOPLE.map((g) => (
            <div key={g.who} className="border-t-2 border-brand pt-6">
              <g.icon size={26} className="text-brand" aria-hidden />
              <h3 className="mt-4 font-display text-[22px] font-bold tracking-[-0.02em]">{g.who}</h3>
              <ul className="mt-4 flex flex-col gap-3 text-[15.5px] leading-snug text-ink-2">
                {g.lines.map((l) => <li key={l} className="flex gap-3"><Check size={17} className="mt-0.5 shrink-0 text-brand" strokeWidth={2.6} aria-hidden />{l}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Made for Nigeria */}
      <section className="bg-surface-2">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-4 py-20 sm:px-6 md:grid-cols-[.9fr_1.4fr] md:py-28">
          <div>
            <h2 className="font-display text-[34px] font-bold leading-[1.06] tracking-[-0.035em] sm:text-[46px]">Made for how Nigerian farms really work.</h2>
            <p className="mt-5 text-[16.5px] leading-relaxed text-ink-2">Weak signal, shared phones, cash and transfers, workers who start at dawn. Oko was built on real farms around all of it.</p>
          </div>
          <ul className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {MADE_FOR.map((f) => (
              <li key={f.title}>
                <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-surface text-brand shadow-[0_1px_2px_rgba(16,24,40,.06)] ring-1 ring-line"><f.icon size={21} aria-hidden /></span>
                <h3 className="mt-4 text-[17px] font-bold">{f.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Questions */}
      <section className="mx-auto grid max-w-[1180px] gap-12 px-4 py-20 sm:px-6 md:grid-cols-[.9fr_1.4fr] md:py-28">
        <div>
          <h2 className="font-display text-[34px] font-bold leading-[1.06] tracking-[-0.035em] sm:text-[46px]">Questions farmers ask us.</h2>
          <p className="mt-5 text-[16.5px] text-ink-2">Something else? <a href={WHATSAPP} className="font-semibold text-brand underline-offset-4 hover:underline">Ask us on WhatsApp</a>.</p>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17.5px] font-semibold">
                {f.q}<Plus size={20} className="shrink-0 text-brand transition-transform group-open:rotate-45" aria-hidden />
              </summary>
              <p className="mt-3 max-w-[620px] text-[15.5px] leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Install */}
      <section id="install" className="scroll-mt-20 border-t border-line bg-surface">
        <div className="mx-auto max-w-[1180px] px-4 py-20 sm:px-6 md:py-24">
          <h2 className="font-display text-[30px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[38px]">Put Oko on your phone in a minute.</h2>
          <p className="mt-3 max-w-[600px] text-[16px] text-ink-2">No app store. Installed, Oko opens from your home screen, full screen, and works without network. Sign in once with network first.</p>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            <Steps title="Android" steps={["Open Oko in Chrome and sign in", "Tap “Install app” (or ⋮ → Add to Home screen)", "Open Oko from your home screen"]} />
            <Steps title="iPhone" steps={["Open Oko in Safari and sign in", "Tap Share, then “Add to Home Screen”", "Open Oko from your home screen"]} />
            <Steps title="Computer" steps={["Open Oko in Chrome or Edge", "Click the install icon in the address bar", "Oko opens in its own window"]} />
          </div>
        </div>
      </section>

      {/* Close: start, and who builds it */}
      <section id="pilot" className="navy-hero scroll-mt-20 overflow-hidden">
        <div className="relative mx-auto max-w-[1180px] px-4 py-20 text-center sm:px-6 md:py-28">
          <h2 className="mx-auto max-w-[760px] font-display text-[38px] font-bold leading-[1.02] tracking-[-0.04em] text-white sm:text-[60px]">
            Put this season on record.
          </h2>
          <p className="mx-auto mt-5 max-w-[540px] text-[17.5px] text-[#b4c0d6]">
            Set up your farm in five minutes, or let us set it up with you and your workers.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="glow-hover inline-flex min-h-[52px] items-center rounded-full bg-[#2f5bff] px-8 text-[16px] font-semibold text-white">Start your farm free</Link>
            <a href={WHATSAPP} className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-white/15 px-7 text-[16px] font-semibold text-white transition-colors hover:border-[#5c8bff] hover:bg-white/[.04]">
              <MessageCircle size={18} aria-hidden /> WhatsApp {PHONE}
            </a>
          </div>
          <a href="https://www.standeva.com" target="_blank" rel="noopener noreferrer"
            className="mx-auto mt-16 flex w-fit items-center gap-3.5 rounded-full border border-white/10 bg-white/[.03] py-2 pl-2 pr-5 text-left transition-colors hover:border-[#5c8bff]/50">
            <svg width="36" height="36" viewBox="0 0 120 120" aria-hidden>
              <rect width="120" height="120" rx="28" fill="#174bff" />
              <path d="M82 38H50a14 14 0 0 0 0 28h20a14 14 0 0 1 0 28H38" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[14px] leading-tight text-[#98a5bd]">
              Built and looked after by <b className="font-display font-semibold text-white">standeva<span className="text-[#5c8bff]">.</span></b>
              <span className="block text-[12.5px]">Custom software, AI and business systems</span>
            </span>
          </a>
        </div>
      </section>
    </>
  );
}

function Steps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div>
      <b className="font-display text-[20px] font-semibold">{title}</b>
      <ol className="mt-4 flex flex-col gap-3 text-[15px] text-ink-2">
        {steps.map((s, i) => <li key={s} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-bold text-brand">{i + 1}</span>{s}</li>)}
      </ol>
    </div>
  );
}
