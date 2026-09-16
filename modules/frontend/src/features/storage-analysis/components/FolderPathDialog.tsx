import React, { RefObject, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { IconButton } from "../../../shared/ui/IconButton";
import { Icon } from "../../../shared/ui/Icon";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";

interface FolderPathDialogProps {
  dialogRef: RefObject<HTMLDialogElement>;
  pending: boolean;
  error?: string;
  onAnalyze(path: string): Promise<void>;
}

export function FolderPathDialog({
  dialogRef,
  pending,
  error,
  onAnalyze,
}: FolderPathDialogProps) {
  const [pathInput, setPathInput] = useState("");
  const { t } = useTranslation();

  return (
    <dialog
      ref={dialogRef}
      className="path-dialog"
      aria-labelledby="path-dialog-title"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onAnalyze(pathInput).catch(() => {});
        }}
      >
        <div className="dialog-heading">
          <h2 id="path-dialog-title">{t("folderDialog.title")}</h2>
          <IconButton
            label={t("folderDialog.close")}
            variant="ghost"
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
          >
            <Icon name="close" />
          </IconButton>
        </div>
        <p>{t("folderDialog.description")}</p>
        <label htmlFor="folder-path">{t("folderDialog.label")}</label>
        <input
          id="folder-path"
          value={pathInput}
          onChange={(event) => setPathInput(event.target.value)}
          placeholder="C:\Users\you\Documents"
          required
          autoFocus
          aria-describedby={error !== undefined ? "path-error" : undefined}
          aria-invalid={error !== undefined || undefined}
          autoComplete="off"
        />
        {error !== undefined && (
          <p id="path-error" role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
          >
            {t("folderDialog.cancel")}
          </Button>
          <Button type="submit" loading={pending} disabled={!pathInput.trim()}>
            {t("folderDialog.analyze")}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
