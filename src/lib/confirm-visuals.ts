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
      contentIconBgClass: "bg-amber-50",
      contentIconColorClass: "text-amber-700",
    };
  if (t.includes("change password"))
    return {
      ContentIcon: KeyRound,
      contentIconBgClass: "bg-amber-50",
      contentIconColorClass: "text-amber-700",
    };
  if (t.includes("expiry"))
    return {
      ContentIcon: CalendarClock,
      contentIconBgClass: "bg-amber-50",
      contentIconColorClass: "text-amber-700",
    };
  if (t.includes("lock"))
    return {
      ContentIcon: Lock,
      contentIconBgClass: "bg-red-50",
      contentIconColorClass: "text-destructive",
      confirmVariant: "destructive" as const,
    };
  if (t.includes("deactivate"))
    return {
      ContentIcon: ShieldOff,
      contentIconBgClass: "bg-red-50",
      contentIconColorClass: "text-red-600",
      confirmVariant: "destructive" as const,
    };
  if (t.includes("remove") || t.includes("delete"))
    return {
      ContentIcon: Trash2,
      contentIconBgClass: "bg-red-50",
      contentIconColorClass: "text-red-600",
      confirmVariant: "destructive" as const,
    };
  if (t.includes("fingerprint") || t.includes("face"))
    return {
      ContentIcon: t.includes("fingerprint") ? Fingerprint : ScanFace,
      contentIconBgClass: "bg-red-50",
      contentIconColorClass: "text-red-600",
      confirmVariant: t.includes("deactivate") ? ("destructive" as const) : undefined,
    };
  return {} as any;
};
