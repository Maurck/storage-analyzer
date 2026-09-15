import React from 'react';

export interface SpinnerProps {
  label?: string;
  className?: string;
}

export function Spinner({ label = 'Loading', className = '' }: SpinnerProps) {
  return (
    <span className={`sa-spinner ${className}`.trim()} role="status" aria-live="polite">
      <span className="sa-spinner__ring" aria-hidden="true" />
      <span className="sa-sr-only">{label}</span>
    </span>
  );
}
