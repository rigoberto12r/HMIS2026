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
  tabs?: Tab[]; // Optional for Radix-style usage
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
  // Radix UI-style props (for compatibility)
  children?: ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
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
  children,
  value,
  onValueChange,
  defaultValue,
}: TabsProps) {
  // Support both Radix-style (value/onValueChange) and array-based (activeTab/onTabChange)
  const isRadixStyle = !!children;
  const [internalActiveTab, setInternalActiveTab] = useState(
    defaultValue || value || tabs?.[0]?.id || ''
  );
  const activeTab = value || (controlledActiveTab ?? internalActiveTab);

  const handleTabClick = (tabId: string) => {
    const tab = tabs?.find(t => t.id === tabId);
    if (tab?.disabled) return;

    if (onValueChange) {
      onValueChange(tabId);
    } else if (onTabChange) {
      onTabChange(tabId);
    } else {
      setInternalActiveTab(tabId);
    }
  };

  // For Radix-style usage with children
  if (isRadixStyle) {
    return <div className={className}>{children}</div>;
  }

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
      {tabs?.map((tab) => {
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

// ─── Radix-style Tabs Components (for compatibility) ───

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg bg-surface-100 dark:bg-surface-200 p-1',
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  return (
    <button
      role="tab"
      data-value={value}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5',
        'text-sm font-medium ring-offset-background transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:bg-white data-[state=active]:text-surface-900 data-[state=active]:shadow-sm',
        'dark:data-[state=active]:bg-surface-100',
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  return (
    <div
      role="tabpanel"
      data-value={value}
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        className
      )}
    >
      {children}
    </div>
  );
}
