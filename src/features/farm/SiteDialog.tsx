"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Dialog, Field, Input, Textarea, useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { LocationFields } from "@/features/geo";
import { type Site, useArchiveSite, useCreateSite, useUpdateSite } from "./api";

const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function SiteDialog({ open, onClose, site }: { open: boolean; onClose: () => void; site?: Site | null }) {
  const ws = useCurrentWorkspace();
  const create = useCreateSite(ws.orgId);
  const update = useUpdateSite(ws.orgId);
  const archive = useArchiveSite(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ name: "", code: "", address: "", state: "", lga: "", ward: "", area: "", lat: "", lng: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setF(site ? {
      name: site.name, code: site.code, address: site.address ?? "", state: site.state ?? "", lga: site.lga ?? "", ward: site.ward ?? "",
      area: site.area_hectares?.toString() ?? "", lat: site.latitude?.toString() ?? "", lng: site.longitude?.toString() ?? "", notes: site.notes ?? "",
    } : { name: "", code: "", address: "", state: ws.organization.state ?? "", lga: ws.organization.lga ?? "", ward: "", area: "", lat: "", lng: "", notes: "" });
  }, [open, site, ws.organization.state, ws.organization.lga]);

  const save = async () => {
    setError(null);
    const body = {
      name: f.name.trim(), address: f.address || null, state: f.state || null, lga: f.lga || null, ward: f.ward || null,
      area_hectares: num(f.area), latitude: num(f.lat), longitude: num(f.lng), notes: f.notes || null,
      ...(f.code.trim() ? { code: f.code.trim() } : {}),
    };
    try {
      if (site) { await update.mutateAsync({ id: site.id, ...body }); toast(`Saved ${body.name}`); }
      else { const s = await create.mutateAsync(body); toast(`Added site ${s.name} (${s.code})`); }
      onClose();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save."); }
  };

  return (
    <Dialog open={open} onClose={onClose} title={site ? `Edit ${site.name}` : "Add a site"} eyebrow="Farm"
      footer={<>
        {site && <Button variant="ghost" className="mr-auto" loading={archive.isPending} onClick={async () => {
          try { await archive.mutateAsync(site.id); toast(`Archived ${site.name}`); onClose(); } catch (e) { setError((e as ApiError).message); }
        }}>Archive site</Button>}
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={create.isPending || update.isPending} disabled={f.name.trim().length < 2} onClick={save}>{site ? "Save" : "Add site"}</Button>
      </>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <p className="text-[13px] text-ink-3">A site is a place you keep animals: the main farm, a second location or an outgrower plot.</p>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
          <Field label="Name" htmlFor="site-name"><Input id="site-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Main farm" /></Field>
          <Field label="Short code" htmlFor="site-code" hint="Optional"><Input id="site-code" value={f.code} maxLength={20} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="MAIN" /></Field>
        </div>
        <Field label="Address or landmark" htmlFor="site-address"><Input id="site-address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Km 4, Obada road" /></Field>
        <LocationFields withWard idPrefix="site" value={{ state: f.state, lga: f.lga, ward: f.ward }}
          onChange={(p) => setF((x) => ({ ...x, state: p.state, lga: p.lga, ward: p.ward ?? "" }))}
          onFix={(fix) => setF((x) => ({ ...x, lat: String(fix.latitude), lng: String(fix.longitude) }))} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Size (hectares)" htmlFor="site-area"><Input id="site-area" inputMode="decimal" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Field>
          <Field label="Latitude" htmlFor="site-lat" hint={f.lat ? undefined : "Optional"}><Input id="site-lat" inputMode="decimal" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} /></Field>
          <Field label="Longitude" htmlFor="site-lng" hint={f.lng ? undefined : "Optional"}><Input id="site-lng" inputMode="decimal" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} /></Field>
        </div>
        <p className="-mt-2 text-[12.5px] text-ink-3">{site?.location_precision === "ward" || site?.location_precision === "lga"
          ? `The point saved now is the centre of the ${site.location_precision === "ward" ? "ward" : "LGA"}. Stand at the farm and tap “Use my location” for the exact spot.`
          : "Stand at the farm and tap “Use my location” for the exact spot. Without it, Oko uses the centre of the ward you choose."}</p>
        <Field label="Notes" htmlFor="site-notes"><Textarea id="site-notes" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}
