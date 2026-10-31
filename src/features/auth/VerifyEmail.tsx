"use client";

import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Alert, Badge, Button, Card, Field, useToast } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { CodeInput, retryAfter, useCooldown } from "./codes";

/** Shows whether the person's email is confirmed, and lets them confirm it with a code. */
export function VerifyEmailCard() {
  const { me, reload } = useAuth();
  const toast = useToast();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();
  const user = me?.user;
  if (!user) return null;

  const send = async () => {
    setError(null); setBusy(true);
    try {
      await post("/auth/email/verify/start");
      setSent(true); cooldown.start(60);
    } catch (e) {
      const wait = retryAfter(e);
      if (wait) { setSent(true); cooldown.start(wait); return; }  // a code is already on its way
      setError(e instanceof ApiError ? e.message : "Could not send the code.");
    } finally { setBusy(false); }
  };
  const confirm = async () => {
    setError(null); setBusy(true);
    try {
      await post("/auth/email/verify/confirm", { code });
      await reload(); toast("Email confirmed");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not confirm.");
    } finally { setBusy(false); }
  };

  return (
    <Card title="Email address" action={user.email ? (user.email_verified
      ? <Badge tone="good"><CheckCircle2 size={13} /> Confirmed</Badge> : <Badge tone="warn">Not confirmed</Badge>) : undefined}>
      {!user.email ? (
        <p className="text-ink-2">You signed up with a phone number. Adding an email for receipts and sign-in codes arrives soon.</p>
      ) : user.email_verified ? (
        <p className="flex items-center gap-2 text-ink-2"><Mail size={16} className="text-brand" />{user.email}. Invites, codes and receipts are sent here.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-ink-2">Confirm <b className="text-ink">{user.email}</b> so you can reset your password and sign in with a code.</p>
          {error && <Alert tone="crit">{error}</Alert>}
          {sent && !error && <p className="text-[13px] text-ink-3">We sent a 6-digit code to your email. It expires in 10 minutes.</p>}
          {sent ? (
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); if (code.length === 6) confirm(); }}>
              <Field label="Code from the email" htmlFor="verify-code"><CodeInput id="verify-code" value={code} onChange={setCode} autoFocus /></Field>
              <Button type="submit" variant="primary" loading={busy} disabled={code.length !== 6}>Confirm</Button>
              <Button type="button" variant="ghost" disabled={cooldown.left > 0 || busy} onClick={send}>
                {cooldown.left > 0 ? `Resend in ${cooldown.left}s` : "Send again"}</Button>
            </form>
          ) : (
            <div><Button variant="primary" loading={busy} onClick={send}><Mail size={16} /> Email me a code</Button></div>
          )}
        </div>
      )}
    </Card>
  );
}
