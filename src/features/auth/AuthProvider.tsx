"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, api, lastRefreshWasOffline, post, refreshAccessToken, setAccessToken } from "@/lib/api";
import type { Me } from "@/lib/types";
import { setQueueUser } from "@/features/offline/queue";
import { clearOfflineCache, offlineCacheReady } from "@/features/offline/persist";

type Status = "loading" | "signed-in" | "signed-out";
type AuthCtx = {
  status: Status;
  me: Me | null;
  signIn: (identifier: string, password: string) => Promise<Me>;
  signUp: (data: { full_name: string; email?: string; phone?: string; password: string }) => Promise<Me>;
  signOut: () => Promise<void>;
  /** Finish signing in with an access token returned by another flow (email code, password reset). */
  signInWithToken: (accessToken: string) => Promise<Me>;
  reload: () => Promise<Me | null>;
};

const Ctx = createContext<AuthCtx | null>(null);

// The signed-in account is kept on the phone so the app opens with no network (a worker in the field).
// It is only used when the server cannot be reached, and is removed on sign-out.
const ME = "oko.me.v1";
const cachedMe = (): Me | null => { try { return JSON.parse(localStorage.getItem(ME) ?? "null"); } catch { return null; } };
const keepMe = (me: Me | null) => { try { if (me) localStorage.setItem(ME, JSON.stringify(me)); else localStorage.removeItem(ME); } catch { /* ignore */ } };
export const cachedUserId = () => cachedMe()?.user.id ?? null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const qc = useQueryClient();
  useEffect(() => { setQueueUser(me?.user.id ?? null); }, [me]);

  const reload = useCallback(async () => {
    try {
      const data = await api<Me>("/auth/me");
      setMe(data);
      keepMe(data);
      setStatus("signed-in");
      return data;
    } catch (e) {
      const offline = e instanceof ApiError && (e.status === 0 || e.status >= 500);
      const kept = offline ? cachedMe() : null;
      setMe(kept);
      setStatus(kept ? "signed-in" : "signed-out");
      if (!offline) keepMe(null);
      return kept;
    }
  }, []);

  // On first load, try to resume the session from the refresh cookie. With no network, open with the
  // account kept on this phone; when the network returns, the session is checked again.
  useEffect(() => {
    const resume = () => Promise.all([refreshAccessToken(), offlineCacheReady()]).then(([token]) => {
      if (token) return reload();
      const kept = lastRefreshWasOffline() ? cachedMe() : null;
      if (kept) { setMe(kept); setStatus("signed-in"); return kept; }
      keepMe(null);
      setStatus("signed-out");
      return null;
    });
    resume();
    window.addEventListener("online", resume);
    return () => window.removeEventListener("online", resume);
  }, [reload]);

  const finish = useCallback(async (token: string) => {
    setAccessToken(token);
    const data = await reload();
    if (!data) throw new Error("Could not load your account.");
    return data;
  }, [reload]);

  const value = useMemo<AuthCtx>(() => ({
    status,
    me,
    reload,
    signIn: async (identifier, password) => {
      const r = await post<{ access_token: string }>("/auth/login", { identifier, password });
      return finish(r.access_token);
    },
    signUp: async (data) => {
      const r = await post<{ access_token: string }>("/auth/register", data);
      return finish(r.access_token);
    },
    signInWithToken: finish,
    signOut: async () => {
      await post("/auth/logout").catch(() => null);
      setAccessToken(null);
      setMe(null);
      keepMe(null);
      setStatus("signed-out");
      qc.clear();
      await clearOfflineCache();
    },
  }), [status, me, reload, finish, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
