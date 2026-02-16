'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { useCreatePatient, type PatientCreateData } from '@/hooks/usePatients';
import { ArrowLeft, Save, User, FileText, Phone, Mail, MapPin, Shield, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validatePhone } from '@/lib/utils/phone-validation';
import { dateUtils } from '@/lib/utils/validation';
import { captureException } from '@/lib/monitoring';

/**
 * New Patient Form Page
 *
 * Features:
 * - Comprehensive patient registration form with React Hook Form validation
 * - Grouped sections: Personal Info, Contact, Medical, Insurance
 * - Dark mode compatible
 * - Mobile responsive
 * - Real-time validation with error messages
 * - Success/Error handling with toast notifications
 */

interface PatientFormData {
  // Personal Information
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'M' | 'F' | 'O';
  document_type: string;
  document_number: string;

  // Contact Information
  phone_number?: string;
  email?: string;
  address?: string;
  city?: string;

  // Medical Information
  blood_type?: string;
  allergies?: string;

  // Emergency Contact
  emergency_contact_name?: string;
  emergency_contact_phone?: string;

  // Insurance
  insurance_company?: string;
  insurance_policy_number?: string;
}

const documentTypeOptions = [
  { value: 'cedula', label: 'Cédula de Identidad' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'ruc', label: 'RUC' },
  { value: 'otro', label: 'Otro' },
];

const genderOptions = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'O', label: 'Otro' },
];

const bloodTypeOptions = [
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
];

