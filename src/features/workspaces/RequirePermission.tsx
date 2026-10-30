"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { useCurrentWorkspace } from "./WorkspaceContext";

/** Wrap a page or section. Shows a clear message instead of a broken screen. */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const ws = useCurrentWorkspace();
  if (ws.can(permission)) return <>{children}</>;
  return <EmptyState icon={<Lock size={22} />} title="Your role cannot open this" body={`Ask an owner or manager for the “${permission}” permission.`} />;
}
