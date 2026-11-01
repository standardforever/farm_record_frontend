"use client";

import { useMemo, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Alert, Badge, Button, Dialog, Field, Input, Segmented, Select, useToast } from "@/components/ui";
import { type FarmScope, ScopePicker, scopeIsValid } from "@/features/farm";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, formatDate } from "@/lib/format";
import type { Invite } from "@/lib/types";
import { canGrant, inviteLink, useCreateInvite, useRoles } from "./api";

const ENDINGS = [
  { v: "never", l: "No end date" },
  { v: "7", l: "In 7 days" },
  { v: "30", l: "In 30 days" },
  { v: "90", l: "In 90 days" },
  { v: "date", l: "Pick a date" },
];

export function InviteDialog({ open, onClose, presetRole }: { open: boolean; onClose: () => void; presetRole?: string }) {
  const ws = useCurrentWorkspace();
  const roles = useRoles(ws.orgId);
  const create = useCreateInvite(ws.orgId);
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [contact, setContact] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [ending, setEnding] = useState("never");
  const [date, setDate] = useState("");
  const [scope, setScope] = useState<FarmScope>({});
  const [done, setDone] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);

  const grantable = useMemo(() => (roles.data ?? []).filter((r) => canGrant(ws.my_permissions, r)), [roles.data, ws.my_permissions]);
  const role = grantable.find((r) => r.id === roleId) ?? grantable.find((r) => r.key === (presetRole ?? "worker"));
  const expiry = ending === "never" ? null : ending === "date" ? (date ? new Date(date + "T23:59:00").toISOString() : null)
    : new Date(Date.now() + Number(ending) * 86400000).toISOString();

  const reset = () => { setStep(1); setName(""); setContact(""); setRoleId(""); setEnding("never"); setDate(""); setScope({}); setDone(null); create.reset(); onClose(); };
  const send = async () => {
    if (!role) return;
    const limited = !role.permissions.includes("*") && scopeIsValid(scope) && Object.keys(scope).length > 0;
    const inv = await create.mutateAsync({ full_name: name, role_id: role.id, access_expires_at: expiry, scope: limited ? scope : {},
      ...(mode === "phone" ? { phone: contact } : { email: contact }) });
    setDone(inv);
    toast(inv.emailed ? `Invite emailed to ${inv.email}` : `Invite ready for ${inv.full_name}`);
  };
  const link = done?.accept_token ? inviteLink(done.accept_token) : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { toast("Select the link and copy it", "crit"); }
  };
  const waText = encodeURIComponent(`Hello ${done?.full_name}, join ${ws.organization.name} on Oko as ${done?.role.name}: ${link}`);

  const steps = ["Who", "Role", "Access", "Review"];
  return (
    <Dialog open={open} onClose={reset} title={done ? "Invite ready" : "Invite someone"} eyebrow={done ? undefined : `Step ${step} of 4 · ${steps[step - 1]}`}
      footer={done ? <Button variant="primary" onClick={reset}>Done</Button> : (
        <>
          {step > 1 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>}
          {step < 4 && <Button variant="primary" disabled={(step === 1 && (name.trim().length < 2 || contact.trim().length < 5)) || (step === 2 && !role) || (step === 3 && ((ending === "date" && !date) || !scopeIsValid(scope)))} onClick={() => setStep(step + 1)}>Next</Button>}
          {step === 4 && <Button variant="primary" loading={create.isPending} onClick={send}>Create invite</Button>}
        </>
      )}>
      {done ? (
        <div className="flex flex-col gap-4">
          {done.emailed && <Alert tone="good">We emailed the invite to <b>{done.email}</b>. You can also share the link yourself.</Alert>}
          <p className="text-ink-2">{done.emailed ? "This link" : <>Send this link to <b className="text-ink">{done.full_name}</b>. It</>} works once and expires on {formatDate(done.expires_at)}.</p>
          <div className="break-all rounded-xl bg-surface-2 p-3 font-mono text-[12.5px] select-all">{link}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy link"}</Button>
            <a className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line px-4 font-semibold hover:bg-surface-2" target="_blank" rel="noreferrer"
              href={`https://wa.me/${done.phone ? done.phone.replace("+", "") : ""}?text=${waText}`}><MessageCircle size={16} /> Send on WhatsApp</a>
          </div>
          {!done.emailed && <p className="text-[12.5px] text-ink-3">Invites by phone are shared by WhatsApp or copied link for now. Automatic SMS arrives later.</p>}
        </div>
      ) : step === 1 ? (
        <div className="flex flex-col gap-4">
          <Field label="Their name" htmlFor="inv-name"><Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chinedu Okafor" /></Field>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2"><label htmlFor="inv-contact" className="text-[12.5px] font-semibold text-ink-2">{mode === "phone" ? "Phone number" : "Email"}</label>
              <Segmented value={mode} onChange={setMode} options={[{ value: "phone", label: "Phone" }, { value: "email", label: "Email" }]} /></div>
            <Input id="inv-contact" type={mode === "phone" ? "tel" : "email"} value={contact} onChange={(e) => setContact(e.target.value)} placeholder={mode === "phone" ? "0803 555 0147" : "name@example.com"} />
          </div>
        </div>
      ) : step === 2 ? (
        <div className="flex flex-col gap-2">
          {roles.isLoading && <p className="text-ink-3">Loading roles…</p>}
          {(["member", "guest"] as const).map((kind) => (
            <div key={kind}>
              <div className="eyebrow mb-2 mt-2">{kind === "member" ? "Your team" : "Guests from other organisations"}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {grantable.filter((r) => r.kind === kind).map((r) => (
                  <button key={r.id} type="button" onClick={() => setRoleId(r.id)} aria-pressed={role?.id === r.id}
                    className={cn("cursor-pointer rounded-xl border p-3 text-left", role?.id === r.id ? "border-brand bg-brand-soft" : "border-line hover:border-ink-3")}>
                    <b className="block">{r.name}</b><span className="text-[12.5px] text-ink-3">{r.description || `${r.permissions.length} permissions`}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {roles.data && grantable.length < roles.data.length && <p className="mt-2 text-[12.5px] text-ink-3">Roles with more access than yours are hidden.</p>}
        </div>
      ) : step === 3 ? (
        <div className="flex flex-col gap-4">
          <Field label="Access ends" htmlFor="inv-end" hint={role?.kind === "guest" ? "Guests usually get an end date, for example a lender for 30 days." : "Staff usually have no end date."}>
            <Select id="inv-end" value={ending} onChange={(e) => setEnding(e.target.value)}>{ENDINGS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</Select>
          </Field>
          {ending === "date" && <Field label="End date" htmlFor="inv-date"><Input id="inv-date" type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></Field>}
          {role && !role.permissions.includes("*") && <ScopePicker value={scope} onChange={setScope} />}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {create.error && <Alert tone="crit">{(create.error as ApiError).message}</Alert>}
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 rounded-xl bg-surface-2 p-4 text-[13.5px]">
            <dt className="text-ink-3">Name</dt><dd className="text-right font-semibold">{name}</dd>
            <dt className="text-ink-3">{mode === "phone" ? "Phone" : "Email"}</dt><dd className="text-right font-semibold">{contact}</dd>
            <dt className="text-ink-3">Role</dt><dd className="text-right"><Badge tone={role?.kind === "guest" ? "maize" : "brand"}>{role?.name}</Badge></dd>
            <dt className="text-ink-3">Access ends</dt><dd className="text-right font-semibold">{expiry ? formatDate(expiry) : "No end date"}</dd>
            {(scope.units?.length || scope.sites?.length) ? <><dt className="text-ink-3">Limited to</dt><dd className="text-right font-semibold">
              {scope.units?.length ? `${scope.units.length} unit${scope.units.length === 1 ? "" : "s"}` : `${scope.sites!.length} site${scope.sites!.length === 1 ? "" : "s"}`}</dd></> : null}
          </dl>
          {role && <p className="text-[12.5px] text-ink-3">{role.name} can: {role.permissions.includes("*") ? "everything" : role.permissions.join(", ")}.</p>}
        </div>
      )}
    </Dialog>
  );
}
