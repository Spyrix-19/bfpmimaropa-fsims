import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const ModalFooterTargetContext = React.createContext<HTMLElement | null>(null);

export function ModalFooterLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [target, setTarget] = React.useState<HTMLDivElement | null>(null);

  return (
    <ModalFooterTargetContext.Provider value={target}>
      {children}
      <div
        ref={setTarget}
        className={cn(
          "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/60 bg-card px-5 py-3",
          className,
        )}
      />
    </ModalFooterTargetContext.Provider>
  );
}

export function ModalFooterPortal({ children }: { children: React.ReactNode }) {
  const target = React.useContext(ModalFooterTargetContext);
  return target ? createPortal(children, target) : null;
}