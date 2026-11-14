"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Stop = {
  time: string; t: number; title: string; body: string;
  shot: { src: string; alt: string; kind: "phone" | "desk" };
};

const STOPS: Stop[] = [
  {
    time: "6:30", t: 0.06, title: "The day's jobs are waiting",
    body: "Each worker opens Oko to their own list: feed, water, deaths, eggs or milk, the vaccine due today, for their own houses, ponds or pens.",
    shot: { src: "/landing/phone-today.webp", alt: "Today's list in Oko: feed, deaths, weigh, eggs, water and the morning checklist", kind: "phone" },
  },
  {
    time: "8:00", t: 0.27, title: "Recorded in the pen, no network needed",
    body: "Feed, deaths and counts are saved on the phone and send themselves, once, when it finds signal. Nothing is lost if the battery dies.",
    shot: { src: "/landing/phone-feed.webp", alt: "Logging four 25 kg bags of feed for house H1 in Oko", kind: "phone" },
  },
  {
    time: "13:00", t: 0.5, title: "Tomorrow's heat, ready for today",
    body: "Oko reads the forecast for your farm. A very hot day or heavy rain puts the right jobs on the list a day ahead, for birds, fish or animals.",
    shot: { src: "/landing/phone-weather.webp", alt: "Oko weather for the farm: a serious heat warning tomorrow and the jobs it adds", kind: "phone" },
  },
  {
    time: "16:00", t: 0.73, title: "A slow batch, caught in week two",
    body: "Weigh a sample and Oko puts it against the breed's growth curve, with feed per head counted only on the animals still alive.",
    shot: { src: "/landing/desk-batch.webp", alt: "A broiler batch in Oko: weight against the Ross 308 standard", kind: "desk" },
  },
  {
    time: "20:00", t: 0.94, title: "What each batch really made",
    body: "Sales, feed at the price you paid, drugs, wages and a fair share of farm costs. Profit per batch, to the naira, from your phone at night.",
    shot: { src: "/landing/desk-profit.webp", alt: "Oko finance: profit and loss for the month and profit per batch", kind: "desk" },
  },
];

// The sun's path: a quadratic curve from sunrise (left) to sunset (right).
const P0 = { x: 30, y: 190 }, P1 = { x: 500, y: -110 }, P2 = { x: 970, y: 190 };
const at = (t: number) => ({
  x: (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * P1.x + t ** 2 * P2.x,
  y: (1 - t) ** 2 * P0.y + 2 * (1 - t) * t * P1.y + t ** 2 * P2.y,
});

export function DayArc() {
  const [i, setI] = useState(0);
  const touched = useRef(false);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => { if (!touched.current) setI((n) => (n + 1) % STOPS.length); }, 6500);
    return () => clearInterval(id);
  }, []);

  const pick = (n: number) => { touched.current = true; setI(n); };
  const s = STOPS[i];
  const sun = at(s.t);

  return (
    <div>
      <div className="relative">
        <svg viewBox="0 0 1000 200" className="block h-auto w-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id="arc" x1="0" x2="1">
              <stop offset="0" stopColor="#5c8bff" stopOpacity=".15" />
              <stop offset=".5" stopColor="#3fd2ff" stopOpacity=".9" />
              <stop offset="1" stopColor="#5c8bff" stopOpacity=".15" />
            </linearGradient>
            <radialGradient id="sun">
              <stop offset="0" stopColor="#3fd2ff" stopOpacity=".55" />
              <stop offset="1" stopColor="#3fd2ff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <line x1="0" y1="190" x2="1000" y2="190" stroke="rgba(255,255,255,.12)" />
          <path d={`M${P0.x} ${P0.y} Q${P1.x} ${P1.y} ${P2.x} ${P2.y}`} fill="none" stroke="url(#arc)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
          {STOPS.map((st, n) => { const p = at(st.t); return <circle key={st.time} cx={p.x} cy={p.y} r={n === i ? 0 : 5} fill="#142040" stroke="#5c8bff" strokeWidth="2" />; })}
          <g style={{ transform: `translate(${sun.x}px, ${sun.y}px)`, transition: "transform .9s cubic-bezier(.4,.1,.2,1)" }}>
            <circle r="46" fill="url(#sun)" />
            <circle r="13" fill="#fff" />
            <circle r="13" fill="none" stroke="#3fd2ff" strokeWidth="3" />
          </g>
        </svg>
        <div role="tablist" aria-label="A day on the farm" className="mt-4 grid grid-cols-5 gap-1 sm:gap-3">
          {STOPS.map((st, n) => (
            <button key={st.time} role="tab" aria-selected={n === i} aria-controls="day-panel" onClick={() => pick(n)}
              className={`flex flex-col items-center justify-start rounded-[12px] px-1 py-2 text-center sm:items-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5c8bff] sm:px-3 sm:text-left ${n === i ? "bg-white/[.07] text-white" : "text-[#98a5bd] hover:text-white"}`}>
              <span className="block font-display text-[17px] font-semibold tabular-nums sm:text-[22px]">{st.time}</span>
              <span className="hidden text-[13px] leading-snug sm:block">{st.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div id="day-panel" role="tabpanel" className="mt-10 grid items-center gap-10 md:grid-cols-[1fr_1.25fr]">
        <div key={s.time} className="motion-safe:animate-[rise_.5s_ease-out]">
          <p className="font-display text-[56px] font-semibold leading-none tracking-[-0.04em] text-[#3fd2ff] tabular-nums">{s.time}</p>
          <h3 className="mt-4 font-display text-[28px] font-bold leading-[1.1] tracking-[-0.03em] text-white sm:text-[34px]">{s.title}</h3>
          <p className="mt-4 max-w-[460px] text-[16.5px] leading-relaxed text-[#b4c0d6]">{s.body}</p>
        </div>
        <div className="flex min-h-[420px] items-center justify-center">
          {STOPS.map((st, n) => (
            <div key={st.time} className={n === i ? "w-full" : "hidden"}>
              {st.shot.kind === "phone" ? (
                <div className="mx-auto w-[58%] max-w-[270px] overflow-hidden rounded-[30px] border-[6px] border-[#0b1220] bg-[#0b1220] shadow-[0_30px_80px_-20px_rgba(47,91,255,.55)] ring-1 ring-white/10">
                  <Image src={st.shot.src} alt={st.shot.alt} width={780} height={1688} sizes="270px" className="h-auto w-full rounded-[24px]" />
                </div>
              ) : (
                <div className="overflow-hidden rounded-[14px] bg-[#0b1220] shadow-[0_30px_80px_-24px_rgba(47,91,255,.55)] ring-1 ring-white/10">
                  <div className="flex gap-1.5 px-3.5 py-2.5"><i className="h-2.5 w-2.5 rounded-full bg-white/15" /><i className="h-2.5 w-2.5 rounded-full bg-white/15" /><i className="h-2.5 w-2.5 rounded-full bg-white/15" /></div>
                  <Image src={st.shot.src} alt={st.shot.alt} width={1280} height={800} sizes="(max-width: 768px) 100vw, 620px" className="h-auto w-full" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
