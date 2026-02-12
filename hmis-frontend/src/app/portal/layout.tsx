'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Calendar,
  FileText,
  Pill,
  DollarSign,
  User,
  LogOut,
  Menu,
  X,
  Heart,
  Bell,
  Home,
  Activity,
} from 'lucide-react';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [patientName, setPatientName] = useState('');

  const isAuthPage = pathname?.includes('/login') || pathname?.includes('/register');

  useEffect(() => {
    if (!isAuthPage) {
      const token = localStorage.getItem('portal_access_token');
      const name = localStorage.getItem('patient_name');

      if (!token) {
        router.replace('/portal/login');
      } else {
        setPatientName(name || 'Patient');
      }
    }
  }, [router, isAuthPage]);

  const handleLogout = () => {
    localStorage.removeItem('portal_access_token');
    localStorage.removeItem('portal_refresh_token');
    localStorage.removeItem('patient_name');
    localStorage.removeItem('patient_id');
    router.push('/portal/login');
  };

  if (isAuthPage) {
    return children;
  }

  const navItems = [
    { name: 'Dashboard', href: '/portal/dashboard', icon: Home },
    { name: 'Appointments', href: '/portal/appointments', icon: Calendar },
    { name: 'Medical Records', href: '/portal/medical-records', icon: FileText },
    { name: 'Prescriptions', href: '/portal/prescriptions', icon: Pill },
    { name: 'Lab Results', href: '/portal/lab-results', icon: Activity },
    { name: 'Billing', href: '/portal/billing', icon: DollarSign },
    { name: 'Profile', href: '/portal/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Mobile menu backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-64 bg-gradient-to-b from-primary-800 via-primary-900 to-indigo-950 transition-transform duration-200 ease-in-out',
          'lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
            <Link href="/portal/dashboard" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-accent-400 to-accent-600 rounded-xl flex items-center justify-center shadow-lg shadow-accent-500/25">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white text-base">Patient Portal</h1>
                <p className="text-xs text-white/40">HMIS Health</p>
              </div>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-2 hover:bg-white/10 rounded-lg text-white/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-white/15 text-white'
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                      )}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="relative">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-accent-400 rounded-full border-2 border-indigo-900" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{patientName}</p>
                <p className="text-xs text-white/40">Patient Account</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/40 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64 min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 glass-strong h-16 border-b border-surface-200/60">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-surface-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="lg:hidden" />

            <div className="flex items-center gap-3">
              <button
                className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-100 text-surface-500 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>

        {/* Footer */}
        <footer className="border-t border-surface-200 py-6 px-4 lg:px-6 mt-12">
          <div className="text-center text-sm text-surface-500">
            <p>
              HMIS Patient Portal - For medical emergencies, call{' '}
              <a href="tel:911" className="font-semibold text-primary-500 hover:underline">
                911
              </a>
            </p>
            <p className="text-xs mt-1 text-surface-400">
              Secure health information system - HIPAA compliant
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
