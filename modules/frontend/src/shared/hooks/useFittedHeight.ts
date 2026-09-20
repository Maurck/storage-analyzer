import { RefObject, useEffect } from "react";

/**
 * Below this the region would show too little to be worth its own scrollbar:
 * about three rows, which is what the shortest supported window has left.
 */
const MINIMUM = 150;
/** Narrow windows keep one scroll, the page's. */
const COMPACT = 768;

/**
 * Bounds a scrolling region to the window, counting what sits above it and
 * everything that follows it (its own count and pagination, the page footer),
 * so the rows scroll inside it and the page itself does not scroll at all.
 * When the window is too short, or the text too large, for a useful region,
 * the bound is dropped and the page scrolls as it otherwise would.
 */
export function useFittedHeight(
  region: RefObject<HTMLElement>,
  /** Changing this re-measures, e.g. when the rows or the filters change. */
  ...dependencies: unknown[]
) {
  useEffect(() => {
    const element = region.current;
    if (!element) return;
    const fit = () => {
      // The region's own height never moves its top, and shrinking it moves
      // what follows by the same amount, so measuring needs no reset and
      // writing only on a change keeps the observer from looping.
      const rect = element.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const below = Math.max(
        0,
        document.body.getBoundingClientRect().bottom - rect.bottom,
      );
      const height = window.innerHeight - top - below - 1;
      const bound =
        window.innerWidth >= COMPACT && height >= MINIMUM
          ? `${Math.floor(height)}px`
          : "";
      if (element.style.maxHeight !== bound) element.style.maxHeight = bound;
    };
    fit();
    // Whatever sits above or below the region decides its room: a warning, the
    // size explanation opening, another language with longer labels.
    const observer = new ResizeObserver(fit);
    observer.observe(document.body);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
      element.style.maxHeight = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
