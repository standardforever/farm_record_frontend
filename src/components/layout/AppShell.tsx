"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Clock, LogOut, Menu, Plus, Shield, X } from "lucide-react";
import { SHOW_ROADMAP } from "@/config/focus";
import { FARM_ORG_TYPES, NAV, PHASE_LABEL, SIMPLE_NAV } from "@/config/navigation";
import { orgTypeLabel } from "@/config/orgTypes";
import { useAuth } from "@/features/auth";
import { useMeta } from "@/features/meta/api";
import { SyncStatus, useAutoSync } from "@/features/offline";
import { OfflineWarmup } from "@/features/offline/Warmup";
import { useSimpleMode } from "@/features/simple";
import { useCurrentWorkspace } from "@/features/workspaces";
import { Avatar, Badge } from "@/components/ui";
import { cn } from "@/lib/format";
import { Logo } from "./Logo";

export function AppShell({ children }: { children: ReactNode }) {
  const ws = useCurrentWorkspace();
  const { me, signOut } = useAuth();
  const { data: meta } = useMeta();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  useEffect(() => { setOpen(false); setSwitcher(false); }, [path]);
  useAutoSync();

  const base = `/w/${ws.orgId}`;
  const simple = useSimpleMode(ws.my_role.key) && ws.has("farm") && ws.can("farm.view") && FARM_ORG_TYPES.includes(ws.organization.type);
  const items = NAV.filter((n) => (!n.permission || ws.can(n.permission)) && (!n.feature || ws.has(n.feature))
    && (!n.orgTypes || n.orgTypes.includes(ws.organization.type)) && (!simple || SIMPLE_NAV.includes(n.key)));
  const planned = simple || !SHOW_ROADMAP ? [] : (meta?.modules ?? []).filter((m) => m.status === "planned");
  const current = (p: string) => (p === "" ? path === base : path === base + p || (p !== "/team" && path.startsWith(base + p)));
  const others = (me?.workspaces ?? []).filter((w) => w.organization_id !== ws.orgId);

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[264px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[80] flex w-[min(300px,86vw)] flex-col gap-3.5 overflow-y-auto bg-side px-3.5 pb-4 pt-[calc(20px+env(safe-area-inset-top))] text-side-ink transition-transform lg:sticky lg:top-0 lg:h-dvh lg:w-auto lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-[104%]")} aria-label="Main navigation">
        <div className="flex items-center justify-between px-1.5"><Logo /><button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button></div>

        <div className="relative">
          <button onClick={() => setSwitcher((v) => !v)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-[11px] bg-side-hi p-2.5 text-left" aria-expanded={switcher}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-brand-2 text-[12px] font-bold text-white">{ws.organization.name.slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><b className="block truncate text-[13.5px] text-white">{ws.organization.name}</b>
              <small className="text-[11.5px] text-side-ink-2">{orgTypeLabel(ws.organization.type)} · {ws.my_role.name}</small></span>
            <ChevronDown size={16} className="text-side-ink-2" />
          </button>
          {switcher && (
            <div className="absolute inset-x-0 top-[calc(100%+6px)] z-10 overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-[var(--shadow)]">
              {others.map((w) => (
                <button key={w.organization_id} onClick={() => router.push(`/w/${w.organization_id}`)}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-2">
                  <Avatar name={w.organization_name} size={28} />
                  <span className="min-w-0"><b className="block truncate text-[13px]">{w.organization_name}</b><small className="text-ink-3">{w.role_name}</small></span>
                </button>
              ))}
              <Link href="/onboarding" className="flex items-center gap-2 border-t border-line px-3 py-2.5 text-[13px] font-semibold text-brand hover:bg-surface-2"><Plus size={15} /> New workspace</Link>
            </div>
          )}
        </div>

        <nav className="flex flex-col">
          {(["Overview", "Farm", "Workspace"] as const).filter((g) => items.some((i) => i.group === g)).map((g) => (
            <div key={g}>
              <div className="px-2.5 pb-1 pt-3.5 font-mono text-[10.5px] uppercase tracking-[.14em] text-side-ink-2">{g}</div>
              {items.filter((i) => i.group === g).map((i) => (
                <Link key={i.key} href={base + i.path} aria-current={current(i.path) ? "page" : undefined}
                  className={cn("flex items-center gap-2.5 rounded-[9px] px-2.5 py-[7px] font-medium hover:bg-side-hi",
                    current(i.path) && "bg-side-hi text-white [&_svg]:text-maize")}>
                  <i.icon size={18} /> {i.label}
                </Link>
              ))}
            </div>
          ))}
          {planned.length > 0 && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between px-2.5 pb-1 pt-3.5 font-mono text-[10.5px] uppercase tracking-[.14em] text-side-ink-2">
                Coming next <span className="normal-case tracking-normal">{planned.length} modules</span>
              </summary>
              {planned.map((m) => (
                <Link key={m.key} href={`${base}/modules/${m.key}`}
                  className="flex items-center gap-2.5 rounded-[9px] px-2.5 py-[6px] text-[13px] text-side-ink-2 hover:bg-side-hi hover:text-side-ink">
                  <Clock size={15} /> <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  <span className="font-mono text-[10px]">{PHASE_LABEL[m.phase]?.replace("Phase ", "P")}</span>
                </Link>
              ))}
            </details>
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-side-hi px-1.5 pt-3">
          <div className="hidden lg:block"><SyncStatus orgId={ws.orgId} dark /></div>
          {me?.user.platform_role && (
            <Link href="/admin" className="flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] font-semibold hover:bg-side-hi"><Shield size={16} /> Oko admin console</Link>
          )}
          <div className="flex items-center gap-2.5 px-1">
            <Avatar name={me?.user.full_name ?? "?"} size={32} tone="maize" />
            <span className="min-w-0 flex-1"><b className="block truncate text-[13px] text-white">{me?.user.full_name}</b>
              <small className="block truncate text-[11.5px] text-side-ink-2">{me?.user.email ?? me?.user.phone}</small></span>
            <button onClick={() => signOut().then(() => router.replace("/login"))} aria-label="Sign out" title="Sign out"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg hover:bg-side-hi"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-[75] bg-[var(--scrim)] lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-[env(safe-area-inset-top)] z-40 flex items-center gap-2.5 border-b border-line bg-surface py-2.5 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-10 w-10 cursor-pointer place-items-center rounded-[10px] border border-line"><Menu size={20} /></button>
          <div className="min-w-0"><div className="eyebrow !text-[10.5px]">{orgTypeLabel(ws.organization.type)}</div>
            <b className="block truncate font-display text-[16px]">{ws.organization.name}</b></div>
          <div className="ml-auto flex items-center gap-2"><SyncStatus orgId={ws.orgId} /><Badge tone="brand" className="max-[380px]:hidden">{ws.my_role.name}</Badge></div>
        </header>
        <OfflineWarmup />
        <main className="w-full max-w-[1280px] flex-1 px-[max(16px,env(safe-area-inset-left))] pb-[calc(100px+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-8 lg:pb-14">
          {children}
        </main>
      </div>

      {/* Phone bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-around border-t border-line bg-surface px-2 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 lg:hidden" aria-label="Quick navigation">
        {items.filter((i) => i.mobile).map((i) => (
          <Link key={i.key} href={base + i.path} className={cn("flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-semibold", current(i.path) ? "text-brand" : "text-ink-3")}>
            <i.icon size={22} />{i.label.split(" ")[0]}
          </Link>
        ))}
        <button onClick={() => setOpen(true)} className="flex flex-1 cursor-pointer flex-col items-center gap-0.5 py-1 text-[11px] font-semibold text-ink-3"><Menu size={22} />More</button>
      </nav>
    </div>
  );
}
