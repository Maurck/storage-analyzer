import React, { forwardRef, ReactNode } from 'react';
import { Button, ButtonProps } from './Button';

export interface IconButtonProps extends Omit<ButtonProps, 'aria-label'> {
  label: string;
  icon?: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, children, className = '', variant = 'ghost', ...props },
  ref,
) {
  return (
    <Button
      {...props}
      ref={ref}
      variant={variant}
      className={`sa-icon-button ${className}`.trim()}
      aria-label={label}
      title={props.title || label}
    >
      {icon || children}
    </Button>
  );
});
