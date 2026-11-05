"use client";

import { useState } from "react";
import { FileText, Image as ImageIcon, Link2, Paperclip } from "lucide-react";
import { Card, EmptyState, PageHeader, PageLoader, Pager, usePager } from "@/components/ui";
import { type EvidenceKind, EvidenceSheet, useRecentEvidence } from "@/features/evidence";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { formatDateTime } from "@/lib/format";

export default function EvidencePage() {
  return <RequirePermission permission="workspace.view"><Inner /></RequirePermission>;
}

const ICON = { photo: ImageIcon, pdf: FileText, link: Link2 };

function Inner() {
  const ws = useCurrentWorkspace();
  const pg = usePager(20);
  const q = useRecentEvidence(ws.orgId, pg.params.page, pg.params.page_size);
  const [open, setOpen] = useState<{ kind: EvidenceKind; id: string } | null>(null);
  return (
    <>
      <PageHeader eyebrow="Workspace" title="Evidence"
        sub="Photos, documents and links added to records, newest first. Only what you are allowed to see. Open one to see everything on that record, or add more." />
      <Card flush>
        {q.isLoading ? <PageLoader /> : !q.data?.items.length ? (
          <EmptyState icon={<Paperclip size={22} />} title="No evidence yet"
            body="Add a receipt, a delivery note or a photo of the work when you save a record, or later with the paperclip next to it. It is always optional." />
        ) : (
          <ul>
            {q.data.items.map((e) => {
              const Icon = ICON[e.type];
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => setOpen({ kind: e.kind, id: e.record_id })}
                    className="flex w-full cursor-pointer items-start gap-3 border-t border-line px-4 py-3 text-left hover:bg-surface-2/60">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3"><Icon size={16} /></span>
                    <span className="min-w-0 flex-1 text-[13.5px]">
                      <b className="block truncate">{e.kind_label}: {e.label}</b>
                      <span className="block truncate text-ink-2">{e.note ?? e.name ?? e.url ?? (e.type === "photo" ? "Photo" : "Document")}</span>
                      <span className="block text-[12px] text-ink-3">{e.added_by ?? "Someone"} · {formatDateTime(e.added_at)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Pager className="mx-4 mb-3" {...pg.bind(q.data?.total, q.isFetching)} noun="files" />
      </Card>
      {open && <EvidenceSheet kind={open.kind} id={open.id} onClose={() => setOpen(null)} />}
    </>
  );
}
