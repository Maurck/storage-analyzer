import React, { useMemo, useState } from "react";
import { DirectoryNode } from "../model/directory.types";
import {
  formatBytes,
  formatNumber,
  percentOf,
} from "../../../shared/lib/format";
import { Icon } from "../../../shared/ui/Icon";
import { IconButton } from "../../../shared/ui/IconButton";
import { Button } from "../../../shared/ui/Button";
import { EmptyState } from "../../../shared/components/EmptyState";

export function ContentsTable({
  node,
  onSelect,
}: {
  node: DirectoryNode;
  onSelect(node: DirectoryNode): void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<{
    key: "name" | "sizeBytes";
    descending: boolean;
  }>({ key: "sizeBytes", descending: true });
  const [page, setPage] = useState(0);
  const items = useMemo(
    () =>
      node.subdirectories
        .filter(
          (child) =>
            child.name
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase()) &&
            (filter === "all" || child.type === filter),
        )
        .sort(
          (a, b) =>
            (sort.key === "name"
              ? a.name.localeCompare(b.name, undefined, { numeric: true })
              : a.sizeBytes - b.sizeBytes || a.name.localeCompare(b.name)) *
            (sort.descending ? -1 : 1),
        ),
    [node, search, filter, sort],
  );
  const pages = Math.ceil(items.length / 25);
  const currentPage = Math.min(page, Math.max(pages - 1, 0));
  const reset = () => {
    setSearch("");
    setFilter("all");
    setPage(0);
  };
  const sortBy = (key: "name" | "sizeBytes") => {
    setSort((value) => ({
      key,
      descending: value.key === key ? !value.descending : key === "sizeBytes",
    }));
    setPage(0);
  };
  return (
    <section className="contents-card" aria-labelledby="contents-title">
      <div className="card-heading">
        <div className="inline-heading">
          <h3 id="contents-title">Folder contents</h3>
          <span className="count-badge">
            {formatNumber(node.subdirectories.length)}
          </span>
        </div>
        <span className="muted">Largest first by default</span>
      </div>
      {node.subdirectories.length === 0 ? (
        <EmptyState
          title="This folder is empty"
          description="There are no items to display in this folder."
          icon={<Icon name="folder-open" size={28} />}
        />
      ) : (
        <>
          <div className="table-tools">
            <div className="search-field">
              <Icon name="search" size={18} />
              <label className="sr-only" htmlFor="contents-search">
                Search this folder
              </label>
              <input
                id="contents-search"
                type="search"
                placeholder="Search this folder…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </div>
            <label className="sr-only" htmlFor="type-filter">
              Filter by type
            </label>
            <select
              id="type-filter"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="all">All types</option>
              <option value="FOLDER">Folders</option>
              <option value="FILE">Files</option>
              <option value="ERROR">Skipped items</option>
            </select>
            {(search || filter !== "all") && (
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
            )}
          </div>
          {items.length === 0 ? (
            <EmptyState
              title="No matching items"
              description="Try another name or clear the active filters."
              action={
                <Button variant="secondary" onClick={reset}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="table-scroll">
              <table>
                <caption className="sr-only">
                  Contents of {node.name}. Sizes are logical file sizes as
                  Windows Explorer reports them, not allocated disk space.
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
                        Name{" "}
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
                      Type
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
                        Size{" "}
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
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .slice(currentPage * 25, (currentPage + 1) * 25)
                    .map((child) => (
                      <tr key={child.absolutePath}>
                        <td>
                          <button
                            className="item-link"
                            title={child.absolutePath}
                            onClick={() => onSelect(child)}
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
                              <span className="partial-label">Partial</span>
                            )}
                          </button>
                        </td>
                        <td className="type-column muted">
                          {child.type === "FILE"
                            ? "File"
                            : child.type === "ERROR"
                              ? "Skipped"
                              : "Folder"}
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
                              {percentOf(
                                child.sizeBytes,
                                node.sizeBytes,
                              ).toFixed(1)}
                              %
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="table-footer">
            <span role="status">
              {items.length
                ? `${currentPage * 25 + 1}–${Math.min((currentPage + 1) * 25, items.length)} of ${formatNumber(items.length)} items`
                : "0 items"}
            </span>
            {pages > 1 && (
              <nav aria-label="Contents pagination">
                <IconButton
                  label="Previous page"
                  variant="ghost"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <Icon name="chevron-right" className="rotate-180" />
                </IconButton>
                <span>
                  Page {currentPage + 1} of {pages}
                </span>
                <IconButton
                  label="Next page"
                  variant="ghost"
                  disabled={currentPage + 1 >= pages}
                  onClick={() => setPage(currentPage + 1)}
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
