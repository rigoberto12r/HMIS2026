import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ─── Card ───────────────────────────────────────────────

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

const variantStyles = {
  default: 'bg-white border border-neutral-200 shadow-card',
  bordered: 'bg-white border-2 border-neutral-200',
  elevated: 'bg-white shadow-card-hover',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl',
          variantStyles[variant],
          paddingStyles[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// ─── Card Header ────────────────────────────────────────

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

function CardHeader({ className, title, subtitle, action, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('flex items-start justify-between mb-4', className)}
      {...props}
    >
      <div>
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        {subtitle && (
          <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─── Card Content ───────────────────────────────────────

function CardContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

// ─── Card Footer ────────────────────────────────────────

function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 mt-4 pt-4 border-t border-neutral-100',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: ReactNode;
  iconColor?: string;
}

function KpiCard({ title, value, change, changeType = 'neutral', icon, iconColor }: KpiCardProps) {
  const changeColorMap = {
    positive: 'text-medical-green',
    negative: 'text-medical-red',
    neutral: 'text-neutral-500',
  };

  return (
    <Card className="kpi-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">{value}</p>
          {change && (
            <p className={cn('mt-1 text-xs font-medium', changeColorMap[changeType])}>
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center',
              iconColor || 'bg-primary-50 text-primary-500'
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export { Card, CardHeader, CardContent, CardFooter, KpiCard };
export type { CardProps, CardHeaderProps, KpiCardProps };
