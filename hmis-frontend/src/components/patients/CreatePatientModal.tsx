'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreatePatient, type PatientCreateData } from '@/hooks/usePatients';
import { validatePhone } from '@/lib/utils/phone-validation';
import { dateUtils } from '@/lib/utils/validation';
import { captureException } from '@/lib/monitoring';

interface CreatePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const genderOptions = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'O', label: 'Otro' },
];

const bloodTypeOptions = [
  { value: '', label: 'Seleccionar' },
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
];

const documentTypeOptions = [
  { value: 'cedula', label: 'Cédula' },
  { value: 'passport', label: 'Pasaporte' },
  { value: 'otro', label: 'Otro' },
];

const emptyForm: PatientCreateData = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: 'M',
  document_type: 'cedula',
  document_number: '',
  phone_number: '',
  email: '',
  blood_type: '',
  allergies: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
};

export function CreatePatientModal({ isOpen, onClose }: CreatePatientModalProps) {
  const [formData, setFormData] = useState<PatientCreateData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const createPatient = useCreatePatient();

  const handleChange = (field: keyof PatientCreateData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!formData.first_name || !formData.last_name) {
      setFormError('Nombre y apellido son requeridos');
      return;
    }
    if (!formData.date_of_birth) {
      setFormError('Fecha de nacimiento es requerida');
      return;
    }
    if (!formData.document_number) {
      setFormError('Número de documento es requerido');
      return;
    }

    // Phone validation
    if (formData.phone_number && formData.phone_number.trim() !== '') {
      const phoneValidation = validatePhone(formData.phone_number);
      if (!phoneValidation.valid) {
        setFormError(phoneValidation.error || 'Número de teléfono inválido');
        return;
      }
    }

    // Emergency contact phone validation
    if (formData.emergency_contact_phone && formData.emergency_contact_phone.trim() !== '') {
      const phoneValidation = validatePhone(formData.emergency_contact_phone);
      if (!phoneValidation.valid) {
        setFormError('Teléfono de contacto de emergencia inválido: ' + (phoneValidation.error || ''));
        return;
      }
    }

    try {
      await createPatient.mutateAsync(formData);
      toast.success('Paciente registrado exitosamente');
      setFormData(emptyForm);
      setFormError(null);
      onClose();
    } catch (err: any) {
      captureException(err, {
        context: 'create_patient_modal',
        formData: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          document_type: formData.document_type,
        },
      });

      let message = 'Error al crear paciente';
      if (err?.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          message = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          message = err.response.data.detail.map((e: any) => e.msg || e.message).join(', ');
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setFormError(message);
    }
  };

  const handleClose = () => {
    setFormData(emptyForm);
    setFormError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Registrar Nuevo Paciente"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={createPatient.isPending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={createPatient.isPending}
          >
            {createPatient.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Paciente'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Error Message */}
        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{formError}</p>
          </div>
        )}

        {/* Basic Information */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Información Básica</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre *"
              value={formData.first_name}
              onChange={(e) => handleChange('first_name', e.target.value)}
              onBlur={(e) => {
                const trimmed = e.target.value.trim();
                if (trimmed !== e.target.value) {
                  handleChange('first_name', trimmed);
                }
              }}
              placeholder="Ej: Juan"
              required
            />
            <Input
              label="Apellido *"
              value={formData.last_name}
              onChange={(e) => handleChange('last_name', e.target.value)}
              onBlur={(e) => {
                const trimmed = e.target.value.trim();
                if (trimmed !== e.target.value) {
                  handleChange('last_name', trimmed);
                }
              }}
              placeholder="Ej: Pérez"
              required
            />
            <Input
              label="Fecha de Nacimiento *"
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => handleChange('date_of_birth', e.target.value)}
              max={dateUtils.getMaxBirthDate()}
              min={dateUtils.getMinBirthDate()}
              title="Fecha de nacimiento (edad máxima 120 años)"
              required
            />
            <Select
              label="Género *"
              value={formData.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              options={genderOptions}
              required
            />
          </div>
        </div>

        {/* Identification */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Identificación</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Tipo de Documento *"
              value={formData.document_type}
              onChange={(e) => handleChange('document_type', e.target.value)}
              options={documentTypeOptions}
              required
            />
            <Input
              label="Número de Documento *"
              value={formData.document_number}
              onChange={(e) => handleChange('document_number', e.target.value)}
              placeholder="Ej: 001-1234567-8"
              required
            />
          </div>
        </div>

        {/* Contact Information */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Información de Contacto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Teléfono"
              type="tel"
              value={formData.phone_number || ''}
              onChange={(e) => handleChange('phone_number', e.target.value)}
              placeholder="Ej: 809-555-1234"
              title="Formato: 809-555-1234 o +1-809-555-1234"
            />
            <Input
              label="Correo Electrónico"
              type="email"
              value={formData.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={(e) => {
                const trimmed = e.target.value.trim();
                if (trimmed !== e.target.value) {
                  handleChange('email', trimmed);
                }
              }}
              placeholder="Ej: paciente@ejemplo.com"
              pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
              title="Ingrese un correo válido (ej: usuario@ejemplo.com)"
            />
          </div>
        </div>

        {/* Medical Information */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Información Médica</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Tipo de Sangre"
              value={formData.blood_type || ''}
              onChange={(e) => handleChange('blood_type', e.target.value)}
              options={bloodTypeOptions}
            />
            <div className="relative">
              <Input
                label="Alergias"
                value={formData.allergies || ''}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    handleChange('allergies', e.target.value);
                  }
                }}
                placeholder="Ej: Penicilina, Mariscos"
                maxLength={500}
              />
              <p className="text-xs text-neutral-400 mt-1">
                {(formData.allergies || '').length}/500 caracteres
              </p>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Contacto de Emergencia</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre del Contacto"
              value={formData.emergency_contact_name || ''}
              onChange={(e) => handleChange('emergency_contact_name', e.target.value)}
              placeholder="Ej: María Pérez"
            />
            <Input
              label="Teléfono del Contacto"
              type="tel"
              value={formData.emergency_contact_phone || ''}
              onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
              placeholder="Ej: 809-555-9999"
              title="Formato: 809-555-1234 o +1-809-555-1234"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
