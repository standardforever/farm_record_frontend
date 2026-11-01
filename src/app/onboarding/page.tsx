"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ORG_TYPES } from "@/config/orgTypes";
import { RequireAuth, useAuth } from "@/features/auth";
import { rememberWorkspace, useCreateWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { LocationFields } from "@/features/geo";
import { cn } from "@/lib/format";

export default function Onboarding() {
  return <RequireAuth><CreateWorkspace /></RequireAuth>;
}

function CreateWorkspace() {
  const { me, reload } = useAuth();
  const router = useRouter();
  const create = useCreateWorkspace();
  const [type, setType] = useState("farm");
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const first = me?.user.full_name.split(" ")[0];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ws = await create.mutateAsync({ name, type, state: state || undefined, lga: lga || undefined });
    rememberWorkspace(ws.organization.id);
    await reload();
    router.replace(`/w/${ws.organization.id}`);
  };

  return (
    <div className="min-h-dvh px-[max(16px,env(safe-area-inset-left))] py-8 sm:px-8">
      <div className="mx-auto max-w-[880px]">
        <div className="mb-8 flex items-center justify-between gap-2"><Logo dark />
          <div className="flex items-center gap-1">
            {me?.user.platform_role && <Button variant="ghost" onClick={() => router.push("/admin")}><ShieldCheck size={16} /> Oko admin console</Button>}
            {me && me.workspaces.length > 0 && <Button variant="ghost" onClick={() => router.back()}><ArrowLeft size={16} /> Back</Button>}
          </div></div>
        <div className="eyebrow">Step {step} of 2</div>
        <h1 className="mt-1 text-[clamp(26px,4vw,36px)] font-bold">{step === 1 ? `Welcome${first ? `, ${first}` : ""}. What do you run?` : "Name your workspace"}</h1>
        <p className="mt-1.5 text-ink-2">{step === 1 ? "Pick the closest match. You only see the tools for your kind of work." : "You can invite your team and change these details later."}</p>

        {step === 1 ? (
          <>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ORG_TYPES.map((t) => (
                <button key={t.key} type="button" onClick={() => setType(t.key)} aria-pressed={type === t.key}
                  className={cn("relative flex cursor-pointer items-start gap-3 rounded-[14px] border bg-surface p-4 text-left transition-colors",
                    type === t.key ? "border-brand shadow-[inset_0_0_0_1px_var(--brand)]" : "border-line hover:border-ink-3")}>
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", type === t.key ? "bg-brand text-on-brand" : "bg-brand-soft text-brand")}><t.icon size={20} /></span>
                  <span className="min-w-0"><b className="block">{t.label}</b><span className="text-[12.5px] text-ink-3">{t.blurb}</span></span>
                  {type === t.key && <Check size={16} className="absolute right-3 top-3 text-brand" />}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end"><Button variant="primary" size="lg" onClick={() => setStep(2)}>Continue</Button></div>
          </>
        ) : (
          <form onSubmit={submit} className="mt-6 flex max-w-[520px] flex-col gap-4">
            {create.error && <Alert tone="crit">{(create.error as ApiError).message}</Alert>}
            <Field label="Name" htmlFor="ws-name" hint={type === "farm" ? "For example, Adeyemi Integrated Farms" : undefined}>
              <Input id="ws-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <LocationFields idPrefix="ws" value={{ state, lga }} onChange={(p) => { setState(p.state); setLga(p.lga); }} />
            <p className="text-[12.5px] text-ink-3">Your location is used for weather, disease alerts and nearby buyers. Others only ever see your LGA.</p>
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</Button>
              <Button type="submit" variant="primary" size="lg" loading={create.isPending} disabled={name.trim().length < 2}>Create workspace</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
