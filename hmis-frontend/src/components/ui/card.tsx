import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

// ─── Card ───────────────────────────────────────────────

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated' | 'glass' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

const variantStyles = {
  default: 'bg-white dark:bg-surface-100 border border-surface-200 dark:border-surface-700 shadow-card',
  bordered: 'bg-white dark:bg-surface-100 border-2 border-surface-200 dark:border-surface-700',
  elevated: 'bg-white dark:bg-surface-100 shadow-card-hover',
  glass: 'glass',
  gradient: 'bg-gradient-to-br from-primary-500/5 via-white to-accent-500/5 dark:from-primary-500/10 dark:via-surface-100 dark:to-accent-500/10 border border-surface-200/60 dark:border-surface-700/60',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl transition-all duration-200',
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
        <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{title}</h3>
        {subtitle && (
          <p className="text-sm text-surface-500 mt-0.5">{subtitle}</p>
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
        'flex items-center justify-end gap-3 mt-4 pt-4 border-t border-surface-100 dark:border-surface-700',
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
  icon?: LucideIcon;
  iconColor?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  loading?: boolean;
}

function KpiCard({ title, value, change, changeType = 'neutral', icon: Icon, iconColor, variant = 'default', loading }: KpiCardProps) {
  const changeColorMap = {
    positive: 'text-accent-600 dark:text-accent-400',
    negative: 'text-red-500',
    neutral: 'text-surface-500',
  };

  const variantColorMap = {
    default: 'bg-surface-50 dark:bg-surface-200 text-surface-500',
    primary: 'bg-primary-50 text-primary-500',
    success: 'bg-accent-50 text-accent-600',
    warning: 'bg-amber-50 text-amber-500',
    danger: 'bg-red-50 text-red-500',
  };

  if (loading) {
    return (
      <Card className="kpi-card">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="h-4 bg-surface-200 rounded w-20 mb-2 shimmer" />
            <div className="h-8 bg-surface-200 rounded w-16 shimmer" />
          </div>
          <div className="w-11 h-11 bg-surface-200 rounded-lg shimmer" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="kpi-card group hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-surface-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-surface-900 dark:text-surface-50 font-display">
            {value}
          </p>
          {change && (
            <p className={cn('mt-1 text-xs font-medium', changeColorMap[changeType])}>
              {change}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              'flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110',
              iconColor || variantColorMap[variant]
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </Card>
  );
}

export { Card, CardHeader, CardContent, CardFooter, KpiCard };
export type { CardProps, CardHeaderProps, KpiCardProps };
