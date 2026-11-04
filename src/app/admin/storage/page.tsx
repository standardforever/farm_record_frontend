"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, CloudUpload, ExternalLink, HardDrive, Link2Off, XCircle } from "lucide-react";
import { Alert, Badge, Button, Card, PageHeader, PageLoader, Stat, useToast } from "@/components/ui";
import { useDisconnectDrive, useMoveNow, useStartDrive, useStorage } from "@/features/admin/api";
import { useAuth } from "@/features/auth";
import { ApiError } from "@/lib/api";
import { formatDateTime, relative } from "@/lib/format";

const size = (b: number) => b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

const RETURN: Record<string, { tone: "good" | "warn" | "crit"; text: string }> = {
  connected: { tone: "good", text: "Google Drive is connected. New photos move there within a minute; older ones follow." },
  cancelled: { tone: "warn", text: "Connecting was cancelled on Google's page. Nothing changed." },
  expired: { tone: "warn", text: "That connect link expired (they last 10 minutes). Press Connect again." },
  forbidden: { tone: "crit", text: "Only an Oko super admin can connect Drive." },
  failed: { tone: "crit", text: "Google did not finish connecting." },
};

export default function StoragePage() {
  return <Suspense fallback={<PageLoader />}><Storage /></Suspense>;
}

