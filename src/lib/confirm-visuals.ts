import {
  ShieldCheck,
  KeyRound,
  CalendarClock,
  Lock,
  ShieldOff,
  Fingerprint,
  ScanFace,
  Trash2,
} from "lucide-react";

export const getConfirmVisuals = (title?: string) => {
  const t = String(title ?? "").toLowerCase();
  if (!t) return {} as any;
  if (t.startsWith("save"))
    return {
      ContentIcon: ShieldCheck,
      contentIconBgClass: "bg-primary/10",
      contentIconColorClass: "text-primary",
      // Use the primary/default confirm button for save actions to keep the
      // visual language consistent across non-destructive confirmations.
      confirmVariant: "default" as const,
    };
  if (t.includes("reset password") || t.includes("reset"))
    return {
      ContentIcon: KeyRound,
      contentIconBgClass: "tone-warning-soft",
      contentIconColorClass: "text-warning",
    };
  if (t.includes("change password"))
    return {
      ContentIcon: KeyRound,
      contentIconBgClass: "tone-warning-soft",
      contentIconColorClass: "text-warning",
    };
  if (t.includes("expiry"))
    return {
      ContentIcon: CalendarClock,
      contentIconBgClass: "tone-warning-soft",
      contentIconColorClass: "text-warning",
    };
  if (t.includes("lock"))
    return {
      ContentIcon: Lock,
      contentIconBgClass: "tone-danger-soft",
      contentIconColorClass: "text-destructive",
      confirmVariant: "destructive" as const,
    };
  if (t.includes("deactivate"))
    return {
      ContentIcon: ShieldOff,
      contentIconBgClass: "tone-danger-soft",
      contentIconColorClass: "text-destructive",
      confirmVariant: "destructive" as const,
    };
  if (t.includes("remove") || t.includes("delete"))
    return {
      ContentIcon: Trash2,
      contentIconBgClass: "tone-danger-soft",
      contentIconColorClass: "text-destructive",
      confirmVariant: "destructive" as const,
    };
  if (t.includes("fingerprint") || t.includes("face"))
    return {
      ContentIcon: t.includes("fingerprint") ? Fingerprint : ScanFace,
      contentIconBgClass: "tone-danger-soft",
      contentIconColorClass: "text-destructive",
      confirmVariant: t.includes("deactivate") ? ("destructive" as const) : undefined,
    };
  return {} as any;
};
