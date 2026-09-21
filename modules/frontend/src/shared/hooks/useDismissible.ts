import { useState } from "react";

/**
 * Lets a banner be closed without losing the next thing it has to say. The
 * key describes the message on screen, so another failure, or the same one
 * raised again after a retry, opens the banner anew; a null key means there
 * is nothing to show right now.
 */
export function useDismissible(key: string | null) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  // Adjusting while rendering, rather than in an effect, keeps a new message
  // from appearing for a frame with the closed banner still in its place.
  if (dismissed !== null && dismissed !== key) setDismissed(null);
  return {
    open: key !== null && key !== dismissed,
    dismiss: () => setDismissed(key),
  };
}
