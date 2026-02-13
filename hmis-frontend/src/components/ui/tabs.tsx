import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

interface TabPanelsProps {
  children: ReactNode;
  activeTab: string;
}

interface TabPanelProps {
  id: string;
  children: ReactNode;
  className?: string;
}

// ─── Tabs Component ─────────────────────────────────────

export function Tabs({
  tabs,
  activeTab: controlledActiveTab,
  onTabChange,
  variant = 'default',
  className,
}: TabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(tabs[0]?.id || '');
  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabClick = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.disabled) return;

    if (onTabChange) {
      onTabChange(tabId);
    } else {
      setInternalActiveTab(tabId);
    }
  };

  const variantStyles = {
    default: {
      container: 'border-b border-surface-200 dark:border-surface-700',
      tab: cn(
        'relative px-4 py-3 text-sm font-medium transition-colors',
        'hover:text-surface-900 dark:hover:text-surface-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none'
      ),
      active: 'text-primary-600 dark:text-primary-400',
      inactive: 'text-surface-500 dark:text-surface-400',
      indicator: 'absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500',
    },
    pills: {
      container: 'bg-surface-100 dark:bg-surface-200 rounded-lg p-1',
      tab: cn(
        'px-4 py-2 text-sm font-medium rounded-md transition-all',
        'hover:bg-surface-200 dark:hover:bg-surface-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        'disabled:opacity-50 disabled:pointer-events-none'
      ),
      active: 'bg-white dark:bg-surface-100 text-primary-600 dark:text-primary-400 shadow-sm',
      inactive: 'text-surface-600 dark:text-surface-400',
      indicator: '',
    },
    underline: {
      container: 'border-b-2 border-surface-100 dark:border-surface-700',
      tab: cn(
        'px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-0.5',
        'hover:text-surface-900 dark:hover:text-surface-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        'disabled:opacity-50 disabled:pointer-events-none'
      ),
      active: 'text-primary-600 dark:text-primary-400 border-primary-500',
      inactive: 'text-surface-500 dark:text-surface-400 border-transparent',
      indicator: '',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={cn('flex gap-1', styles.container, className)} role="tablist">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            onClick={() => handleTabClick(tab.id)}
            disabled={tab.disabled}
            className={cn(
              styles.tab,
              isActive ? styles.active : styles.inactive
            )}
          >
            <span className="flex items-center gap-2">
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span className={cn(
                  'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                  isActive
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'bg-surface-200 dark:bg-surface-600 text-surface-600 dark:text-surface-300'
                )}>
                  {tab.badge}
                </span>
              )}
            </span>
            {variant === 'default' && isActive && (
              <span className={styles.indicator} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Tab Panels Container ───────────────────────────────

export function TabPanels({ children, activeTab }: TabPanelsProps) {
  return <div className="mt-4">{children}</div>;
}

// ─── Tab Panel ──────────────────────────────────────────

export function TabPanel({ id, children, className }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={cn('focus:outline-none', className)}
    >
      {children}
    </div>
  );
}
