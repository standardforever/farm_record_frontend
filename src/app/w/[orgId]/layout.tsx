"use client";

import { use, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, Button, PageLoader } from "@/components/ui";
import { RequireAuth } from "@/features/auth";
import { keepPagesOffline } from "@/features/offline";
import { rememberWorkspace, useWorkspace, WorkspaceProvider } from "@/features/workspaces";
import { ApiError } from "@/lib/api";

export default function WorkspaceLayout({ children, params }: { children: ReactNode; params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params);
  return <RequireAuth><Loaded orgId={orgId}>{children}</Loaded></RequireAuth>;
}

function Loaded({ orgId, children }: { orgId: string; children: ReactNode }) {
  const { data, error, isLoading } = useWorkspace(orgId);
  useEffect(() => { if (data) rememberWorkspace(orgId); }, [data, orgId]);
  useEffect(() => { if (data && navigator.onLine && process.env.NODE_ENV === "production") keepPagesOffline(orgId); }, [!!data, orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (isLoading && !data) return <PageLoader label="Opening workspace…" />;
  if (!data) { // with the offline copy, a failed refresh still shows the workspace
    const e = error as ApiError | null;
    const msg = e?.code === "access_expired" ? "Your access to this workspace has ended." : e?.code === "workspace_suspended"
      ? "This workspace is suspended. Contact Oko support." : e?.code === "membership_suspended" ? "Your access to this workspace is paused."
      : e?.code === "network" || (!e && typeof navigator !== "undefined" && !navigator.onLine)
        ? "No network, and this workspace has not been opened on this phone yet. Open it once with network to use it offline."
        : "This workspace does not exist or you are not a member.";
    return (
      <div className="mx-auto mt-24 flex max-w-md flex-col gap-4 px-4">
        <Alert tone="crit" title="Cannot open workspace">{msg}</Alert>
        <Link href="/"><Button>Go to my workspaces</Button></Link>
      </div>
    );
  }
  return <WorkspaceProvider value={data}><AppShell>{children}</AppShell></WorkspaceProvider>;
}
