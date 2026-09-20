import React, { useEffect, useMemo, useRef } from "react";
import { DirectoryNode } from "../model/directory.types";
import {
  formatBytes,
  formatNumber,
  formatPercent,
  percentOf,
} from "../../../shared/lib/format";
import { Icon } from "../../../shared/ui/Icon";
import { IconButton } from "../../../shared/ui/IconButton";
import { Button } from "../../../shared/ui/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";
import { useFittedHeight } from "../../../shared/hooks/useFittedHeight";

export const PAGE_SIZE = 25;

/** How one folder's table is shown; the page keeps one per folder and scan. */
export interface ContentsState {
  search: string;
  filter: "all" | DirectoryNode["type"];
  sort: { key: "name" | "sizeBytes"; descending: boolean };
  page: number;
}

export const initialContentsState: ContentsState = {
  search: "",
  filter: "all",
  sort: { key: "sizeBytes", descending: true },
  page: 0,
};

/** The rows the table lists, in order, before paging. */
export function contentsItems(node: DirectoryNode, state: ContentsState) {
  const { search, filter, sort } = state;
  const query = search.trim().toLocaleLowerCase();
  return node.subdirectories
    .filter(
      (child) =>
        child.name.toLocaleLowerCase().includes(query) &&
        (filter === "all" || child.type === filter),
    )
    .sort(
      (a, b) =>
        (sort.key === "name"
          ? a.name.localeCompare(b.name, undefined, { numeric: true })
          : a.sizeBytes - b.sizeBytes || a.name.localeCompare(b.name)) *
        (sort.descending ? -1 : 1),
    );
}

