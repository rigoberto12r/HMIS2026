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
}

// ─── Styles ─────────────────────────────────────────────

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-100 text-neutral-700',
  primary: 'bg-primary-50 text-primary-700',
  secondary: 'bg-secondary-50 text-secondary-700',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-yellow-50 text-yellow-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  outline: 'bg-transparent border border-neutral-300 text-neutral-600',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-neutral-400',
  primary: 'bg-primary-500',
  secondary: 'bg-secondary-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  outline: 'bg-neutral-400',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-2xs px-1.5 py-0.5',
  md: 'text-xs px-2.5 py-0.5',
  lg: 'text-sm px-3 py-1',
};

// ─── Component ──────────────────────────────────────────

function Badge({
  className,
  variant = 'default',
  size = 'md',
  dot = false,
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
        <span
          className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColors[variant])}
          aria-hidden="true"
        />
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

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  pendiente: { label: 'Pendiente', variant: 'warning' },
  confirmada: { label: 'Confirmada', variant: 'info' },
  en_progreso: { label: 'En Progreso', variant: 'primary' },
  completada: { label: 'Completada', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'default' },
  pagada: { label: 'Pagada', variant: 'success' },
  vencida: { label: 'Vencida', variant: 'danger' },
  parcial: { label: 'Parcial', variant: 'warning' },
  activo: { label: 'Activo', variant: 'success' },
  inactivo: { label: 'Inactivo', variant: 'default' },
  urgente: { label: 'Urgente', variant: 'danger' },
  dispensada: { label: 'Dispensada', variant: 'success' },
  por_dispensar: { label: 'Por Dispensar', variant: 'warning' },
};

function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || {
    label: status,
    variant: 'default' as BadgeVariant,
  };

  return (
    <Badge variant={config.variant} dot size="md" className={className}>
      {config.label}
    </Badge>
  );
}

export { Badge, StatusBadge };
export type { BadgeProps, BadgeVariant, BadgeSize, StatusBadgeProps };
