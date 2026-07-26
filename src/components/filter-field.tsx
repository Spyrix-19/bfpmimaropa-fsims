import * as React from "react";

export default function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
