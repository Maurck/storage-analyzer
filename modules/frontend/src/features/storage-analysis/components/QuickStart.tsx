import React from "react";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { IconButton } from "../../../shared/ui/IconButton";
import { CommonFolder } from "../../../shared/lib/desktopBridge";
import { folderName } from "../../../shared/lib/recentFolders";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";

interface QuickStartProps {
  /** Defaults to "Start quickly"; the id must be unique on the page. */
  title?: string;
  titleId?: string;
  recent: string[];
  common: CommonFolder[];
  disabled: boolean;
  onAnalyze(path: string): void;
  onForget(path: string): void;
  onClear(): void;
}

/** One click to analyze a recent or common folder. Nothing runs on its own. */
export function QuickStart({
  title,
  titleId = "quick-start-title",
  recent,
  common,
  disabled,
  onAnalyze,
  onForget,
  onClear,
}: QuickStartProps) {
  const { t } = useTranslation();
  if (recent.length === 0 && common.length === 0) return null;
  return (
    <section className="quick-start" aria-labelledby={titleId}>
      <h2 id={titleId}>{title ?? t("quick.title")}</h2>
      {recent.length > 0 && (
        <div className="quick-group">
          <div className="quick-group-heading">
            <h3>{t("quick.recent")}</h3>
            <Button variant="ghost" size="sm" onClick={onClear}>
              {t("quick.clear")}
            </Button>
          </div>
          <ul>
            {recent.map((path) => (
              <li key={path}>
                <button
                  className="quick-folder"
                  disabled={disabled}
                  onClick={() => onAnalyze(path)}
                  title={path}
                >
                  <Icon name="folder" size={18} />
                  <span className="quick-folder-name">{folderName(path)}</span>
                  <span className="quick-folder-path">{path}</span>
                </button>
                <IconButton
                  label={t("quick.remove", { name: folderName(path) })}
                  variant="ghost"
                  onClick={() => onForget(path)}
                >
                  <Icon name="close" size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      )}
      {common.length > 0 && (
        <div className="quick-group">
          <div className="quick-group-heading">
            <h3>{t("quick.common")}</h3>
          </div>
          <ul>
            {common.map((folder) => (
              <li key={folder.id}>
                <button
                  className="quick-folder"
                  disabled={disabled}
                  onClick={() => onAnalyze(folder.path)}
                  title={folder.path}
                >
                  <Icon name="folder" size={18} />
                  <span className="quick-folder-name">
                    {t(`quick.${folder.id}`)}
                  </span>
                  <span className="quick-folder-path">{folder.path}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
