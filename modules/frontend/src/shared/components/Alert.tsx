import React, { HTMLAttributes } from "react";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { useTranslation } from "../i18n/LanguageProvider";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "warning" | "error" | "success";
  title?: string;
  /** Offers a close button. The room the alert took goes back to the page. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function Alert({
  variant = "info",
  title,
  onDismiss,
  dismissLabel,
  children,
  className = "",
  ...props
}: AlertProps) {
  const { t } = useTranslation();
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      {...props}
      className={`sa-alert sa-alert--${variant}${
        onDismiss ? " sa-alert--dismissible" : ""
      } ${className}`.trim()}
    >
      <Icon
        name={
          variant === "success"
            ? "check"
            : variant === "info"
              ? "info"
              : "alert"
        }
      />
      <div className="sa-alert__content">
        {title && <p className="sa-alert__title">{title}</p>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <IconButton
          size="sm"
          className="sa-alert__dismiss"
          label={dismissLabel ?? t("common.dismiss")}
          onClick={onDismiss}
          icon={<Icon name="close" size={16} />}
        />
      )}
    </div>
  );
}
