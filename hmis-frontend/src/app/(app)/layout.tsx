'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/ui/sidebar';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Bell, Sun, Moon, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import { Providers } from '@/lib/providers';
import { Toaster } from 'sonner';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { CommandPaletteTrigger } from '@/components/ui/command-palette';
import { useTheme } from '@/hooks/useTheme';
import { MotionPage } from '@/components/ui/motion';
import { AnimatePresence, motion } from 'framer-motion';

const CommandPalette = dynamic(
  () => import('@/components/ui/command-palette').then((m) => m.CommandPalette),
  { ssr: false }
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, loadUser, user, logout } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { resolved: theme, toggleTheme } = useTheme();

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
    <Providers>
      <div className="min-h-screen bg-surface-50">
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
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-100 dark:hover:bg-surface-200 text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 transition-all"
                  aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                  title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                  {theme === 'dark' ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  )}
                </button>

                {/* Notifications */}
                <div className="relative">
                  <button
                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                    className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-100 dark:hover:bg-surface-200 text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 transition-all"
                    aria-label="Notificaciones"
                  >
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-surface-100 animate-pulse" />
                    <span className="absolute top-1 right-1 px-1 min-w-[18px] h-[18px] text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                      3
                    </span>
                  </button>

                  {/* Notifications dropdown */}
                  <AnimatePresence>
                    {notificationsOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setNotificationsOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-surface-100 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 z-40 overflow-hidden"
                        >
                          <div className="p-4 border-b border-surface-200 dark:border-surface-700">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-surface-800 dark:text-surface-200">
                                Notificaciones
                              </h3>
                              <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                                3 nuevas
                              </span>
                            </div>
                          </div>
                          <div className="max-h-96 overflow-y-auto">
                            <div className="p-3 hover:bg-surface-50 dark:hover:bg-surface-200 border-b border-surface-100 dark:border-surface-700 cursor-pointer transition-colors">
                              <div className="flex gap-3">
                                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                                    Nueva cita agendada
                                  </p>
                                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                                    Juan Pérez - Mañana 10:00 AM
                                  </p>
                                  <p className="text-2xs text-surface-400 mt-1">Hace 5 minutos</p>
                                </div>
                              </div>
                            </div>
                            <div className="p-3 hover:bg-surface-50 dark:hover:bg-surface-200 border-b border-surface-100 dark:border-surface-700 cursor-pointer transition-colors">
                              <div className="flex gap-3">
                                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                                    Resultado de laboratorio listo
                                  </p>
                                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                                    María González - Hemograma completo
                                  </p>
                                  <p className="text-2xs text-surface-400 mt-1">Hace 15 minutos</p>
                                </div>
                              </div>
                            </div>
                            <div className="p-3 hover:bg-surface-50 dark:hover:bg-surface-200 cursor-pointer transition-colors">
                              <div className="flex gap-3">
                                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                                    Medicamento próximo a vencer
                                  </p>
                                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                                    Amoxicilina 500mg - Lote #AB123 vence en 30 días
                                  </p>
                                  <p className="text-2xs text-surface-400 mt-1">Hace 2 horas</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 border-t border-surface-200 dark:border-surface-700">
                            <button className="w-full text-center text-sm text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
                              Ver todas las notificaciones
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* User menu */}
                {user && (
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2.5 pl-3 ml-1 border-l border-surface-200 dark:border-surface-700 hover:opacity-80 transition-opacity"
                    >
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center ring-2 ring-white dark:ring-surface-100 shadow-sm">
                          <span className="text-sm font-semibold text-white">
                            {user.first_name?.[0]}
                            {user.last_name?.[0]}
                          </span>
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-accent-400 rounded-full border-2 border-white dark:border-surface-100" />
                      </div>
                      <div className="hidden sm:block text-left">
                        <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 leading-tight">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400 capitalize">
                          {user.role}
                        </p>
                      </div>
                      <ChevronDown className="hidden sm:block w-4 h-4 text-surface-400" />
                    </button>

                    {/* User dropdown */}
                    <AnimatePresence>
                      {userMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setUserMenuOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-surface-100 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 z-40 overflow-hidden"
                          >
                            <div className="p-3 border-b border-surface-200 dark:border-surface-700">
                              <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                                {user.first_name} {user.last_name}
                              </p>
                              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                                {user.email}
                              </p>
                            </div>
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setUserMenuOpen(false);
                                  router.push('/settings/profile');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-200 transition-colors"
                              >
                                <User className="w-4 h-4" />
                                Mi perfil
                              </button>
                              <button
                                onClick={() => {
                                  setUserMenuOpen(false);
                                  router.push('/settings');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-200 transition-colors"
                              >
                                <Settings className="w-4 h-4" />
                                Configuración
                              </button>
                            </div>
                            <div className="border-t border-surface-200 dark:border-surface-700 py-1">
                              <button
                                onClick={() => {
                                  logout();
                                  router.push('/auth/login');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <LogOut className="w-4 h-4" />
                                Cerrar sesión
                              </button>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
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
    </Providers>
  );
}
