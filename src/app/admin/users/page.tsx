"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Avatar, Badge, Card, Input, PageHeader, PageLoader, Select, useToast } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { useAdminUsers, useUpdateUser } from "@/features/admin/api";
import { ApiError } from "@/lib/api";
import { relative } from "@/lib/format";

const STAFF = ["", "super_admin", "verification", "support", "moderation", "content", "finance"];

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const users = useAdminUsers(q);
  const update = useUpdateUser();
  const { me } = useAuth();
  const toast = useToast();
  const change = async (id: string, body: Record<string, unknown>, label: string) => {
    try { await update.mutateAsync({ id, ...body }); toast(label); } catch (e) { toast((e as ApiError).message, "crit"); }
  };
  return (
    <>
      <PageHeader eyebrow="Oko operations" title="Accounts" sub="Suspend accounts and give Oko staff roles. Only super admins can change staff roles." />
      <div className="relative mb-3 max-w-xs"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <Input className="pl-9" placeholder="Name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search accounts" /></div>
      <Card flush>
        {users.isLoading ? <PageLoader /> : (
          <ul>
            {users.data?.items.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 first:border-0">
                <Avatar name={u.full_name} />
                <span className="min-w-[200px] flex-1"><b className="block">{u.full_name}</b><span className="text-[12.5px] text-ink-3">{u.email ?? u.phone} · last seen {u.last_login_at ? relative(u.last_login_at) : "never"}</span></span>
                <Select className="w-40 py-1.5" aria-label="Staff role" value={u.platform_role ?? ""} disabled={me?.user.platform_role !== "super_admin" || u.id === me?.user.id}
                  onChange={(e) => change(u.id, e.target.value ? { platform_role: e.target.value } : { clear_platform_role: true }, `${u.full_name}: staff role updated`)}>
                  {STAFF.map((s) => <option key={s} value={s}>{s ? s.replace("_", " ") : "Not staff"}</option>)}
                </Select>
                <button className="cursor-pointer" disabled={u.id === me?.user.id} onClick={() => change(u.id, { status: u.status === "active" ? "suspended" : "active" }, `${u.full_name}: ${u.status === "active" ? "suspended" : "reactivated"}`)}>
                  <Badge tone={u.status === "active" ? "good" : "crit"} dot>{u.status}</Badge></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
