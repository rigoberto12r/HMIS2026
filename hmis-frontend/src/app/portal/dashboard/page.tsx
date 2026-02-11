/**
 * Patient Portal Dashboard - Refactored with React Query
 * Reduced from 304 lines with manual fetching to clean component
 */

'use client';

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
import { usePortalDashboard } from '@/hooks/usePortalData';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-DO', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
  }).format(amount);
}

const severityColors = {
  high: 'border-red-200 bg-red-50',
  medium: 'border-yellow-200 bg-yellow-50',
  low: 'border-blue-200 bg-blue-50',
};

export default function PortalDashboardPage() {
  const { data, isLoading, error } = usePortalDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-neutral-500">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
          <p className="text-lg font-semibold text-neutral-900">Error al cargar dashboard</p>
          <p className="text-sm text-neutral-500 mt-1">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, upcoming_appointments, recent_alerts } = data;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Mi Portal de Salud</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Accede a tu información médica y gestiona tus citas
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/portal/appointments">
          <Card className="p-5 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Próximas Citas</p>
                <p className="text-3xl font-bold text-neutral-900 mt-1">
                  {stats.upcoming_appointments_count}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/portal/prescriptions">
          <Card className="p-5 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Recetas Pendientes</p>
                <p className="text-3xl font-bold text-neutral-900 mt-1">
                  {stats.pending_prescriptions_count}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Pill className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/portal/lab-results">
          <Card className="p-5 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Resultados de Lab</p>
                <p className="text-3xl font-bold text-neutral-900 mt-1">
                  {stats.unread_lab_results_count}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/portal/billing">
          <Card className="p-5 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Balance Pendiente</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">
                  {formatCurrency(stats.outstanding_balance)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Alerts */}
      {recent_alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">Alertas y Notificaciones</h2>
          {recent_alerts.map((alert) => (
            <Card
              key={alert.id}
              className={`p-4 border-l-4 ${severityColors[alert.severity as keyof typeof severityColors] || 'border-neutral-200'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-neutral-500" />
                    <h3 className="font-semibold text-neutral-900">{alert.title}</h3>
                  </div>
                  <p className="text-sm text-neutral-600 mt-1">{alert.message}</p>
                  <p className="text-xs text-neutral-400 mt-2">{formatDate(alert.created_at)}</p>
                </div>
                {alert.action_url && (
                  <Link href={alert.action_url}>
                    <Button size="sm" variant="outline">
                      Ver detalles
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upcoming Appointments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Próximas Citas</h2>
          <Link href="/portal/appointments">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Ver todas
            </Button>
          </Link>
        </div>

        {upcoming_appointments.length === 0 ? (
          <Card className="p-8 text-center">
            <Calendar className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">No tienes citas próximas</p>
            <Link href="/portal/appointments">
              <Button size="sm" className="mt-3">
                Solicitar Cita
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming_appointments.map((apt) => (
              <Card key={apt.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900">
                        {apt.provider_name}
                      </h3>
                      {apt.provider_specialty && (
                        <p className="text-sm text-neutral-500">{apt.provider_specialty}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-neutral-400" />
                        <span className="text-sm text-neutral-600">
                          {formatDate(apt.scheduled_start)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="primary" size="sm">
                    {apt.appointment_type}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Last Visit */}
      {stats.last_visit_date && (
        <Card className="p-4 bg-neutral-50">
          <p className="text-sm text-neutral-500">
            Última visita: <span className="font-medium text-neutral-900">{formatDate(stats.last_visit_date)}</span>
          </p>
        </Card>
      )}
    </div>
  );
}
