"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (status === "signed-out") router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [status, router, path]);
  if (status !== "signed-in") return <PageLoader label="Opening Oko…" />;
  return <>{children}</>;
}
