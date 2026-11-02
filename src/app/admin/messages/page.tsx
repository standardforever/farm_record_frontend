"use client";

import { useState } from "react";
import { Mail, RotateCw, Send } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, PageLoader, Pager, Segmented, useDebounced, usePager, useToast } from "@/components/ui";
import { useDeliveryConfig, useMessages, useRetryMessage, useSendTest } from "@/features/admin/api";
import { useAuth } from "@/features/auth";
import { ApiError } from "@/lib/api";
import { relative } from "@/lib/format";

const STATUS_TONE = { sent: "good", queued: "warn", failed: "crit" } as const;
const TEMPLATE: Record<string, string> = {
  code_verify_email: "Confirm email code", code_reset_password: "Password reset code", code_login: "Sign-in code",
  invite: "Invite", test: "Test email",
};

export default function Messages() {
  const { me } = useAuth();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [to, setTo] = useState(me?.user.email ?? "");
  const term = useDebounced(q);
  const pg = usePager(20, [status, term]);
  const msgs = useMessages(status, term, pg.params);
  const cfg = useDeliveryConfig();
  const test = useSendTest();
  const retry = useRetryMessage();
  const toast = useToast();
  const superAdmin = me?.user.platform_role === "super_admin";

  return (
    <>
      <PageHeader eyebrow="Oko operations" title="Email delivery" sub="Every email Oko sends: invites, codes and tests. Codes are hidden. Message bodies are deleted once sent." />
      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Providers" meta="Tried in this order; if one fails the next is used.">
          {cfg.data && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {cfg.data.email_providers.map((p, i) => <Badge key={p} tone={p === "console" ? "warn" : "brand"}>{i + 1}. {p}</Badge>)}
              </div>
              {!cfg.data.real_email_delivery && <Alert tone="warn" title="Emails are not being sent">No provider key is set, so emails only go to the server log. Add OQUMAIL_API_KEY in Render.</Alert>}
              <p className="text-[12.5px] text-ink-3">From name “{cfg.data.from_name}” · links point to {cfg.data.app_url} · SMS: {cfg.data.sms_providers.length ? cfg.data.sms_providers.join(", ") : "not enabled yet (milestone M0.6)"}</p>
            </div>
          )}
        </Card>
        <Card title="Send a test email" meta={superAdmin ? "Check it lands in the inbox, not spam." : "Super admins only."}>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async (e) => {
            e.preventDefault();
            try { await test.mutateAsync(to.trim()); toast(`Test email queued for ${to.trim()}`); } catch (err) { toast((err as ApiError).message, "crit"); }
          }}>
            <Input aria-label="Send test to" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@gmail.com" disabled={!superAdmin} />
            <Button type="submit" variant="primary" loading={test.isPending} disabled={!superAdmin || !/^\S+@\S+\.\S+$/.test(to.trim())}><Send size={16} /> Send</Button>
          </form>
        </Card>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented value={status} onChange={setStatus} options={[{ value: "", label: "All" }, { value: "sent", label: "Sent" }, { value: "queued", label: "Waiting" }, { value: "failed", label: "Failed" }]} />
        <Input aria-label="Search recipient" className="max-w-[280px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email" />
        <span className="ml-auto text-[12.5px] text-ink-3">{msgs.data ? `${msgs.data.total} messages` : ""}</span>
      </div>
      <Card flush>
        {msgs.isLoading ? <PageLoader /> : !msgs.data?.items.length ? (
          <EmptyState icon={<Mail size={22} />} title="No emails yet" body="Invites, sign-in codes and tests will show here." />
        ) : (
          <ul>
            {msgs.data.items.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 border-t border-line px-4 py-3 first:border-0">
                <div className="min-w-0 flex-1 basis-[260px]">
                  <div className="flex flex-wrap items-center gap-2"><b className="break-all">{m.to_address}</b><Badge>{TEMPLATE[m.template] ?? m.template}</Badge></div>
                  <div className="truncate text-[13px] text-ink-3">{m.subject}</div>
                  {m.last_error && <div className={m.status === "sent" ? "text-[12.5px] text-warn" : "text-[12.5px] text-crit"}>{m.status === "sent" ? "Fallback used: " : ""}{m.last_error}</div>}
                </div>
                <div className="flex items-center gap-2 text-[12.5px] text-ink-3">
                  <span title={m.sent_at ?? m.created_at}>{relative(m.sent_at ?? m.created_at)}</span>
                  {m.provider && <span className="font-mono">{m.provider}</span>}
                  {m.attempts > 1 && <span>{m.attempts} tries</span>}
                  <Badge tone={STATUS_TONE[m.status]}>{m.status === "queued" ? "waiting" : m.status}</Badge>
                  {m.status === "failed" && (
                    <Button size="sm" variant="ghost" onClick={async () => {
                      try { await retry.mutateAsync(m.id); toast("Trying again"); } catch (e) { toast((e as ApiError).message, "crit"); }
                    }}><RotateCw size={14} /> Retry</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pager className="mx-4 mb-3" {...pg.bind(msgs.data?.total, msgs.isFetching)} noun="messages" />
      </Card>
    </>
  );
}
