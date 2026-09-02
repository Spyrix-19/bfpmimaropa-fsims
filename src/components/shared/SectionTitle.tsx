import * as React from "react";

/**
 * Compact bordered section heading used by the BWC and Inspector
 * modals/views. Extracted from four byte-identical local copies.
 */
export function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 pb-2">
      <span className="text-primary">{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

export default SectionTitle;
