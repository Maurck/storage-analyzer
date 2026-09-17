import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { useTranslation } from "../i18n/LanguageProvider";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      loadingLabel,
      disabled,
      className = "",
      type = "button",
      children,
      ...props
    },
    ref,
  ) {
    const { t } = useTranslation();
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={`sa-button sa-button--${variant} sa-button--${size} ${className}`.trim()}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
      >
        {loading && <span className="sa-spinner__ring" aria-hidden="true" />}
        <span className="sa-button__content">{children}</span>
        <span className="sa-sr-only" role="status" aria-live="polite">
          {loading ? (loadingLabel ?? t("common.loading")) : ""}
        </span>
      </button>
    );
  },
);
