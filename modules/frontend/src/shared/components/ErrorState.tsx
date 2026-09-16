import React from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { EmptyState, EmptyStateProps } from "./EmptyState";
import { useTranslation } from "../i18n/LanguageProvider";

export interface ErrorStateProps extends EmptyStateProps {
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  onRetry,
  retryLabel,
  action,
  icon = <Icon name="alert" size={24} />,
  className = "",
  ...props
}: ErrorStateProps) {
  const { t } = useTranslation();
  const label = retryLabel ?? t("error.tryAgain");
  return (
    <div role="alert">
      <EmptyState
        {...props}
        icon={icon}
        className={`sa-state--error ${className}`.trim()}
        action={
          action ||
          (onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              <Icon name="refresh" />
              {label}
            </Button>
          ))
        }
      />
    </div>
  );
}
