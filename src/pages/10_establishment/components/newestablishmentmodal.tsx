import * as React from "react";
import { Building2, Info, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import GentableSelect from "@/components/gentable-select";
import StationSearchSelect from "@/components/station-search-select";
import LocationSearchSelect from "@/components/location-search-select";
import LocationPickerMap from "@/components/LocationPickerMap";
import { toast } from "@/lib/toast";
import { unwrap } from "@/lib/api-envelope";
import { useAuth } from "@/lib/auth";
import { MIMAROPA_REGION_CODE, REGION_NAME, EMPTY_GUID } from "@/lib/fsims-constants";
import { businessAPI } from "@/services/establistmentAPI";
import type { BusinessEstablishmentDTO, BusinessEstablishmentDetailModel, BusinessEstablishmentModel } from "@/types/establishmentType";
import { BUSINESS_STATUS_TABLE, useBusinessOptions } from "../business-options";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; record: BusinessEstablishmentModel | null; onSaved: () => void };
type FormState = BusinessEstablishmentDTO & { regionname: string; provincename: string; cityname: string; barangayname: string; stationname: string; stationcode: string };

const EMPTY: FormState = {
  establishmentno: EMPTY_GUID, establishmentcode: "", establishmentname: "", lastname: "", firstname: "", miname: "", suffix: "", fullname: "",
  contactno: "", emailaddress: "", regionno: MIMAROPA_REGION_CODE, provinceno: EMPTY_GUID, cityno: EMPTY_GUID, barangayno: EMPTY_GUID,
  streetaddress: "", landmark: "", stationno: EMPTY_GUID, latitude: 0, longitude: 0, statusno: 0, buildingname: "", floorcount: 0,
  buildingarea: 0, fsecdateissued: "", fsecexpirationdate: "", fsicdateissued: "", fsicexpirationdate: "", remarks: "", isrequired: false,
  encodedby: EMPTY_GUID, regionname: REGION_NAME, provincename: "", cityname: "", barangayname: "", stationname: "", stationcode: "",
};

const generateCode = () => `BUS${Date.now()}${String(Math.floor(100 + Math.random() * 900))}`;
const hasValue = (v: string) => !!v && v !== EMPTY_GUID;
const fmtDateInput = (v?: string) => v && !v.startsWith("0001") ? v.slice(0, 10) : "";

const fromRecord = (r: BusinessEstablishmentModel | BusinessEstablishmentDetailModel): FormState => ({
  ...EMPTY,
  establishmentno: r.establishmentno || EMPTY_GUID, establishmentcode: r.establishmentcode ?? "", establishmentname: r.establishmentname ?? "",
  lastname: r.lastname ?? "", firstname: r.firstname ?? "", miname: r.miname ?? "", suffix: r.suffix ?? "", fullname: r.fullname ?? "",
  contactno: r.contactno ?? "", emailaddress: r.emailaddress ?? "", regionno: r.regionno || MIMAROPA_REGION_CODE, provinceno: r.provinceno || EMPTY_GUID,
  cityno: r.cityno || EMPTY_GUID, barangayno: r.barangayno || EMPTY_GUID, streetaddress: r.streetaddress ?? "", landmark: r.landmark ?? "",
  stationno: r.stationno || EMPTY_GUID, latitude: Number(r.latitude) || 0, longitude: Number(r.longitude) || 0, statusno: Number(r.statusno) || 0,
  buildingname: r.buildingname ?? "", floorcount: Number(r.floorcount) || 0, buildingarea: Number(r.buildingarea) || 0,
  fsecdateissued: fmtDateInput(r.fsecdateissued), fsecexpirationdate: fmtDateInput(r.fsecexpirationdate),
  fsicdateissued: fmtDateInput(r.fsicdateissued), fsicexpirationdate: fmtDateInput(r.fsicexpirationdate), remarks: r.remarks ?? "", isrequired: !!r.isrequired,
  regionname: r.regionname || REGION_NAME, provincename: r.provincename ?? "", cityname: r.cityname ?? "", barangayname: r.barangayname ?? "",
  stationname: r.stationname ?? "", stationcode: r.stationcode ?? "",
});

