'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { SearchableSelect, SearchableOption } from '@/components/ui/searchable-select';
import { ArrowLeft, Calendar, Clock, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useCreateAppointment } from '@/hooks/useAppointments';
import { useProviders } from '@/hooks/useProviders';
import { usePatients } from '@/hooks/usePatients';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const appointmentTypes = [
  { value: 'consulta', label: 'Consulta General' },
  { value: 'control', label: 'Control/Seguimiento' },
  { value: 'procedimiento', label: 'Procedimiento' },
  { value: 'urgencia', label: 'Urgencia' },
  { value: 'primera_vez', label: 'Primera Vez' },
];

const durationOptions = [
  { value: '15', label: '15 minutos' },
  { value: '20', label: '20 minutos' },
  { value: '30', label: '30 minutos' },
  { value: '45', label: '45 minutos' },
  { value: '60', label: '60 minutos' },
  { value: '90', label: '90 minutos' },
];

interface FormData {
  patient_id: string;
  provider_id: string;
  appointment_type: string;
  scheduled_start: string;
  duration_minutes: string;
  reason: string;
  notes: string;
}

const initialForm: FormData = {
  patient_id: '',
  provider_id: '',
  appointment_type: 'consulta',
  scheduled_start: '',
  duration_minutes: '30',
  reason: '',
  notes: '',
};

