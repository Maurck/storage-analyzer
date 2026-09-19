import React, { useEffect, useRef, useState } from "react";
import { IconButton } from "../../../shared/ui/IconButton";
import { Icon } from "../../../shared/ui/Icon";
import { CommonFolder } from "../../../shared/lib/desktopBridge";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";
import { QuickStart } from "./QuickStart";

interface QuickAccessMenuProps {
  recent: string[];
  common: CommonFolder[];
  disabled: boolean;
  onAnalyze(path: string): void;
  onForget(path: string): void;
  onClear(): void;
}

/**
 * Recent and common folders next to "New analysis", so another analysis does
 * not require going back to the welcome screen. A disclosure, not a modal:
 * Escape, a click outside or leaving it with Tab closes it.
 */
export function QuickAccessMenu({
  recent,
  common,
  disabled,
  onAnalyze,
  onForget,
  onClear,
}: QuickAccessMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const empty = recent.length === 0 && common.length === 0;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      toggle.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (empty || disabled) setOpen(false);
  }, [empty, disabled]);

  if (empty) return null;
  return (
    <div
      className="quick-access"
      ref={wrapper}
      onBlur={(event) => {
        // Tabbing away closes it. A null target means the focused button was
        // removed (a forgotten folder) or a click, which pointerdown handles.
        const next = event.relatedTarget as Node | null;
        if (next && !wrapper.current?.contains(next)) setOpen(false);
      }}
    >
      <IconButton
        ref={toggle}
        label={t("page.quickAccess")}
        variant="secondary"
        disabled={disabled}
        aria-expanded={open}
        aria-controls="quick-access-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="chevron-down" size={18} />
      </IconButton>
      <div
        id="quick-access-panel"
        className="quick-access-panel"
        hidden={!open}
      >
        {open && (
          <QuickStart
            title={t("page.quickAccess")}
            titleId="quick-access-title"
            recent={recent}
            common={common}
            disabled={disabled}
            onAnalyze={(path) => {
              setOpen(false);
              onAnalyze(path);
            }}
            onForget={onForget}
            onClear={onClear}
          />
        )}
      </div>
    </div>
  );
}
