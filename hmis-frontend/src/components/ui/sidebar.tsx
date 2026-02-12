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
  Heart,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';

// ─── Navigation Items ───────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Panel Principal', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Pacientes', href: '/patients', icon: Users },
  { label: 'Citas', href: '/appointments', icon: CalendarDays },
  { label: 'Historia Clinica', href: '/emr', icon: FileText },
  { label: 'Facturacion', href: '/billing', icon: Receipt },
  { label: 'Farmacia', href: '/pharmacy', icon: Pill },
  { label: 'Configuracion', href: '/settings', icon: Settings },
];

// ─── Sidebar Component ─────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/25">
            <Heart className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="text-base font-bold text-white block truncate">HMIS</span>
              <span className="text-2xs text-white/40 block">Gestion Hospitalaria</span>
            </div>
          )}
        </Link>
        {/* Collapse button (desktop) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex w-7 h-7 items-center justify-center rounded-md hover:bg-white/10 text-white/40 transition-colors"
          aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
        >
          <ChevronLeft className={cn('w-4 h-4 transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Navegacion principal">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'nav-link',
                active && 'nav-link-active',
                collapsed && 'justify-center px-2'
              )}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User info / Logout */}
      <div className="border-t border-white/10 p-3">
        {user && !collapsed && (
          <div className="px-3 py-2 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-white">
                    {user.first_name?.[0]}{user.last_name?.[0]}
                  </span>
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-accent-400 rounded-full border-2 border-indigo-900" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-xs text-white/40 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            'nav-link w-full text-white/40 hover:text-red-300 hover:bg-red-500/10',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Cerrar sesion' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Cerrar sesion</span>}
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
