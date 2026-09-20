import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "react-query";
import { getLargest, searchFiles } from "../api/directory.api";
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
import { useFittedHeight } from "../../../shared/hooks/useFittedHeight";

const LIMIT = 100;
/** Files per page of search results. */
export const SEARCH_PAGE_SIZE = 50;
/** How far into the matches the backend lets pages reach (MAX_SEARCH_WINDOW). */
export const SEARCH_WINDOW = 10_000;
/** Typing pauses this long before a search is sent. */
const SEARCH_DELAY_MS = 250;
// The app labels powers of 1024 as KB, MB and GB, like Explorer.
const MB = 1024 ** 2;
const GB = 1024 ** 3;
const thresholds = [0, 100 * MB, GB, 10 * GB];
/** The scope option that stands for the whole analysis. */
const WHOLE_ANALYSIS = "";

/** The folder part of a path relative to the scan root. */
function locationOf(file: RankedFile) {
  return file.relativePath
    .slice(0, Math.max(0, file.relativePath.length - file.name.length))
    .replace(/[\\/]+$/, "");
}

export interface SearchScope {
  path: string;
  name: string;
}

/**
 * What the view shows, kept by the page for one scan so that leaving it (to
 * open a folder, for instance) and coming back loses nothing.
 */
export interface LargestState {
  minSize: number;
  /** Text looked for in each file's name and path from the root. */
  query: string;
  /** A folder searched with its subfolders; the whole analysis when absent. */
  scope?: SearchScope;
  /** Page of search results; the ranking has one. */
  page: number;
  /** The file last opened, marked in the list. */
  selected?: string;
  /** Its details are open instead of the list. */
  detail: boolean;
  /** Page scroll of the list when the details opened. */
  scrollY: number;
  /** Scroll inside the rows' own region when the details opened. */
  listScroll: number;
}

export const initialLargestState: LargestState = {
  minSize: 0,
  query: "",
  page: 0,
  detail: false,
  scrollY: 0,
  listScroll: 0,
};

/** A query or a folder turns the ranking into a search of every file. */
export const isSearch = (state: LargestState) =>
  state.query.trim() !== "" || !!state.scope;

