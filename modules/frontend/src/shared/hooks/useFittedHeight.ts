import { RefObject, useEffect } from "react";

/** Below this the region would show too little to be worth its own scrollbar. */
const MINIMUM = 240;
/** Space kept under the region for the footer that must stay on screen. */
const RESERVED = 16;
/** Narrow windows keep one scroll, the page's. */
const COMPACT = 768;

/**
 * Bounds a scrolling region to what is left of the window below it, so the
 * rows scroll inside it and the count and pagination under it stay on screen.
 * When the window is too short, or the text too large, for a useful region,
 * the bound is dropped and the page scrolls as it otherwise would.
 */
export function useFittedHeight(
  region: RefObject<HTMLElement>,
  footer: RefObject<HTMLElement>,
  /** Changing this re-measures, e.g. when the rows or the filters change. */
  ...dependencies: unknown[]
) {
  useEffect(() => {
    const element = region.current;
    if (!element) return;
    const fit = () => {
      // The region's own height never moves its top, so measuring needs no
      // reset; writing only on a change keeps the observer from looping.
      const top = element.getBoundingClientRect().top + window.scrollY;
      const height =
        window.innerHeight -
        top -
        (footer.current?.getBoundingClientRect().height ?? 0) -
        RESERVED;
      const bound =
        window.innerWidth >= COMPACT && height >= MINIMUM
          ? `${Math.floor(height)}px`
          : "";
      if (element.style.maxHeight !== bound) element.style.maxHeight = bound;
    };
    fit();
    // Whatever sits above the region decides where it starts: a warning, the
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
