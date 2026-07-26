import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type BannerVariant = "info" | "success" | "warning" | "danger";

const VARIANTS: Record<
  BannerVariant,
  { icon: ComponentType<{ className?: string }>; iconClass: string }
> = {
  info: { icon: Info, iconClass: "text-primary" },
  success: { icon: CheckCircle2, iconClass: "text-success" },
  warning: { icon: AlertTriangle, iconClass: "text-warning" },
  danger: { icon: XCircle, iconClass: "text-destructive" },
};

/**
 * Shared full-viewport banner used for empty, restricted, or error states
 * that take over a page (e.g. "Reports are restricted", "Access denied").
 *
 * Renders a centered card with an optional icon override, a title, an
 * optional description, and an optional actions slot. Callers get
 * consistent copy, spacing, and iconography without re-implementing the
 * pattern each time.
 */
export function Banner({
  variant = "info",
  title,
  description,
  icon: IconOverride,
  actions,
  className,
  fullscreen = true,
}: {
  variant?: BannerVariant;
  title: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  actions?: ReactNode;
  className?: string;
  /** When false, renders the card without the min-height wrapper. */
  fullscreen?: boolean;
}) {
  const { icon: DefaultIcon, iconClass } = VARIANTS[variant];
  const Icon = IconOverride ?? DefaultIcon;

  const card = (
    <Card className={cn("max-w-md p-8 text-center", className)}>
      <Icon className={cn("mx-auto mb-3 h-10 w-10", iconClass)} />
      <h2 className="text-xl font-semibold">{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      )}
      {actions && <div className="mt-4 flex justify-center gap-2">{actions}</div>}
    </Card>
  );

  if (!fullscreen) return card;
  return <div className="flex min-h-[50vh] items-center justify-center">{card}</div>;
}
