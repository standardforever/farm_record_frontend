"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorkspaceDetail } from "@/lib/types";

const Ctx = createContext<WorkspaceDetail | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceDetail; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The open workspace, my role, permissions and features. */
export function useCurrentWorkspace() {
  const ws = useContext(Ctx);
  if (!ws) throw new Error("useCurrentWorkspace must be used inside a workspace page");
  const can = (p: string) => ws.my_permissions.includes("*") || ws.my_permissions.includes(p);
  const has = (f: string) => ws.features.includes(f);
  return { ...ws, orgId: ws.organization.id, can, has };
}
