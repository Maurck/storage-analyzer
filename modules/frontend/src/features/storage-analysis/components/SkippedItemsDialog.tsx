import React, { RefObject, useEffect, useState } from "react";
import { useQuery } from "react-query";
import { getSkipped } from "../api/directory.api";
import { ErrorState } from "../../../shared/components/ErrorState";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { IconButton } from "../../../shared/ui/IconButton";
import { Skeleton } from "../../../shared/ui/Skeleton";
import { formatNumber } from "../../../shared/lib/format";
import {
  describeCode,
  useErrorMessage,
} from "../../../shared/i18n/useErrorMessage";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";

const PAGE_SIZE = 100;

interface SkippedItemsDialogProps {
  dialogRef: RefObject<HTMLDialogElement>;
  scanId?: string;
  open: boolean;
  onClose(): void;
}

/** Why a partial analysis is partial: each skipped item with its reason. */
export function SkippedItemsDialog({
  dialogRef,
  scanId,
  open,
  onClose,
}: SkippedItemsDialogProps) {
  const i18n = useTranslation();
  const { t } = i18n;
  const describeError = useErrorMessage();
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [scanId]);
  const query = useQuery(
    ["skipped", scanId, page],
    ({ signal }) => getSkipped(scanId!, page * PAGE_SIZE, PAGE_SIZE, signal),
    { enabled: open && !!scanId, staleTime: Infinity, retry: 1 },
  );
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.recorded / PAGE_SIZE)) : 1;
  const typeLabel = (type: string) =>
    type === "FILE"
      ? t("contents.typeFile")
      : type === "ERROR"
        ? t("contents.typeSkipped")
        : t("contents.typeFolder");

  return (
    <dialog
      ref={dialogRef}
      className="skipped-dialog"
      aria-labelledby="skipped-dialog-title"
      onClose={onClose}
    >
      <div className="dialog-heading">
        <h2 id="skipped-dialog-title">{t("skipped.title")}</h2>
        <IconButton
          label={t("skipped.close")}
          variant="ghost"
          onClick={() => dialogRef.current?.close()}
        >
          <Icon name="close" />
        </IconButton>
      </div>
      <p>{t("skipped.description")}</p>
      {query.isError ? (
        <ErrorState
          title={t("skipped.errorTitle")}
          description={describeError(query.error)}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : !data ? (
        <div className="detail-skeleton" role="status">
          <span className="sr-only">{t("skipped.loading")}</span>
          <Skeleton height={160} />
        </div>
      ) : data.total === 0 ? (
        <p role="status">{t("skipped.empty")}</p>
      ) : (
        <>
          <div className="table-scroll skipped-table">
            <table>
              <caption className="sr-only">{t("skipped.caption")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("skipped.columnItem")}</th>
                  <th scope="col" className="type-column">
                    {t("contents.columnType")}
                  </th>
                  <th scope="col">{t("skipped.columnReason")}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.absolutePath}>
                    <td>
                      <span className="location" title={item.absolutePath}>
                        {item.relativePath || t("skipped.root")}
                      </span>
                    </td>
                    <td className="type-column muted">
                      {typeLabel(item.type)}
                    </td>
                    <td>
                      {describeCode(
                        i18n,
                        "nodeIssue",
                        item.code,
                        "nodeIssue.unknown",
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <span role="status">
              {t("skipped.range", {
                from: formatNumber(data.offset + 1),
                to: formatNumber(data.offset + data.items.length),
                total: formatNumber(data.total),
              })}
            </span>
            {pages > 1 && (
              <nav aria-label={t("contents.pagination")}>
                <IconButton
                  label={t("contents.previousPage")}
                  variant="ghost"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
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
                  onClick={() => setPage(page + 1)}
                >
                  <Icon name="chevron-right" />
                </IconButton>
              </nav>
            )}
          </div>
          {data.recorded < data.total && (
            <p className="muted">
              {t("skipped.truncated", {
                recorded: formatNumber(data.recorded),
                total: formatNumber(data.total),
              })}
            </p>
          )}
        </>
      )}
      <div className="dialog-actions">
        <Button onClick={() => dialogRef.current?.close()}>
          {t("common.close")}
        </Button>
      </div>
    </dialog>
  );
}
