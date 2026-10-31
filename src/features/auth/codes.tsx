"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { nextUrl } from "./forms";

/** Six-digit code box: numeric keyboard on phones, accepts paste and SMS/email autofill. */
export function CodeInput({ id = "code", value, onChange, autoFocus }: { id?: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <Input id={id} value={value} autoFocus={autoFocus} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
      placeholder="••••••" className="text-center font-mono text-[22px] tracking-[0.5em]"
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} />
  );
}

/** Seconds left before another code can be requested. */
export function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: (s: number) => setLeft(s) };
}

export function retryAfter(e: unknown) {
  return e instanceof ApiError && e.status === 429 ? Number(e.details.retry_after ?? 60) : 0;
}

type Flow = "login" | "reset";

/** Two steps: ask for the email, then enter the code (and a new password when resetting). */
export function EmailCodeForm({ flow }: { flow: Flow }) {
  const { signInWithToken } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();
  const startPath = flow === "login" ? "/auth/login-code/start" : "/auth/password/forgot";

  const send = async () => {
    setError(null); setBusy(true);
    try {
      await post(startPath, { email: email.trim() });
      setStep(2); setCode(""); cooldown.start(60);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not send the code.");
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    setError(null); setBusy(true);
    try {
      const r = flow === "login"
        ? await post<{ access_token: string }>("/auth/login-code/verify", { email: email.trim(), code })
        : await post<{ access_token: string }>("/auth/password/reset", { email: email.trim(), code, new_password: password });
      await signInWithToken(r.access_token);
      router.replace(nextUrl(params));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally { setBusy(false); }
  };

  if (step === 1) {
    return (
      <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); send(); }}>
        {error && <Alert tone="crit">{error}</Alert>}
        <Field label="Email address" htmlFor="code-email">
          <Input id="code-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}>Email me a code</Button>
        <p className="text-center text-[13px] text-ink-3">Signed up with a phone number? Codes by SMS are coming soon. Sign in with your password for now.</p>
        <Link href="/login" className="text-center text-[13.5px] font-semibold text-brand">Back to sign in</Link>
      </form>
    );
  }
  const ready = code.length === 6 && (flow === "login" || password.length >= 8);
  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); if (ready) confirm(); }}>
      <Alert tone="info">If <b>{email}</b> has an Oko account, a 6-digit code is on its way. Check spam if you do not see it.</Alert>
      {error && <Alert tone="crit">{error}</Alert>}
      <Field label="Code" htmlFor="code"><CodeInput value={code} onChange={setCode} autoFocus /></Field>
      {flow === "reset" && (
        <Field label="New password" htmlFor="new-password" hint="At least 8 characters">
          <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      )}
      <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={!ready}>{flow === "login" ? "Sign in" : "Set new password and sign in"}</Button>
      <div className="flex items-center justify-between text-[13.5px]">
        <button type="button" className="font-semibold text-brand disabled:text-ink-3" disabled={cooldown.left > 0 || busy} onClick={send}>
          {cooldown.left > 0 ? `Send again in ${cooldown.left}s` : "Send a new code"}
        </button>
        <button type="button" className="font-semibold text-ink-2" onClick={() => { setStep(1); setError(null); }}>Use another email</button>
      </div>
    </form>
  );
}
