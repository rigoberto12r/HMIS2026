'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
      <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-200/60">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
            <Heart className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="text-base font-bold text-neutral-900 block truncate">HMIS</span>
              <span className="text-2xs text-neutral-400 block">Gestion Hospitalaria</span>
            </div>
          )}
        </Link>
        {/* Collapse button (desktop) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex w-7 h-7 items-center justify-center rounded-md hover:bg-neutral-100 text-neutral-400"
          aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
        >
          <ChevronLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
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
      <div className="border-t border-neutral-200/60 p-3">
        {user && !collapsed && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-neutral-800 truncate">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-xs text-neutral-400 truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            'nav-link w-full text-neutral-500 hover:text-medical-red hover:bg-red-50',
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
        className="lg:hidden fixed top-3 left-3 z-40 w-10 h-10 flex items-center justify-center rounded-lg bg-white shadow-md text-neutral-600"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-sidebar',
          'transform transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-md hover:bg-neutral-100 text-neutral-400"
          aria-label="Cerrar menu"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 bg-white border-r border-neutral-200 shadow-sidebar',
          'transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-[68px]' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
