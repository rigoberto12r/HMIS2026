'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  name?: string;
}

export interface RadioGroupItemProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
  id?: string;
}

const RadioGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
  name?: string;
}>({});

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, name, children, ...props }, ref) => {
    return (
      <RadioGroupContext.Provider value={{ value, onValueChange, name }}>
        <div
          ref={ref}
          className={cn('grid gap-2', className)}
          role="radiogroup"
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);

RadioGroup.displayName = 'RadioGroup';

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value: itemValue, id, children, ...props }, ref) => {
    const { value, onValueChange, name } = React.useContext(RadioGroupContext);
    const inputId = id || `radio-${itemValue}`;
    const isChecked = value === itemValue;

    return (
      <div className="flex items-center space-x-2">
        <input
          ref={ref}
          type="radio"
          id={inputId}
          name={name}
          value={itemValue}
          checked={isChecked}
          onChange={(e) => {
            if (e.target.checked && onValueChange) {
              onValueChange(itemValue);
            }
          }}
          className={cn(
            'h-4 w-4 rounded-full border border-surface-300 text-primary-600',
            'focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          {...props}
        />
        {children}
      </div>
    );
  }
);

RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
