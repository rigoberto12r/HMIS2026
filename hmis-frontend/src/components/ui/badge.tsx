import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline';

type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
}

// ─── Styles ─────────────────────────────────────────────

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300',
  primary: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  secondary: 'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300',
  success: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  warning: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  outline: 'bg-transparent border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-400',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-surface-400',
  primary: 'bg-primary-500',
  secondary: 'bg-accent-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  outline: 'bg-surface-400',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-2xs px-2 py-0.5',
  md: 'text-xs px-3 py-0.5',
  lg: 'text-sm px-3.5 py-1',
};

// ─── Component ──────────────────────────────────────────

function Badge({
  className,
  variant = 'default',
  size = 'md',
  dot = false,
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className="relative flex-shrink-0" aria-hidden="true">
          <span
            className={cn('w-1.5 h-1.5 rounded-full block', dotColors[variant])}
          />
          {pulse && (
            <span
              className={cn(
                'absolute inset-0 w-1.5 h-1.5 rounded-full animate-ping opacity-75',
                dotColors[variant]
              )}
            />
          )}
        </span>
      )}
      {children}
    </span>
  );
}

// ─── Status Badge (pre-configured for common HMIS statuses) ─

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: BadgeVariant; pulse?: boolean }> = {
  pendiente: { label: 'Pendiente', variant: 'warning' },
  confirmada: { label: 'Confirmada', variant: 'info' },
  en_progreso: { label: 'En Progreso', variant: 'primary', pulse: true },
  completada: { label: 'Completada', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'default' },
  pagada: { label: 'Pagada', variant: 'success' },
  vencida: { label: 'Vencida', variant: 'danger', pulse: true },
  parcial: { label: 'Parcial', variant: 'warning' },
  activo: { label: 'Activo', variant: 'success', pulse: true },
  inactivo: { label: 'Inactivo', variant: 'default' },
  urgente: { label: 'Urgente', variant: 'danger', pulse: true },
  dispensada: { label: 'Dispensada', variant: 'success' },
  por_dispensar: { label: 'Por Dispensar', variant: 'warning' },
};

function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || {
    label: status,
    variant: 'default' as BadgeVariant,
  };

  return (
    <Badge variant={config.variant} dot size="md" pulse={config.pulse} className={className}>
      {config.label}
    </Badge>
  );
}

export { Badge, StatusBadge };
export type { BadgeProps, BadgeVariant, BadgeSize, StatusBadgeProps };
