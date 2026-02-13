'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Users,
  CalendarDays,
  FileText,
  Receipt,
  Pill,
  Settings,
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Heart,
  Stethoscope,
  FlaskConical,
  Image,
  BedDouble,
  Sparkles,
  BarChart3,
  Plug,
  Bell,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';

// ─── Navigation Items ───────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number | string;
  submenu?: SubMenuItem[];
}

interface SubMenuItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard
  },
  {
    label: 'Pacientes',
    href: '/patients',
    icon: Users,
    submenu: [
      { label: 'Lista de Pacientes', href: '/patients' },
      { label: 'Nuevo Paciente', href: '/patients/new' },
      { label: 'Historial Clínico', href: '/patients/history' },
    ]
  },
  {
    label: 'Citas',
    href: '/appointments',
    icon: CalendarDays,
    submenu: [
      { label: 'Agenda', href: '/appointments' },
      { label: 'Nueva Cita', href: '/appointments/new' },
      { label: 'Confirmaciones', href: '/appointments/confirmations' },
    ]
  },
  {
    label: 'Consulta Médica',
    href: '/emr',
    icon: Stethoscope,
    submenu: [
      { label: 'Consulta Actual', href: '/emr' },
      { label: 'Evoluciones', href: '/emr/evolutions' },
      { label: 'Diagnósticos', href: '/emr/diagnoses' },
      { label: 'Órdenes Médicas', href: '/emr/orders' },
      { label: 'Recetas', href: '/emr/prescriptions' },
    ]
  },
  {
    label: 'Laboratorio',
    href: '#',
    icon: FlaskConical,
    badge: 'Próximamente',
    submenu: [
      { label: 'Órdenes', href: '#' },
      { label: 'Resultados', href: '#' },
      { label: 'Valores Críticos', href: '#' },
    ]
  },
  {
    label: 'Imágenes',
    href: '#',
    icon: Image,
    badge: 'Próximamente',
    submenu: [
      { label: 'Solicitudes', href: '#' },
      { label: 'Estudios', href: '#' },
      { label: 'Informes', href: '#' },
    ]
  },
  {
    label: 'Hospitalización',
    href: '#',
    icon: BedDouble,
    badge: 'Próximamente',
    submenu: [
      { label: 'Camas', href: '#' },
      { label: 'Pacientes Ingresados', href: '#' },
      { label: 'Enfermería', href: '#' },
    ]
  },
  {
    label: 'Farmacia',
    href: '/pharmacy',
    icon: Pill,
    submenu: [
      { label: 'Medicamentos', href: '/pharmacy' },
      { label: 'Recetas', href: '/pharmacy/prescriptions' },
      { label: 'Despacho', href: '/pharmacy/dispensation' },
      { label: 'Inventario', href: '/pharmacy/inventory' },
    ]
  },
  {
    label: 'Facturación',
    href: '/billing',
    icon: Receipt,
    submenu: [
      { label: 'Facturas', href: '/billing' },
      { label: 'Caja', href: '/billing/cashier' },
      { label: 'Seguros / ARS', href: '/billing/insurance' },
      { label: 'Reportes', href: '/billing/reports' },
    ]
  },
  {
    label: 'IA Clínica',
    href: '#',
    icon: Sparkles,
    badge: '✨',
    submenu: [
      { label: 'Asistente Médico', href: '#' },
      { label: 'Resúmenes Automáticos', href: '#' },
      { label: 'Alertas Inteligentes', href: '#' },
      { label: 'Calidad Clínica', href: '#' },
    ]
  },
  {
    label: 'Reportes',
    href: '/reports',
    icon: BarChart3,
    submenu: [
      { label: 'Dashboard Ejecutivo', href: '/reports' },
      { label: 'Producción Médica', href: '/reports/medical' },
      { label: 'Finanzas', href: '/reports/finance' },
      { label: 'Indicadores Clínicos', href: '/reports/clinical' },
    ]
  },
  {
    label: 'Integraciones',
    href: '#',
    icon: Plug,
    badge: 'Beta',
    submenu: [
      { label: 'APIs', href: '#' },
      { label: 'Webhooks', href: '#' },
      { label: 'Pagos', href: '#' },
    ]
  },
  {
    label: 'Configuración',
    href: '/settings',
    icon: Settings,
    submenu: [
      { label: 'Usuarios & Roles', href: '/settings/users' },
      { label: 'Catálogos', href: '/settings/catalogs' },
      { label: 'Servicios', href: '/settings/services' },
      { label: 'Tarifas', href: '/settings/rates' },
    ]
  },
];

