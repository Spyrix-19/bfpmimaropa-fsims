import * as React from "react";
import { Eye, Loader2, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StationInfoCard from "@/components/station-info-card";
import { toast } from "@/lib/toast";
import { unwrap } from "@/lib/api-envelope";
import { businessAPI } from "@/services/establistmentAPI";
import type { BusinessEstablishmentDetailModel, BusinessEstablishmentModel } from "@/types/establishmentType";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; record: BusinessEstablishmentModel | null };
const fmtDate = (v?: string) => !v || v.startsWith("0001") ? "—" : (Number.isNaN(new Date(v).getTime()) ? v : new Date(v).toLocaleDateString());
const Field = ({ label, value, wide }: { label: string; value?: React.ReactNode; wide?: boolean }) => <div className={wide ? "sm:col-span-2" : ""}><div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div><div className="mt-0.5 text-sm break-words">{value || "—"}</div></div>;

export default function BusinessDetailsModal({ open, onOpenChange, record }: Props) {
  const [detail, setDetail] = React.useState<BusinessEstablishmentDetailModel | null>(null);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    if (!open || !record) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setDetail(null);
      const resp = await businessAPI.getDetails({ establishmentno: record.establishmentno });
      const { ok, data, error } = unwrap<BusinessEstablishmentDetailModel>(resp);
      if (!cancelled) { if (ok && data) setDetail(data); else toast.error(error || "Unable to load business establishment details."); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, record]);
  const d = detail;
  const address = d ? [d.streetaddress, d.barangayname, d.cityname, d.provincename, d.regionname, d.zipcode].filter((v) => v?.trim()).join(", ") : "";
  const hasCoords = !!d && Number.isFinite(d.latitude) && Number.isFinite(d.longitude) && (d.latitude !== 0 || d.longitude !== 0);
  const card = "rounded-lg border border-border bg-card p-4 shadow-none";
  const title = "mb-3 text-xs font-semibold uppercase text-muted-foreground";
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="flex h-[calc(100dvh-1rem)] w-full max-w-[min(100vw-1rem,720px)] flex-col gap-0 overflow-x-hidden overflow-y-auto p-0 sm:h-auto sm:max-h-[calc(100dvh-1rem)] sm:overflow-hidden sm:rounded-lg">
    <DialogHeader className="shrink-0 border-b border-border bg-muted/40 px-5 py-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Eye className="h-5 w-5" /></div><div className="min-w-0 flex-1"><DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">View Business Establishment</DialogTitle><DialogDescription className="text-sm text-muted-foreground">View-only summary of this business establishment.</DialogDescription></div></div></DialogHeader>
    <div className="min-w-0 shrink-0 space-y-4 overflow-x-hidden p-5 sm:min-h-0 sm:flex-1 sm:overflow-y-auto">{loading ? <div className="flex justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading details…</div> : !d ? <p className="py-10 text-center text-sm text-muted-foreground">Details are not available.</p> : <> 
      <Card className={card}><div className="flex flex-wrap justify-between gap-2"><div><span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{d.establishmentcode || "—"}</span><div className="mt-1 text-base font-bold">{d.establishmentname}</div></div><div className="flex gap-1.5"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{d.statusname || "No status"}</span>{d.isrequired && <span className="rounded-full tone-warning-soft px-2 py-0.5 text-[10px] font-semibold">Required</span>}</div></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Floor / Area" value={[d.floorcount ? `${d.floorcount} floors` : "", d.buildingarea ? `${d.buildingarea} sq. m.` : ""].filter(Boolean).join(" · ")} /></div></Card>
      <Card className={card}><div className={title}>Owner &amp; Contact</div><div className="grid gap-4 sm:grid-cols-2"><Field label="Full Name" value={d.fullname || [d.firstname, d.miname, d.lastname, d.suffix].filter(Boolean).join(" ")} wide /><Field label="Contact No." value={d.contactno} /><Field label="Email Address" value={d.emailaddress} /></div></Card>
      <StationInfoCard stationName={d.stationname || "—"} unitCode={d.stationcode || undefined} logoUrl={d.stationlogourl || undefined} fields={[{ label: "Unit Code", value: d.stationcode || "—" }, { label: "City / Municipality", value: d.cityname || "—" }, { label: "Province", value: d.provincename || "—" }]} />
      <Card className={card}><div className={title}>Location</div><div className="grid gap-4 sm:grid-cols-2"><Field label="Address" value={address} wide /><Field label="Landmark" value={d.landmark} /><Field label="Zip Code" value={d.zipcode} /><Field label="Coordinates" wide value={hasCoords ? <a href={`https://www.google.com/maps?q=${d.latitude},${d.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><MapPin className="h-3.5 w-3.5" />{d.latitude.toFixed(5)}, {d.longitude.toFixed(5)}</a> : null} /></div></Card>
      <Card className={card}><div className={title}>Fire Safety Compliance</div><div className="grid gap-4 sm:grid-cols-2"><Field label="FSEC Date Issued" value={fmtDate(d.fsecdateissued)} /><Field label="FSEC Expiration" value={fmtDate(d.fsecexpirationdate)} /><Field label="FSIC Date Issued" value={fmtDate(d.fsicdateissued)} /><Field label="FSIC Expiration" value={fmtDate(d.fsicexpirationdate)} /><Field label="Remarks" value={d.remarks} wide /></div></Card>
      <Card className={card}><div className={title}>Record</div><div className="grid gap-4 sm:grid-cols-2"><Field label="Encoded By" value={d.encodedby} /><Field label="Date Encoded" value={fmtDate(d.dateencoded)} /><Field label="Updated By" value={d.updatedby} /><Field label="Date Updated" value={fmtDate(d.dateupdated)} /></div></Card>
    </>}</div>
    <DialogFooter className="shrink-0 border-t border-border px-5 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
  </DialogContent></Dialog>;
}
