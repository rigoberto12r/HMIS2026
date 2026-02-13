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
  Stethoscope,
  Loader2,
} from 'lucide-react';
import { usePatients } from '@/hooks/usePatients';
import type { Appointment, AppointmentsResponse } from '@/hooks/useAppointments';
import type { Invoice, InvoicesResponse } from '@/hooks/useInvoices';
import type { Encounter, EncountersResponse } from '@/hooks/useEncounters';

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  href: string;
  group: string;
  metadata?: string;
}

const navigationCommands: CommandItem[] = [
  { id: 'dashboard', label: 'Panel Principal', icon: LayoutDashboard, href: '/dashboard', group: 'Navegación' },
  { id: 'patients', label: 'Pacientes', icon: Users, href: '/patients', group: 'Navegación' },
  { id: 'appointments', label: 'Citas', icon: CalendarDays, href: '/appointments', group: 'Navegación' },
  { id: 'emr', label: 'Historia Clínica', icon: FileText, href: '/emr', group: 'Navegación' },
  { id: 'billing', label: 'Facturación', icon: Receipt, href: '/billing', group: 'Navegación' },
  { id: 'pharmacy', label: 'Farmacia', icon: Pill, href: '/pharmacy', group: 'Navegación' },
  { id: 'settings', label: 'Configuración', icon: Settings, href: '/settings', group: 'Navegación' },
];

const actionCommands: CommandItem[] = [
  { id: 'new-patient', label: 'Nuevo Paciente', icon: Users, href: '/patients?action=new', group: 'Acciones Rápidas' },
  { id: 'new-appointment', label: 'Nueva Cita', icon: CalendarDays, href: '/appointments?action=new', group: 'Acciones Rápidas' },
  { id: 'new-encounter', label: 'Nueva Consulta', icon: Stethoscope, href: '/emr?action=new', group: 'Acciones Rápidas' },
  { id: 'new-invoice', label: 'Nueva Factura', icon: Receipt, href: '/billing?action=new', group: 'Acciones Rápidas' },
];

