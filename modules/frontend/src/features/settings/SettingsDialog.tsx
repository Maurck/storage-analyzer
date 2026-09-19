import React, { RefObject } from "react";
import { Button } from "../../shared/ui/Button";
import { IconButton } from "../../shared/ui/IconButton";
import { Icon } from "../../shared/ui/Icon";
import { isLanguage, useTranslation } from "../../shared/i18n/LanguageProvider";
import { languages, TranslationKey } from "../../shared/i18n/translations";
import { formatNumber } from "../../shared/lib/format";

interface SettingsDialogProps {
  dialogRef: RefObject<HTMLDialogElement>;
  /** From the analysis engine once it is ready. */
  capacity?: { maxEntries: number; referencePathLength: number };
}

// Key names are the same in every language on the keyboards the app supports.
const shortcuts: [string, TranslationKey][] = [
  ["Ctrl+O", "shortcuts.chooseFolder"],
  ["F5", "shortcuts.rescan"],
  ["Ctrl+F", "shortcuts.search"],
  ["Alt+←", "shortcuts.parent"],
];

export function SettingsDialog({ dialogRef, capacity }: SettingsDialogProps) {
  const { language, setLanguage, t } = useTranslation();

  return (
    <dialog
      ref={dialogRef}
      className="settings-dialog"
      aria-labelledby="settings-dialog-title"
    >
      <div className="dialog-heading">
        <h2 id="settings-dialog-title">{t("settings.title")}</h2>
        <IconButton
          label={t("settings.close")}
          variant="ghost"
          onClick={() => dialogRef.current?.close()}
        >
          <Icon name="close" />
        </IconButton>
      </div>
      <div className="settings-field">
        <label htmlFor="language-select">{t("settings.language")}</label>
        <select
          id="language-select"
          value={language}
          aria-describedby="language-hint"
          onChange={(event) => {
            if (isLanguage(event.target.value)) setLanguage(event.target.value);
          }}
        >
          {languages.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.label}
            </option>
          ))}
        </select>
        <p id="language-hint" className="settings-hint">
          {t("settings.languageHint")}
        </p>
      </div>
      <p className="settings-note">{t("settings.sizesNote")}</p>
      <section className="settings-section" aria-labelledby="capacity-title">
        <h3 id="capacity-title">{t("capacity.title")}</h3>
        <p className="settings-hint">
          {capacity
            ? t("capacity.description", {
                count: formatNumber(capacity.maxEntries),
                length: formatNumber(capacity.referencePathLength),
              })
            : t("capacity.unavailable")}
        </p>
      </section>
      <section className="settings-section" aria-labelledby="shortcuts-title">
        <h3 id="shortcuts-title">{t("shortcuts.title")}</h3>
        <dl className="shortcut-list">
          {shortcuts.map(([keys, label]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{t(label)}</dd>
            </div>
          ))}
        </dl>
        <p className="settings-hint">{t("shortcuts.note")}</p>
      </section>
      <div className="dialog-actions">
        <Button onClick={() => dialogRef.current?.close()}>
          {t("settings.done")}
        </Button>
      </div>
    </dialog>
  );
}
