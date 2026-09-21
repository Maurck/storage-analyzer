import React from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { EmptyState, EmptyStateProps } from "./EmptyState";
import { useTranslation } from "../i18n/LanguageProvider";

export interface ErrorStateProps extends EmptyStateProps {
  onRetry?: () => void;
  retryLabel?: string;
  /** Offers a close button. The room the error took goes back to the page. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function ErrorState({
  onRetry,
  retryLabel,
  onDismiss,
  dismissLabel,
  action,
  icon = <Icon name="alert" size={24} />,
  className = "",
  ...props
}: ErrorStateProps) {
  const { t } = useTranslation();
  const label = retryLabel ?? t("error.tryAgain");
  return (
    <div role="alert" className={onDismiss ? "sa-state-shell" : undefined}>
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
      {/* In the corner, out of the flow: the message keeps the height it has
          with no close button, so offering one moves nothing. */}
      {onDismiss && (
        <IconButton
          size="sm"
          className="sa-state__dismiss"
          label={dismissLabel ?? t("common.dismiss")}
          onClick={onDismiss}
          icon={<Icon name="close" size={16} />}
        />
      )}
    </div>
  );
}
