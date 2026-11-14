/** Oko's lockup, in the StandEva family: a blue tile with Oko's sprout, the lowercase "oko." wordmark (like
 * "standeva."), and "by standeva." with StandEva's own S tile. `dark` is for light backgrounds (dark text). */
export function Logo({ dark, compact }: { dark?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <OkoMark size={36} />
      <span className="leading-none">
        <b className={`block font-display text-[24px] font-semibold tracking-[-0.04em] ${dark ? "text-ink" : "text-white"}`}>
          oko<span className={dark ? "text-brand" : "text-[#5c8bff]"}>.</span>
        </b>
        {!compact && <ByStandeva dark={dark} />}
      </span>
    </div>
  );
}

export function OkoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden className="shrink-0 drop-shadow-[0_6px_16px_rgba(23,75,255,.35)]">
      <defs>
        <linearGradient id="oko-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f5bff" /><stop offset="1" stopColor="#174bff" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="28" fill="url(#oko-tile)" />
      <circle cx="60" cy="73" r="23" fill="none" stroke="#fff" strokeWidth="12.5" />
      <path d="M61 44c1-14 11-21 25-21-1 14-11 21-25 21z" fill="#3fd2ff" />
      <path d="M58 44c-1-11-9-17-20-17 1 11 9 17 20 17z" fill="#fff" />
    </svg>
  );
}

/** "by standeva." with StandEva's S tile: Oko is a StandEva product. */
export function ByStandeva({ dark, className = "" }: { dark?: boolean; className?: string }) {
  return (
    <small className={`mt-1 flex items-center gap-1 font-mono text-[10px] font-medium tracking-[.06em] ${dark ? "text-ink-3" : "text-[#98a5bd]"} ${className}`}>
      by
      <svg width="11" height="11" viewBox="0 0 120 120" aria-hidden>
        <rect width="120" height="120" rx="28" fill="#174bff" />
        <path d="M82 38H50a14 14 0 0 0 0 28h20a14 14 0 0 1 0 28H38" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`font-display text-[11px] font-semibold tracking-[-0.02em] ${dark ? "text-ink-2" : "text-[#eaf0fb]"}`}>standeva<span className="text-[#5c8bff]">.</span></span>
    </small>
  );
}
