"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Alert } from "@/components/ui";
import { RequireAuth, useAuth } from "@/features/auth";
import { cn } from "@/lib/format";

const TABS = [{ href: "/admin", label: "Workspaces" }, { href: "/admin/users", label: "Accounts" }, { href: "/admin/flags", label: "Feature switches" }, { href: "/admin/messages", label: "Email delivery" }, { href: "/admin/errors", label: "Errors" }, { href: "/admin/storage", label: "Storage" }, { href: "/admin/packs", label: "Species packs" }];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RequireAuth><Gate>{children}</Gate></RequireAuth>;
}

function Gate({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const path = usePathname();
  if (!me?.user.platform_role) return <div className="mx-auto mt-24 max-w-md px-4"><Alert tone="crit" title="Oko staff only">This console is for the Oko operations team.</Alert></div>;
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 bg-side text-side-ink">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-4 px-[max(16px,env(safe-area-inset-left))] py-3 sm:px-6">
          <Logo /><span className="rounded-full bg-maize px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-on-maize">Operations</span>
          <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 [scrollbar-width:none]">{TABS.map((t) => <Link key={t.href} href={t.href} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-[13.5px] font-semibold", path === t.href ? "bg-side-hi text-white" : "text-side-ink-2 hover:text-white")}>{t.label}</Link>)}</nav>
          <Link href="/app" className="ml-auto flex items-center gap-1.5 text-[13px] text-side-ink-2 hover:text-white"><ArrowLeft size={15} /> Back to my workspaces</Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-[max(16px,env(safe-area-inset-left))] py-6 sm:px-6">{children}</main>
    </div>
  );
}
