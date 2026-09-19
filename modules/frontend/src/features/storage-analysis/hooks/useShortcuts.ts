import { useEffect, useRef } from "react";

export interface ShortcutHandlers {
  chooseFolder(): void;
  rescan(): void;
  search(): void;
  parent(): void;
}

/** Keys shown in Settings and announced with aria-keyshortcuts. */
export const SHORTCUTS = {
  chooseFolder: "Control+O",
  rescan: "F5",
  search: "Control+F",
  parent: "Alt+ArrowLeft",
} as const;

function typingOrInDialog(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  return (
    !!element?.closest("input, textarea, select, [contenteditable='true']") ||
    !!document.querySelector("dialog[open]")
  );
}

/**
 * Window-level shortcuts. They step aside while someone types in a field or a
 * dialog is open, and the handlers decide whether the action is available.
 */
export function useShortcuts(handlers: ShortcutHandlers) {
  const current = useRef(handlers);
  current.current = handlers;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || typingOrInDialog(event.target)) return;
      const control = event.ctrlKey || event.metaKey;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const plain = !event.shiftKey && !event.altKey;
      let action: keyof ShortcutHandlers | undefined;
      if (control && plain && key === "o") action = "chooseFolder";
      else if (control && plain && key === "f") action = "search";
      else if (!control && plain && key === "F5") action = "rescan";
      else if (
        event.altKey &&
        !control &&
        !event.shiftKey &&
        key === "ArrowLeft"
      )
        action = "parent";
      if (!action) return;
      event.preventDefault();
      if (!event.repeat) current.current[action]();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
