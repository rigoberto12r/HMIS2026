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

  // Skip layout for login/register pages
  const isAuthPage = pathname?.includes('/login') || pathname?.includes('/register');

  useEffect(() => {
    if (!isAuthPage) {
      // Check authentication
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Mobile menu backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r border-neutral-200 transition-transform duration-200 ease-in-out',
          'lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-200">
            <Link href="/portal/dashboard" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-neutral-900 text-base">Patient Portal</h1>
                <p className="text-xs text-neutral-500">HMIS Health</p>
              </div>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-2 hover:bg-neutral-100 rounded-lg"
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
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
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
          <div className="p-3 border-t border-neutral-200">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{patientName}</p>
                <p className="text-xs text-neutral-500">Patient Account</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-neutral-200/60 h-16">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-neutral-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="lg:hidden" />

            <div className="flex items-center gap-3">
              <button
                className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>

        {/* Footer */}
        <footer className="border-t border-neutral-200 py-6 px-4 lg:px-6 mt-12">
          <div className="text-center text-sm text-neutral-500">
            <p>
              HMIS Patient Portal - For medical emergencies, call{' '}
              <a href="tel:911" className="font-semibold text-blue-600 hover:underline">
                911
              </a>
            </p>
            <p className="text-xs mt-1 text-neutral-400">
              Secure health information system - HIPAA compliant
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
