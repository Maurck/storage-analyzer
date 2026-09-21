import React from "react";
import { FileCategory, TypeBreakdown } from "../model/directory.types";
import {
  formatBytes,
  formatPercent,
  percentOf,
} from "../../../shared/lib/format";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";
import { Button } from "../../../shared/ui/Button";

/** The token of each category's color, so a type reads the same everywhere. */
export const categoryColor = (category: FileCategory) =>
  `var(--chart-${category.toLowerCase().replace("_", "-")})`;

/**
 * The files of the searched scope in one labelled bar, one segment per type.
 * Choosing a segment filters the list below it, the same as the type filter;
 * choosing it again removes that filter. Exact sizes stay in the filter and
 * in the table.
 */
export function TypeDistribution({
  types,
  where,
  failed,
  selected,
  onSelect,
  onRetry,
}: {
  types?: TypeBreakdown;
  /** The scope, as a sentence reads it: "the whole analysis". */
  where: string;
  failed: boolean;
  selected?: FileCategory;
  onSelect(category: FileCategory | undefined): void;
  onRetry(): void;
}) {
  const { t } = useTranslation();
  if (failed && !types)
    return (
      <div className="type-strip-error">
        <span className="muted">{t("types.error")}</span>
        <Button variant="ghost" size="sm" onClick={onRetry}>
          {t("error.tryAgain")}
        </Button>
      </div>
    );
  // Room is kept while the breakdown loads, so the rows do not move.
  if (!types) return <div className="distribution-strip type-strip" />;
  const parts = types.categories.filter((part) => part.sizeBytes > 0);
  // Nothing to compare: the list's own empty state explains it.
  if (types.totalBytes === 0) return null;
  return (
    <figure
      className="distribution-strip type-strip"
      aria-label={t("types.figureLabel", {
        where,
        size: formatBytes(types.totalBytes),
      })}
    >
      <figcaption className="distribution-label" aria-hidden="true">
        <span className="distribution-label__title">{t("types.title")}</span>
        <span className="distribution-label__total">
          {formatBytes(types.totalBytes)}
        </span>
      </figcaption>
      <div className="stacked-bar">
        {parts.map((part) => {
          const name = t(`category.${part.category}`);
          const size = formatBytes(part.sizeBytes);
          const share = formatPercent(
            percentOf(part.sizeBytes, types.totalBytes),
          );
          const chosen = part.category === selected;
          return (
            <button
              key={part.category}
              className={`bar-segment${chosen ? " is-chosen" : ""}${
                selected && !chosen ? " is-dimmed" : ""
              }`}
              style={{
                flexGrow: part.sizeBytes,
                background: categoryColor(part.category),
              }}
              title={`${name} · ${size}`}
              aria-label={t("types.segment", { category: name, size, share })}
              aria-pressed={chosen}
              onClick={() => onSelect(chosen ? undefined : part.category)}
            >
              <span className="bar-segment__label" aria-hidden="true">
                <span className="bar-segment__name">{name}</span>
                <span className="bar-segment__size"> · {size}</span>
                <span className="bar-segment__share">
                  <span className="bar-segment__separator"> · </span>
                  {share}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </figure>
  );
}
