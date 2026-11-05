"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui";

/** Chrome's "install this app" prompt, caught early (it fires once, before most screens mount). */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const subs = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; subs.forEach((s) => s()); });
  window.addEventListener("appinstalled", () => { deferred = null; subs.forEach((s) => s()); });
}

const standalone = () => typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const ios = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** "Install Oko" on Android/desktop Chrome, or the Share → Add to Home Screen hint on iPhone. Hidden once installed. */
export function InstallOko({ compact }: { compact?: boolean }) {
  const [, tick] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); const f = () => tick((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  if (!mounted || standalone()) return null;
  if (deferred) {
    return (
      <Button variant={compact ? "secondary" : "primary"} onClick={async () => { await deferred?.prompt(); deferred = null; tick((n) => n + 1); }}>
        <Download size={16} /> Install Oko on this phone
      </Button>
    );
  }
  if (ios()) return <p className="flex items-center gap-1.5 text-[13px] text-ink-3"><Share size={14} /> To install: tap Share, then “Add to Home Screen”.</p>;
  return null;
}

/** Ask the service worker to keep a workspace's main pages so they open with no network. */
export function keepPagesOffline(orgId: string) {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) {
    navigator.serviceWorker?.ready.then((r) => r.active?.postMessage({ type: "keep", urls: pages(orgId) })).catch(() => null);
    return;
  }
  navigator.serviceWorker.controller.postMessage({ type: "keep", urls: pages(orgId) });
}
const pages = (orgId: string) => ["/app", ...["", "/today", "/farm", "/batches"].map((p) => `/w/${orgId}${p}`)];
