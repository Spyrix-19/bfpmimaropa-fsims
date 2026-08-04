import { Suspense, type ComponentType, type ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function LazyChartCard<TProps extends object>({
  title,
  subtitle,
  height = "h-72",
  className,
  chart: Chart,
  props,
}: {
  title: string;
  subtitle?: string;
  height?: string;
  className?: string;
  chart: ComponentType<TProps>;
  props: TProps;
}) {
  return (
    <Card className={`border-border/60 bg-card p-5 shadow-soft ${className ?? ""}`}>
      <div className="mb-4">
        <h3 className="truncate text-sm font-semibold">{title}</h3>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className={`${height} w-full`}>
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading chart…
            </div>
          }
        >
          <Chart {...props} />
        </Suspense>
      </div>
    </Card>
  );
}
