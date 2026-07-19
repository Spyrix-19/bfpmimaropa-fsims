"use client";

import * as React from "react";

/**
 * createLazyTriggerModal — split a trigger-based modal into its own chunk.
 *
 * The body module (`loader`) contains the full Dialog + form/table/etc. The
 * shell returned by this helper renders only the `trigger` element initially
 * and dynamically imports the body on:
 *   1. Trigger hover / focus / touch (eager prefetch when the user is likely
 *      to open it).
 *   2. A short idle timer after mount (background warm-up so subsequent
 *      clicks find the chunk already cached).
 *   3. The first time `open` becomes truthy when used in controlled mode.
 *
 * Once mounted the body component owns its own state — the shell unmounts the
 * raw trigger and renders the body, which in turn re-renders the same trigger
 * inside a real DialogTrigger.
 *
 * This keeps the modal's public API identical (same default export, same
 * props) while splitting hundreds of lines of form/table code out of the
 * parent page chunk.
 */
export function createLazyTriggerModal<P extends { trigger?: React.ReactNode; open?: boolean }>(
  loader: () => Promise<{ default: React.ComponentType<P> }>,
  options: { prefetchDelayMs?: number } = {},
): React.ComponentType<P> {
  const Body = React.lazy(loader);
  const prefetchDelayMs = options.prefetchDelayMs ?? 400;

  // Module-level memoized loader so multiple instances share one fetch.
  let started = false;
  const startLoad = () => {
    if (started) return;
    started = true;
    loader().catch(() => {
      started = false;
    });
  };

  return function LazyTriggerModalShell(props: P) {
    const isControlled = typeof props.open !== "undefined";
    const [shouldMount, setShouldMount] = React.useState<boolean>(isControlled);

    // Background prefetch shortly after mount so the modal chunk downloads
    // in parallel with route data instead of blocking the first click.
    React.useEffect(() => {
      if (shouldMount) return;
      const t = setTimeout(() => {
        startLoad();
        setShouldMount(true);
      }, prefetchDelayMs);
      return () => clearTimeout(t);
    }, [shouldMount]);

    // Controlled mode (no trigger): mount immediately.
    if (shouldMount) {
      return (
        <React.Suspense fallback={null}>
          <Body {...props} />
        </React.Suspense>
      );
    }

    // Pre-mount: render just the trigger with interaction handlers that
    // upgrade to the real body component on any sign of intent.
    const upgrade = () => {
      startLoad();
      setShouldMount(true);
    };

    const trigger = props.trigger as React.ReactElement | undefined;
    if (!trigger) return null;

    const originalOnClick = (trigger.props as { onClick?: React.MouseEventHandler })?.onClick;
    return React.cloneElement(trigger, {
      onMouseEnter: upgrade,
      onFocus: upgrade,
      onTouchStart: upgrade,
      onClick: (e: React.MouseEvent) => {
        upgrade();
        originalOnClick?.(e);
      },
    } as Partial<React.HTMLAttributes<HTMLElement>>);
  };
}
