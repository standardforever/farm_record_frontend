"use client";

import { useEffect, useState } from "react";

/**
 * Simple mode: a phone-first home with big buttons for the day's work and nothing else in the way.
 * Chosen per phone (a shared farm phone can stay in simple mode). Workers start in it; anyone can switch.
 */
const KEY = "oko.simple.v1";
const subs = new Set<() => void>();

function read(): boolean | null {
  try { const v = localStorage.getItem(KEY); return v === null ? null : v === "1"; } catch { return null; }
}
export function setSimpleMode(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* ignore */ }
  subs.forEach((s) => s());
}

export function useSimpleMode(roleKey?: string): boolean {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => { const f = () => setV(read()); f(); subs.add(f); return () => { subs.delete(f); }; }, []);
  return v ?? roleKey === "worker";
}