// ─── Sidebar Component ─────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  function isActive(href: string): boolean {
    if (href === '#') return false;
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  function toggleSubmenu(label: string) {
    setExpandedMenus((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(label)) {
        newSet.delete(label);
      } else {
        newSet.add(label);
      }
      return newSet;
    });
  }

  function isSubmenuActive(item: NavItem): boolean {
    if (!item.submenu) return false;
    return item.submenu.some(sub => sub.href !== '#' && pathname.startsWith(sub.href));
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/25 transition-transform hover:scale-105">
            <Heart className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="text-base font-bold text-white block truncate">HMIS</span>
              <span className="text-2xs text-white/40 block">Gestión Hospitalaria</span>
            </div>
          )}
        </Link>
        {/* Collapse button (desktop) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex w-7 h-7 items-center justify-center rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-all"
          aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
        >
          <ChevronLeft className={cn('w-4 h-4 transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Navegación principal">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const submenuActive = isSubmenuActive(item);
          const isExpanded = expandedMenus.has(item.label);
          const hasSubmenu = item.submenu && item.submenu.length > 0;

          return (
            <div key={item.label}>
              {/* Main nav item */}
              {hasSubmenu && !collapsed ? (
                <button
                  onClick={() => toggleSubmenu(item.label)}
                  className={cn(
                    'nav-link w-full',
                    (active || submenuActive) && 'nav-link-active'
                  )}
                  aria-expanded={isExpanded}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-accent-500/20 text-accent-400 font-medium">
                      {item.badge}
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 flex-shrink-0 transition-transform duration-200',
                      isExpanded && 'rotate-180'
                    )}
                  />
                </button>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    'nav-link',
                    (active || submenuActive) && 'nav-link-active',
                    collapsed && 'justify-center px-2'
                  )}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="text-2xs px-1.5 py-0.5 rounded bg-accent-500/20 text-accent-400 font-medium">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              )}

              {/* Submenu */}
              {hasSubmenu && !collapsed && (
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="ml-8 mt-1 space-y-1 border-l border-white/10 pl-3">
                        {item.submenu!.map((subItem) => {
                          const subActive = subItem.href !== '#' && pathname.startsWith(subItem.href);
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-md text-sm',
                                'text-white/50 hover:text-white hover:bg-white/5',
                                'transition-all duration-200',
                                subActive && 'text-white bg-white/10 font-medium'
                              )}
                              onClick={() => setMobileOpen(false)}
                              aria-current={subActive ? 'page' : undefined}
                            >
                              <span className="truncate">{subItem.label}</span>
                              {subItem.href === '#' && (
                                <span className="text-2xs text-white/30">•••</span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </nav>

      {/* User info / Logout */}
      <div className="border-t border-white/10 p-3">
        {user && !collapsed && (
          <div className="px-3 py-2 mb-2 rounded-lg hover:bg-white/5 transition-colors duration-200">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-md">
                  <span className="text-xs font-bold text-white">
                    {user.first_name?.[0]}{user.last_name?.[0]}
                  </span>
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-accent-400 rounded-full border-2 border-indigo-900 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-xs text-white/50 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}
        {user && collapsed && (
          <div className="flex justify-center mb-2">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-md">
                <span className="text-xs font-bold text-white">
                  {user.first_name?.[0]}{user.last_name?.[0]}
                </span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-accent-400 rounded-full border-2 border-indigo-900 animate-pulse" />
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            'nav-link w-full text-white/50 hover:text-red-300 hover:bg-red-500/10',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Cerrar sesión' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 w-11 h-11 flex items-center justify-center rounded-lg bg-white dark:bg-surface-100 shadow-md text-surface-600 touch-manipulation"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            className="lg:hidden fixed inset-y-0 left-0 z-50 w-64"
            style={{ background: 'var(--gradient-sidebar)' }}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50"
              aria-label="Cerrar menu"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed inset-y-0 left-0 z-30',
          'transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-[68px]' : 'w-64'
        )}
        style={{ background: 'var(--gradient-sidebar)' }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
