'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, ...props }, ref) => {
    const id = props.id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={id}
          className={cn(
            'flex min-h-[80px] w-full rounded-lg border border-surface-300 dark:border-surface-600',
            'bg-white dark:bg-surface-100 px-3 py-2 text-sm',
            'placeholder:text-surface-400 dark:placeholder:text-surface-500',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-50 dark:disabled:bg-surface-200',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          {...props}
        />

        {error && (
          <p id={`${id}-error`} className="mt-1.5 text-xs text-red-500">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={`${id}-helper`} className="mt-1.5 text-xs text-surface-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
