import React from "react";
import { FileFacts } from "../model/directory.types";
import { formatDate, formatDateTime } from "../../../shared/lib/format";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";

/**
 * The date a file was last written, in the regional format. An unknown date
 * says so, and a date after the analysis is marked rather than trusted.
 */
export function ModifiedDate({
  file,
  analyzedAt,
  withTime = false,
}: {
  file: FileFacts;
  analyzedAt: string;
  withTime?: boolean;
}) {
  const { t } = useTranslation();
  if (!file.lastModified) return <>{t("date.unknown")}</>;
  const future = Date.parse(file.lastModified) > Date.parse(analyzedAt);
  return (
    <>
      <time dateTime={file.lastModified}>
        {withTime
          ? formatDateTime(file.lastModified)
          : formatDate(file.lastModified)}
      </time>
      {future && <span className="date-flag"> · {t("date.future")}</span>}
    </>
  );
}

/** The category of a file, and its extension when it has one. */
export function useFileType() {
  const { t } = useTranslation();
  return (file: FileFacts) =>
    !file.category
      ? ""
      : file.extension
        ? t("category.withExtension", {
            category: t(`category.${file.category}`),
            extension: file.extension,
          })
        : t(`category.${file.category}`);
}