export default function NewAppointmentPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');

  const createAppointment = useCreateAppointment();

  // Fetch providers
  const { data: providersData, isLoading: loadingProviders } = useProviders({ page_size: 100 });

  // Fetch patients for search
  const { data: patientsData, isLoading: loadingPatients } = usePatients(
    { query: patientSearch, page_size: 20 },
    { enabled: patientSearch.length >= 2 }
  );

  const providerOptions: SearchableOption[] = providersData?.items.map((p) => ({
    value: p.id,
    label: `Dr. ${p.first_name} ${p.last_name}`,
    subtitle: p.specialty_name || 'General',
  })) || [];

  const patientOptions: SearchableOption[] = patientsData?.items.map((p) => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name}`,
    subtitle: `${p.document_type}: ${p.document_number}`,
  })) || [];

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.patient_id) {
      newErrors.patient_id = 'Debe seleccionar un paciente';
    }
    if (!form.provider_id) {
      newErrors.provider_id = 'Debe seleccionar un médico';
    }
    if (!form.scheduled_start) {
      newErrors.scheduled_start = 'Debe seleccionar fecha y hora';
    } else {
      const appointmentDate = new Date(form.scheduled_start);
      const now = new Date();
      if (appointmentDate < now) {
        newErrors.scheduled_start = 'La fecha debe ser futura';
      }
    }
    if (!form.reason.trim()) {
      newErrors.reason = 'Debe ingresar el motivo de la consulta';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Por favor corrija los errores en el formulario');
      return;
    }

    // Calculate scheduled_end from start + duration
    const startDate = new Date(form.scheduled_start);
    const durationMs = parseInt(form.duration_minutes) * 60 * 1000;
    const endDate = new Date(startDate.getTime() + durationMs);

    try {
      await createAppointment.mutateAsync({
        patient_id: form.patient_id,
        provider_id: form.provider_id,
        scheduled_start: startDate.toISOString(),
        scheduled_end: endDate.toISOString(),
        appointment_type: form.appointment_type,
        reason: form.reason,
        notes: form.notes || undefined,
        source: 'web',
      });

      setIsSuccess(true);
      toast.success('Cita creada exitosamente');

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/appointments');
      }, 2000);
    } catch (err: any) {
      const message = err?.detail || err?.message || 'Error al crear cita';

      // Check for conflict error (409)
      if (err?.status === 409 || message.includes('conflict') || message.includes('disponib')) {
        setErrors({ scheduled_start: 'El horario seleccionado no está disponible. Intente otro horario.' });
        toast.error('Conflicto de horario');
      } else {
        toast.error(message);
      }
    }
  };

  const handleReset = () => {
    setForm(initialForm);
    setErrors({});
    setPatientSearch('');
  };

  // Success state
  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[60vh]"
      >
        <div className="bg-white dark:bg-surface-100 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="flex justify-center mb-4"
          >
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </motion.div>
          <h2 className="text-2xl font-semibold text-surface-900 dark:text-surface-50 mb-2">
            Cita creada exitosamente
          </h2>
          <p className="text-surface-500 mb-6">
            La cita ha sido agendada correctamente. Redirigiendo...
          </p>
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/appointments">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50">
              Nueva Cita
            </h1>
          </div>
          <p className="text-surface-500">
            Complete el formulario para agendar una nueva cita médica
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card className="p-6">
          <div className="space-y-6">
            {/* Global Error */}
            {Object.keys(errors).length > 0 && !errors.scheduled_start && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Hay errores en el formulario
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                    Por favor corrija los campos marcados en rojo
                  </p>
                </div>
              </div>
            )}

            {/* Patient Selection */}
            <div>
              <SearchableSelect
                label="Paciente"
                placeholder="Buscar paciente por nombre o documento..."
                value={form.patient_id}
                onChange={(value) => handleChange('patient_id', value)}
                options={patientOptions}
                onSearch={setPatientSearch}
                loading={loadingPatients}
                required
                error={errors.patient_id}
                emptyMessage={patientSearch.length < 2 ? 'Escriba al menos 2 caracteres' : 'No se encontraron pacientes'}
              />
            </div>

            {/* Provider Selection */}
            <div>
              <SearchableSelect
                label="Médico"
                placeholder="Seleccionar médico..."
                value={form.provider_id}
                onChange={(value) => handleChange('provider_id', value)}
                options={providerOptions}
                loading={loadingProviders}
                required
                error={errors.provider_id}
                emptyMessage="No hay médicos disponibles"
              />
            </div>

            {/* Appointment Type and Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Select
                  label="Tipo de Cita"
                  value={form.appointment_type}
                  onChange={(e) => handleChange('appointment_type', e.target.value)}
                  options={appointmentTypes}
                />
              </div>
              <div>
                <Select
                  label="Duración"
                  value={form.duration_minutes}
                  onChange={(e) => handleChange('duration_minutes', e.target.value)}
                  options={durationOptions}
                />
              </div>
            </div>

            {/* Date and Time */}
            <div>
              <Input
                label="Fecha y Hora"
                type="datetime-local"
                value={form.scheduled_start}
                onChange={(e) => handleChange('scheduled_start', e.target.value)}
                required
                error={errors.scheduled_start}
              />
              {errors.scheduled_start && (
                <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 dark:text-red-200">{errors.scheduled_start}</p>
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Motivo de la Consulta <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.reason}
                onChange={(e) => handleChange('reason', e.target.value)}
                placeholder="Describa el motivo de la consulta..."
                rows={3}
                className={`
                  w-full px-3 py-2.5 border rounded-lg text-sm resize-none
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  dark:bg-surface-200 dark:text-surface-50 dark:border-surface-600
                  ${errors.reason ? 'border-red-300 dark:border-red-600' : 'border-surface-300 dark:border-surface-600'}
                `}
                required
              />
              {errors.reason && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.reason}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Notas Adicionales (Opcional)
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Información adicional relevante..."
                rows={2}
                className="w-full px-3 py-2.5 border border-surface-300 dark:border-surface-600 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-surface-200 dark:text-surface-50"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 mt-8 pt-6 border-t border-surface-200 dark:border-surface-700">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={createAppointment.isPending}
            >
              Limpiar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={createAppointment.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createAppointment.isPending}
              className="min-w-[140px]"
            >
              {createAppointment.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Crear Cita
                </>
              )}
            </Button>
          </div>
        </Card>
      </form>

      {/* Info Card */}
      <Card className="p-5 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
        <div className="flex gap-3">
          <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-1">
              Validación de Horario
            </p>
            <p className="text-sm text-primary-700 dark:text-primary-300">
              El sistema verificará automáticamente la disponibilidad del médico en el horario seleccionado
              y le notificará si existe algún conflicto.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
