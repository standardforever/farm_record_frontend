"use client";

import { useRef, useState } from "react";
import { Camera, ChevronDown, FileText, Link2, Paperclip, X } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { shrinkPhoto } from "@/features/daily/device";
import { newId } from "@/features/offline/queue";
import { cn } from "@/lib/format";
import type { Picked, PickedFile } from "./api";

const MAX_PDF = 5 * 1024 * 1024;
const MAX_FILES = 8;

/**
 * "Add photos or documents (optional)": photos (shrunk on the phone), PDFs and a link, chosen while filling in a
 * form and added once the record is saved. Never required; the same can be added later from the record.
 */
export function EvidencePicker({ value, onChange, open: startOpen = false, hint, className }: {
  value: Picked; onChange: (p: Picked) => void; open?: boolean; hint?: string; className?: string;
}) {
  const [open, setOpen] = useState(startOpen || value.files.length > 0 || !!value.link);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const count = value.files.length + (value.link.trim() ? 1 : 0);

  const add = async (list: FileList | null, type: "photo" | "pdf") => {
    if (!list?.length) return;
    setErr(null); setBusy(true);
    const files: PickedFile[] = [];
    try {
      for (const f of Array.from(list)) {
        if (value.files.length + files.length >= MAX_FILES) { setErr(`Up to ${MAX_FILES} files at a time.`); break; }
        if (type === "pdf") {
          if (f.type && f.type !== "application/pdf") { setErr(`${f.name} is not a PDF.`); continue; }
          if (f.size > MAX_PDF) { setErr(`${f.name} is larger than 5 MB.`); continue; }
          files.push({ id: newId(), blob: f, name: f.name, type: "pdf" });
        } else {
          const blob = await shrinkPhoto(f);
          files.push({ id: newId(), blob, name: f.name.replace(/\.\w+$/, "") + ".jpg", type: "photo", preview: URL.createObjectURL(blob) });
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      setBusy(false);
      if (photoRef.current) photoRef.current.value = "";
      if (pdfRef.current) pdfRef.current.value = "";
    }
    if (files.length) onChange({ ...value, files: [...value.files, ...files] });
  };
  const drop = (id: string) => onChange({ ...value, files: value.files.filter((f) => f.id !== id) });

  return (
    <div className={cn("rounded-xl border border-line", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-[13.5px] font-semibold">
        <Paperclip size={15} className="text-ink-3" />
        <span className="flex-1">Add photos or documents <span className="font-normal text-ink-3">(optional{count ? `, ${count} added` : ""})</span></span>
        <ChevronDown size={16} className={cn("text-ink-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-line px-3 pb-3 pt-2.5">
          <p className="text-[12.5px] text-ink-3">{hint ?? "A receipt, delivery note, prescription or a photo of the work. Photos up to any size (shrunk on this phone), PDFs up to 5 MB."}</p>
          <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" aria-label="Choose photos" onChange={(e) => add(e.target.files, "photo")} />
          <input ref={pdfRef} type="file" accept="application/pdf" multiple className="hidden" aria-label="Choose PDF documents" onChange={(e) => add(e.target.files, "pdf")} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={busy} onClick={() => photoRef.current?.click()}><Camera size={14} /> Photo</Button>
            <Button size="sm" onClick={() => pdfRef.current?.click()}><FileText size={14} /> PDF</Button>
          </div>
          {value.files.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {value.files.map((f) => (
                <li key={f.id} className="relative">
                  {f.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.preview} alt={f.name} className="h-16 w-16 rounded-lg border border-line object-cover" />
                  ) : (
                    <span className="flex h-16 w-28 flex-col justify-center gap-0.5 rounded-lg border border-line px-2 text-[11.5px]">
                      <FileText size={15} className="text-ink-3" /><span className="truncate">{f.name}</span></span>
                  )}
                  <button type="button" onClick={() => drop(f.id)} aria-label={`Remove ${f.name}`}
                    className="absolute -right-1.5 -top-1.5 grid h-6 w-6 cursor-pointer place-items-center rounded-full bg-[var(--scrim)] text-white"><X size={13} /></button>
                </li>
              ))}
            </ul>
          )}
          <Field label="Or a link" htmlFor="ev-link" hint="To a file kept elsewhere, e.g. Google Drive">
            <div className="relative"><Link2 size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <Input id="ev-link" className="pl-8" inputMode="url" placeholder="https://" value={value.link} onChange={(e) => onChange({ ...value, link: e.target.value })} /></div>
          </Field>
          {count > 0 && (
            <Field label="What is it?" htmlFor="ev-note" hint="Optional">
              <Input id="ev-note" maxLength={300} value={value.note} placeholder="For example: waybill from Top Feeds" onChange={(e) => onChange({ ...value, note: e.target.value })} />
            </Field>
          )}
          {err && <p className="text-[12.5px] text-crit" role="alert">{err}</p>}
        </div>
      )}
    </div>
  );
}
