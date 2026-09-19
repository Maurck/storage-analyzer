import React from "react";
import { DirectoryNode } from "../model/directory.types";
import {
  formatBytes,
  formatPercent,
  percentOf,
} from "../../../shared/lib/format";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";

const colors = [
  "#60A5FA",
  "#A78BFA",
  "#2DD4BF",
  "#FBBF24",
  "#FB7185",
  "#94A3B8",
];
/** One labelled stacked bar above the contents table: the composition at a
 * glance in a fixed single line. Each segment says as much as its width
 * allows; exact values stay in the table. */
export function SpaceDistribution({
  node,
  onSelect,
}: {
  node: DirectoryNode;
  onSelect(node: DirectoryNode): void;
}) {
  const { t } = useTranslation();
  const sorted = [...node.subdirectories]
    .filter((child) => child.sizeBytes > 0)
    .sort((a, b) => b.sizeBytes - a.sizeBytes);
  const top = sorted
    .slice(0, 5)
    .map((child) => ({ name: child.name, size: child.sizeBytes, node: child }));
  const other = sorted
    .slice(5)
    .reduce((sum, child) => sum + child.sizeBytes, 0);
  const parts: { name: string; size: number; node?: DirectoryNode }[] = [
    ...top,
    ...(other > 0 ? [{ name: t("distribution.other"), size: other }] : []),
  ];
  const total = parts.reduce((sum, part) => sum + part.size, 0);
  // Nothing to compare: the table's own empty state explains the folder.
  if (total === 0) return null;
  return (
    <figure
      className="distribution-strip"
      aria-label={t("distribution.figureLabel", {
        name: node.name,
        size: formatBytes(total),
      })}
    >
      <figcaption className="distribution-label" aria-hidden="true">
        <span className="distribution-label__title">
          {t("distribution.title")}
        </span>
        <span className="distribution-label__total">{formatBytes(total)}</span>
      </figcaption>
      <div className="stacked-bar">
        {parts.map((part, i) => {
          const size = formatBytes(part.size);
          const content = (
            <span className="bar-segment__label">
              <span className="bar-segment__name">{part.name}</span>
              <span className="bar-segment__size"> · {size}</span>
              <span className="bar-segment__share">
                <span className="bar-segment__separator"> · </span>
                {formatPercent(percentOf(part.size, total))}
              </span>
            </span>
          );
          const style = { flexGrow: part.size, background: colors[i] };
          const title = `${part.name} · ${size}`;
          return part.node ? (
            <button
              key={part.node.absolutePath}
              className="bar-segment"
              style={style}
              title={title}
              onClick={() => onSelect(part.node!)}
            >
              {content}
            </button>
          ) : (
            <span
              key="other"
              className="bar-segment"
              style={style}
              title={title}
            >
              {content}
            </span>
          );
        })}
      </div>
    </figure>
  );
}
