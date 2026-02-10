import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

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
  icon?: LucideIcon;
  iconColor?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  loading?: boolean;
}

function KpiCard({ title, value, change, changeType = 'neutral', icon: Icon, iconColor, variant = 'default', loading }: KpiCardProps) {
  const changeColorMap = {
    positive: 'text-medical-green',
    negative: 'text-medical-red',
    neutral: 'text-neutral-500',
  };

  const variantColorMap = {
    default: 'bg-neutral-50 text-neutral-500',
    primary: 'bg-primary-50 text-primary-500',
    success: 'bg-medical-green/10 text-medical-green',
    warning: 'bg-medical-yellow/10 text-medical-yellow',
    danger: 'bg-medical-red/10 text-medical-red',
  };

  if (loading) {
    return (
      <Card className="kpi-card animate-pulse">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="h-4 bg-neutral-200 rounded w-20 mb-2"></div>
            <div className="h-8 bg-neutral-200 rounded w-16"></div>
          </div>
          <div className="w-11 h-11 bg-neutral-200 rounded-lg"></div>
        </div>
      </Card>
    );
  }

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
        {Icon && (
          <div
            className={cn(
              'flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center',
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
