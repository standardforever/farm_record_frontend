"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth";
import { cachedUserId } from "@/features/auth/AuthProvider";
import { keepOfflineCache, markRestored, restoreOfflineCache } from "@/features/offline/persist";
import { ToastProvider } from "@/components/ui";
import { ApiError } from "@/lib/api";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 24 * 3600 * 1000, // kept for the offline copy
        refetchOnWindowFocus: false,
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
    },
  }));
  // Restore the offline copy before signed-in screens draw (AuthProvider waits for it), so they open with no network.
  useEffect(() => {
    markRestored(restoreOfflineCache(client, cachedUserId()));
    const stop = keepOfflineCache(client, cachedUserId);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    }
    return stop;
  }, [client]);
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
