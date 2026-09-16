import React from "react";
import { DirectoryNode } from "../model/directory.types";
import { Icon } from "../../../shared/ui/Icon";
import { Alert } from "../../../shared/components/Alert";
import { formatBytes, formatNumber } from "../../../shared/lib/format";

interface ScanSummaryProps {
  root: DirectoryNode;
  skippedCount: number;
}

export function ScanSummary({ root, skippedCount }: ScanSummaryProps) {
  return (
    <>
      <section className="metric-grid" aria-label="Analysis summary">
        <div className="metric-card metric-primary">
          <span className="metric-label">
            <Icon name="hard-drive" size={18} />
            {root.partial ? "Known size" : "Total size"}
          </span>
          <strong>{formatBytes(root.sizeBytes)}</strong>
          <small>Logical size · binary units</small>
        </div>
        <div className="metric-card">
          <span className="metric-label">
            <Icon name="file" size={18} />
            Files analyzed
          </span>
          <strong>{formatNumber(root.fileCount)}</strong>
          <small>Across the selected folder</small>
        </div>
        <div className="metric-card">
          <span className="metric-label">
            <Icon name="folder" size={18} />
            Subfolders
          </span>
          <strong>{formatNumber(root.directoryCount)}</strong>
          <small>A hierarchy to explore</small>
        </div>
        <div
          className={`metric-card ${skippedCount > 0 ? "metric-warning" : ""}`}
        >
          <span className="metric-label">
            <Icon name={skippedCount > 0 ? "alert" : "check"} size={18} />
            Skipped items
          </span>
          <strong>{formatNumber(skippedCount)}</strong>
          <small>
            {root.partial
              ? "Some sizes may be incomplete"
              : "No read errors reported"}
          </small>
        </div>
      </section>
      {root.partial && (
        <div className="page-feedback">
          <Alert variant="warning" title="Some items could not be measured">
            Results show readable file bytes only. Symbolic links, inaccessible
            files, or scan limits may leave totals incomplete.
          </Alert>
        </div>
      )}
    </>
  );
}
