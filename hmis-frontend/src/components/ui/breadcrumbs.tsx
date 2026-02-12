'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const labelMap: Record<string, string> = {
  dashboard: 'Panel Principal',
  patients: 'Pacientes',
  appointments: 'Citas',
  emr: 'Historia Clinica',
  billing: 'Facturacion',
  pharmacy: 'Farmacia',
  settings: 'Configuracion',
  reports: 'Reportes',
  portal: 'Portal',
};

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = labelMap[segment] || decodeURIComponent(segment);
    const isLast = index === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-sm', className)}>
      <Link
        href="/dashboard"
        className="text-surface-400 hover:text-primary-500 transition-colors"
        aria-label="Inicio"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5 text-surface-300" />
          {crumb.isLast ? (
            <span className="text-surface-700 dark:text-surface-300 font-medium">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-surface-400 hover:text-primary-500 transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
