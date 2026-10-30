"use client";

import { Suspense, use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Alert, Badge, Button, PageLoader, Segmented } from "@/components/ui";
import { orgTypeLabel } from "@/config/orgTypes";
import { useAuth } from "@/features/auth";
import { LoginForm, RegisterForm } from "@/features/auth/forms";
import { ApiError, get, post } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { InvitePreview } from "@/lib/types";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { status, reload } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const preview = useQuery({ queryKey: ["invite", token], queryFn: () => get<InvitePreview>(`/invites/${token}`), retry: false });
  const accept = useMutation({
    mutationFn: () => post<{ organization_id: string }>(`/invites/${token}/accept`),
    onSuccess: async (r) => { await reload(); router.replace(`/w/${r.organization_id}`); },
  });

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <div className="mb-8"><Logo dark /></div>
      <div className="w-full max-w-[460px] rounded-[18px] border border-line bg-surface p-6 shadow-[var(--shadow)]">
        {preview.isLoading && <PageLoader label="Checking your invite…" />}
        {preview.error && <Alert tone="crit" title="This invite link is not valid">Ask the person who invited you for a new link.</Alert>}
        {preview.data && (
          <>
            <div className="eyebrow">You are invited</div>
            <h1 className="mt-1 text-[24px] font-bold">Join {preview.data.organization_name}</h1>
            <p className="mt-1 text-ink-2">{preview.data.invited_by_name ?? "Someone"} invited {preview.data.full_name} to this {orgTypeLabel(preview.data.organization_type).toLowerCase()} on Oko.</p>
            <div className="mt-4 rounded-xl bg-surface-2 p-4">
              <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-brand" /><b>{preview.data.role_name}</b>
                <Badge tone={preview.data.kind === "guest" ? "maize" : "brand"}>{preview.data.kind === "guest" ? "Guest" : "Team member"}</Badge></div>
              <p className="mt-1.5 text-[13px] text-ink-2">{preview.data.role_description}</p>
              {preview.data.access_expires_at && (
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-3"><CalendarClock size={14} /> Access ends {formatDate(preview.data.access_expires_at)}</p>
              )}
            </div>
            {preview.data.status !== "pending" ? (
              <div className="mt-5"><Alert tone="warn" title={`This invite is ${preview.data.status}`}>Ask {preview.data.invited_by_name ?? "the owner"} for a new link.</Alert></div>
            ) : status === "signed-in" ? (
              <div className="mt-5 flex flex-col gap-3">
                {accept.error && <Alert tone="crit">{(accept.error as ApiError).message}</Alert>}
                <Button variant="primary" size="lg" block loading={accept.isPending} onClick={() => accept.mutate()}>Accept and join</Button>
              </div>
            ) : status === "signed-out" ? (
              <div className="mt-6">
                <div className="mb-4 flex justify-center"><Segmented value={mode} onChange={setMode} options={[{ value: "new", label: "I am new" }, { value: "existing", label: "I have an account" }]} /></div>
                <Suspense>
                  {mode === "new"
                    ? <RegisterForm compact defaultName={preview.data.full_name} onDone={() => accept.mutate()} />
                    : <LoginForm compact onDone={() => accept.mutate()} />}
                </Suspense>
              </div>
            ) : null}
            <p className="mt-4 text-center text-[12px] text-ink-3">Link expires {formatDate(preview.data.expires_at)}</p>
          </>
        )}
      </div>
    </div>
  );
}
