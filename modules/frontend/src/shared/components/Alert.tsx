import React, { HTMLAttributes } from 'react';
import { Icon } from '../ui/Icon';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
}

export function Alert({ variant = 'info', title, children, className = '', ...props }: AlertProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      {...props}
      className={`sa-alert sa-alert--${variant} ${className}`.trim()}
    >
      <Icon name={variant === 'success' ? 'check' : variant === 'info' ? 'info' : 'alert'} />
      <div className="sa-alert__content">
        {title && <p className="sa-alert__title">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
