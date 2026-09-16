import { AppError } from "../lib/http";
import { useTranslation } from "./LanguageProvider";
import { TranslationKey } from "./translations";

/**
 * Turns an error into a sentence in the reader's language.
 *
 * Only failures this application words itself carry a code and can be
 * translated. A message relayed by the backend is shown exactly as the service
 * worded it, so localizing those means localizing the Java service too.
 */
export function useErrorMessage() {
  const { t } = useTranslation();
  return (error: unknown): string => {
    if (error instanceof AppError && error.code) {
      return t(`error.${error.code}` as TranslationKey);
    }
    if (error instanceof Error && error.message) return error.message;
    return t("error.unknown");
  };
}
