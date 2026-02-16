'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const variantStyles = {
  default: 'bg-primary-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
};

const sizeStyles = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant = 'default', size = 'md', showLabel = false, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
      <div className="w-full space-y-1">
        {showLabel && (
          <div className="flex items-center justify-between text-xs text-surface-600 dark:text-surface-400">
            <span>Progress</span>
            <span className="font-medium">{Math.round(percentage)}%</span>
          </div>
        )}
        <div
          ref={ref}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={value}
          className={cn(
            'relative w-full overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700',
            sizeStyles[size],
            className
          )}
          {...props}
        >
          <div
            className={cn(
              'h-full transition-all duration-300 ease-in-out rounded-full',
              variantStyles[variant]
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

Progress.displayName = 'Progress';

export { Progress };
