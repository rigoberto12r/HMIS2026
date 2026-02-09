'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, children, ...props }, ref) => {
    const id = props.id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-neutral-700 mb-1.5"
          >
            {label}
            {props.required && <span className="text-medical-red ml-1">*</span>}
          </label>
        )}

        <select
          ref={ref}
          id={id}
          className={cn(
            'form-select w-full px-3 py-2 border rounded-lg shadow-sm',
            'text-sm text-neutral-800 bg-white',
            'border-neutral-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
            'disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed',
            error && 'border-medical-red focus:border-medical-red focus:ring-medical-red/20',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          {...props}
        >
          {children}
        </select>

        {error && (
          <p id={`${id}-error`} className="mt-1.5 text-xs text-medical-red">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={`${id}-helper`} className="mt-1.5 text-xs text-neutral-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
