'use client';

import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun, Monitor } from 'lucide-react';

/**
 * 🎨 Premium Theme Toggle Component
 *
 * Features:
 * - 3 modes: Light, Dark, System
 * - Smooth transitions
 * - Visual feedback
 * - Keyboard accessible
 *
 * Usage:
 * ```tsx
 * import { ThemeToggle } from '@/components/ui/ThemeToggle';
 *
 * <ThemeToggle />
 * ```
 */

interface ThemeOption {
  value: 'light' | 'dark' | 'system';
  label: string;
  icon: React.ReactNode;
}

const themeOptions: ThemeOption[] = [
  {
    value: 'light',
    label: 'Claro',
    icon: <Sun className="w-4 h-4" />,
  },
  {
    value: 'dark',
    label: 'Oscuro',
    icon: <Moon className="w-4 h-4" />,
  },
  {
    value: 'system',
    label: 'Sistema',
    icon: <Monitor className="w-4 h-4" />,
  },
];

export function ThemeToggle() {
  const { theme, setTheme, isTransitioning } = useTheme();

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-surface-100 dark:bg-surface-100">
      {themeOptions.map((option) => {
        const isActive = theme === option.value;

        return (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            disabled={isTransitioning}
            className={`
              relative flex items-center gap-2 px-3 py-1.5 rounded-md
              text-sm font-medium transition-all duration-200
              ${
                isActive
                  ? 'bg-white dark:bg-surface-200 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
              }
              ${isTransitioning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-100
            `}
            aria-label={`Cambiar a tema ${option.label.toLowerCase()}`}
            aria-pressed={isActive}
          >
            {option.icon}
            <span className="hidden sm:inline">{option.label}</span>

            {/* Active indicator */}
            {isActive && (
              <span className="absolute inset-0 rounded-md ring-1 ring-primary-400/20 dark:ring-primary-500/20" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 🎨 Simple Toggle Button (Light/Dark only)
 *
 * Usage:
 * ```tsx
 * import { ThemeToggleSimple } from '@/components/ui/ThemeToggle';
 *
 * <ThemeToggleSimple />
 * ```
 */
export function ThemeToggleSimple() {
  const { resolved, toggleTheme, isTransitioning } = useTheme();
  const isDark = resolved === 'dark';

  return (
    <button
      onClick={toggleTheme}
      disabled={isTransitioning}
      className={`
        relative p-2 rounded-lg
        bg-surface-100 dark:bg-surface-100
        text-surface-600 dark:text-surface-400
        hover:text-surface-900 dark:hover:text-surface-100
        transition-all duration-200
        ${isTransitioning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-50
      `}
      aria-label={`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

/**
 * 🎨 Dropdown Theme Selector
 *
 * Usage:
 * ```tsx
 * import { ThemeSelector } from '@/components/ui/ThemeToggle';
 *
 * <ThemeSelector />
 * ```
 */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-2">
      <label
        htmlFor="theme-select"
        className="block text-sm font-medium text-surface-700 dark:text-surface-300"
      >
        Tema de la aplicación
      </label>
      <select
        id="theme-select"
        value={theme}
        onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
        className="
          w-full px-3 py-2 rounded-lg
          bg-white dark:bg-surface-100
          border border-surface-300 dark:border-surface-600
          text-surface-900 dark:text-surface-100
          focus:border-primary-500 focus:ring-1 focus:ring-primary-500
          transition-all duration-200
        "
      >
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
        <option value="system">Automático (según sistema)</option>
      </select>
      <p className="text-xs text-surface-500 dark:text-surface-400">
        El modo oscuro reduce la fatiga visual durante largas jornadas
      </p>
    </div>
  );
}
