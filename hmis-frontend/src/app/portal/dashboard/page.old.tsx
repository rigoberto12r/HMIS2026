'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  FileText,
  Pill,
  DollarSign,
  AlertCircle,
  Clock,
  ArrowRight,
  Activity,
} from 'lucide-react';

interface DashboardStats {
  upcoming_appointments_count: number;
  pending_prescriptions_count: number;
  unread_lab_results_count: number;
  outstanding_balance: number;
  last_visit_date: string | null;
}

interface Appointment {
  id: string;
  provider_name: string;
  provider_specialty: string | null;
  scheduled_start: string;
  appointment_type: string;
  status: string;
}

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  created_at: string;
  action_url: string | null;
}

interface DashboardData {
  stats: DashboardStats;
  upcoming_appointments: Appointment[];
  recent_alerts: Alert[];
}

export default function PortalDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('portal_access_token');
      const response = await fetch('http://localhost:8000/api/v1/portal/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load dashboard');

      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-neutral-900 font-medium">Failed to load dashboard</p>
          <p className="text-sm text-neutral-500">{error}</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Upcoming Appointments',
      value: data.stats.upcoming_appointments_count,
      icon: Calendar,
      color: 'blue',
      href: '/portal/appointments',
    },
    {
      title: 'Active Prescriptions',
      value: data.stats.pending_prescriptions_count,
      icon: Pill,
      color: 'purple',
      href: '/portal/prescriptions',
    },
    {
      title: 'Unread Lab Results',
      value: data.stats.unread_lab_results_count,
      icon: Activity,
      color: 'green',
      href: '/portal/lab-results',
    },
    {
      title: 'Outstanding Balance',
      value: `$${data.stats.outstanding_balance.toFixed(2)}`,
      icon: DollarSign,
      color: 'orange',
      href: '/portal/billing',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white">
        <h1 className="text-xl sm:text-2xl font-bold mb-2">Welcome to Your Health Portal</h1>
        <p className="text-blue-100">
          {data.stats.last_visit_date
            ? `Last visit: ${new Date(data.stats.last_visit_date).toLocaleDateString()}`
            : 'Access your medical records, appointments, and more'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Link
            key={stat.title}
            href={stat.href}
            className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-10 h-10 rounded-lg bg-${stat.color}-100 flex items-center justify-center`}
              >
                <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400" />
            </div>
            <p className="text-2xl font-bold text-neutral-900 mb-1">{stat.value}</p>
            <p className="text-sm text-neutral-500">{stat.title}</p>
          </Link>
        ))}
      </div>

      {/* Alerts */}
      {data.recent_alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Recent Alerts</h2>
          <div className="space-y-3">
            {data.recent_alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${
                  alert.severity === 'urgent'
                    ? 'bg-red-50 border-red-200'
                    : alert.severity === 'warning'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle
                    className={`w-5 h-5 flex-shrink-0 ${
                      alert.severity === 'urgent'
                        ? 'text-red-600'
                        : alert.severity === 'warning'
                        ? 'text-yellow-600'
                        : 'text-blue-600'
                    }`}
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-neutral-900 text-sm">{alert.title}</h3>
                    <p className="text-sm text-neutral-600 mt-1">{alert.message}</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Appointments */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Upcoming Appointments</h2>
          <Link
            href="/portal/appointments"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View All
          </Link>
        </div>

        {data.upcoming_appointments.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500">No upcoming appointments</p>
            <Link
              href="/portal/appointments"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2 inline-block"
            >
              Schedule an Appointment
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {data.upcoming_appointments.map((appt) => (
              <div key={appt.id} className="flex items-start gap-4 p-4 rounded-lg bg-neutral-50">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-xs text-blue-600 font-medium">
                    {new Date(appt.scheduled_start).toLocaleDateString('en-US', {
                      month: 'short',
                    })}
                  </span>
                  <span className="text-lg font-bold text-blue-600">
                    {new Date(appt.scheduled_start).getDate()}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-neutral-900">{appt.provider_name}</h3>
                  <p className="text-sm text-neutral-500">
                    {appt.provider_specialty || appt.appointment_type}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm text-neutral-600">
                      {new Date(appt.scheduled_start).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    appt.status === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {appt.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/portal/medical-records"
          className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-md transition-shadow"
        >
          <FileText className="w-8 h-8 text-blue-600 mb-3" />
          <h3 className="font-semibold text-neutral-900 mb-1">Medical Records</h3>
          <p className="text-sm text-neutral-500">View your medical history and records</p>
        </Link>

        <Link
          href="/portal/prescriptions"
          className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-md transition-shadow"
        >
          <Pill className="w-8 h-8 text-purple-600 mb-3" />
          <h3 className="font-semibold text-neutral-900 mb-1">Prescriptions</h3>
          <p className="text-sm text-neutral-500">Manage and refill your prescriptions</p>
        </Link>

        <Link
          href="/portal/billing"
          className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-md transition-shadow"
        >
          <DollarSign className="w-8 h-8 text-green-600 mb-3" />
          <h3 className="font-semibold text-neutral-900 mb-1">Billing</h3>
          <p className="text-sm text-neutral-500">View invoices and payment history</p>
        </Link>
      </div>
    </div>
  );
}