function Storage() {
  const { me } = useAuth();
  const q = useStorage();
  const start = useStartDrive();
  const disconnect = useDisconnectDrive();
  const moveNow = useMoveNow();
  const toast = useToast();
  const params = useSearchParams();
  const router = useRouter();
  const back = params.get("drive");
  const why = params.get("why");
  const superAdmin = me?.user.platform_role === "super_admin";
  useEffect(() => { if (back) q.refetch(); }, [back]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!q.data) return <PageLoader />;
  const s = q.data;
  const inDb = s.evidence.database ?? { count: 0, bytes: 0 };
  const onDrive = s.evidence.gdrive ?? { count: 0, bytes: 0 };
  const connectDrive = async () => {
    try { window.location.href = (await start.mutateAsync()).url; }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not start connecting", "crit"); }
  };

  return (
    <>
      <PageHeader eyebrow="Oko admin" title="Storage" sub="Where evidence photos and the nightly backups are kept. One Google Drive for the whole platform." />
      {back && RETURN[back] && (
        <div className="mb-4"><Alert tone={RETURN[back].tone} title={RETURN[back].text}
          action={<Button size="sm" variant="ghost" onClick={() => router.replace("/admin/storage")}>Dismiss</Button>}>{why ?? undefined}</Alert></div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card title="Google Drive" action={s.status === "ok" ? <Badge tone="good" dot>Connected</Badge> : s.status === "reconnect" ? <Badge tone="crit" dot>Needs reconnecting</Badge> : <Badge dot>Not connected</Badge>}>
          {!s.configured ? (
            <div className="flex flex-col gap-3 text-[13.5px]">
              <Alert tone="info" title="Set up on the server first">
                Create a Google OAuth client (Web application) and add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in Render. Its redirect URI must be exactly:
              </Alert>
              <code className="break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-[12.5px]">{s.redirect_uri}</code>
            </div>
          ) : s.status === "ok" ? (
            <div className="flex flex-col gap-3 text-[13.5px]">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
                <dt className="text-ink-3">Account</dt><dd className="break-all font-semibold">{s.email}</dd>
                <dt className="text-ink-3">Connected</dt><dd>{s.connected_at ? formatDateTime(s.connected_at) : "—"}{s.connected_by ? ` by ${s.connected_by}` : ""}</dd>
                {s.quota && <><dt className="text-ink-3">Space</dt><dd>{size(s.quota.usage)} used{s.quota.limit ? ` of ${size(s.quota.limit)}` : ""}</dd></>}
                <dt className="text-ink-3">Access</dt><dd>Only the <b>Oko</b> folder it created. Nothing else in this Drive.</dd>
              </dl>
              <div className="flex flex-wrap gap-2">
                {s.folder_url && <a href={s.folder_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-[13px] font-semibold"><ExternalLink size={14} /> Open the Oko folder</a>}
                {superAdmin && <Button size="sm" variant="ghost" onClick={async () => { if (confirmDisconnect()) { await disconnect.mutateAsync(); toast("Drive disconnected. New photos stay in the database."); } }}><Link2Off size={14} /> Disconnect</Button>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-[13.5px]">
              {s.status === "reconnect" && <Alert tone="crit" title="Google Drive stopped accepting Oko's files">{s.error} Photos wait safely in the database until it is connected again.</Alert>}
              <p className="text-ink-2">Sign in with Oko&apos;s company Google account. Oko will only be able to see and change the folder it creates (<b>Oko</b>), nothing else in that Drive.</p>
              {superAdmin ? <Button variant="primary" onClick={connectDrive} disabled={start.isPending}><HardDrive size={16} /> {s.status === "reconnect" ? "Reconnect Google Drive" : "Connect Google Drive"}</Button>
                : <p className="text-ink-3">A super admin has to connect it.</p>}
            </div>
          )}
        </Card>

        <Card title="Evidence photos" meta="Sick animals, deliveries, counts. Saved in the database first, then moved to Drive.">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="In Google Drive" value={onDrive.count.toLocaleString("en-NG")} sub={onDrive.count ? size(onDrive.bytes) : "—"} />
            <Stat label="Waiting in the database" value={inDb.count.toLocaleString("en-NG")} sub={inDb.count ? size(inDb.bytes) : "—"} />
          </div>
          {s.status === "ok" && inDb.count > 0 && superAdmin && (
            <Button className="mt-3" size="sm" disabled={moveNow.isPending} onClick={async () => { const r = await moveNow.mutateAsync(); toast(`${r.moved} photo${r.moved === 1 ? "" : "s"} moved to Drive`); }}>
              <CloudUpload size={14} /> Move them now</Button>
          )}
        </Card>
      </div>

      <Card className="mt-4" title="Nightly backups" meta="Encrypted every night at 02:30, kept in Drive for 30 days. Each one is downloaded back and restored into an empty database to prove it works.">
        {!s.backups_enabled ? <Alert tone="info" title="Backups to Drive are off">Set <code>BACKUP_TOKEN</code> in Render and the three backup secrets in GitHub (see docs/OPERATIONS.md).</Alert>
          : !s.backups.length ? <p className="text-[13.5px] text-ink-3">No backups yet. The first arrives tonight at 02:30, or run the &quot;Nightly backup&quot; job on GitHub now.</p> : (
          <ul className="flex flex-col divide-y divide-line">
            {s.backups.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13.5px]">
                {b.drill_ok ? <CheckCircle2 size={16} className="text-good" /> : b.drill_ok === false ? <XCircle size={16} className="text-crit" /> : <HardDrive size={16} className="text-ink-3" />}
                <span className="min-w-0 flex-1 basis-[220px]"><b className="font-mono text-[12.5px]">{b.name}</b>
                  <span className="block text-[12px] text-ink-3">{relative(b.created_at)} · {size(b.size)}{b.on_drive ? "" : " · removed from Drive (older than 30 days)"}</span></span>
                <span className="text-[12.5px]">{b.drill_ok ? <>Restore works · {b.drill.tables} tables · {(b.drill.rows ?? 0).toLocaleString("en-NG")} rows</>
                  : b.drill_ok === false ? <span className="text-crit">Restore failed: {(b.drill.problems ?? []).join("; ")}</span> : <span className="text-ink-3">Drill not run</span>}</span>
                {b.run_url && <a href={b.run_url} target="_blank" rel="noreferrer" className="text-[12.5px] font-semibold text-brand">Run</a>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function confirmDisconnect() {
  // A plain confirm is fine on an admin-only page.
  return window.confirm("Disconnect Google Drive? Files already there stay there. Photos uploaded from now on stay in the database, and nightly backups stop until it is connected again.");
}
