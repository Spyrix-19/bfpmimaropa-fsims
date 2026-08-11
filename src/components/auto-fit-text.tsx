import * as React from "react";

/**
 * Shrinks its content's font size until it fits the available width, so inner
 * detail panels never need their own scrollbar. Only scales down (never up
 * past the base size) and re-measures on container/content resize.
 */
export function AutoFitText({
  children,
  className,
  baseFontSize = 10,
  minFontSize = 5,
}: {
  children: React.ReactNode;
  className?: string;
  baseFontSize?: number;
  minFontSize?: number;
}) {
  const outerRef = React.useRef<HTMLDivElement | null>(null);
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const [fontSize, setFontSize] = React.useState(baseFontSize);

  React.useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const available = outer.clientWidth;
        if (!available) return;
        // Measure at the base size, then scale the font down proportionally.
        inner.style.fontSize = `${baseFontSize}px`;
        const needed = inner.scrollWidth;
        const next =
          needed > available
            ? Math.max(minFontSize, Math.floor((baseFontSize * available) / needed * 100) / 100)
            : baseFontSize;
        inner.style.fontSize = `${next}px`;
        setFontSize(next);
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [baseFontSize, minFontSize, children]);

  return (
    <div ref={outerRef} className={className} style={{ overflow: "hidden" }}>
      <div ref={innerRef} style={{ fontSize }}>
        {children}
      </div>
    </div>
  );
}

export default AutoFitText;
