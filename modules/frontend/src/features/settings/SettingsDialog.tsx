import React, { RefObject } from "react";
import { Button } from "../../shared/ui/Button";
import { IconButton } from "../../shared/ui/IconButton";
import { Icon } from "../../shared/ui/Icon";
import { isLanguage, useTranslation } from "../../shared/i18n/LanguageProvider";
import { languages } from "../../shared/i18n/translations";

interface SettingsDialogProps {
  dialogRef: RefObject<HTMLDialogElement>;
}

export function SettingsDialog({ dialogRef }: SettingsDialogProps) {
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
      <div className="dialog-actions">
        <Button onClick={() => dialogRef.current?.close()}>
          {t("settings.done")}
        </Button>
      </div>
    </dialog>
  );
}