// Fuzzy search helper
function fuzzyMatch(text: string, query: string): boolean {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Direct substring match
  if (textLower.includes(queryLower)) return true;

  // Fuzzy match: check if all query chars appear in order
  let textIndex = 0;
  for (const char of queryLower) {
    textIndex = textLower.indexOf(char, textIndex);
    if (textIndex === -1) return false;
    textIndex++;
  }
  return true;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debounce query for API calls (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Data hooks - only fetch when there's a query
  const { data: patientsData, isLoading: patientsLoading } = usePatients(
    { query: debouncedQuery, page_size: 5 },
    { enabled: open && debouncedQuery.length >= 2 }
  );

  // Note: useAppointments doesn't support options parameter yet
  // We'll enable this once the hook is updated
  const appointmentsData: AppointmentsResponse | undefined = undefined as AppointmentsResponse | undefined;
  const appointmentsLoading = false;

  // Disabled for now - can be enabled in future for more comprehensive search
  const invoicesData: InvoicesResponse | undefined = undefined as InvoicesResponse | undefined;
  const invoicesLoading = false;
  const prescriptionsData: { items: any[] } | undefined = undefined as { items: any[] } | undefined;
  const prescriptionsLoading = false;
  const encountersData: EncountersResponse | undefined = undefined as EncountersResponse | undefined;
  const encountersLoading = false;

  const isSearching = patientsLoading || appointmentsLoading || invoicesLoading || prescriptionsLoading || encountersLoading;

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
      setDebouncedQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Build command items from data
  const allCommands: CommandItem[] = [];

  // Always include navigation and actions (filtered by query)
  if (!query || query.length < 2) {
    allCommands.push(...navigationCommands, ...actionCommands);
  } else {
    // Filter navigation/actions by fuzzy match
    const matchedNav = navigationCommands.filter(cmd =>
      fuzzyMatch(cmd.label, query)
    );
    const matchedActions = actionCommands.filter(cmd =>
      fuzzyMatch(cmd.label, query)
    );
    allCommands.push(...matchedNav, ...matchedActions);
  }

  // Add patients
  if (patientsData?.items) {
    const patientCommands: CommandItem[] = patientsData.items.map(patient => ({
      id: `patient-${patient.id}`,
      label: `${patient.first_name} ${patient.last_name}`,
      sublabel: patient.document_number,
      icon: Users,
      href: `/patients/${patient.id}`,
      group: 'Pacientes',
      metadata: `${patient.phone_number || ''} ${patient.email || ''} ${patient.mrn}`,
    }));
    allCommands.push(...patientCommands);
  }

  // Add appointments (if enabled in future)
  if (appointmentsData && appointmentsData.items) {
    const appointmentCommands: CommandItem[] = appointmentsData.items.map((apt: Appointment) => ({
      id: `appointment-${apt.id}`,
      label: apt.patient_name || 'Paciente desconocido',
      sublabel: new Date(apt.appointment_datetime).toLocaleString('es-DO'),
      icon: CalendarDays,
      href: `/appointments/${apt.id}`,
      group: 'Citas',
    }));
    allCommands.push(...appointmentCommands);
  }

  // Add invoices
  if (invoicesData && invoicesData.items) {
    const invoiceCommands: CommandItem[] = invoicesData.items.map((inv: Invoice) => ({
      id: `invoice-${inv.id}`,
      label: inv.invoice_number,
      sublabel: `${inv.customer_name} - ${inv.currency} ${inv.grand_total.toFixed(2)}`,
      icon: Receipt,
      href: `/billing/invoices/${inv.id}`,
      group: 'Facturas',
    }));
    allCommands.push(...invoiceCommands);
  }

  // Add prescriptions
  if (prescriptionsData && prescriptionsData.items) {
    const prescriptionCommands: CommandItem[] = prescriptionsData.items.map((rx: any) => ({
      id: `prescription-${rx.id}`,
      label: `Receta #${rx.id.slice(0, 8)}`,
      sublabel: rx.status,
      icon: Pill,
      href: `/pharmacy/prescriptions/${rx.id}`,
      group: 'Recetas',
    }));
    allCommands.push(...prescriptionCommands);
  }

  // Add encounters
  if (encountersData && encountersData.items) {
    const encounterCommands: CommandItem[] = encountersData.items.map((enc: Encounter) => ({
      id: `encounter-${enc.id}`,
      label: `Consulta - ${enc.patient_name}`,
      sublabel: new Date(enc.start_datetime).toLocaleDateString('es-DO'),
      icon: Stethoscope,
      href: `/emr/encounters/${enc.id}`,
      group: 'Consultas',
    }));
    allCommands.push(...encounterCommands);
  }

  // Group commands
  const groups = allCommands.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const flatList = allCommands;

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
                {isSearching ? (
                  <Loader2 className="w-4 h-4 text-primary-500 animate-spin flex-shrink-0" />
                ) : (
                  <Search className="w-4 h-4 text-surface-400 flex-shrink-0" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Buscar pacientes, citas, órdenes, recetas..."
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
              <div className="max-h-[400px] overflow-y-auto py-2">
                {flatList.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    {isSearching ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                        <p className="text-sm text-surface-500">Buscando...</p>
                      </div>
                    ) : query.length >= 2 ? (
                      <p className="text-sm text-surface-500">No se encontraron resultados</p>
                    ) : (
                      <p className="text-sm text-surface-400">
                        Escribe al menos 2 caracteres para buscar
                      </p>
                    )}
                  </div>
                ) : (
                  Object.entries(groups).map(([group, items]) => (
                    <div key={group} className="mb-1">
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
                              'flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors group',
                              isSelected
                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-200'
                            )}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                          >
                            <div className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                              isSelected
                                ? 'bg-primary-100 dark:bg-primary-900/40'
                                : 'bg-surface-100 dark:bg-surface-200 group-hover:bg-surface-200 dark:group-hover:bg-surface-300'
                            )}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.label}</p>
                              {item.sublabel && (
                                <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                                  {item.sublabel}
                                </p>
                              )}
                            </div>
                            {isSelected && <ArrowRight className="w-4 h-4 flex-shrink-0" />}
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
      className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-xl bg-surface-50 dark:bg-surface-200 border border-surface-200 dark:border-surface-600 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 hover:border-surface-300 dark:hover:border-surface-500 hover:bg-white dark:hover:bg-surface-100 transition-all shadow-sm hover:shadow group"
    >
      <Search className="w-4 h-4 text-surface-400 group-hover:text-primary-500 transition-colors" />
      <span className="font-medium">Buscar pacientes, citas, órdenes...</span>
      <div className="flex items-center gap-1 ml-auto">
        <kbd className="text-2xs px-1.5 py-0.5 rounded bg-white dark:bg-surface-100 border border-surface-200 dark:border-surface-600 text-surface-500 font-mono">
          {typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'}
        </kbd>
        <kbd className="text-2xs px-1.5 py-0.5 rounded bg-white dark:bg-surface-100 border border-surface-200 dark:border-surface-600 text-surface-500 font-mono">
          K
        </kbd>
      </div>
    </button>
  );
}
