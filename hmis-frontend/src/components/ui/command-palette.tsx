'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Search,
  Users,
  CalendarDays,
  FileText,
  Receipt,
  Pill,
  Settings,
  LayoutDashboard,
  ArrowRight,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  group: string;
}

const commands: CommandItem[] = [
  { id: 'dashboard', label: 'Panel Principal', icon: LayoutDashboard, href: '/dashboard', group: 'Navegacion' },
  { id: 'patients', label: 'Pacientes', icon: Users, href: '/patients', group: 'Navegacion' },
  { id: 'appointments', label: 'Citas', icon: CalendarDays, href: '/appointments', group: 'Navegacion' },
  { id: 'emr', label: 'Historia Clinica', icon: FileText, href: '/emr', group: 'Navegacion' },
  { id: 'billing', label: 'Facturacion', icon: Receipt, href: '/billing', group: 'Navegacion' },
  { id: 'pharmacy', label: 'Farmacia', icon: Pill, href: '/pharmacy', group: 'Navegacion' },
  { id: 'settings', label: 'Configuracion', icon: Settings, href: '/settings', group: 'Navegacion' },
  { id: 'new-patient', label: 'Nuevo Paciente', icon: Users, href: '/patients?action=new', group: 'Acciones' },
  { id: 'new-appointment', label: 'Nueva Cita', icon: CalendarDays, href: '/appointments?action=new', group: 'Acciones' },
  { id: 'new-invoice', label: 'Nueva Factura', icon: Receipt, href: '/billing?action=new', group: 'Acciones' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  const filtered = query
    ? commands.filter((cmd) =>
        cmd.label.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const groups = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const flatList = Object.values(groups).flat();

  const handleSelect = useCallback((item: CommandItem) => {
    setOpen(false);
    router.push(item.href);
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatList[selectedIndex]) {
      e.preventDefault();
      handleSelect(flatList[selectedIndex]);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
            <motion.div
              className="w-full max-w-lg bg-white dark:bg-surface-100 rounded-xl shadow-2xl border border-surface-200 dark:border-surface-700 overflow-hidden"
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 border-b border-surface-200 dark:border-surface-700">
                <Search className="w-4 h-4 text-surface-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Buscar pacientes, citas, acciones..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  className="flex-1 py-3.5 text-sm bg-transparent outline-none text-surface-800 dark:text-surface-200 placeholder:text-surface-400"
                />
                <kbd className="hidden sm:inline-flex text-2xs px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-200 text-surface-400 border border-surface-200 dark:border-surface-600">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[300px] overflow-y-auto py-2">
                {flatList.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-surface-500">
                    No se encontraron resultados
                  </p>
                ) : (
                  Object.entries(groups).map(([group, items]) => (
                    <div key={group}>
                      <p className="px-4 py-1.5 text-2xs font-semibold text-surface-400 uppercase tracking-wider">
                        {group}
                      </p>
                      {items.map((item) => {
                        const Icon = item.icon;
                        const idx = flatList.indexOf(item);
                        const isSelected = idx === selectedIndex;
                        return (
                          <button
                            key={item.id}
                            className={cn(
                              'flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors',
                              isSelected
                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-200'
                            )}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1">{item.label}</span>
                            {isSelected && <ArrowRight className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-4 px-4 py-2 border-t border-surface-200 dark:border-surface-700 text-2xs text-surface-400">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-surface-100 dark:bg-surface-200 border border-surface-200 dark:border-surface-600">↑↓</kbd>
                  navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-surface-100 dark:bg-surface-200 border border-surface-200 dark:border-surface-600">↵</kbd>
                  seleccionar
                </span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export function CommandPaletteTrigger() {
  return (
    <button
      onClick={() => {
        const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true });
        document.dispatchEvent(event);
      }}
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-50 dark:bg-surface-200 border border-surface-200 dark:border-surface-600 text-sm text-surface-400 hover:text-surface-600 hover:border-surface-300 transition-all"
    >
      <Search className="w-3.5 h-3.5" />
      <span>Buscar...</span>
      <kbd className="text-2xs px-1.5 py-0.5 rounded bg-white dark:bg-surface-100 border border-surface-200 dark:border-surface-600 text-surface-400 ml-4">
        Ctrl+K
      </kbd>
    </button>
  );
}
