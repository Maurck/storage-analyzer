import { useCallback } from "react";
import { AppError } from "../lib/http";
import { formatNumber } from "../lib/format";
import { LanguageContextValue, useTranslation } from "./LanguageProvider";
import { TranslationKey } from "./translations";

function formatParams(params?: Record<string, number> | null) {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).map(([name, value]) => [name, formatNumber(value)]),
  );
}

/**
 * Words a coded message in the reader's language. The backend's English text is
 * never shown: a code this interface does not know gets `fallback` instead.
 */
export function describeCode(
  { t, has }: Pick<LanguageContextValue, "t" | "has">,
  prefix: "api" | "scanError" | "nodeIssue",
  code: string | null | undefined,
  fallback: TranslationKey,
  params?: Record<string, number> | null,
): string {
  const key = code ? `${prefix}.${code}` : "";
  return has(key) ? t(key, formatParams(params)) : t(fallback);
}

/** Turns an error into a sentence in the reader's language. */
export function useErrorMessage() {
  const i18n = useTranslation();
  return useCallback(
    (error: unknown): string => {
      const { t, has } = i18n;
      if (error instanceof AppError) {
        if (error.apiCode) {
          return describeCode(
            i18n,
            "api",
            error.apiCode,
            "error.unknownService",
          );
        }
        const key = error.code ? `error.${error.code}` : "";
        if (has(key)) return t(key);
        // A backend answer without a code comes from an older service.
        return error.status > 0
          ? t("error.unknownService")
          : t("error.unknown");
      }
      return t("error.unknown");
    },
    [i18n],
  );
}
