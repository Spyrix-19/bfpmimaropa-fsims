/**
 * Memory optimization hook for lazy-loading dashboard sections.
 * Prevents all API calls from firing simultaneously on page load.
 */

import { useEffect, useRef, useCallback, useState } from "react";

type SectionId = "trend" | "monthly" | "performance" | "fees" | "activity";

const LOAD_DELAY_MS: Record<SectionId, number> = {
  trend: 300, // Load immediately-ish
  monthly: 600, // Slight delay
  performance: 900, // More delay
  fees: 1200, // Even more delay
  activity: 1500, // Last to load
};

/**
 * Defers loading of a dashboard section to prevent memory spikes.
 * Each section loads after a staggered delay so API requests don't pile up.
 */
export function useLazyLoadSection(sectionId: SectionId): boolean {
  const [shouldLoad, setShouldLoad] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const delay = LOAD_DELAY_MS[sectionId];
    timerRef.current = setTimeout(() => {
      setShouldLoad(true);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sectionId]);

  return shouldLoad;
}

/**
 * Hook to track if a section is visible in viewport.
 * Useful for deferred loading of sections below the fold.
 */
export function useVisibilityTracking(elementRef: React.RefObject<HTMLElement>): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!elementRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [elementRef]);

  return isVisible;
}

/**
 * Cleanup hook for aborting requests when component unmounts.
 * Usage: const signal = useRequestAbort()
 */
export function useRequestAbort() {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    controllerRef.current = new AbortController();

    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return controllerRef.current?.signal;
}

/**
 * Memory-aware hook that limits concurrent API calls.
 * Only allows 2 requests at a time to prevent memory spike.
 */
export function useLimitedConcurrency(maxConcurrent = 2) {
  const activeRef = useRef(0);
  const queueRef = useRef<Array<() => Promise<void>>>([]);

  const executeQueue = useCallback(async () => {
    if (activeRef.current >= maxConcurrent) return;

    const task = queueRef.current.shift();
    if (!task) return;

    activeRef.current += 1;
    try {
      await task();
    } finally {
      activeRef.current -= 1;
      if (queueRef.current.length > 0) {
        void executeQueue();
      }
    }
  }, [maxConcurrent]);

  return useCallback(
    (task: () => Promise<void>) => {
      queueRef.current.push(task);
      void executeQueue();
    },
    [executeQueue],
  );
}