export function ContentsTable({
  node,
  onSelect,
  state,
  onStateChange,
  revealed,
  revealedFromSearch = false,
  focusRevealed = false,
  onRevealFocused,
  onSearchSubfolders,
}: {
  node: DirectoryNode;
  onSelect(node: DirectoryNode): void;
  state: ContentsState;
  onStateChange(state: ContentsState): void;
  /** An item reached from elsewhere (the ranking or a search), marked in its row. */
  revealed?: string;
  /** It was reached from search results rather than the ranking. */
  revealedFromSearch?: boolean;
  /** Move focus to that row once it is on screen, then report it. */
  focusRevealed?: boolean;
  onRevealFocused?(): void;
  /** Looks for the filter's text in this folder and all its subfolders. */
  onSearchSubfolders?(query: string): void;
}) {
  const { t } = useTranslation();
  const { search, filter, sort, page } = state;
  const revealedButton = useRef<HTMLButtonElement>(null);
  const scrollRegion = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLDivElement>(null);
  const items = useMemo(() => contentsItems(node, state), [node, state]);
  const pages = Math.ceil(items.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(pages - 1, 0));
  const update = (change: Partial<ContentsState>) =>
    onStateChange({ ...state, ...change });
  const reset = () => update({ search: "", filter: "all", page: 0 });
  const query = search.trim();
  const sortBy = (key: "name" | "sizeBytes") =>
    update({
      sort: {
        key,
        descending: sort.key === key ? !sort.descending : key === "sizeBytes",
      },
      page: 0,
    });

  // The rows scroll inside their region, so the count and the pages under
  // them stay on screen.
  useFittedHeight(scrollRegion, footer, node.absolutePath, items.length, query, filter);

  useEffect(() => {
    if (!focusRevealed || !revealedButton.current) return;
    revealedButton.current.focus();
    onRevealFocused?.();
  }, [focusRevealed, revealed, onRevealFocused]);

  return (
    <section className="contents-card" aria-labelledby="contents-title">
      {node.subdirectories.length === 0 ? (
        <div className="table-tools">
          <div className="inline-heading">
            <h3 id="contents-title">{t("contents.title")}</h3>
            <span className="count-badge">0</span>
          </div>
        </div>
      ) : null}
      {node.subdirectories.length === 0 ? (
        <EmptyState
          title={t("contents.emptyTitle")}
          description={t("contents.emptyDescription")}
          icon={<Icon name="folder-open" size={28} />}
        />
      ) : (
        <>
          <div className="table-tools">
            {/* The card's name shares the row with what filters it. */}
            <div className="inline-heading">
              <h3 id="contents-title">{t("contents.title")}</h3>
              <span className="count-badge">
                {formatNumber(node.subdirectories.length)}
              </span>
            </div>
            <div className="search-field">
              <Icon name="search" size={18} />
              <label className="sr-only" htmlFor="contents-search">
                {t("contents.searchLabel")}
              </label>
              <input
                id="contents-search"
                type="search"
                placeholder={t("contents.searchPlaceholder")}
                value={search}
                onChange={(event) =>
                  update({ search: event.target.value, page: 0 })
                }
              />
            </div>
            <label className="sr-only" htmlFor="type-filter">
              {t("contents.filterLabel")}
            </label>
            <select
              id="type-filter"
              value={filter}
              onChange={(event) =>
                update({
                  filter: event.target.value as ContentsState["filter"],
                  page: 0,
                })
              }
            >
              <option value="all">{t("contents.allTypes")}</option>
              <option value="FOLDER">{t("contents.folders")}</option>
              <option value="FILE">{t("contents.files")}</option>
              <option value="ERROR">{t("contents.skippedItems")}</option>
            </select>
            {(search || filter !== "all") && (
              <Button variant="ghost" size="sm" onClick={reset}>
                {t("contents.reset")}
              </Button>
            )}
          </div>
          {/* The filter reads direct items only; going deeper is a search, said so. */}
          {query && onSearchSubfolders && node.directoryCount > 0 && (
            <div className="contents-scope">
              <span className="muted">
                {t("contents.directOnly", { name: node.name })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onSearchSubfolders(query)}
              >
                <Icon name="search" size={16} />
                {t("contents.searchSubfolders", { query, name: node.name })}
              </Button>
            </div>
          )}
          {items.length === 0 ? (
            <EmptyState
              title={t("contents.noMatchTitle")}
              description={t("contents.noMatchDescription")}
              action={
                <Button variant="secondary" onClick={reset}>
                  {t("contents.clearFilters")}
                </Button>
              }
            />
          ) : (
            <div className="table-scroll" ref={scrollRegion}>
              <table>
                <caption className="sr-only">
                  {t("contents.caption", { name: node.name })}
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      aria-sort={
                        sort.key === "name"
                          ? sort.descending
                            ? "descending"
                            : "ascending"
                          : "none"
                      }
                    >
                      <button onClick={() => sortBy("name")}>
                        {t("contents.columnName")}{" "}
                        <Icon
                          name={
                            sort.key === "name" && !sort.descending
                              ? "arrow-up"
                              : "arrow-down"
                          }
                          size={14}
                        />
                      </button>
                    </th>
                    <th scope="col" className="type-column">
                      {t("contents.columnType")}
                    </th>
                    <th
                      scope="col"
                      className="numeric"
                      aria-sort={
                        sort.key === "sizeBytes"
                          ? sort.descending
                            ? "descending"
                            : "ascending"
                          : "none"
                      }
                    >
                      <button onClick={() => sortBy("sizeBytes")}>
                        {t("contents.columnSize")}{" "}
                        <Icon
                          name={
                            sort.key === "sizeBytes" && !sort.descending
                              ? "arrow-up"
                              : "arrow-down"
                          }
                          size={14}
                        />
                      </button>
                    </th>
                    <th scope="col" className="share-column">
                      {t("contents.columnShare")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .slice(
                      currentPage * PAGE_SIZE,
                      (currentPage + 1) * PAGE_SIZE,
                    )
                    .map((child) => {
                      const isRevealed = child.absolutePath === revealed;
                      return (
                        <tr
                          key={child.absolutePath}
                          className={isRevealed ? "is-selected" : undefined}
                        >
                          <td>
                            <button
                              className="item-link"
                              title={child.absolutePath}
                              onClick={() => onSelect(child)}
                              ref={isRevealed ? revealedButton : undefined}
                              aria-current={isRevealed || undefined}
                            >
                              <Icon
                                name={
                                  child.type === "ERROR"
                                    ? "alert"
                                    : child.type === "FILE"
                                      ? "file"
                                      : "folder"
                                }
                                size={19}
                              />
                              <span>{child.name}</span>
                              {child.partial && (
                                <span className="partial-label">
                                  {t("contents.partial")}
                                </span>
                              )}
                              {isRevealed && (
                                <span className="revealed-label">
                                  {revealedFromSearch
                                    ? t("contents.revealedSearch")
                                    : t("contents.revealed")}
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="type-column muted">
                            {child.type === "FILE"
                              ? t("contents.typeFile")
                              : child.type === "ERROR"
                                ? t("contents.typeSkipped")
                                : t("contents.typeFolder")}
                          </td>
                          <td className="numeric">
                            {child.partial ? "≥ " : ""}
                            {formatBytes(child.sizeBytes)}
                          </td>
                          <td className="share-column">
                            <div className="share-value">
                              <span className="share-bar" aria-hidden="true">
                                <span
                                  style={{
                                    width: `${percentOf(child.sizeBytes, node.sizeBytes)}%`,
                                  }}
                                />
                              </span>
                              <span>
                                {formatPercent(
                                  percentOf(child.sizeBytes, node.sizeBytes),
                                )}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
          <div className="table-footer" ref={footer}>
            <span role="status">
              {items.length
                ? t("contents.range", {
                    from: formatNumber(currentPage * PAGE_SIZE + 1),
                    to: formatNumber(
                      Math.min((currentPage + 1) * PAGE_SIZE, items.length),
                    ),
                    total: formatNumber(items.length),
                  })
                : t("contents.noItems")}
            </span>
            {pages > 1 && (
              <nav aria-label={t("contents.pagination")}>
                <IconButton
                  label={t("contents.previousPage")}
                  variant="ghost"
                  disabled={currentPage === 0}
                  onClick={() => update({ page: currentPage - 1 })}
                >
                  <Icon name="chevron-right" className="rotate-180" />
                </IconButton>
                <span>
                  {t("contents.pageOf", {
                    page: formatNumber(currentPage + 1),
                    pages: formatNumber(pages),
                  })}
                </span>
                <IconButton
                  label={t("contents.nextPage")}
                  variant="ghost"
                  disabled={currentPage + 1 >= pages}
                  onClick={() => update({ page: currentPage + 1 })}
                >
                  <Icon name="chevron-right" />
                </IconButton>
              </nav>
            )}
          </div>
        </>
      )}
    </section>
  );
}
