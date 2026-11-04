"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth";
import { cachedUserId } from "@/features/auth/AuthProvider";
import { keepOfflineCache, markRestored, restoreOfflineCache } from "@/features/offline/persist";
import { ToastProvider } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { watchGlobalErrors } from "@/lib/report";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    // A request that fails for lack of network (the phone says online but there is none): show the kept copy.
    queryCache: new QueryCache({
      onError: (err) => { if (err instanceof ApiError && err.status === 0) restoreOfflineCache(client, cachedUserId(), { force: true }); },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 24 * 3600 * 1000, // kept for the offline copy
        refetchOnWindowFocus: false,
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
    },
  }));
  // With no network, restore the kept copy before signed-in screens draw (AuthProvider waits for it).
  useEffect(() => {
    markRestored(restoreOfflineCache(client, cachedUserId()));
    const stop = keepOfflineCache(client, cachedUserId);
    const unwatch = watchGlobalErrors();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    }
    return () => { stop(); unwatch(); };
  }, [client]);
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
