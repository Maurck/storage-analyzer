import React, { useEffect, useMemo, useRef, useState } from "react";
import { DirectoryNode, NodeCache } from "../model/directory.types";
import { Icon } from "../../../shared/ui/Icon";
import { Spinner } from "../../../shared/ui/Spinner";
import { formatBytes } from "../../../shared/lib/format";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";

interface Props {
  root: DirectoryNode;
  nodes: NodeCache;
  selectedPath: string;
  onSelect(node: DirectoryNode): void;
  onLoad(node: DirectoryNode): Promise<void>;
  loadingPaths: Set<string>;
}

export function DirectoryTree({
  root,
  nodes,
  selectedPath,
  onSelect,
  onLoad,
  loadingPaths,
}: Props) {
  const [expanded, setExpanded] = useState(new Set([root.absolutePath]));
  const [focused, setFocused] = useState(root.absolutePath);
  const { t } = useTranslation();
  const treeItemLabel = (node: DirectoryNode) => {
    const kind =
      node.type === "ERROR"
        ? t("tree.skippedItem")
        : node.type === "FILE"
          ? t("tree.file")
          : t("tree.folder");
    const incomplete = node.partial ? ", " + t("tree.incomplete") : "";
    const detail = node.error ? ", " + node.error : "";
    return (
      node.name +
      ", " +
      kind +
      incomplete +
      ", " +
      formatBytes(node.sizeBytes) +
      detail
    );
  };
  const [search, setSearch] = useState("");
  const refs = useRef(new Map<string, HTMLLIElement>());
  const typeAhead = useRef({ text: "", time: 0 });
  const resolved = (node: DirectoryNode) => nodes[node.absolutePath] ?? node;
  const query = search.trim().toLocaleLowerCase();
  const matches = useMemo(() => {
    const found = new Set<string>();
    function visit(preview: DirectoryNode): boolean {
      const node = nodes[preview.absolutePath] ?? preview;
      const childMatch = node.subdirectories.map(visit).some(Boolean);
      const match =
        !query || node.name.toLocaleLowerCase().includes(query) || childMatch;
      if (match) found.add(node.absolutePath);
      return match;
    }
    visit(root);
    return found;
  }, [nodes, root, query]);

  const visible: { node: DirectoryNode; parent?: string }[] = [];
  function flatten(preview: DirectoryNode, parent?: string) {
    const node = resolved(preview);
    if (!matches.has(node.absolutePath)) return;
    visible.push({ node, parent });
    if (query || expanded.has(node.absolutePath))
      node.subdirectories.forEach((child) => flatten(child, node.absolutePath));
  }
  flatten(root);
  const tabStop = visible.some((item) => item.node.absolutePath === focused)
    ? focused
    : visible[0]?.node.absolutePath;
  useEffect(() => {
    if (tabStop && focused !== tabStop) setFocused(tabStop);
  }, [tabStop, focused]);

  const focus = (path?: string) => {
    if (!path) return;
    setFocused(path);
    refs.current.get(path)?.focus();
  };
  const expand = async (node: DirectoryNode) => {
    if (!node.hasChildren) return;
    setExpanded((value) => new Set(value).add(node.absolutePath));
    await onLoad(node);
  };
  const collapse = (path: string) =>
    setExpanded((value) => {
      const next = new Set(value);
      next.delete(path);
      return next;
    });

  const onKeyDown = (event: React.KeyboardEvent, node: DirectoryNode) => {
    event.stopPropagation();
    const index = visible.findIndex(
      (item) => item.node.absolutePath === node.absolutePath,
    );
    const open = !!query || expanded.has(node.absolutePath);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focus(
          visible[Math.min(index + 1, visible.length - 1)]?.node.absolutePath,
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        focus(visible[Math.max(index - 1, 0)]?.node.absolutePath);
        break;
      case "Home":
        event.preventDefault();
        focus(visible[0]?.node.absolutePath);
        break;
      case "End":
        event.preventDefault();
        focus(visible[visible.length - 1]?.node.absolutePath);
        break;
      case "ArrowRight":
        event.preventDefault();
        if (node.hasChildren && !open) void expand(node);
        else if (node.hasChildren && !node.childrenLoaded) void expand(node);
        else if (node.hasChildren)
          focus(
            node.subdirectories.find((child) => matches.has(child.absolutePath))
              ?.absolutePath,
          );
        break;
      case "ArrowLeft":
        event.preventDefault();
        if (open && node.hasChildren && !query) collapse(node.absolutePath);
        else focus(visible[index]?.parent);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onSelect(node);
        break;
      default:
        if (
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          const now = Date.now();
          typeAhead.current.text =
            now - typeAhead.current.time > 600
              ? event.key
              : typeAhead.current.text + event.key;
          typeAhead.current.time = now;
          const after = [
            ...visible.slice(index + 1),
            ...visible.slice(0, index + 1),
          ];
          focus(
            after.find((item) =>
              item.node.name
                .toLocaleLowerCase()
                .startsWith(typeAhead.current.text.toLocaleLowerCase()),
            )?.node.absolutePath,
          );
        }
    }
  };

  const renderNode = (
    preview: DirectoryNode,
    level: number,
    position: number,
    siblings: number,
  ): React.ReactNode => {
    const node = resolved(preview);
    const open = !!query || expanded.has(node.absolutePath);
    const children = node.subdirectories.filter((child) =>
      matches.has(child.absolutePath),
    );
    return (
      <li
        key={node.absolutePath}
        role="treeitem"
        aria-label={treeItemLabel(node)}
        aria-expanded={node.hasChildren ? open : undefined}
        aria-selected={node.absolutePath === selectedPath}
        aria-level={level}
        aria-posinset={position}
        aria-setsize={siblings}
        aria-busy={loadingPaths.has(node.absolutePath)}
        tabIndex={tabStop === node.absolutePath ? 0 : -1}
        ref={(element) => {
          if (element) refs.current.set(node.absolutePath, element);
          else refs.current.delete(node.absolutePath);
        }}
        onFocus={(event) => {
          if (event.target === event.currentTarget)
            setFocused(node.absolutePath);
        }}
        onKeyDown={(event) => onKeyDown(event, node)}
      >
        <div
          className="tree-row"
          style={{ paddingInlineStart: `${12 + (level - 1) * 18}px` }}
          onClick={() => {
            focus(node.absolutePath);
            onSelect(node);
          }}
          onDoubleClick={() => {
            if (open) collapse(node.absolutePath);
            else void expand(node);
          }}
          title={node.absolutePath}
        >
          <span
            className={`tree-chevron ${node.hasChildren ? "" : "is-hidden"}`}
            aria-hidden="true"
            onClick={(event) => {
              event.stopPropagation();
              focus(node.absolutePath);
              if (open) collapse(node.absolutePath);
              else void expand(node);
            }}
          >
            <Icon name={open ? "chevron-down" : "chevron-right"} size={16} />
          </span>
          <Icon
            name={
              node.type === "ERROR"
                ? "alert"
                : node.type === "FILE"
                  ? "file"
                  : open
                    ? "folder-open"
                    : "folder"
            }
            size={18}
          />
          <span className="tree-name">{node.name}</span>
          {loadingPaths.has(node.absolutePath) ? (
            <Spinner label={`Loading ${node.name}`} />
          ) : (
            <span className="tree-size">{formatBytes(node.sizeBytes)}</span>
          )}
        </div>
        {node.hasChildren && open && children.length > 0 && (
          <ul role="group">
            {children.map((child, index) =>
              renderNode(child, level + 1, index + 1, children.length),
            )}
          </ul>
        )}
      </li>
    );
  };
  return (
    <>
      <div className="explorer-search">
        <label className="sr-only" htmlFor="tree-search">
          {t("explorer.searchLabel")}
        </label>
        <Icon name="search" size={17} />
        <input
          id="tree-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("explorer.searchPlaceholder")}
          aria-describedby="tree-search-hint"
          type="search"
        />
      </div>
      <p id="tree-search-hint" className="explorer-hint">
        {t("explorer.hint")}
      </p>
      {visible.length ? (
        <ul
          role="tree"
          aria-label={t("explorer.treeLabel")}
          className="directory-tree"
        >
          {renderNode(root, 1, 1, 1)}
        </ul>
      ) : (
        <p role="status" className="explorer-hint">
          {t("explorer.noMatches", { query: search })}
        </p>
      )}
      <div className="explorer-footer">
        <kbd>↑</kbd>
        <kbd>↓</kbd>
        <span>{t("explorer.navigate")}</span>
        <kbd>Enter</kbd>
        <span>{t("explorer.select")}</span>
      </div>
    </>
  );
}
