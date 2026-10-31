"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, PageHeader, Stat } from "@/components/ui";
import { PHASE_LABEL } from "@/config/navigation";
import { orgTypeLabel } from "@/config/orgTypes";
import { useAuth } from "@/features/auth";
import { useMeta } from "@/features/meta/api";
import { InviteDialog } from "@/features/team";
import { useCurrentWorkspace } from "@/features/workspaces";
import { cn } from "@/lib/format";

const VERIFY: Record<string, string> = { none: "Not verified", phone: "Phone verified", identity: "Identity verified", business: "Business verified", farm: "Farm verified", professional: "Professional verified" };

export default function Home() {
  const ws = useCurrentWorkspace();
  const { me } = useAuth();
  const { data: meta } = useMeta();
  const [inviting, setInviting] = useState(false);
  const base = `/w/${ws.orgId}`;
  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const modules = (meta?.modules ?? []).filter((m) => !["system", "admin", "plans", "identity"].includes(m.key));
  const phases = ["phase-0", "phase-1", "phase-2", "phase-3", "phase-4", "phase-5"];

  const steps = [
    { done: true, label: "Create your workspace", href: `${base}/settings` },
    { done: !!me?.user.email_verified, label: "Confirm your email", href: `${base}/settings`, show: !!me?.user.email },
    { done: ws.member_count + ws.guest_count > 1 || ws.pending_invites > 0, label: "Invite your team or a vet", action: () => setInviting(true), show: ws.can("invites.manage") },
    { done: false, label: "Review who can do what", href: `${base}/team/roles`, show: ws.can("members.view") },
    { done: !!ws.organization.state, label: "Add your state and LGA", href: `${base}/settings`, show: ws.can("workspace.manage") },
  ].filter((s) => s.show !== false);

  return (
    <>
      <PageHeader eyebrow={`${orgTypeLabel(ws.organization.type)} · ${ws.organization.state ?? "Nigeria"}`} title={`${greet}, ${me?.user.full_name.split(" ")[0]}`}
        sub={`You are ${ws.my_role.kind === "guest" ? "a guest" : "the " + ws.my_role.name.toLowerCase()} in ${ws.organization.name}.`}
        actions={ws.can("invites.manage") ? <Button variant="primary" onClick={() => setInviting(true)}><UserPlus size={16} /> Invite someone</Button> : undefined} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat hero label="Your role" value={ws.my_role.name} sub={`${ws.my_permissions.includes("*") ? "Full access" : ws.my_permissions.length + " permissions"}`} />
        <Stat label="Team members" value={ws.member_count} sub={`${ws.guest_count} guests`} />
        <Stat label="Pending invites" value={ws.pending_invites} sub="Waiting to join" />
        <Stat label="Plan" value={ws.organization.plan_code.replace("_", " ")} sub={VERIFY[ws.organization.verification_level]} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="What Oko will do for you" meta="Built in phases. Each one goes live here as it is finished.">
          <div className="flex flex-col gap-5">
            {phases.map((p) => {
              const list = modules.filter((m) => m.phase === p);
              if (!list.length) return null;
              const live = list.every((m) => m.status === "live");
              return (
                <div key={p}>
                  <div className="mb-2 flex items-center gap-2"><b className="font-display text-[15px]">{PHASE_LABEL[p]}</b>
                    {live ? <Badge tone="good" dot>Live</Badge> : p === "phase-1" ? <Badge tone="maize" dot>Next</Badge> : <Badge>Planned</Badge>}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((m) => {
                      const on = !m.feature || ws.has(m.feature);
                      return (
                        <Link key={m.key} href={m.status === "live" ? base : `${base}/modules/${m.key}`}
                          className={cn("flex items-start gap-2.5 rounded-xl border border-line p-3 hover:border-ink-3", m.status === "live" && "bg-brand-soft/50")}>
                          <span className={cn("mt-0.5", m.status === "live" ? "text-good" : "text-ink-3")}>{m.status === "live" ? <CheckCircle2 size={16} /> : <Clock size={16} />}</span>
                          <span className="min-w-0"><b className="block text-[13.5px]">{m.name}</b>
                            <span className="block text-[12px] text-ink-3">{m.status === "live" ? "Available now" : on ? "In your plan when released" : "Not in your plan"}</span></span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="Get started" meta={`${steps.filter((s) => s.done).length} of ${steps.length} done`}>
            <ul className="flex flex-col">
              {steps.map((s) => {
                const inner = <><span className={s.done ? "text-good" : "text-ink-3"}>{s.done ? <CheckCircle2 size={18} /> : <span className="block h-[18px] w-[18px] rounded-full border-2 border-surface-3" />}</span>
                  <span className={cn("flex-1", s.done && "text-ink-3 line-through")}>{s.label}</span>{!s.done && <ArrowRight size={15} className="text-ink-3" />}</>;
                return <li key={s.label} className="border-t border-line first:border-0">
                  {s.action ? <button onClick={s.action} className="flex w-full cursor-pointer items-center gap-3 py-2.5 text-left">{inner}</button>
                    : <Link href={s.href!} className="flex items-center gap-3 py-2.5">{inner}</Link>}</li>;
              })}
            </ul>
          </Card>
          <Card title="Your access">
            <div className="flex flex-col gap-2.5 text-[13.5px]">
              <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-brand" /><b>{ws.my_role.name}</b><Badge tone={ws.my_role.kind === "guest" ? "maize" : "brand"}>{ws.my_role.kind === "guest" ? "Guest" : "Team"}</Badge></div>
              <p className="text-ink-2">{ws.my_role.description}</p>
              {ws.can("members.view") && <Link href={`${base}/team/roles`} className="inline-flex items-center gap-1.5 font-semibold text-brand"><KeyRound size={15} /> See all roles</Link>}
            </div>
          </Card>
        </div>
      </div>
      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
    </>
  );
}
