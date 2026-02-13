'use client';

import { ThemeToggle, ThemeToggleSimple, ThemeSelector } from '@/components/ui/ThemeToggle';
import { useTheme } from '@/hooks/useTheme';
import {
  Activity,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

/**
 * 🎨 Theme System Showcase
 *
 * Componente de demostración que muestra todas las utilidades del sistema de temas.
 * Útil para:
 * - Verificar que el tema funcione correctamente
 * - Probar nuevas variables CSS
 * - Documentación visual del design system
 *
 * NO incluir en producción - solo para desarrollo.
 */

export function ThemeShowcase() {
  const { theme, resolved, systemTheme, isTransitioning } = useTheme();

  return (
    <div className="min-h-screen bg-body theme-transition p-8 space-y-8">
      {/* Header */}
      <div className="premium-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">
              Theme System Showcase
            </h1>
            <p className="text-secondary mt-1">
              Sistema de temas premium con Dark Mode
            </p>
          </div>
          <ThemeToggleSimple />
        </div>

        {/* Theme info */}
        <div className="glass-card rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-tertiary text-sm">Preferencia:</span>
            <span className="text-primary font-medium">{theme}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-tertiary text-sm">Tema activo:</span>
            <span className="text-primary font-medium">{resolved}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-tertiary text-sm">Sistema:</span>
            <span className="text-primary font-medium">{systemTheme}</span>
          </div>
          {isTransitioning && (
            <div className="flex items-center gap-2 text-accent-500 text-sm">
              <div className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
              Transicionando...
            </div>
          )}
        </div>
      </div>

      {/* Theme Controls */}
      <div className="premium-card">
        <h2 className="text-xl font-semibold text-primary mb-4">
          Controles de Tema
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-secondary mb-2">
              Toggle con 3 opciones
            </h3>
            <ThemeToggle />
          </div>
          <div>
            <h3 className="text-sm font-medium text-secondary mb-2">
              Selector dropdown
            </h3>
            <ThemeSelector />
          </div>
        </div>
      </div>

      {/* Color Palette */}
      <div className="premium-card">
        <h2 className="text-xl font-semibold text-primary mb-4">
          Paleta de Colores
        </h2>

        {/* Primary */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-secondary mb-2">Primary</h3>
          <div className="grid grid-cols-5 gap-2">
            {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
              <div key={shade} className="space-y-1">
                <div
                  className={`h-16 rounded-lg bg-primary-${shade} border border-surface-200 dark:border-surface-700`}
                />
                <p className="text-xs text-tertiary text-center">{shade}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Accent */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-secondary mb-2">Accent</h3>
          <div className="grid grid-cols-5 gap-2">
            {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
              <div key={shade} className="space-y-1">
                <div
                  className={`h-16 rounded-lg bg-accent-${shade} border border-surface-200 dark:border-surface-700`}
                />
                <p className="text-xs text-tertiary text-center">{shade}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Semantic */}
        <div>
          <h3 className="text-sm font-medium text-secondary mb-2">
            Colores Semánticos
          </h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-danger shadow-glow-danger" />
              <p className="text-xs text-tertiary text-center">Danger</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-warning" />
              <p className="text-xs text-tertiary text-center">Warning</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-success shadow-glow-success" />
              <p className="text-xs text-tertiary text-center">Success</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-info" />
              <p className="text-xs text-tertiary text-center">Info</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="premium-card">
        <h2 className="text-xl font-semibold text-primary mb-4">
          KPI Cards (Dashboard Style)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Pacientes"
            value="1,234"
            change="+12%"
            icon={<Users className="w-5 h-5" />}
            color="primary"
          />
          <KPICard
            title="Citas Hoy"
            value="42"
            change="+8%"
            icon={<Calendar className="w-5 h-5" />}
            color="accent"
          />
          <KPICard
            title="Ingresos"
            value="$45,678"
            change="+23%"
            icon={<DollarSign className="w-5 h-5" />}
            color="success"
          />
          <KPICard
            title="Actividad"
            value="89%"
            change="-3%"
            icon={<Activity className="w-5 h-5" />}
            color="warning"
          />
        </div>
      </div>

      {/* Glass Effects */}
      <div className="premium-card">
        <h2 className="text-xl font-semibold text-primary mb-4">
          Glass Effects
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-weak rounded-lg p-6 text-center">
            <h3 className="font-medium text-primary mb-2">Glass Weak</h3>
            <p className="text-sm text-secondary">50% opacity</p>
          </div>
          <div className="glass-medium rounded-lg p-6 text-center">
            <h3 className="font-medium text-primary mb-2">Glass Medium</h3>
            <p className="text-sm text-secondary">70% opacity</p>
          </div>
          <div className="glass-strong rounded-lg p-6 text-center">
            <h3 className="font-medium text-primary mb-2">Glass Strong</h3>
            <p className="text-sm text-secondary">90% opacity</p>
          </div>
        </div>
      </div>

      {/* Gradients */}
      <div className="premium-card">
        <h2 className="text-xl font-semibold text-primary mb-4">Gradientes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gradient-primary rounded-lg p-6 text-white text-center">
            <h3 className="font-medium mb-2">Primary</h3>
            <p className="text-sm opacity-90">Indigo → Violet</p>
          </div>
          <div className="bg-gradient-accent rounded-lg p-6 text-white text-center">
            <h3 className="font-medium mb-2">Accent</h3>
            <p className="text-sm opacity-90">Emerald → Green</p>
          </div>
          <div className="bg-gradient-danger rounded-lg p-6 text-white text-center">
            <h3 className="font-medium mb-2">Danger</h3>
            <p className="text-sm opacity-90">Red gradient</p>
          </div>
          <div className="bg-gradient-success rounded-lg p-6 text-white text-center">
            <h3 className="font-medium mb-2">Success</h3>
            <p className="text-sm opacity-90">Green gradient</p>
          </div>
          <div className="bg-gradient-warning rounded-lg p-6 text-white text-center">
            <h3 className="font-medium mb-2">Warning</h3>
            <p className="text-sm opacity-90">Amber gradient</p>
          </div>
          <div className="bg-gradient-sidebar rounded-lg p-6 text-white text-center">
            <h3 className="font-medium mb-2">Sidebar</h3>
            <p className="text-sm opacity-90">Dark blue</p>
          </div>
        </div>
      </div>

      {/* Text Styles */}
      <div className="premium-card">
        <h2 className="text-xl font-semibold text-primary mb-4">
          Jerarquía de Texto
        </h2>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-tertiary mb-1">text-primary</p>
            <p className="text-primary text-lg">
              Texto principal, alto contraste
            </p>
          </div>
          <div>
            <p className="text-xs text-tertiary mb-1">text-secondary</p>
            <p className="text-secondary text-lg">
              Texto secundario, contraste medio
            </p>
          </div>
          <div>
            <p className="text-xs text-tertiary mb-1">text-tertiary</p>
            <p className="text-tertiary text-lg">Texto apagado, bajo contraste</p>
          </div>
          <div>
            <p className="text-xs text-tertiary mb-1">text-disabled</p>
            <p className="text-disabled text-lg">Texto deshabilitado</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="premium-card">
        <h2 className="text-xl font-semibold text-primary mb-4">
          Alertas y Estados
        </h2>
        <div className="space-y-4">
          <div className="glass-card rounded-lg p-4 flex items-center gap-3 border-l-4 border-l-success">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <p className="text-primary">Todo está funcionando correctamente</p>
          </div>
          <div className="glass-card rounded-lg p-4 flex items-center gap-3 border-l-4 border-l-warning">
            <AlertCircle className="w-5 h-5 text-warning" />
            <p className="text-primary">
              Atención: Algunos pacientes requieren seguimiento
            </p>
          </div>
          <div className="glass-card rounded-lg p-4 flex items-center gap-3 border-l-4 border-l-danger">
            <AlertCircle className="w-5 h-5 text-danger" />
            <p className="text-primary">Error: No se pudo conectar al servidor</p>
          </div>
          <div className="glass-card rounded-lg p-4 flex items-center gap-3 border-l-4 border-l-info">
            <AlertCircle className="w-5 h-5 text-info" />
            <p className="text-primary">
              Información: Nueva actualización disponible
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  color: 'primary' | 'accent' | 'success' | 'warning' | 'danger';
}

function KPICard({ title, value, change, icon, color }: KPICardProps) {
  const isPositive = change.startsWith('+');

  const colorClasses = {
    primary: 'bg-gradient-primary shadow-glow-primary',
    accent: 'bg-gradient-accent shadow-glow-accent',
    success: 'bg-gradient-success shadow-glow-success',
    warning: 'bg-gradient-warning',
    danger: 'bg-gradient-danger shadow-glow-danger',
  };

  return (
    <div className="premium-card group">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-secondary text-sm mb-1">{title}</p>
          <h3 className="text-primary text-2xl font-bold">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl text-white ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            isPositive
              ? 'bg-accent-100 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400'
              : 'bg-danger/10 text-danger'
          }`}
        >
          <TrendingUp
            className={`w-3 h-3 ${isPositive ? '' : 'rotate-180'}`}
          />
          {change}
        </div>
        <span className="text-xs text-tertiary">vs mes anterior</span>
      </div>
    </div>
  );
}
