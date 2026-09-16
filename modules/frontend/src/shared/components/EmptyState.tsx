import React, { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`sa-state ${className}`.trim()}>
      {icon && (
        <div className="sa-state__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className="sa-state__copy">
        <h2 className="sa-state__title">{title}</h2>
        <p className="sa-state__description">{description}</p>
      </div>
      {action && <div className="sa-state__action">{action}</div>}
    </div>
  );
}
