"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, Button, Field, Input, Segmented } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useAuth } from "./AuthProvider";

export function nextUrl(params: URLSearchParams, fallback = "/") {
  const n = params.get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : fallback;
}

const loginSchema = z.object({
  identifier: z.string().min(3, "Enter your email or phone number"),
  password: z.string().min(1, "Enter your password"),
});

export function LoginForm({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const f = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const submit = f.handleSubmit(async (v) => {
    setError(null);
    try {
      await signIn(v.identifier, v.password);
      if (onDone) onDone(); else router.replace(nextUrl(params));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not sign in.");
    }
  });
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {error && <Alert tone="crit">{error}</Alert>}
      <Field label="Email or phone number" htmlFor="identifier" error={f.formState.errors.identifier?.message}>
        <Input id="identifier" autoComplete="username" placeholder="0803 555 0147 or you@example.com" {...f.register("identifier")} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="password" className="text-[12.5px] font-semibold text-ink-2">Password</label>
          {!compact && <Link href="/forgot-password" className="text-[12.5px] font-semibold text-brand">Forgot password?</Link>}
        </div>
        <Input id="password" type="password" autoComplete="current-password" {...f.register("password")} />
        {f.formState.errors.password && <p className="text-[12.5px] text-crit">{f.formState.errors.password.message}</p>}
      </div>
      <Button type="submit" variant="primary" size="lg" block loading={f.formState.isSubmitting}>Sign in</Button>
      {!compact && <Link href={`/login/code${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}
        className="text-center text-[13.5px] font-semibold text-brand">Email me a sign-in code instead</Link>}
      {!compact && (
        <p className="text-center text-[13.5px] text-ink-2">New to Oko? <Link className="font-semibold text-brand" href={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}>Create an account</Link></p>
      )}
    </form>
  );
}

const registerSchema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  contact: z.string().min(3, "Enter your phone number or email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

export function RegisterForm({ onDone, compact, defaultName }: { onDone?: () => void; compact?: boolean; defaultName?: string }) {
  const { signUp } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [error, setError] = useState<string | null>(null);
  const f = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema), defaultValues: { full_name: defaultName ?? "" } });
  const submit = f.handleSubmit(async (v) => {
    setError(null);
    try {
      await signUp({ full_name: v.full_name, password: v.password, ...(mode === "phone" ? { phone: v.contact } : { email: v.contact }) });
      if (onDone) onDone(); else router.replace(nextUrl(params, "/onboarding"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create your account.");
    }
  });
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {error && <Alert tone="crit">{error}</Alert>}
      <Field label="Full name" htmlFor="full_name" error={f.formState.errors.full_name?.message}>
        <Input id="full_name" autoComplete="name" placeholder="Funke Adeyemi" {...f.register("full_name")} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="contact" className="text-[12.5px] font-semibold text-ink-2">{mode === "phone" ? "Phone number" : "Email address"}</label>
          <Segmented value={mode} onChange={setMode} options={[{ value: "phone", label: "Phone" }, { value: "email", label: "Email" }]} />
        </div>
        <Input id="contact" type={mode === "phone" ? "tel" : "email"} autoComplete={mode === "phone" ? "tel" : "email"}
          placeholder={mode === "phone" ? "0803 555 0147" : "you@example.com"} {...f.register("contact")} />
        {f.formState.errors.contact && <p className="text-[12.5px] text-crit">{f.formState.errors.contact.message}</p>}
      </div>
      <Field label="Password" htmlFor="new-password" hint="At least 8 characters" error={f.formState.errors.password?.message}>
        <Input id="new-password" type="password" autoComplete="new-password" {...f.register("password")} />
      </Field>
      <Button type="submit" variant="primary" size="lg" block loading={f.formState.isSubmitting}>Create account</Button>
      {!compact && (
        <p className="text-center text-[13.5px] text-ink-2">Already on Oko? <Link className="font-semibold text-brand" href={`/login${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}>Sign in</Link></p>
      )}
    </form>
  );
}
