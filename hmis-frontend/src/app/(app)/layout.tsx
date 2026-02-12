'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/ui/sidebar';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Bell, Sun, Moon, Search } from 'lucide-react';
import { QueryProvider } from './providers';
import { Toaster } from 'sonner';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { CommandPaletteTrigger } from '@/components/ui/command-palette';
import { useTheme } from '@/hooks/useTheme';
import { MotionPage } from '@/components/ui/motion';

const CommandPalette = dynamic(
  () => import('@/components/ui/command-palette').then((m) => m.CommandPalette),
  { ssr: false }
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, loadUser, user } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { resolved: theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Listen to sidebar collapse state
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const sidebar = document.querySelector('aside[class*="lg:flex"]');
      if (sidebar) {
        setSidebarCollapsed(sidebar.classList.contains('w-[68px]'));
      }
    });

    const sidebar = document.querySelector('aside[class*="lg:flex"]');
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }

    return () => observer.disconnect();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-surface-500">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryProvider>
      <div className="min-h-screen bg-surface-50 dark:bg-surface-50">
        <Sidebar />
        <CommandPalette />

        {/* Main content area */}
        <div
          className={cn(
            'transition-[margin-left] duration-200 ease-in-out min-h-screen',
            'lg:ml-64',
            sidebarCollapsed && 'lg:ml-[68px]'
          )}
        >
          {/* Top bar */}
          <header className="sticky top-0 z-20 glass-strong h-16 border-b border-surface-200/60 dark:border-surface-700/60">
            <div className="flex items-center justify-between h-full px-4 lg:px-6 pl-16 lg:pl-6">
              {/* Left: Breadcrumbs + Search trigger */}
              <div className="flex items-center gap-4">
                <Breadcrumbs className="hidden md:flex" />
                <CommandPaletteTrigger />
              </div>

              {/* Right section */}
              <div className="flex items-center gap-2 ml-auto">
                {/* Theme toggle */}
                <button
                  onClick={toggleTheme}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-100 dark:hover:bg-surface-200 text-surface-500 transition-colors"
                  aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4.5 h-4.5" />
                  ) : (
                    <Moon className="w-4.5 h-4.5" />
                  )}
                </button>

                {/* Notifications */}
                <button
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-100 dark:hover:bg-surface-200 text-surface-500 transition-colors"
                  aria-label="Notificaciones"
                >
                  <Bell className="w-4.5 h-4.5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-surface-100" />
                </button>

                {/* User avatar */}
                {user && (
                  <div className="flex items-center gap-2.5 pl-3 ml-1 border-l border-surface-200 dark:border-surface-700">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                        <span className="text-xs font-semibold text-white">
                          {user.first_name?.[0]}
                          {user.last_name?.[0]}
                        </span>
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-accent-400 rounded-full border-2 border-white dark:border-surface-100" />
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200 leading-tight">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-2xs text-surface-400">{user.role}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="p-4 lg:p-6">
            <MotionPage>{children}</MotionPage>
          </main>
        </div>
      </div>
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={4000}
        toastOptions={{
          className: 'dark:bg-surface-100 dark:text-surface-200 dark:border-surface-700',
        }}
      />
    </QueryProvider>
  );
}
