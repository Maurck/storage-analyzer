import React from "react";
import { Button } from "../../../shared/ui/Button";
import { Spinner } from "../../../shared/ui/Spinner";
import {
  formatBytes,
  formatDuration,
  formatNumber,
} from "../../../shared/lib/format";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";
import { Scan } from "../model/directory.types";

// Past this, a quiet scan is worth explaining. Slow network or cloud folders
// can go this long without a new entry while still working.
export const STALLED_AFTER_MS = 10_000;

interface ScanProgressProps {
  scan?: Scan;
  /** The last status request failed: the numbers shown may be stale. */
  unresponsive: boolean;
  cancelling: boolean;
  onCancel(): void;
}

export function ScanProgress({
  scan,
  unresponsive,
  cancelling,
  onCancel,
}: ScanProgressProps) {
  const { t } = useTranslation();
  const stalled =
    !unresponsive && (scan?.millisSinceActivity ?? 0) >= STALLED_AFTER_MS;
  return (
    <section className="scan-progress" aria-label={t("progress.label")}>
      <Spinner label={t("progress.spinner")} />
      <div className="scan-progress-text">
        <strong>{t("progress.heading")}</strong>
        <span className="scan-path" title={scan?.path}>
          {scan?.path || t("progress.starting")}
        </span>
        <span>
          {t("progress.counts", {
            files: formatNumber(scan?.processedFiles ?? 0),
            bytes: formatBytes(scan?.processedBytes ?? 0),
            skipped: formatNumber(scan?.skippedCount ?? 0),
          })}
          {" · "}
          {/* Updates with each poll; kept out of live regions on purpose. */}
          <span className="scan-elapsed">
            {t("progress.elapsed", {
              time: formatDuration(scan?.elapsedMillis ?? 0),
            })}
          </span>
        </span>
        {scan?.currentPath && (
          <span className="scan-current" title={scan.currentPath}>
            {t("progress.reading", { path: scan.currentPath })}
          </span>
        )}
        {/* Fixed sentences only, so screen readers hear each state once. */}
        <p className="scan-activity" role="status">
          {unresponsive
            ? t("progress.noResponse")
            : stalled
              ? t("progress.stalled")
              : ""}
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={onCancel}
        loading={cancelling}
        disabled={!scan}
      >
        {t("progress.cancel")}
      </Button>
    </section>
  );
}
