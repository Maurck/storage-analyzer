import React from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { EmptyState, EmptyStateProps } from "./EmptyState";

export interface ErrorStateProps extends EmptyStateProps {
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  onRetry,
  retryLabel = "Try again",
  action,
  icon = <Icon name="alert" size={24} />,
  className = "",
  ...props
}: ErrorStateProps) {
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
              {retryLabel}
            </Button>
          ))
        }
      />
    </div>
  );
}
