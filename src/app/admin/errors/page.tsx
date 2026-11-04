"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bug, CheckCircle2, RotateCcw } from "lucide-react";
import { Badge, Button, Card, Dialog, EmptyState, PageHeader, PageLoader, Pager, Segmented, usePager, useToast } from "@/components/ui";
import { type ErrorGroup, useErrorDetail, useErrors, useResolveError } from "@/features/admin/api";
import { formatDateTime, relative } from "@/lib/format";

const SOURCE: Record<ErrorGroup["source"], { label: string; tone: "crit" | "warn" | "info" }> = {
  api: { label: "API", tone: "crit" }, worker: { label: "Background job", tone: "warn" }, web: { label: "Web app", tone: "info" },
};

export default function ErrorsPage() {
  return <Suspense fallback={<PageLoader />}><Errors /></Suspense>;
}

function Errors() {
  const [status, setStatus] = useState<"open" | "resolved" | "all">("open");
  const [source, setSource] = useState("");
  const pg = usePager(20, [status, source]);
  const q = useErrors(status, source, pg.params);
  const params = useSearchParams();
  const router = useRouter();
  const openId = params.get("id");   // links in alert emails open the error directly
  const open = (id: string | null) => router.replace(id ? `/admin/errors?id=${id}` : "/admin/errors", { scroll: false });

  return (
    <>
      <PageHeader eyebrow="Oko admin" title="Errors" sub="Crashes in the API, background jobs and people's browsers, grouped. A new one emails the super admins once." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Segmented value={status} onChange={setStatus} options={[{ value: "open", label: "Open" }, { value: "resolved", label: "Fixed" }, { value: "all", label: "All" }]} />
        <Segmented value={source} onChange={setSource} options={[{ value: "", label: "Everywhere" }, { value: "api", label: "API" }, { value: "worker", label: "Jobs" }, { value: "web", label: "Web" }]} />
      </div>
      <Card flush>
        {q.isLoading ? <PageLoader /> : !q.data?.items.length ? (
          <EmptyState icon={<CheckCircle2 size={22} />} title={status === "open" ? "No open errors" : "Nothing here"} body={status === "open" ? "When something breaks, it shows here and the super admins get an email." : undefined} />
        ) : (
          <ul>
            {q.data.items.map((e) => (
              <li key={e.id} className="border-t border-line first:border-0">
                <button type="button" onClick={() => open(e.id)} className="flex w-full flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-surface-2">
                  <Bug size={16} className="mt-0.5 shrink-0 text-crit" />
                  <span className="min-w-0 flex-1 basis-[240px]">
                    <b className="block break-words text-[13.5px]">{e.title}</b>
                    <span className="block truncate font-mono text-[12px] text-ink-3">{e.location}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                    <Badge tone={SOURCE[e.source].tone}>{SOURCE[e.source].label}</Badge>
                    {e.resolved_at && <Badge tone="good">Fixed</Badge>}
                    <span className="tnum">{e.count.toLocaleString("en-NG")}×{e.people ? ` · ${e.people} ${e.people === 1 ? "person" : "people"}` : ""}</span>
                    <span>· {relative(e.last_seen)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Pager className="mx-4 mb-3" {...pg.bind(q.data?.total, q.isFetching)} noun="errors" />
      </Card>
      <ErrorSheet id={openId} onClose={() => open(null)} />
    </>
  );
}

function ErrorSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const d = useErrorDetail(id);
  const resolve = useResolveError();
  const toast = useToast();
  const e = d.data;
  const trace = e?.sample.traceback ?? e?.sample.stack;
  return (
    <Dialog open={!!id} onClose={onClose} side wide title={e?.title ?? "Error"} eyebrow={e ? SOURCE[e.source].label : "Error"}
      footer={e && (e.resolved_at
        ? <Button onClick={async () => { await resolve.mutateAsync({ id: e.id, resolved: false }); toast("Reopened"); }}><RotateCcw size={15} /> Reopen</Button>
        : <Button variant="primary" onClick={async () => { await resolve.mutateAsync({ id: e.id, resolved: true }); toast("Marked fixed. If it happens again you will get an email."); onClose(); }}><CheckCircle2 size={15} /> Mark fixed</Button>)}>
      {!e ? <PageLoader /> : (
        <div className="flex flex-col gap-4 text-[13.5px]">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
            <dt className="text-ink-3">Where</dt><dd className="break-words font-mono text-[12.5px]">{e.location || "—"}</dd>
            {e.sample.path && <><dt className="text-ink-3">Page or route</dt><dd className="break-words font-mono text-[12.5px]">{e.sample.method ? `${e.sample.method} ` : ""}{e.sample.path}</dd></>}
            <dt className="text-ink-3">How often</dt><dd>{e.count.toLocaleString("en-NG")} times{e.people ? `, ${e.people} ${e.people === 1 ? "person" : "people"}` : ""}</dd>
            <dt className="text-ink-3">First / last</dt><dd>{formatDateTime(e.first_seen)} · {formatDateTime(e.last_seen)}</dd>
            <dt className="text-ink-3">Release</dt><dd className="font-mono text-[12.5px]">{e.release}{e.sample.web_release ? ` (web ${e.sample.web_release})` : ""}</dd>
            {e.sample.user_agent && <><dt className="text-ink-3">Browser</dt><dd className="break-words text-[12.5px]">{e.sample.user_agent}</dd></>}
            {e.sample.note && <><dt className="text-ink-3">Job</dt><dd className="break-words">{e.sample.logger}: {e.sample.note}</dd></>}
          </dl>
          {trace && (
            <div>
              <div className="eyebrow mb-1.5">Latest {e.source === "web" ? "stack" : "traceback"}</div>
              <pre className="max-h-[50vh] overflow-auto rounded-xl bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre">{trace}</pre>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
