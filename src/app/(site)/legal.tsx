import type { ReactNode } from "react";

/** Shared look for the privacy policy and terms: readable on a small phone. */
export function Legal({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-[760px] px-4 py-12 sm:px-6 md:py-16">
      <p className="eyebrow">Last updated {updated}</p>
      <h1 className="mt-2 font-display text-[34px] font-bold leading-tight sm:text-[42px]">{title}</h1>
      <div className="legal mt-8 flex flex-col gap-4 text-[15.5px] leading-relaxed text-ink-2
        [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:text-ink
        [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5 [&_b]:text-ink [&_a]:font-semibold [&_a]:text-brand">
        {children}
      </div>
    </article>
  );
}
