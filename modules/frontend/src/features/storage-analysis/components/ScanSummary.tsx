import React from "react";
import { DirectoryNode, Volume } from "../model/directory.types";
import { Icon } from "../../../shared/ui/Icon";
import { Alert } from "../../../shared/components/Alert";
import { Button } from "../../../shared/ui/Button";
import { formatBytes, formatNumber } from "../../../shared/lib/format";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";

interface ScanSummaryProps {
  root: DirectoryNode;
  skippedCount: number;
  volume?: Volume | null;
  onOpenSkipped?(): void;
}

/** A compact strip, so the results start within the first screen. */
export function ScanSummary({
  root,
  skippedCount,
  volume,
  onOpenSkipped,
}: ScanSummaryProps) {
  const { t } = useTranslation();
  return (
    <>
      <section className="summary-strip" aria-label={t("summary.label")}>
        <dl className="summary-figures">
          <div className="summary-figure summary-figure--primary">
            <dt>
              {root.partial ? t("summary.knownSize") : t("summary.totalSize")}
            </dt>
            <dd>
              <strong>{formatBytes(root.sizeBytes)}</strong>
              <small>{t("summary.logicalSize")}</small>
            </dd>
          </div>
          <div className="summary-figure">
            <dt>{t("summary.filesAnalyzed")}</dt>
            <dd>
              <strong>{formatNumber(root.fileCount)}</strong>
            </dd>
          </div>
          <div
            className={`summary-figure ${skippedCount > 0 ? "summary-figure--warning" : ""}`}
          >
            <dt>
              {skippedCount > 0 && <Icon name="alert" size={15} />}
              {t("summary.skipped")}
            </dt>
            <dd>
              <strong>{formatNumber(skippedCount)}</strong>
              {skippedCount > 0 && onOpenSkipped && (
                <Button variant="ghost" size="sm" onClick={onOpenSkipped}>
                  {t("skipped.open")}
                </Button>
              )}
            </dd>
          </div>
          <div className="summary-figure summary-figure--secondary">
            <dt>{t("summary.subfolders")}</dt>
            <dd>
              <strong>{formatNumber(root.directoryCount)}</strong>
            </dd>
          </div>
        </dl>
        <div className="summary-notes">
          <p className="volume-note">
            <Icon name="hard-drive" size={16} />
            <span>
              {volume
                ? t("summary.volume", {
                    free: formatBytes(volume.usableBytes),
                    total: formatBytes(volume.totalBytes),
                  })
                : t("summary.volumeUnknown")}
            </span>
          </p>
          <details className="size-help">
            <summary>
              <Icon name="info" size={16} />
              {t("summary.howCalculated")}
            </summary>
            <p>{t("summary.sizeNote")}</p>
            <p>{t("work.snapshotNote")}</p>
          </details>
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
