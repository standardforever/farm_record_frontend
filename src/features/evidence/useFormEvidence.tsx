"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { EvidencePicker } from "./EvidencePicker";
import { type EvidenceKind, type Picked, type RecordRef, attachPicked, emptyPicked, hasPicked, useEvidenceRefresh, viewPermission } from "./api";

/**
 * Optional evidence on a form. Render `field` in the form; after the record is saved call
 * `await attach("expense", { record_id: saved.id }, "Diesel")`. The record is never held back by its evidence:
 * if a file cannot be added, the person is told the record was saved and can add the file from the record.
 */
export function useFormEvidence(kind: EvidenceKind, opts: { hint?: string } = {}) {
  const ws = useCurrentWorkspace();
  const toast = useToast();
  const refresh = useEvidenceRefresh(ws.orgId);
  const [picked, setPicked] = useState<Picked>(emptyPicked);
  const allowed = ws.can(viewPermission(kind));
  const reset = useCallback(() => setPicked(emptyPicked()), []);

  const attach = useCallback(async (ref: RecordRef, label: string, as?: EvidenceKind) => {
    if (!allowed || !hasPicked(picked)) return;
    try {
      await attachPicked(ws.orgId, as ?? kind, ref, picked, label);
    } catch (e) {
      toast(`Saved. The evidence was not added: ${e instanceof ApiError ? e.message : "try again"}. Add it from the record.`, "crit");
    } finally {
      setPicked(emptyPicked());
      refresh();
    }
  }, [allowed, picked, ws.orgId, kind, toast, refresh]);

  const field = allowed ? <EvidencePicker value={picked} onChange={setPicked} hint={opts.hint} /> : null;
  return { field, attach, reset, picked: hasPicked(picked) };
}
