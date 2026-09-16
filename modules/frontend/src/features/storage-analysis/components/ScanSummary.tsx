import React from "react";
import { DirectoryNode } from "../model/directory.types";
import { Icon } from "../../../shared/ui/Icon";
import { Alert } from "../../../shared/components/Alert";
import { formatBytes, formatNumber } from "../../../shared/lib/format";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";

interface ScanSummaryProps {
  root: DirectoryNode;
  skippedCount: number;
}

export function ScanSummary({ root, skippedCount }: ScanSummaryProps) {
  const { t } = useTranslation();
  return (
    <>
      <section className="metric-grid" aria-label={t("summary.label")}>
        <div className="metric-card metric-primary">
          <span className="metric-label">
            <Icon name="hard-drive" size={18} />
            {root.partial ? t("summary.knownSize") : t("summary.totalSize")}
          </span>
          <strong>{formatBytes(root.sizeBytes)}</strong>
          <small>{t("summary.logicalSize")}</small>
        </div>
        <div className="metric-card">
          <span className="metric-label">
            <Icon name="file" size={18} />
            {t("summary.filesAnalyzed")}
          </span>
          <strong>{formatNumber(root.fileCount)}</strong>
          <small>{t("summary.filesAcross")}</small>
        </div>
        <div className="metric-card">
          <span className="metric-label">
            <Icon name="folder" size={18} />
            {t("summary.subfolders")}
          </span>
          <strong>{formatNumber(root.directoryCount)}</strong>
          <small>{t("summary.subfoldersHint")}</small>
        </div>
        <div
          className={`metric-card ${skippedCount > 0 ? "metric-warning" : ""}`}
        >
          <span className="metric-label">
            <Icon name={skippedCount > 0 ? "alert" : "check"} size={18} />
            {t("summary.skipped")}
          </span>
          <strong>{formatNumber(skippedCount)}</strong>
          <small>
            {root.partial
              ? t("summary.skippedIncomplete")
              : t("summary.skippedNone")}
          </small>
        </div>
      </section>
      {root.partial && (
        <div className="page-feedback">
          <Alert variant="warning" title={t("summary.partialTitle")}>
            {t("summary.partialDescription")}
          </Alert>
        </div>
      )}
    </>
  );
}