export default function NewPatientPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<'personal' | 'contact' | 'medical' | 'insurance'>('personal');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<PatientFormData>({
    defaultValues: {
      document_type: 'cedula',
      gender: 'M',
    },
  });

  const createPatientMutation = useCreatePatient();

  const onSubmit = async (data: PatientFormData) => {
    try {
      // Validate phone numbers before submitting
      if (data.phone_number && data.phone_number.trim() !== '') {
        const phoneValidation = validatePhone(data.phone_number);
        if (!phoneValidation.valid) {
          throw new Error(phoneValidation.error || 'Número de teléfono inválido');
        }
      }

      if (data.emergency_contact_phone && data.emergency_contact_phone.trim() !== '') {
        const phoneValidation = validatePhone(data.emergency_contact_phone);
        if (!phoneValidation.valid) {
          throw new Error('Teléfono de contacto de emergencia inválido: ' + (phoneValidation.error || ''));
        }
      }

      const patientData: PatientCreateData = {
        first_name: data.first_name,
        last_name: data.last_name,
        date_of_birth: data.date_of_birth,
        gender: data.gender,
        document_type: data.document_type,
        document_number: data.document_number,
        phone_number: data.phone_number,
        email: data.email,
        blood_type: data.blood_type,
        allergies: data.allergies,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone,
      };

      // Add insurance if provided
      if (data.insurance_company && data.insurance_policy_number) {
        patientData.insurance_policies = [
          {
            insurer_name: data.insurance_company,
            policy_number: data.insurance_policy_number,
            is_primary: true,
          },
        ];
      }

      await createPatientMutation.mutateAsync(patientData);

      // Redirect to patients list on success
      router.push('/patients');
    } catch (error) {
      captureException(error, {
        context: 'create_patient_page',
        formData: {
          first_name: data.first_name,
          last_name: data.last_name,
          document_type: data.document_type,
        },
      });
      console.error('Error creating patient:', error);
    }
  };

  const goBack = () => {
    router.back();
  };

  const sections = [
    { id: 'personal' as const, label: 'Personal', icon: User },
    { id: 'contact' as const, label: 'Contacto', icon: Phone },
    { id: 'medical' as const, label: 'Médico', icon: Heart },
    { id: 'insurance' as const, label: 'Seguro', icon: Shield },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={goBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50 mb-2">
          Nuevo Paciente
        </h1>
        <p className="text-sm text-surface-500">
          Complete el formulario para registrar un nuevo paciente en el sistema
        </p>
      </div>

      {/* Section Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                activeSection === section.id
                  ? 'bg-primary-500 text-white shadow-glow-primary'
                  : 'bg-surface-100 dark:bg-surface-200 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-300'
              )}
            >
              <Icon className="w-4 h-4" />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="pt-6">
            {/* Personal Information Section */}
            {activeSection === 'personal' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-primary-500" />
                  <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                    Información Personal
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    {...register('first_name', {
                      required: 'El nombre es requerido',
                      minLength: { value: 2, message: 'El nombre debe tener al menos 2 caracteres' }
                    })}
                    label="Nombre"
                    placeholder="Juan"
                    error={errors.first_name?.message}
                    required
                  />

                  <Input
                    {...register('last_name', {
                      required: 'El apellido es requerido',
                      minLength: { value: 2, message: 'El apellido debe tener al menos 2 caracteres' }
                    })}
                    label="Apellido"
                    placeholder="Pérez"
                    error={errors.last_name?.message}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    {...register('date_of_birth', {
                      required: 'La fecha de nacimiento es requerida'
                    })}
                    type="date"
                    label="Fecha de Nacimiento"
                    error={errors.date_of_birth?.message}
                    required
                    max={dateUtils.getMaxBirthDate()}
                    min={dateUtils.getMinBirthDate()}
                    title="Fecha de nacimiento (edad máxima 120 años)"
                  />

                  <Select
                    {...register('gender', { required: 'El sexo es requerido' })}
                    label="Sexo"
                    options={genderOptions}
                    error={errors.gender?.message}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    {...register('document_type', { required: 'El tipo de documento es requerido' })}
                    label="Tipo de Documento"
                    options={documentTypeOptions}
                    error={errors.document_type?.message}
                    required
                  />

                  <Input
                    {...register('document_number', {
                      required: 'El número de documento es requerido',
                      minLength: { value: 3, message: 'Número de documento inválido' }
                    })}
                    label="Número de Documento"
                    placeholder="001-1234567-8"
                    error={errors.document_number?.message}
                    required
                  />
                </div>
              </div>
            )}

            {/* Contact Information Section */}
            {activeSection === 'contact' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Phone className="w-5 h-5 text-primary-500" />
                  <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                    Información de Contacto
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    {...register('phone_number', {
                      pattern: {
                        value: /^[0-9+\-() ]+$/,
                        message: 'Número de teléfono inválido'
                      }
                    })}
                    type="tel"
                    label="Teléfono"
                    placeholder="+1 809-555-1234"
                    leftIcon={<Phone className="w-4 h-4" />}
                    error={errors.phone_number?.message}
                    title="Formato: 809-555-1234 o +1-809-555-1234"
                  />

                  <Input
                    {...register('email', {
                      pattern: {
                        value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                        message: 'Email inválido'
                      }
                    })}
                    type="email"
                    label="Email"
                    placeholder="juan.perez@email.com"
                    leftIcon={<Mail className="w-4 h-4" />}
                    error={errors.email?.message}
                    pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
                    title="Ingrese un correo válido (ej: usuario@ejemplo.com)"
                  />
                </div>

                <Input
                  {...register('address')}
                  label="Dirección"
                  placeholder="Calle Principal #123, Sector Los Jardines"
                  leftIcon={<MapPin className="w-4 h-4" />}
                />

                <Input
                  {...register('city')}
                  label="Ciudad"
                  placeholder="Santo Domingo"
                />

                <div className="border-t border-surface-200 dark:border-surface-700 pt-4 mt-6">
                  <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">
                    Contacto de Emergencia
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      {...register('emergency_contact_name')}
                      label="Nombre Completo"
                      placeholder="María Pérez"
                    />

                    <Input
                      {...register('emergency_contact_phone', {
                        pattern: {
                          value: /^[0-9+\-() ]+$/,
                          message: 'Número de teléfono inválido'
                        }
                      })}
                      type="tel"
                      label="Teléfono"
                      placeholder="+1 809-555-5678"
                      error={errors.emergency_contact_phone?.message}
                      title="Formato: 809-555-1234 o +1-809-555-1234"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Medical Information Section */}
            {activeSection === 'medical' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Heart className="w-5 h-5 text-primary-500" />
                  <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                    Información Médica
                  </h2>
                </div>

                <Select
                  {...register('blood_type')}
                  label="Tipo de Sangre"
                  options={bloodTypeOptions}
                  placeholder="Seleccionar tipo de sangre"
                />

                <div className="relative">
                  <Textarea
                    {...register('allergies', {
                      maxLength: {
                        value: 500,
                        message: 'Máximo 500 caracteres'
                      }
                    })}
                    label="Alergias"
                    placeholder="Describa cualquier alergia conocida (medicamentos, alimentos, etc.)"
                    rows={4}
                    hint="Opcional - Liste todas las alergias conocidas"
                    maxLength={500}
                  />
                  <p className="text-xs text-surface-400 mt-1">
                    {(watch('allergies') || '').length}/500 caracteres
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Nota:</strong> Esta información es crítica para la seguridad del paciente.
                    Asegúrese de mantenerla actualizada en todo momento.
                  </p>
                </div>
              </div>
            )}

            {/* Insurance Section */}
            {activeSection === 'insurance' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-primary-500" />
                  <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                    Información del Seguro
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    {...register('insurance_company')}
                    label="Compañía de Seguro"
                    placeholder="ARS Humano, SeNaSa, etc."
                    hint="Opcional"
                  />

                  <Input
                    {...register('insurance_policy_number')}
                    label="Número de Póliza"
                    placeholder="POL-123456"
                    hint="Opcional"
                  />
                </div>

                <div className="bg-surface-50 dark:bg-surface-200 rounded-lg p-4">
                  <p className="text-sm text-surface-600 dark:text-surface-400">
                    Puede agregar información de seguro ahora o más tarde desde el perfil del paciente.
                  </p>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={goBack}>
              Cancelar
            </Button>

            <div className="flex gap-2">
              {activeSection !== 'personal' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const currentIndex = sections.findIndex(s => s.id === activeSection);
                    if (currentIndex > 0) {
                      setActiveSection(sections[currentIndex - 1].id);
                    }
                  }}
                >
                  Anterior
                </Button>
              )}

              {activeSection !== 'insurance' ? (
                <Button
                  type="button"
                  onClick={() => {
                    const currentIndex = sections.findIndex(s => s.id === activeSection);
                    if (currentIndex < sections.length - 1) {
                      setActiveSection(sections[currentIndex + 1].id);
                    }
                  }}
                >
                  Siguiente
                </Button>
              ) : (
                <Button
                  type="submit"
                  isLoading={isSubmitting || createPatientMutation.isPending}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Crear Paciente
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>

        {/* Error Display */}
        {createPatientMutation.isError && (
          <Card className="mt-4 border-red-200 bg-red-50 dark:bg-red-900/10">
            <CardContent>
              <p className="text-sm text-red-800 dark:text-red-400">
                <strong>Error al crear paciente:</strong>{' '}
                {createPatientMutation.error instanceof Error
                  ? createPatientMutation.error.message
                  : 'Error desconocido'}
              </p>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
