"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { refreshAccessToken } from "@/lib/api";
import { type Op, flush, lastSyncedAt, migrateLegacy, onQueueChange, queued } from "./queue";

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set); window.addEventListener("offline", set);
    return () => { window.removeEventListener("online", set); window.removeEventListener("offline", set); };
  }, []);
  return online;
}

/** What is waiting on this phone for one workspace, and whether it is being sent. */
export function useSync(orgId: string) {
  const [ops, setOps] = useState<Op[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [last, setLast] = useState(0);
  const online = useOnline();
  const load = useCallback(() => { queued(orgId).then(setOps); setLast(lastSyncedAt()); }, [orgId]);
  useEffect(() => { load(); return onQueueChange(load); }, [load]);
  const sendNow = useCallback(async () => {
    setSyncing(true);
    try { return await flush(); } finally { setSyncing(false); load(); }
  }, [load]);
  return {
    ops, online, syncing, lastSync: last, sendNow,
    waiting: ops.filter((o) => o.status === "waiting"),
    conflicts: ops.filter((o) => o.status === "conflict"),
  };
}

/**
 * Keeps the queue moving: sends when the network comes back, when the app is brought to the front,
 * and every 30 seconds while something is waiting. Mounted once in the workspace layout.
 */
export function useAutoSync() {
  const qc = useQueryClient();
  useEffect(() => {
    let stop = false;
    const go = async () => {
      if (stop || !navigator.onLine) return;
      const r = await flush();
      if (r.sent || r.duplicates || r.conflicts.length) qc.invalidateQueries();
    };
    const back = async () => { await refreshAccessToken(); await go(); qc.invalidateQueries(); };
    const visible = () => { if (document.visibilityState === "visible") go(); };
    migrateLegacy().then(go);
    window.addEventListener("online", back);
    document.addEventListener("visibilitychange", visible);
    const t = window.setInterval(async () => { if ((await queued()).some((o) => o.status === "waiting")) go(); }, 30_000);
    return () => { stop = true; window.removeEventListener("online", back); document.removeEventListener("visibilitychange", visible); window.clearInterval(t); };
  }, [qc]);
}