export default function BusinessFormModal({ open, onOpenChange, record, onSaved }: Props) {
  const { user, systemAccess } = useAuth();
  const roleno = Number(systemAccess?.roleno ?? 0) || 0;
  const isSuperAdmin = roleno === 1;
  const canSave = roleno === 1 || roleno === 2;
  const isEdit = !!record;
  const lockRequired = isEdit && !!record?.isrequired && !isSuperAdmin;
  const statusOptions = useBusinessOptions(BUSINESS_STATUS_TABLE);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTouched(false);
    if (!record) { setForm({ ...EMPTY, establishmentcode: generateCode() }); return; }
    setForm(fromRecord(record));
    let cancelled = false;
    (async () => {
      setLoadingDetail(true);
      const resp = await businessAPI.getDetails({ establishmentno: record.establishmentno });
      const { ok, data, error } = unwrap<BusinessEstablishmentDetailModel>(resp);
      if (!cancelled) {
        if (ok && data) setForm(fromRecord(data));
        else toast.error(error || "Unable to load the full business establishment record.");
      }
      setLoadingDetail(false);
    })();
    return () => { cancelled = true; };
  }, [open, record]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const emailOk = !form.emailaddress.trim() || /\S+@\S+\.\S+/.test(form.emailaddress.trim());
  const errors = {
    name: !form.establishmentname.trim() ? "Business name is required." : "",
    code: !form.establishmentcode.trim() ? "Business code is required." : "",
    station: !hasValue(form.stationno) ? "Station / Unit is required." : "",
    status: !form.statusno ? "Status is required." : "",
    region: !hasValue(form.regionno) ? "Region is required." : "",
    province: !hasValue(form.provinceno) ? "Province is required." : "",
    city: !hasValue(form.cityno) ? "City / municipality is required." : "",
    barangay: !hasValue(form.barangayno) ? "Barangay is required." : "",
    email: !emailOk ? "Enter a valid email address." : "",
    lat: form.latitude === 0 || form.latitude < -90 || form.latitude > 90 ? "Latitude is required." : "",
    lng: form.longitude === 0 || form.longitude < -180 || form.longitude > 180 ? "Longitude is required." : "",
  };
  const firstError = Object.values(errors).find(Boolean) ?? "";

  const submit = async () => {
    setTouched(true);
    if (!canSave) { toast.error("Only Admin or Super Admin accounts can save business establishments."); return; }
    if (loadingDetail) return;
    if (firstError) { toast.error(firstError); return; }
    setSaving(true);
    try {
      const fullname = [form.firstname, form.miname, form.lastname, form.suffix].filter(Boolean).join(" ").trim();
      const payload: BusinessEstablishmentDTO = { ...form, fullname, establishmentno: isEdit ? form.establishmentno : EMPTY_GUID,
        establishmentcode: form.establishmentcode.trim(), establishmentname: form.establishmentname.trim(), buildingname: form.establishmentname.trim(), encodedby: String(user?.memberno ?? EMPTY_GUID),
      };
      delete (payload as Partial<FormState>).regionname;
      delete (payload as Partial<FormState>).provincename;
      delete (payload as Partial<FormState>).cityname;
      delete (payload as Partial<FormState>).barangayname;
      delete (payload as Partial<FormState>).stationname;
      delete (payload as Partial<FormState>).stationcode;
      const resp = await businessAPI.create(payload);
      const { ok, error } = unwrap(resp);
      if (!ok) { toast.error(error || (isEdit ? "Unable to update business establishment." : "Unable to add business establishment.")); return; }
      toast.success(`${payload.establishmentname} has been ${isEdit ? "updated" : "added"}.`);
      onOpenChange(false); onSaved();
    } finally { setSaving(false); }
  };

  const labelClass = "text-xs font-semibold uppercase tracking-wide text-foreground/70";
  const Err = ({ msg }: { msg: string }) => touched && msg ? <p className="text-[11px] font-medium text-destructive">{msg}</p> : null;
  const Req = () => <span className="text-destructive">*</span>;
  const cardClass = "space-y-4 rounded-lg border border-border bg-card p-4 shadow-none";
  const sectionTitle = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="flex h-[calc(100dvh-1rem)] w-full max-w-[min(100vw-1rem,720px)] flex-col gap-0 overflow-x-hidden overflow-y-auto p-0 sm:h-auto sm:max-h-[calc(100dvh-1rem)] sm:overflow-hidden sm:rounded-lg">
        <DialogHeader className="shrink-0 border-b border-border bg-muted/40 px-5 py-4">
          <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div><div className="min-w-0 flex-1"><DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">{isEdit ? "Edit Business Establishment" : "Add Business Establishment"}</DialogTitle><DialogDescription className="text-sm text-muted-foreground">{isEdit ? "Update the details of this business establishment." : "Register a business establishment and its fire safety compliance."}</DialogDescription></div></div>
        </DialogHeader>
        <div className="min-w-0 shrink-0 space-y-4 overflow-x-hidden p-5 sm:min-h-0 sm:flex-1 sm:overflow-y-auto">
          {loadingDetail ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading full record…</div> : null}
          <Card className={cardClass}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label className={labelClass}>Station / Unit <Req /></Label><StationSearchSelect value={form.stationno} valueName={form.stationname} provinceno={hasValue(form.provinceno) ? form.provinceno : undefined} onChange={(no, name) => setForm((f) => ({ ...f, stationno: no, stationname: name }))} placeholder="Select station" /><Err msg={errors.station} /></div>
              <div className="space-y-1.5"><Label className={labelClass}>Business Code <Req /></Label><Input value={form.establishmentcode} readOnly disabled /><Err msg={errors.code} /></div>
              <div className="space-y-1.5"><Label className={labelClass}>Status <Req /></Label><GentableSelect<number> value={form.statusno} onChange={(v) => set("statusno", Number(v) || 0)} options={statusOptions} placeholder="Select status" /><Err msg={errors.status} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label className={labelClass}>Business Name <Req /></Label><Input value={form.establishmentname} onChange={(e) => set("establishmentname", e.target.value)} placeholder="e.g. ABC Shopping Center" maxLength={150} /><Err msg={errors.name} /></div>
              <div className="space-y-1.5"><Label className={labelClass}>Floor Count</Label><Input type="number" min={0} value={form.floorcount || ""} onChange={(e) => set("floorcount", Number(e.target.value) || 0)} /></div>
              <div className="space-y-1.5"><Label className={labelClass}>Building Area</Label><Input type="number" min={0} value={form.buildingarea || ""} onChange={(e) => set("buildingarea", Number(e.target.value) || 0)} /></div>
            </div>
          </Card>
          <Card className={cardClass}><div className="text-xs font-semibold uppercase text-muted-foreground">Owner / Authorized Representative</div><div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label className={labelClass}>First Name</Label><Input value={form.firstname} onChange={(e) => set("firstname", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className={labelClass}>Middle Name</Label><Input value={form.miname} onChange={(e) => set("miname", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className={labelClass}>Last Name</Label><Input value={form.lastname} onChange={(e) => set("lastname", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className={labelClass}>Suffix</Label><Input value={form.suffix} onChange={(e) => set("suffix", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className={labelClass}>Contact No.</Label><Input value={form.contactno} onChange={(e) => set("contactno", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className={labelClass}>Email Address</Label><Input type="email" value={form.emailaddress} onChange={(e) => set("emailaddress", e.target.value)} /><Err msg={errors.email} /></div>
          </div></Card>
          <Card className={cardClass}>
            <div className={sectionTitle}>Location</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className={labelClass}>Region <Req /></Label>
                <LocationSearchSelect
                  locationtype="REGION"
                  value={form.regionno}
                  valueName={form.regionname}
                  hideCode
                  onChange={(no, name) => setForm((f) => ({
                    ...f,
                    regionno: no,
                    regionname: name,
                    provinceno: EMPTY_GUID,
                    provincename: "",
                    cityno: EMPTY_GUID,
                    cityname: "",
                    barangayno: EMPTY_GUID,
                    barangayname: "",
                  }))}
                  placeholder="Select region"
                />
                <Err msg={errors.region} />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Province <Req /></Label>
                <LocationSearchSelect
                  key={`prov-${form.regionno}`}
                  locationtype="PROVINCE"
                  parentcode={form.regionno}
                  value={form.provinceno}
                  valueName={form.provincename}
                  hideCode
                  disabled={!hasValue(form.regionno)}
                  onChange={(no, name) => setForm((f) => ({
                    ...f,
                    provinceno: no,
                    provincename: name,
                    cityno: EMPTY_GUID,
                    cityname: "",
                    barangayno: EMPTY_GUID,
                    barangayname: "",
                  }))}
                  placeholder={hasValue(form.regionno) ? "Select province" : "Select region first"}
                />
                <Err msg={errors.province} />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>City / Municipality <Req /></Label>
                <LocationSearchSelect
                  key={`city-${form.provinceno}`}
                  locationtype="CITY"
                  parentcode={form.provinceno}
                  value={form.cityno}
                  valueName={form.cityname}
                  disabled={!hasValue(form.provinceno)}
                  onChange={(no, name) => setForm((f) => ({
                    ...f,
                    cityno: no,
                    cityname: name,
                    barangayno: EMPTY_GUID,
                    barangayname: "",
                  }))}
                  placeholder={hasValue(form.provinceno) ? "Select city" : "Select province first"}
                />
                <Err msg={errors.city} />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Barangay <Req /></Label>
                <LocationSearchSelect
                  key={`brgy-${form.cityno}`}
                  locationtype="BARANGAY"
                  parentcode={form.cityno}
                  value={form.barangayno}
                  valueName={form.barangayname}
                  hideCode
                  disabled={!hasValue(form.cityno)}
                  onChange={(no, name) => setForm((f) => ({ ...f, barangayno: no, barangayname: name }))}
                  placeholder={hasValue(form.cityno) ? "Select barangay" : "Select city first"}
                />
                <Err msg={errors.barangay} />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Street Address</Label>
                <Input value={form.streetaddress} onChange={(e) => set("streetaddress", e.target.value)} placeholder="e.g. Rizal Avenue" maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Landmark</Label>
                <Input value={form.landmark} onChange={(e) => set("landmark", e.target.value)} placeholder="e.g. Beside the public market" maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Latitude <Req /></Label>
                <Input type="number" step="any" value={String(form.latitude)} onChange={(e) => set("latitude", Number(e.target.value))} />
                <Err msg={errors.lat} />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Longitude <Req /></Label>
                <Input type="number" step="any" value={String(form.longitude)} onChange={(e) => set("longitude", Number(e.target.value))} />
                <Err msg={errors.lng} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className={labelClass}>Plot on map</Label>
                <LocationPickerMap lat={form.latitude} lng={form.longitude} onChange={(latitude, longitude) => setForm((f) => ({ ...f, latitude, longitude }))} className="h-64 w-full" />
                <p className="text-[11px] text-muted-foreground">Click the map or drag the pin to set the latitude and longitude.</p>
              </div>
            </div>
          </Card>
          <Card className={cardClass}>
            <div className={sectionTitle}>Fire Safety Compliance</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className={labelClass}>FSEC Date Issued</Label><Input type="date" value={form.fsecdateissued} onChange={(e) => set("fsecdateissued", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className={labelClass}>FSEC Expiration</Label><Input type="date" value={form.fsecexpirationdate} onChange={(e) => set("fsecexpirationdate", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className={labelClass}>FSIC Date Issued</Label><Input type="date" value={form.fsicdateissued} onChange={(e) => set("fsicdateissued", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className={labelClass}>FSIC Expiration</Label><Input type="date" value={form.fsicexpirationdate} onChange={(e) => set("fsicexpirationdate", e.target.value)} /></div>
            </div>
          </Card>

          <Card className={cardClass}>
            <div className="space-y-1.5">
              <Label className={labelClass}>Remarks</Label>
              <Textarea value={form.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Notes about this establishment" maxLength={500} rows={3} />
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="required-business" className="flex items-center gap-1.5 text-sm font-medium">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  Required establishment
                </Label>
                <Switch id="required-business" checked={form.isrequired} onCheckedChange={(v) => !lockRequired && set("isrequired", v === true)} className={lockRequired ? "cursor-not-allowed" : ""} aria-label="Required establishment" />
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Required establishments are protected from deletion.</p>
              {lockRequired ? <p className="mt-2 rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-1.5 text-[11px] font-medium text-destructive">Only Super Admin can change the required flag.</p> : null}
            </div>
          </Card>
        </div>
        <DialogFooter className="shrink-0 border-t border-border bg-muted/30 px-5 py-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={submit} disabled={saving || loadingDetail} className="w-full bg-gradient-primary text-primary-foreground shadow-elegant sm:w-auto">
            {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span> : isEdit ? "Update Establishment" : "Add Establishment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
