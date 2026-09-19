import React, { useEffect, useRef, useState } from "react";
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
import {
  formatBytes,
  formatNumber,
  formatPercent,
  percentOf,
} from "../../../shared/lib/format";
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

/**
 * What the ranking shows, kept by the page for one scan so that leaving the
 * view (to open a folder, for instance) and coming back loses nothing.
 */
export interface LargestState {
  minSize: number;
  /** The file last opened, marked in the list. */
  selected?: string;
  /** Its details are open instead of the list. */
  detail: boolean;
  /** Page scroll of the list when the details opened. */
  scrollY: number;
}

export const initialLargestState: LargestState = {
  minSize: 0,
  detail: false,
  scrollY: 0,
};

interface LargestFilesProps {
  scanId: string;
  root: DirectoryNode;
  state: LargestState;
  onStateChange(state: LargestState): void;
  /** Put the list back as it was: scroll and focus on the selected row. */
  restoreList?: boolean;
  onOpenSkipped(): void;
  onOpenFolder(file: RankedFile): Promise<void>;
  /** Shown next to the heading, e.g. the Explorer button of compact windows. */
  headingAction?: React.ReactNode;
}

export function LargestFiles({
  scanId,
  root,
  state,
  onStateChange,
  restoreList = false,
  onOpenSkipped,
  onOpenFolder,
  headingAction,
}: LargestFilesProps) {
  const { t } = useTranslation();
  const describeError = useErrorMessage();
  const { minSize } = state;
  const showItem = useShowItem(scanId);
  const rowButtons = useRef(new Map<string, HTMLButtonElement>());
  const restore = useRef(restoreList);
  const query = useQuery(
    ["largest", scanId, minSize],
    ({ signal }) =>
      getLargest(scanId, { limit: LIMIT, minSizeBytes: minSize }, signal),
    { staleTime: Infinity, keepPreviousData: true, retry: 1 },
  );
  const data = query.data?.minSizeBytes === minSize ? query.data : undefined;
  const detailIndex =
    state.detail && data
      ? data.files.findIndex((file) => file.absolutePath === state.selected)
      : -1;

  // Rows exist only once the ranking has arrived, which after a long visit
  // elsewhere may mean a new request.
  useEffect(() => {
    if (!restore.current || !data || state.detail) return;
    restore.current = false;
    window.scrollTo(0, state.scrollY);
    if (state.selected)
      rowButtons.current.get(state.selected)?.focus({ preventScroll: true });
  }, [data, state.detail, state.scrollY, state.selected]);

  const openDetail = (file: RankedFile) => {
    showItem.clearFailure();
    onStateChange({
      ...state,
      selected: file.absolutePath,
      detail: true,
      scrollY: window.scrollY,
    });
  };
  const closeDetail = () => {
    restore.current = true;
    onStateChange({ ...state, detail: false });
  };

  const showFailure = showItem.failure && (
    <div className="largest-feedback">
      <Alert
        variant="error"
        title={t("show.errorTitle", { name: showItem.failure.name })}
      >
        {showItem.failure.message}
      </Alert>
    </div>
  );

  if (data && detailIndex >= 0)
    return (
      <FindingDetail
        file={data.files[detailIndex]}
        rank={detailIndex + 1}
        root={root}
        showItem={showItem}
        feedback={showFailure}
        onBack={closeDetail}
        onOpenFolder={onOpenFolder}
      />
    );

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
        {headingAction}
      </div>
      <div className="table-tools">
        <SegmentedControl<number>
          name="largest-min-size"
          legend={t("largest.minSizeLabel")}
          showLegend
          value={minSize}
          onChange={(value) =>
            onStateChange({ ...state, minSize: value, detail: false })
          }
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
      {showFailure}
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
                const selected = file.absolutePath === state.selected;
                return (
                  <tr
                    key={file.absolutePath}
                    className={selected ? "is-selected" : undefined}
                  >
                    <td>
                      <button
                        className="item-link"
                        title={file.absolutePath}
                        aria-current={selected || undefined}
                        ref={(element) => {
                          if (element)
                            rowButtons.current.set(file.absolutePath, element);
                          else rowButtons.current.delete(file.absolutePath);
                        }}
                        onClick={() => openDetail(file)}
                      >
                        <Icon name="file" size={19} />
                        <span>{file.name}</span>
                      </button>
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

interface FindingDetailProps {
  file: RankedFile;
  rank: number;
  root: DirectoryNode;
  showItem: ReturnType<typeof useShowItem>;
  feedback: React.ReactNode;
  onBack(): void;
  onOpenFolder(file: RankedFile): Promise<void>;
}

/** One ranked file, with what it is, where it sits and what to do next. */
function FindingDetail({
  file,
  rank,
  root,
  showItem,
  feedback,
  onBack,
  onOpenFolder,
}: FindingDetailProps) {
  const { t } = useTranslation();
  const describeError = useErrorMessage();
  const heading = useRef<HTMLHeadingElement>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const location = locationOf(file);

  // Moving focus here names the new view; its heading scrolls into sight.
  useEffect(() => heading.current?.focus(), []);

  const openFolder = async () => {
    setOpening(true);
    setOpenError("");
    try {
      await onOpenFolder(file);
    } catch (error) {
      setOpenError(describeError(error));
      setOpening(false);
    }
  };
  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(file.absolutePath);
      setCopyStatus(t("selection.copied"));
    } catch {
      setCopyStatus(t("selection.copyFailed"));
    }
  };

  return (
    <section
      className="contents-card finding-detail"
      aria-labelledby="finding-title"
    >
      <div className="finding-back">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <Icon name="arrow-left" size={17} />
          {t("finding.back")}
        </Button>
      </div>
      <div className="finding-heading">
        <span className="selection-icon">
          <Icon name="file" size={24} />
        </span>
        <div>
          <h3 id="finding-title" ref={heading} tabIndex={-1}>
            {file.name}
          </h3>
          <p className="muted">
            {t("finding.summary", {
              size: formatBytes(file.sizeBytes),
              share: formatPercent(percentOf(file.sizeBytes, root.sizeBytes)),
            })}
          </p>
        </div>
      </div>
      <div className="finding-actions">
        <Button
          size="sm"
          loading={opening}
          loadingLabel={t("finding.opening")}
          onClick={() => {
            void openFolder();
          }}
        >
          <Icon name="folder" size={17} />
          {t("finding.openFolder")}
        </Button>
        {showItem.available && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void showItem.show(file.name, file.absolutePath);
            }}
          >
            <Icon name="folder-open" size={17} />
            {t("show.button")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void copyPath();
          }}
        >
          <Icon name="copy" size={17} />
          {t("selection.copyPath")}
        </Button>
      </div>
      {copyStatus && (
        <p role="status" className="copy-status finding-status">
          {copyStatus}
        </p>
      )}
      {openError && (
        <div className="largest-feedback">
          <Alert
            variant="error"
            title={t("finding.openError", { name: file.name })}
          >
            {openError}
          </Alert>
        </div>
      )}
      {feedback}
      <dl className="finding-facts">
        <div>
          <dt>{t("finding.size")}</dt>
          <dd>{formatBytes(file.sizeBytes)}</dd>
        </div>
        <div>
          <dt>{t("finding.rank")}</dt>
          <dd>{t("finding.rankValue", { rank: formatNumber(rank) })}</dd>
        </div>
        <div>
          <dt>{t("finding.location")}</dt>
          <dd>{location || t("largest.rootLocation")}</dd>
        </div>
        <div>
          <dt>{t("finding.path")}</dt>
          <dd className="finding-path">{file.absolutePath}</dd>
        </div>
      </dl>
      <p className="finding-note muted">{t("finding.note")}</p>
    </section>
  );
}
