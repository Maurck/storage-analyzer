import React from "react";
import { useTranslation } from "../i18n/LanguageProvider";

export interface SpinnerProps {
  label?: string;
  className?: string;
}

export function Spinner({ label, className = "" }: SpinnerProps) {
  const { t } = useTranslation();
  return (
    <span
      className={`sa-spinner ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span className="sa-spinner__ring" aria-hidden="true" />
      <span className="sa-sr-only">{label ?? t("common.loading")}</span>
    </span>
  );
}
