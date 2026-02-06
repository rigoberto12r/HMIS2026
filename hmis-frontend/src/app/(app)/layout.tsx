'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/ui/sidebar';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Bell, Search } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, loadUser, user } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-500">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar />

      {/* Main content area */}
      <div
        className={cn(
          'transition-[margin-left] duration-200 ease-in-out min-h-screen',
          'lg:ml-64',
          sidebarCollapsed && 'lg:ml-[68px]'
        )}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-neutral-200/60 h-16">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            {/* Search bar */}
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar pacientes, citas, documentos..."
                className="form-input pl-9 bg-neutral-50 border-neutral-200 text-sm"
                aria-label="Busqueda global"
              />
            </div>

            {/* Right section */}
            <div className="flex items-center gap-3 ml-auto">
              {/* Notifications */}
              <button
                className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                aria-label="Notificaciones"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-medical-red rounded-full" />
              </button>

              {/* User avatar */}
              {user && (
                <div className="flex items-center gap-2.5 pl-3 border-l border-neutral-200">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-xs font-semibold text-primary-600">
                      {user.first_name?.[0]}
                      {user.last_name?.[0]}
                    </span>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium text-neutral-800 leading-tight">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-2xs text-neutral-400">{user.role}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
