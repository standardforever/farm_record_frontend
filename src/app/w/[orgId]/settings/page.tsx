"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Segmented, Select, useToast } from "@/components/ui";
import { orgTypeLabel } from "@/config/orgTypes";
import { useAuth, VerifyEmailCard } from "@/features/auth";
import { usePlans } from "@/features/meta/api";
import { useCurrentWorkspace, useUpdateWorkspace } from "@/features/workspaces";
import { ApiError, patch, post } from "@/lib/api";
import { cn, naira, NIGERIAN_STATES } from "@/lib/format";

const UNIT: Record<string, string> = { workspace: "per month", cycle: "per cycle", unit: "per unit a month", site: "per site a month", agreement: "by agreement" };

export default function SettingsPage() {
  const ws = useCurrentWorkspace();
  const { me, reload } = useAuth();
  const toast = useToast();
  const update = useUpdateWorkspace(ws.orgId);
  const plans = usePlans();
  const o = ws.organization;
  const [form, setForm] = useState({ name: o.name, state: o.state ?? "", lga: o.lga ?? "", phone: o.phone ?? "" });
  const [profile, setProfile] = useState({ full_name: me?.user.full_name ?? "", language: me?.user.language ?? "en" });
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => (typeof document !== "undefined" && (document.documentElement.dataset.theme as "light" | "dark")) || "system");
  const canEdit = ws.can("workspace.manage");

  const saveProfile = useMutation({ mutationFn: () => patch("/auth/me", profile), onSuccess: () => { reload(); toast("Profile saved"); } });
  const changePw = useMutation({ mutationFn: () => post("/auth/change-password", pw), onSuccess: () => { setPw({ current_password: "", new_password: "" }); toast("Password changed"); } });
  const setThemeTo = (t: "system" | "light" | "dark") => {
    setTheme(t);
    if (t === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    try { localStorage.setItem("oko-theme", t); } catch {}
  };

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Settings" sub={`${orgTypeLabel(o.type)} · created ${new Date(o.created_at).getFullYear()}`} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Workspace details" meta={canEdit ? undefined : "Only owners and co-owners can change these."}>
          <form className="flex flex-col gap-4" onSubmit={async (e) => { e.preventDefault(); await update.mutateAsync({ ...form, phone: form.phone || null } as never); toast("Workspace saved"); }}>
            {update.error && <Alert tone="crit">{(update.error as ApiError).message}</Alert>}
            <Field label="Name" htmlFor="s-name"><Input id="s-name" disabled={!canEdit} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="State" htmlFor="s-state"><Select id="s-state" disabled={!canEdit} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                <option value="">Choose a state</option>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="LGA" htmlFor="s-lga"><Input id="s-lga" disabled={!canEdit} value={form.lga} onChange={(e) => setForm({ ...form, lga: e.target.value })} /></Field>
            </div>
            <Field label="Business phone" htmlFor="s-phone"><Input id="s-phone" type="tel" disabled={!canEdit} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0803 555 0147" /></Field>
            {canEdit && <div><Button type="submit" variant="primary" loading={update.isPending}>Save workspace</Button></div>}
          </form>
        </Card>

        <Card title="Plan" meta="Prices are placeholders while we test them with farmers.">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {(plans.data ?? []).map((p) => (
              <div key={p.code} className={cn("rounded-xl border p-3.5", p.code === o.plan_code ? "border-brand bg-brand-soft" : "border-line")}>
                <div className="flex items-center justify-between gap-2"><b>{p.name}</b>{p.code === o.plan_code && <Badge tone="good"><Check size={12} /> Current</Badge>}</div>
                <div className="mt-1 font-mono text-[13px] font-semibold">{p.price_ngn_monthly ? `${naira(p.price_ngn_monthly)} ${UNIT[p.billing_unit] ?? ""}` : p.code === "enterprise" ? "Custom" : "Free"}</div>
                <p className="mt-1 text-[12.5px] text-ink-3">{p.description}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] text-ink-3">Online payment for plans arrives with the wallet (milestone M3.2). Contact Oko to change plan.</p>
        </Card>

        <Card title="My profile">
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); saveProfile.mutate(); }}>
            <Field label="Full name" htmlFor="p-name"><Input id="p-name" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></Field>
            <Field label="Language" htmlFor="p-lang" hint="Translations roll out with Phase 1.">
              <Select id="p-lang" value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })}>
                <option value="en">English</option><option value="pcm">Pidgin</option><option value="ha">Hausa</option><option value="yo">Yorùbá</option><option value="ig">Igbo</option><option value="ff">Fulfulde</option>
              </Select></Field>
            <div className="flex flex-col gap-1.5"><span className="text-[12.5px] font-semibold text-ink-2">Appearance</span>
              <Segmented value={theme} onChange={setThemeTo} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} /></div>
            <div><Button type="submit" variant="primary" loading={saveProfile.isPending}>Save profile</Button></div>
          </form>
        </Card>

        <VerifyEmailCard />

        <Card title="Password">
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); changePw.mutate(); }}>
            {changePw.error && <Alert tone="crit">{(changePw.error as ApiError).message}</Alert>}
            <Field label="Current password" htmlFor="pw-cur"><Input id="pw-cur" type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
            <Field label="New password" htmlFor="pw-new" hint="At least 8 characters"><Input id="pw-new" type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
            <div><Button type="submit" loading={changePw.isPending} disabled={pw.new_password.length < 8 || !pw.current_password}>Change password</Button></div>
          </form>
        </Card>
      </div>
    </>
  );
}
