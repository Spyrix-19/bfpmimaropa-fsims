import { cn } from "@/lib/utils";

export function StatBox({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "success" | "destructive" | "primary";
}) {
  const toneClass =
    tone === "success"
      ? "border-primary/30 bg-primary/5 text-primary"
      : tone === "destructive"
        ? "border-destructive/30 bg-destructive/5 text-destructive"
        : tone === "primary"
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 bg-muted/40 text-foreground";

  return (
    <div className={cn("rounded-lg border px-3 py-2 text-center", toneClass)}>
      <div className="text-lg font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wider opacity-80">
        {label}
      </div>
    </div>
  );
}