interface LargestFilesProps {
  scanId: string;
  root: DirectoryNode;
  state: LargestState;
  onStateChange(state: LargestState): void;
  /** The folder selected in the explorer, offered as a search scope. */
  folder?: SearchScope;
  /** Put the list back as it was: scroll and focus on the selected row. */
  restoreList?: boolean;
  /** Move focus to the search field once it is on screen, then report it. */
  focusSearch?: boolean;
  onSearchFocused?(): void;
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
  folder,
  restoreList = false,
  focusSearch = false,
  onSearchFocused,
  onOpenSkipped,
  onOpenFolder,
  headingAction,
}: LargestFilesProps) {
  const { t } = useTranslation();
  const describeError = useErrorMessage();
  const { minSize, scope, page } = state;
  const showItem = useShowItem(scanId);
  const rowButtons = useRef(new Map<string, HTMLButtonElement>());
  const scrollRegion = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const restore = useRef(restoreList);
  const typed = state.query.trim();
  // The text last sent. Restoring a view sends it at once; typing waits.
  const [sent, setSent] = useState(typed);
  const pending = sent !== typed;
  const searching = isSearch(state);
  const searchSent = sent !== "" || !!scope;

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setSent(typed), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pending, typed]);

  const ranking = useQuery(
    ["largest", scanId, minSize],
    ({ signal }) =>
      getLargest(scanId, { limit: LIMIT, minSizeBytes: minSize }, signal),
    {
      enabled: !searchSent,
      staleTime: Infinity,
      keepPreviousData: true,
      retry: 1,
    },
  );
  const search = useQuery(
    ["files", scanId, sent, scope?.path ?? "", minSize, page],
    ({ signal }) =>
      searchFiles(
        scanId,
        {
          query: sent,
          scope: scope?.path,
          minSizeBytes: minSize,
          offset: page * SEARCH_PAGE_SIZE,
          limit: SEARCH_PAGE_SIZE,
        },
        signal,
      ),
    {
      enabled: searchSent,
      staleTime: Infinity,
      // Earlier rows stay, marked as out of date, until the new ones arrive.
      keepPreviousData: true,
      retry: 1,
    },
  );
  const active = searchSent ? search : ranking;
  const rankingData =
    ranking.data?.minSizeBytes === minSize ? ranking.data : undefined;
  const list = searchSent
    ? search.data && {
        files: search.data.files,
        offset: search.data.offset,
        matching: search.data.matchingFiles,
        partial: search.data.partial,
      }
    : rankingData && {
        files: rankingData.files,
        offset: 0,
        matching: rankingData.matchingFiles,
        partial: rankingData.partial,
      };
  // Rows that answer an earlier question are never shown as current matches.
  const stale = !!list && (pending || (searchSent && search.isPreviousData));
  const detailIndex =
    state.detail && list && !stale
      ? list.files.findIndex((file) => file.absolutePath === state.selected)
      : -1;
  const pages = list
    ? Math.ceil(Math.min(list.matching, SEARCH_WINDOW) / SEARCH_PAGE_SIZE)
    : 0;
  const where = scope
    ? t("search.whereFolder", { name: scope.name })
    : t("search.whereAll");
  // A warning above the rows moves them down, so the region is measured again.
  const partialAbove = searchSent ? list?.partial : root.partial;

  // The rows scroll inside their region, so the count and the pages under
  // them stay on screen.
  useFittedHeight(
    scrollRegion,
    scanId,
    list?.files.length,
    searching,
    !!partialAbove,
  );

  // Rows exist only once the list has arrived, which after a long visit
  // elsewhere may mean a new request.
  useEffect(() => {
    if (!restore.current || !list || stale || state.detail) return;
    restore.current = false;
    window.scrollTo(0, state.scrollY);
    if (scrollRegion.current) scrollRegion.current.scrollTop = state.listScroll;
    if (state.selected)
      rowButtons.current.get(state.selected)?.focus({ preventScroll: true });
  }, [
    list,
    stale,
    state.detail,
    state.scrollY,
    state.listScroll,
    state.selected,
  ]);

  useEffect(() => {
    if (!focusSearch || !searchInput.current) return;
    searchInput.current.focus();
    onSearchFocused?.();
  }, [focusSearch, onSearchFocused, state.detail]);

  const change = (next: Partial<LargestState>) =>
    onStateChange({ ...state, page: 0, detail: false, ...next });
  const openDetail = (file: RankedFile) => {
    showItem.clearFailure();
    onStateChange({
      ...state,
      selected: file.absolutePath,
      detail: true,
      scrollY: window.scrollY,
      listScroll: scrollRegion.current?.scrollTop ?? 0,
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

  if (list && detailIndex >= 0)
    return (
      <FindingDetail
        file={list.files[detailIndex]}
        position={
          searchSent
            ? t("finding.matchValue", {
                rank: formatNumber(list.offset + detailIndex + 1),
                total: formatNumber(list.matching),
              })
            : t("finding.rankValue", { rank: formatNumber(detailIndex + 1) })
        }
        backLabel={searchSent ? t("finding.backToResults") : t("finding.back")}
        root={root}
        showItem={showItem}
        feedback={showFailure}
        onBack={closeDetail}
        onOpenFolder={onOpenFolder}
      />
    );

  const folders = [scope, folder].filter(
    (option, index, all): option is SearchScope =>
      !!option &&
      option.path !== root.absolutePath &&
      all.findIndex((other) => other?.path === option.path) === index,
  );
  const partial = partialAbove;
  const emptyExit = scope ? (
    <Button variant="secondary" onClick={() => change({ scope: undefined })}>
      {t("search.searchAll")}
    </Button>
  ) : minSize > 0 ? (
    <Button variant="secondary" onClick={() => change({ minSize: 0 })}>
      {t("search.anySize")}
    </Button>
  ) : (
    <Button variant="secondary" onClick={() => change({ query: "" })}>
      {t("search.clear")}
    </Button>
  );

  return (
    <section
      className="contents-card largest-card"
      aria-labelledby="largest-title"
    >
      <div className="table-tools largest-search">
        <div className="inline-heading">
          <h3 id="largest-title">
            {!searching
              ? t("largest.title")
              : scope
                ? t("search.titleFolder", { name: scope.name })
                : t("search.titleAll")}
          </h3>
        </div>
        <div className="search-field">
          <Icon name="search" size={18} />
          <label className="sr-only" htmlFor="file-search">
            {t("search.label")}
          </label>
          <input
            id="file-search"
            ref={searchInput}
            type="search"
            placeholder={t("search.placeholder")}
            value={state.query}
            maxLength={1024}
            aria-describedby="file-search-scope"
            onChange={(event) => change({ query: event.target.value })}
          />
        </div>
        {headingAction}
      </div>
      <div className="table-tools largest-filters">
        {folders.length > 0 && (
          <SegmentedControl<string>
            name="file-scope"
            legend={t("search.scopeLegend")}
            showLegend
            value={scope?.path ?? WHOLE_ANALYSIS}
            onChange={(value) =>
              change({
                scope: folders.find((option) => option.path === value),
              })
            }
            options={[
              { value: WHOLE_ANALYSIS, label: t("search.scopeAll") },
              ...folders.map((option) => ({
                value: option.path,
                label: t("search.scopeFolder", { name: option.name }),
              })),
            ]}
          />
        )}
        <SegmentedControl<number>
          name="largest-min-size"
          legend={t("largest.minSizeLabel")}
          showLegend
          value={minSize}
          onChange={(value) => change({ minSize: value })}
          options={thresholds.map((value) => ({
            value,
            label:
              value === 0
                ? t("largest.anySize")
                : t("largest.atLeast", { size: formatBytes(value) }),
          }))}
        />
      </div>
      <p id="file-search-scope" className="search-scope muted">
        {searching
          ? t("search.scopeNote", { where })
          : t("largest.description", { root: root.name })}
        {folders.length === 0 && " " + t("search.scopeHint")}
      </p>
      {partial && (
        <div className="largest-partial">
          <Alert variant="warning">
            <p>{searching ? t("search.partial") : t("largest.partial")}</p>
            <Button variant="secondary" size="sm" onClick={onOpenSkipped}>
              {t("skipped.open")}
            </Button>
          </Alert>
        </div>
      )}
      {showFailure}
      {active.isError && !list ? (
        <ErrorState
          title={searching ? t("search.errorTitle") : t("largest.errorTitle")}
          description={describeError(active.error)}
          onRetry={() => {
            void active.refetch();
          }}
        />
      ) : !list ? (
        <div className="detail-skeleton" role="status">
          <span className="sr-only">
            {searching ? t("search.loading") : t("largest.loading")}
          </span>
          <Skeleton height={220} />
        </div>
      ) : list.files.length === 0 && !stale ? (
        searchSent ? (
          <EmptyState
            title={t("search.emptyTitle")}
            description={
              (sent
                ? t("search.emptyQuery", { where, query: sent })
                : t("search.emptyAll", { where })) +
              (minSize > 0
                ? " " + t("search.emptyMin", { size: formatBytes(minSize) })
                : "")
            }
            icon={<Icon name="search" size={28} />}
            action={emptyExit}
          />
        ) : (
          <EmptyState
            title={t("largest.emptyTitle")}
            description={
              minSize === 0
                ? t("largest.emptyAny")
                : t("largest.emptyFiltered", { size: formatBytes(minSize) })
            }
            icon={<Icon name="file" size={28} />}
          />
        )
      ) : (
        <div
          className={`table-scroll${stale ? " is-stale" : ""}`}
          aria-busy={stale || undefined}
          ref={scrollRegion}
        >
          <table>
            <caption className="sr-only">
              {searchSent
                ? t("search.caption", { where })
                : t("largest.caption", { root: root.name })}
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
              {list.files.map((file) => {
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
                        disabled={stale}
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
                          disabled={stale}
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
      {list && (stale || list.files.length > 0) && (
        <div className="table-footer">
          <span role="status">
            {stale
              ? t("search.searching")
              : searchSent
                ? t("search.range", {
                    from: formatNumber(list.offset + 1),
                    to: formatNumber(list.offset + list.files.length),
                    total: formatNumber(list.matching),
                  })
                : t("largest.count", {
                    shown: formatNumber(list.files.length),
                    matching: formatNumber(list.matching),
                  })}
          </span>
          {!searchSent && list.matching > list.files.length && (
            <span>
              {t("largest.onlyLargest", { limit: formatNumber(LIMIT) })}
            </span>
          )}
          {searchSent && list.matching > SEARCH_WINDOW && (
            <span>
              {t("search.windowLimit", {
                limit: formatNumber(SEARCH_WINDOW),
              })}
            </span>
          )}
          {searchSent && pages > 1 && (
            <nav aria-label={t("search.pagination")}>
              <IconButton
                label={t("contents.previousPage")}
                variant="ghost"
                disabled={page === 0}
                onClick={() => onStateChange({ ...state, page: page - 1 })}
              >
                <Icon name="chevron-right" className="rotate-180" />
              </IconButton>
              <span>
                {t("contents.pageOf", {
                  page: formatNumber(page + 1),
                  pages: formatNumber(pages),
                })}
              </span>
              <IconButton
                label={t("contents.nextPage")}
                variant="ghost"
                disabled={page + 1 >= pages}
                onClick={() => onStateChange({ ...state, page: page + 1 })}
              >
                <Icon name="chevron-right" />
              </IconButton>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}

interface FindingDetailProps {
  file: RankedFile;
  /** Where the file stands in the list it was opened from. */
  position: string;
  backLabel: string;
  root: DirectoryNode;
  showItem: ReturnType<typeof useShowItem>;
  feedback: React.ReactNode;
  onBack(): void;
  onOpenFolder(file: RankedFile): Promise<void>;
}

/** One file of the list, with what it is, where it sits and what to do next. */
function FindingDetail({
  file,
  position,
  backLabel,
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
          {backLabel}
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
          <dd>{position}</dd>
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
