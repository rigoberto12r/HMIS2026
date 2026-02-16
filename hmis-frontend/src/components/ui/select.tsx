'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  onValueChange?: (value: string) => void; // Radix UI-style compatibility
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, children, onValueChange, onChange, ...props }, ref) => {
    const id = props.id || props.name;

    // Handle both native onChange and Radix-style onValueChange
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onChange) {
        onChange(e);
      }
      if (onValueChange) {
        onValueChange(e.target.value);
      }
    };

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
          onChange={handleChange}
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

// ─── Radix-style Select Components (for compatibility) ───

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

interface SelectValueProps {
  placeholder?: string;
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-lg border border-surface-300',
          'bg-white dark:bg-surface-100 px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:border-surface-600',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

SelectTrigger.displayName = 'SelectTrigger';

function SelectValue({ placeholder }: SelectValueProps) {
  return <span className="text-surface-500">{placeholder}</span>;
}

function SelectContent({ children, className }: SelectContentProps) {
  return (
    <div
      className={cn(
        'relative z-50 min-w-[8rem] overflow-hidden rounded-lg border border-surface-200',
        'bg-white dark:bg-surface-100 text-surface-900 shadow-md',
        'dark:border-surface-700',
        className
      )}
    >
      <div className="p-1">{children}</div>
    </div>
  );
}

function SelectItem({ value, children, className }: SelectItemProps) {
  return (
    <div
      data-value={value}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm',
        'outline-none hover:bg-surface-100 dark:hover:bg-surface-200',
        'focus:bg-surface-100 dark:focus:bg-surface-200',
        className
      )}
    >
      {children}
    </div>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
