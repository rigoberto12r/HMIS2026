'use client';
import { parseIntSafe, parseFloatSafe } from '@/lib/utils/safe-parse';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateAppointment } from '@/hooks/useAppointments';
import { useProviders } from '@/hooks/useProviders';
import { api } from '@/lib/api';
import { captureException } from '@/lib/monitoring';

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PatientOption {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
}

const typeOptions = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'control', label: 'Control' },
  { value: 'procedimiento', label: 'Procedimiento' },
  { value: 'urgencia', label: 'Urgencia' },
];

const durationOptions = [
  { value: '15', label: '15 minutos' },
  { value: '20', label: '20 minutos' },
  { value: '30', label: '30 minutos' },
  { value: '45', label: '45 minutos' },
  { value: '60', label: '60 minutos' },
];

const emptyForm = {
  patient_id: '',
  provider_id: '',
  appointment_type: 'consulta',
  scheduled_start: '',
  duration_minutes: '30',
  reason: '',
  notes: '',
};

export function CreateAppointmentModal({ isOpen, onClose }: CreateAppointmentModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedPatientName, setSelectedPatientName] = useState('');

  const createAppointment = useCreateAppointment();
  const { data: providersData } = useProviders({ page_size: 100 });

  const providers = providersData?.items || [];
  const providerOptions = [
    { value: '', label: 'Seleccionar proveedor' },
    ...providers.map((p) => ({
      value: p.id,
      label: `Dr. ${p.first_name} ${p.last_name}${p.specialty_name ? ` — ${p.specialty_name}` : ''}`,
    })),
  ];

  const handleSearchPatients = async (query: string) => {
    setPatientSearch(query);
    if (query.length < 2) {
      setPatients([]);
      return;
    }
    setSearchingPatients(true);
    try {
      const res = await api.get<{ items: PatientOption[] }>('/patients/search', { query, page_size: 5 });
      setPatients(res.items || []);
    } catch {
      setPatients([]);
    } finally {
      setSearchingPatients(false);
    }
  };

  const handleSelectPatient = (patient: PatientOption) => {
    setForm((prev) => ({ ...prev, patient_id: patient.id }));
    setSelectedPatientName(`${patient.first_name} ${patient.last_name}`);
    setPatients([]);
    setPatientSearch('');
  };

  const handleSubmit = async () => {
    if (!form.patient_id) {
      setFormError('Debe seleccionar un paciente');
      return;
    }
    if (!form.provider_id) {
      setFormError('Debe seleccionar un proveedor');
      return;
    }
    if (!form.scheduled_start) {
      setFormError('Debe seleccionar fecha y hora');
      return;
    }

    // Calculate scheduled_end from start + duration
    const startDate = new Date(form.scheduled_start);
    const durationMs = parseIntSafe(form.duration_minutes, 30, 'Duration Minutes') * 60 * 1000;
    const endDate = new Date(startDate.getTime() + durationMs);

    try {
      await createAppointment.mutateAsync({
        patient_id: form.patient_id,
        provider_id: form.provider_id,
        scheduled_start: startDate.toISOString(),
        scheduled_end: endDate.toISOString(),
        appointment_type: form.appointment_type,
        reason: form.reason || undefined,
        notes: form.notes || undefined,
        source: 'web',
      });
      toast.success('Cita creada exitosamente');
      handleClose();
    } catch (err: any) {
      captureException(err, {
        context: 'create_appointment',
        patientId: form.patient_id,
        providerId: form.provider_id,
        scheduledStart: form.scheduled_start,
        appointmentType: form.appointment_type,
      });

      const message = err?.detail || err?.message || 'Error al crear cita';
      if (message.includes('409') || message.includes('disponib') || message.includes('conflict')) {
        setFormError('El horario seleccionado no está disponible. Intente otro horario.');
      } else {
        setFormError(message);
      }
    }
  };

  const handleClose = () => {
    setForm(emptyForm);
    setSelectedPatientName('');
    setPatientSearch('');
    setPatients([]);
    setFormError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nueva Cita"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={createAppointment.isPending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={createAppointment.isPending}>
            {createAppointment.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              'Crear Cita'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{formError}</p>
          </div>
        )}

        {/* Patient Search */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Paciente *</h3>
          {selectedPatientName ? (
            <div className="flex items-center gap-2">
              <span className="px-3 py-2 bg-primary-50 text-primary-700 rounded-md text-sm font-medium">
                {selectedPatientName}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPatientName('');
                  setForm((prev) => ({ ...prev, patient_id: '' }));
                }}
              >
                Cambiar
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => handleSearchPatients(e.target.value)}
                  placeholder="Buscar paciente por nombre o cédula..."
                  className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {patients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPatient(p)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-primary-50 flex justify-between"
                    >
                      <span>{p.first_name} {p.last_name}</span>
                      <span className="text-neutral-400">{p.document_number}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchingPatients && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-md p-3 text-sm text-neutral-500 text-center">
                  Buscando...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Provider + Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Proveedor *"
            value={form.provider_id}
            onChange={(e) => { setForm({ ...form, provider_id: e.target.value }); setFormError(null); }}
            options={providerOptions}
          />
          <Select
            label="Tipo de Cita"
            value={form.appointment_type}
            onChange={(e) => setForm({ ...form, appointment_type: e.target.value })}
            options={typeOptions}
          />
        </div>

        {/* DateTime + Duration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Fecha y Hora *"
            type="datetime-local"
            value={form.scheduled_start}
            onChange={(e) => { setForm({ ...form, scheduled_start: e.target.value }); setFormError(null); }}
          />
          <Select
            label="Duración"
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
            options={durationOptions}
          />
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Motivo</label>
          <textarea
            value={form.reason}
            onChange={(e) => {
              if (e.target.value.length <= 500) {
                setForm({ ...form, reason: e.target.value });
              }
            }}
            placeholder="Motivo de la consulta..."
            rows={2}
            maxLength={500}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
          <p className="text-xs text-neutral-400 mt-1">
            {form.reason.length}/500 caracteres
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Notas (opcional)</label>
          <textarea
            value={form.notes}
            onChange={(e) => {
              if (e.target.value.length <= 500) {
                setForm({ ...form, notes: e.target.value });
              }
            }}
            placeholder="Notas adicionales..."
            rows={2}
            maxLength={500}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
          <p className="text-xs text-neutral-400 mt-1">
            {form.notes.length}/500 caracteres
          </p>
        </div>
      </div>
    </Modal>
  );
}
