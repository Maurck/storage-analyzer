import React from "react";
import { DirectoryNode } from "../model/directory.types";
import {
  formatBytes,
  formatPercent,
  percentOf,
} from "../../../shared/lib/format";
import { EmptyState } from "../../../shared/components/EmptyState";
import { Icon } from "../../../shared/ui/Icon";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";

const colors = [
  "#60A5FA",
  "#A78BFA",
  "#2DD4BF",
  "#FBBF24",
  "#FB7185",
  "#94A3B8",
];
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
  let offset = 0;
  const gradient = parts
    .map((part, i) => {
      const start = offset;
      offset += percentOf(part.size, total);
      return `${colors[i]} ${start}% ${offset}%`;
    })
    .join(", ");
  return (
    <section className="distribution-card" aria-labelledby="distribution-title">
      <div className="card-heading">
        <div>
          <span className="eyebrow">{t("distribution.eyebrow")}</span>
          <h3 id="distribution-title">{t("distribution.title")}</h3>
        </div>
        <span className="subtle-badge">
          {node.partial ? t("distribution.partial") : t("distribution.logical")}
        </span>
      </div>
      {total === 0 ? (
        <EmptyState
          title={t("distribution.emptyTitle")}
          description={t("distribution.emptyDescription")}
          icon={<Icon name="grid" size={28} />}
        />
      ) : (
        <div className="distribution-content">
          <figure
            className="donut-figure"
            aria-label={t("distribution.figureLabel", {
              name: node.name,
              size: formatBytes(total),
            })}
          >
            <div
              className="donut"
              style={{ background: `conic-gradient(${gradient})` }}
              aria-hidden="true"
            >
              <div className="donut-center">
                <span>{formatBytes(total)}</span>
                <small>{t("distribution.inThisFolder")}</small>
              </div>
            </div>
          </figure>
          <div className="chart-legend">
            {parts.map((part, i) => (
              <div
                className="legend-item"
                key={part.node?.absolutePath ?? "other"}
              >
                <span
                  className="legend-dot"
                  style={{ background: colors[i] }}
                  aria-hidden="true"
                />
                <div className="legend-label">
                  {part.node ? (
                    <button
                      onClick={() => onSelect(part.node!)}
                      title={part.name}
                    >
                      {part.name}
                    </button>
                  ) : (
                    <span>{part.name}</span>
                  )}
                  <span className="legend-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${percentOf(part.size, total)}%`,
                        background: colors[i],
                      }}
                    />
                  </span>
                </div>
                <span className="legend-value">
                  {formatBytes(part.size)}
                  <small>{formatPercent(percentOf(part.size, total))}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
