"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, post, refreshAccessToken, setAccessToken } from "@/lib/api";
import type { Me } from "@/lib/types";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const qc = useQueryClient();

  const reload = useCallback(async () => {
    try {
      const data = await api<Me>("/auth/me");
      setMe(data);
      setStatus("signed-in");
      return data;
    } catch {
      setMe(null);
      setStatus("signed-out");
      return null;
    }
  }, []);

  // On first load, try to resume the session from the refresh cookie.
  useEffect(() => {
    refreshAccessToken().then((token) => {
      if (token) reload();
      else setStatus("signed-out");
    });
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
      setStatus("signed-out");
      qc.clear();
    },
  }), [status, me, reload, finish, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
