'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  User,
  Phone,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAppointments, useUpdateAppointmentStatus } from '@/hooks/useAppointments';
import { useProviders } from '@/hooks/useProviders';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type ConfirmAction = 'confirm' | 'cancel' | 'reschedule';

interface ActionModalState {
  isOpen: boolean;
  appointmentId: string | null;
  action: ConfirmAction | null;
  patientName?: string;
}

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'scheduled', label: 'Programadas' },
  { value: 'pending', label: 'Pendientes' },
];

function AppointmentConfirmationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const statusFilter = searchParams.get('status') || 'scheduled';
  const providerFilter = searchParams.get('provider_id') || '';
  const dateFromFilter = searchParams.get('date_from') || '';
  const dateToFilter = searchParams.get('date_to') || '';

  const [localStatus, setLocalStatus] = useState(statusFilter);
  const [localProvider, setLocalProvider] = useState(providerFilter);
  const [localDateFrom, setLocalDateFrom] = useState(dateFromFilter);
  const [localDateTo, setLocalDateTo] = useState(dateToFilter);
  const [showFilters, setShowFilters] = useState(false);
  const [actionModal, setActionModal] = useState<ActionModalState>({
    isOpen: false,
    appointmentId: null,
    action: null,
  });
  const [cancellationReason, setCancellationReason] = useState('');

  // Fetch appointments
  const { data, isLoading, error } = useAppointments({
    page,
    page_size: 20,
    status: statusFilter || undefined,
    provider_id: providerFilter || undefined,
    date_from: dateFromFilter || undefined,
    date_to: dateToFilter || undefined,
  });

  // Fetch providers for filter
  const { data: providersData } = useProviders({ page_size: 100 });

  const updateStatus = useUpdateAppointmentStatus();

  const providerOptions = [
    { value: '', label: 'Todos los médicos' },
    ...(providersData?.items.map((p) => ({
      value: p.id,
      label: `Dr. ${p.first_name} ${p.last_name}`,
    })) || []),
  ];

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    params.set('page', '1');
    if (localStatus) params.set('status', localStatus);
    if (localProvider) params.set('provider_id', localProvider);
    if (localDateFrom) params.set('date_from', localDateFrom);
    if (localDateTo) params.set('date_to', localDateTo);
    router.push(`/appointments/confirmations?${params.toString()}`);
  };

  const handleClearFilters = () => {
    setLocalStatus('scheduled');
    setLocalProvider('');
    setLocalDateFrom('');
    setLocalDateTo('');
    router.push('/appointments/confirmations?status=scheduled');
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/appointments/confirmations?${params.toString()}`);
  };

  const openActionModal = (appointmentId: string, action: ConfirmAction, patientName?: string) => {
    setActionModal({
      isOpen: true,
      appointmentId,
      action,
      patientName,
    });
    setCancellationReason('');
  };

  const closeActionModal = () => {
    setActionModal({
      isOpen: false,
      appointmentId: null,
      action: null,
    });
    setCancellationReason('');
  };

  const handleConfirmAction = async () => {
    if (!actionModal.appointmentId || !actionModal.action) return;

    try {
      let newStatus: 'confirmed' | 'cancelled' = 'confirmed';

      if (actionModal.action === 'confirm') {
        newStatus = 'confirmed';
      } else if (actionModal.action === 'cancel') {
        newStatus = 'cancelled';
        if (!cancellationReason.trim()) {
          toast.error('Debe ingresar el motivo de cancelación');
          return;
        }
      }

      await updateStatus.mutateAsync({
        id: actionModal.appointmentId,
        status: newStatus,
        cancellation_reason: actionModal.action === 'cancel' ? cancellationReason : undefined,
      } as any);

      const actionText = actionModal.action === 'confirm' ? 'confirmada' : 'cancelada';
      toast.success(`Cita ${actionText} exitosamente`);
      closeActionModal();
    } catch (err: any) {
      const message = err?.detail || err?.message || 'Error al procesar la acción';
      toast.error(message);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger'; label: string }> = {
      scheduled: { variant: 'default', label: 'Programada' },
      confirmed: { variant: 'success', label: 'Confirmada' },
      pending: { variant: 'warning', label: 'Pendiente' },
      cancelled: { variant: 'danger', label: 'Cancelada' },
      completed: { variant: 'success', label: 'Completada' },
      no_show: { variant: 'danger', label: 'No asistió' },
    };

    const config = variants[status] || { variant: 'default' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      return {
        date: format(date, "d 'de' MMMM, yyyy", { locale: es }),
        time: format(date, 'HH:mm', { locale: es }),
      };
    } catch {
      return { date: 'Fecha inválida', time: '' };
    }
  };

  const appointments = data?.items || [];
  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50 mb-2">
            Confirmación de Citas
          </h1>
          <p className="text-surface-500">
            Gestione las confirmaciones y cancelaciones de citas médicas
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
        </Button>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Select
                  label="Estado"
                  value={localStatus}
                  onChange={(e) => setLocalStatus(e.target.value)}
                  options={statusOptions}
                />
                <Select
                  label="Médico"
                  value={localProvider}
                  onChange={(e) => setLocalProvider(e.target.value)}
                  options={providerOptions}
                />
                <Input
                  label="Desde"
                  type="date"
                  value={localDateFrom}
                  onChange={(e) => setLocalDateFrom(e.target.value)}
                />
                <Input
                  label="Hasta"
                  type="date"
                  value={localDateTo}
                  onChange={(e) => setLocalDateTo(e.target.value)}
                />
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="primary" onClick={handleApplyFilters} className="gap-2">
                  <Search className="w-4 h-4" />
                  Aplicar Filtros
                </Button>
                <Button variant="outline" onClick={handleClearFilters}>
                  Limpiar
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Error al cargar citas</p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">
              {error instanceof Error ? error.message : 'Error desconocido'}
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-4" />
            <p className="text-surface-500">Cargando citas...</p>
          </div>
        </Card>
      )}

      {/* Appointments List */}
      {!isLoading && appointments.length === 0 && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Calendar className="w-12 h-12 text-surface-300 dark:text-surface-600 mb-4" />
            <h3 className="text-lg font-semibold text-surface-700 dark:text-surface-300 mb-2">
              No hay citas pendientes
            </h3>
            <p className="text-surface-500">
              No se encontraron citas con los filtros seleccionados
            </p>
          </div>
        </Card>
      )}

      {!isLoading && appointments.length > 0 && (
        <div className="space-y-4">
          {appointments.map((appointment) => {
            const { date, time } = formatDateTime(appointment.appointment_datetime);
            return (
              <motion.div
                key={appointment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-5 hover:shadow-md transition-shadow">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Appointment Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                              {appointment.patient_name || 'Paciente'}
                            </h3>
                            {getStatusBadge(appointment.status)}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-surface-600 dark:text-surface-400">
                            <div className="flex items-center gap-1.5">
                              <User className="w-4 h-4" />
                              <span>{appointment.provider_name || 'Médico'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              <span>{date}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4" />
                              <span>{time}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {appointment.reason && (
                        <p className="text-sm text-surface-600 dark:text-surface-400">
                          <span className="font-medium">Motivo:</span> {appointment.reason}
                        </p>
                      )}

                      <div className="inline-block px-2.5 py-1 bg-primary-50 dark:bg-primary-900/20 rounded text-xs font-medium text-primary-700 dark:text-primary-300">
                        {appointment.appointment_type}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-row lg:flex-col gap-2 lg:min-w-[140px]">
                      {appointment.status === 'scheduled' && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openActionModal(appointment.id, 'confirm', appointment.patient_name)}
                            className="flex-1 lg:flex-none gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Confirmar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openActionModal(appointment.id, 'cancel', appointment.patient_name)}
                            className="flex-1 lg:flex-none gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            Cancelar
                          </Button>
                        </>
                      )}
                      {appointment.status === 'confirmed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openActionModal(appointment.id, 'cancel', appointment.patient_name)}
                          className="gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancelar
                        </Button>
                      )}
                      {(appointment.status === 'cancelled' || appointment.status === 'completed') && (
                        <div className="text-sm text-surface-500 dark:text-surface-400 text-center lg:text-left">
                          No hay acciones disponibles
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Página {page} de {totalPages} — Total: {data?.total || 0} citas
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Action Confirmation Modal */}
      <Modal
        isOpen={actionModal.isOpen}
        onClose={closeActionModal}
        title={
          actionModal.action === 'confirm'
            ? 'Confirmar Cita'
            : actionModal.action === 'cancel'
            ? 'Cancelar Cita'
            : 'Reprogramar Cita'
        }
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closeActionModal} disabled={updateStatus.isPending}>
              Cerrar
            </Button>
            <Button
              variant={actionModal.action === 'cancel' ? 'danger' : 'primary'}
              onClick={handleConfirmAction}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  {actionModal.action === 'confirm' && <CheckCircle className="w-4 h-4 mr-2" />}
                  {actionModal.action === 'cancel' && <XCircle className="w-4 h-4 mr-2" />}
                  {actionModal.action === 'reschedule' && <RefreshCw className="w-4 h-4 mr-2" />}
                  {actionModal.action === 'confirm' ? 'Confirmar' : actionModal.action === 'cancel' ? 'Cancelar' : 'Reprogramar'}
                </>
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {actionModal.action === 'confirm' && (
            <p className="text-surface-700 dark:text-surface-300">
              ¿Está seguro que desea confirmar la cita de{' '}
              <span className="font-semibold">{actionModal.patientName}</span>?
            </p>
          )}

          {actionModal.action === 'cancel' && (
            <>
              <p className="text-surface-700 dark:text-surface-300">
                ¿Está seguro que desea cancelar la cita de{' '}
                <span className="font-semibold">{actionModal.patientName}</span>?
              </p>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Motivo de Cancelación <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Ingrese el motivo de la cancelación..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-surface-300 dark:border-surface-600 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-surface-200 dark:text-surface-50"
                  required
                />
              </div>
            </>
          )}

          {actionModal.action === 'reschedule' && (
            <div className="space-y-4">
              <p className="text-surface-700 dark:text-surface-300">
                Seleccione la nueva fecha y hora para la cita de{' '}
                <span className="font-semibold">{actionModal.patientName}</span>:
              </p>
              <Input label="Nueva Fecha y Hora" type="datetime-local" />
              <p className="text-xs text-surface-500">
                Esta funcionalidad será implementada próximamente
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default function AppointmentConfirmationsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    }>
      <AppointmentConfirmationsPageContent />
    </Suspense>
  );
}
