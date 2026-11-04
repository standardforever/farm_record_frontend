"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui";
import { reportError } from "@/lib/report";

/** A screen crashed. Say so plainly, tell the team, and offer a way back. Records saved offline are not lost. */
export default function ScreenError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(error, "render"); }, [error]);
  return (
    <div className="mx-auto mt-24 max-w-md px-4 text-center" role="alert">
      <div className="eyebrow">Something went wrong</div>
      <h1 className="mt-1 text-[26px] font-bold">This screen hit a problem</h1>
      <p className="mt-2 text-[14px] text-ink-2">The Oko team has been told. Anything you saved is safe, including records waiting to send.</p>
      <div className="mt-5 flex justify-center gap-2">
        <Button variant="primary" onClick={reset}><RotateCw size={16} /> Try again</Button>
        <Link href="/" className="inline-flex items-center rounded-xl border border-line px-4 font-semibold">Go home</Link>
      </div>
    </div>
  );
}
