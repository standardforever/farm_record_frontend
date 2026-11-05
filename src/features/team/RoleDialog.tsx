"use client";

import { useEffect, useState } from "react";
import { SHOW_ROADMAP } from "@/config/focus";
import { Alert, Badge, Button, Checkbox, Dialog, Field, Input, Segmented, Select, Textarea, useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import type { Role } from "@/lib/types";
import { useCreateRole, useDeleteRole, usePermissionCatalogue, useRoles, useUpdateRole } from "./api";

/** Create a custom role, or view/edit one. Built-in roles open read-only. */
export function RoleDialog({ open, role, onClose }: { open: boolean; role: Role | null; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const cat = usePermissionCatalogue();
  const roles = useRoles(ws.orgId);
  const create = useCreateRole(ws.orgId);
  const update = useUpdateRole(ws.orgId);
  const remove = useDeleteRole(ws.orgId);
  const toast = useToast();
  const readOnly = !!role?.is_system || !ws.can("roles.manage");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [kind, setKind] = useState<"member" | "guest">("member");
  const [perms, setPerms] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? "");
    setDesc(role?.description ?? "");
    setKind(role?.kind ?? "member");
    setPerms(new Set(role?.permissions.includes("*") ? (cat.data ?? []).flatMap((g) => g.permissions.map((p) => p.key)) : role?.permissions ?? ["workspace.view"]));
  }, [open, role, cat.data]);

  const mine = (p: string) => ws.my_permissions.includes("*") || ws.my_permissions.includes(p);
  const toggle = (p: string, on: boolean) => setPerms((s) => { const n = new Set(s); if (on) n.add(p); else n.delete(p); return n; });
  const copyFrom = (id: string) => { const r = roles.data?.find((x) => x.id === id); if (r) setPerms(new Set(r.permissions.filter((p) => p !== "*" && mine(p)))); };
  const err = (create.error ?? update.error ?? remove.error) as ApiError | null;
  const close = () => { create.reset(); update.reset(); remove.reset(); onClose(); };

  const save = async () => {
    const body = { name, description: desc, permissions: [...perms] };
    if (role) await update.mutateAsync({ id: role.id, ...body });
    else await create.mutateAsync({ ...body, kind });
    toast(role ? `Saved ${name}` : `Created role ${name}`);
    close();
  };

  return (
    <Dialog open={open} onClose={close} wide title={role ? role.name : "New custom role"} eyebrow={role?.is_system ? "Built-in role" : "Custom role"}
      footer={readOnly ? <Button onClick={close}>Close</Button> : (
        <>
          {role && <Button variant="danger" className="mr-auto" loading={remove.isPending} onClick={async () => { await remove.mutateAsync(role.id); toast(`Deleted ${role.name}`); close(); }}>Delete role</Button>}
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" loading={create.isPending || update.isPending} disabled={name.trim().length < 2 || perms.size === 0} onClick={save}>{role ? "Save role" : "Create role"}</Button>
        </>
      )}>
      <div className="flex flex-col gap-5">
        {err && <Alert tone="crit">{err.message}</Alert>}
        {role?.is_system && <Alert tone="info">Built-in roles cannot be changed. Create a custom role and copy this one to start from it.</Alert>}
        {!readOnly && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role name" htmlFor="r-name"><Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pond attendant" /></Field>
            {!role && (
              <div className="flex flex-col gap-1.5"><span className="text-[12.5px] font-semibold text-ink-2">Who is it for</span>
                <Segmented value={kind} onChange={setKind} options={[{ value: "member", label: "My team" }, { value: "guest", label: "Guests" }]} /></div>
            )}
            <Field label="Description" htmlFor="r-desc" className="sm:col-span-2"><Textarea id="r-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this person does" /></Field>
            {!role && (
              <Field label="Start from" htmlFor="r-copy" hint="Copies permissions you are allowed to give.">
                <Select id="r-copy" defaultValue="" onChange={(e) => copyFrom(e.target.value)}>
                  <option value="">Nothing (choose below)</option>
                  {(roles.data ?? []).filter((r) => r.key !== "owner").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </Field>
            )}
          </div>
        )}
        <div className="flex flex-col gap-4">
          {(cat.data ?? []).filter((g) => SHOW_ROADMAP || g.status !== "planned").map((g) => (
            <fieldset key={g.module} className="rounded-xl border border-line p-3.5">
              <legend className="flex items-center gap-2 px-1.5 text-[13.5px] font-semibold">{g.name}
                {g.status === "planned" && <Badge tone="neutral">Coming {g.phase.replace("phase-", "phase ")}</Badge>}</legend>
              <div className="grid gap-x-4 sm:grid-cols-2">
                {g.permissions.map((p) => (
                  <Checkbox key={p.key} label={p.label} description={p.key} checked={perms.has(p.key)}
                    disabled={readOnly || !mine(p.key)} onChange={(v) => toggle(p.key, v)} />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
