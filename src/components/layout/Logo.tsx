export function Logo({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-maize text-on-maize">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 20c0-7 4-13 9-15 3 3 5 7 5 11" /><path d="M4 20h16" /><path d="M12 20c0-4 2-8 6-10" />
        </svg>
      </span>
      <span>
        <b className={`block font-display text-[22px] leading-none tracking-tight ${dark ? "text-ink" : "text-white"}`}>Oko</b>
        <small className={`mt-0.5 block text-[10.5px] uppercase tracking-[.12em] ${dark ? "text-ink-3" : "text-side-ink-2"}`}>Livestock ecosystem</small>
      </span>
    </div>
  );
}
