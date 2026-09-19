import React, { useState } from "react";
import { useQuery } from "react-query";
import { getLargest } from "../api/directory.api";
import { DirectoryNode, RankedFile } from "../model/directory.types";
import { useShowItem } from "../hooks/useShowItem";
import { Alert } from "../../../shared/components/Alert";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorState } from "../../../shared/components/ErrorState";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { IconButton } from "../../../shared/ui/IconButton";
import { SegmentedControl } from "../../../shared/ui/SegmentedControl";
import { Skeleton } from "../../../shared/ui/Skeleton";
import { formatBytes, formatNumber } from "../../../shared/lib/format";
import { useErrorMessage } from "../../../shared/i18n/useErrorMessage";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";

const LIMIT = 100;
// The app labels powers of 1024 as KB, MB and GB, like Explorer.
const MB = 1024 ** 2;
const GB = 1024 ** 3;
const thresholds = [0, 100 * MB, GB, 10 * GB];

/** The folder part of a path relative to the scan root. */
function locationOf(file: RankedFile) {
  return file.relativePath
    .slice(0, Math.max(0, file.relativePath.length - file.name.length))
    .replace(/[\\/]+$/, "");
}

interface LargestFilesProps {
  scanId: string;
  root: DirectoryNode;
  onOpenSkipped(): void;
}

export function LargestFiles({
  scanId,
  root,
  onOpenSkipped,
}: LargestFilesProps) {
  const { t } = useTranslation();
  const describeError = useErrorMessage();
  const [minSize, setMinSize] = useState(0);
  const showItem = useShowItem(scanId);
  const query = useQuery(
    ["largest", scanId, minSize],
    ({ signal }) =>
      getLargest(scanId, { limit: LIMIT, minSizeBytes: minSize }, signal),
    { staleTime: Infinity, keepPreviousData: true, retry: 1 },
  );
  const data = query.data?.minSizeBytes === minSize ? query.data : undefined;

  return (
    <section
      className="contents-card largest-card"
      aria-labelledby="largest-title"
    >
      <div className="card-heading largest-heading">
        <div>
          <h3 id="largest-title">{t("largest.title")}</h3>
          <p className="muted">
            {t("largest.description", { root: root.name })}
          </p>
        </div>
      </div>
      <div className="table-tools">
        <SegmentedControl<number>
          name="largest-min-size"
          legend={t("largest.minSizeLabel")}
          showLegend
          value={minSize}
          onChange={setMinSize}
          options={thresholds.map((value) => ({
            value,
            label:
              value === 0
                ? t("largest.anySize")
                : t("largest.atLeast", { size: formatBytes(value) }),
          }))}
        />
      </div>
      {root.partial && (
        <div className="largest-partial">
          <Alert variant="warning">
            <p>{t("largest.partial")}</p>
            <Button variant="secondary" size="sm" onClick={onOpenSkipped}>
              {t("skipped.open")}
            </Button>
          </Alert>
        </div>
      )}
      {showItem.failure && (
        <div className="largest-feedback">
          <Alert
            variant="error"
            title={t("show.errorTitle", { name: showItem.failure.name })}
          >
            {showItem.failure.message}
          </Alert>
        </div>
      )}
      {query.isError && !data ? (
        <ErrorState
          title={t("largest.errorTitle")}
          description={describeError(query.error)}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : !data ? (
        <div className="detail-skeleton" role="status">
          <span className="sr-only">{t("largest.loading")}</span>
          <Skeleton height={220} />
        </div>
      ) : data.files.length === 0 ? (
        <EmptyState
          title={t("largest.emptyTitle")}
          description={
            minSize === 0
              ? t("largest.emptyAny")
              : t("largest.emptyFiltered", { size: formatBytes(minSize) })
          }
          icon={<Icon name="file" size={28} />}
        />
      ) : (
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              {t("largest.caption", { root: root.name })}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("largest.columnName")}</th>
                <th scope="col" className="location-column">
                  {t("largest.columnLocation")}
                </th>
                <th scope="col" className="numeric">
                  {t("largest.columnSize")}
                </th>
                {showItem.available && (
                  <th scope="col" className="action-column">
                    <span className="sr-only">
                      {t("largest.columnActions")}
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.files.map((file) => {
                const location = locationOf(file);
                return (
                  <tr key={file.absolutePath}>
                    <td>
                      <span className="item-name" title={file.absolutePath}>
                        <Icon name="file" size={19} />
                        <span>{file.name}</span>
                      </span>
                      {/* Replaces the location column on narrow windows. */}
                      <span className="location location-inline">
                        {location || t("largest.rootLocation")}
                      </span>
                    </td>
                    <td className="location-column">
                      <span className="location" title={file.absolutePath}>
                        {location || t("largest.rootLocation")}
                      </span>
                    </td>
                    <td className="numeric">{formatBytes(file.sizeBytes)}</td>
                    {showItem.available && (
                      <td className="action-column">
                        <IconButton
                          label={t("show.itemLabel", { name: file.name })}
                          variant="ghost"
                          onClick={() => {
                            void showItem.show(file.name, file.absolutePath);
                          }}
                        >
                          <Icon name="folder-open" size={18} />
                        </IconButton>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && data.files.length > 0 && (
        <div className="table-footer">
          <span role="status">
            {t("largest.count", {
              shown: formatNumber(data.files.length),
              matching: formatNumber(data.matchingFiles),
            })}
          </span>
          {data.matchingFiles > data.files.length && (
            <span>
              {t("largest.onlyLargest", { limit: formatNumber(LIMIT) })}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
