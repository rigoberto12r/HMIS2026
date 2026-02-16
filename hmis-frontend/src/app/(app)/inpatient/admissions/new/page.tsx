'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ChevronLeft, ChevronRight, Check, UserPlus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCreateAdmission, useAvailableBeds, useFindBestBed } from '@/hooks/useInpatient';
import { usePatients } from '@/hooks/usePatients';
import type { CreateAdmissionRequest, AdmissionType, BedType } from '@/types/inpatient';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, title: 'Paciente y Detalles', description: 'Información del ingreso' },
  { id: 2, title: 'Asignación de Cama', description: 'Selecciona la cama' },
  { id: 3, title: 'Médicos y Confirmación', description: 'Revisión final' },
];

interface FormData extends CreateAdmissionRequest {
  patient_gender?: string;
  bed_type?: BedType;
}

export default function NewAdmissionPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<FormData>>({});

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<FormData>();
  const createAdmission = useCreateAdmission();

  // Step 1: Patient search
  const patientSearch = watch('patient_id');
  const { data: patients } = usePatients({ search: patientSearch, page_size: 10 });

  // Step 2: Bed selection
  const selectedPatient = patients?.items?.find((p) => p.id === formData.patient_id);
  const { data: availableBeds } = useAvailableBeds({
    gender: selectedPatient?.gender as 'male' | 'female' | undefined,
    type: formData.bed_type,
  });

  const handleNext = (data: Partial<FormData>) => {
    setFormData({ ...formData, ...data });
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleFinalSubmit = async (data: Partial<FormData>) => {
    const finalData: CreateAdmissionRequest = {
      ...formData,
      ...data,
    } as CreateAdmissionRequest;

    try {
      const result = await createAdmission.mutateAsync(finalData);
      toast.success('Paciente ingresado exitosamente');
      router.push(`/nursing/kardex/${result.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Error al crear la admisión');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UserPlus className="h-8 w-8" />
          Nueva Admisión
        </h1>
        <p className="text-muted-foreground mt-1">Registro de nuevo paciente hospitalizado</p>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step.id < currentStep
                    ? 'bg-green-500 text-white'
                    : step.id === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.id < currentStep ? <Check className="h-5 w-5" /> : step.id}
              </div>
              <div className="text-center mt-2">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`flex-1 h-1 mx-4 ${step.id < currentStep ? 'bg-green-500' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Patient and Details */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Información del Paciente</CardTitle>
            <CardDescription>Selecciona el paciente y proporciona detalles del ingreso</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit((data) => handleNext(data))}
              className="space-y-4"
            >
              {/* Patient Selection */}
              <div className="space-y-2">
                <Label htmlFor="patient_id">Paciente *</Label>
                <Select
                  value={formData.patient_id}
                  onValueChange={(value: string) => {
                    setFormData({ ...formData, patient_id: value });
                    const patient = patients?.items?.find((p) => p.id === value);
                    if (patient) {
                      setFormData((prev) => ({ ...prev, patient_gender: patient.gender }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Buscar paciente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {patients?.items?.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.first_name} {patient.last_name} - {patient.document_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.patient_id && (
                  <p className="text-sm text-red-500">{errors.patient_id.message}</p>
                )}
              </div>

              {/* Admission Type */}
              <div className="space-y-2">
                <Label>Tipo de Ingreso *</Label>
                <RadioGroup
                  value={formData.admission_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, admission_type: value as AdmissionType })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="emergency" id="emergency" />
                    <Label htmlFor="emergency">Emergencia</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="elective" id="elective" />
                    <Label htmlFor="elective">Electivo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="transfer" id="transfer" />
                    <Label htmlFor="transfer">Transferencia</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="observation" id="observation" />
                    <Label htmlFor="observation">Observación</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Admitting Diagnosis */}
              <div className="space-y-2">
                <Label htmlFor="admitting_diagnosis">Diagnóstico de Ingreso *</Label>
                <Input
                  id="admitting_diagnosis"
                  {...register('admitting_diagnosis', { required: 'Campo requerido' })}
                  defaultValue={formData.admitting_diagnosis}
                  placeholder="Ej: Neumonía adquirida en comunidad"
                />
                {errors.admitting_diagnosis && (
                  <p className="text-sm text-red-500">{errors.admitting_diagnosis.message}</p>
                )}
              </div>

              {/* Chief Complaint */}
              <div className="space-y-2">
                <Label htmlFor="chief_complaint">Motivo de Consulta</Label>
                <Textarea
                  id="chief_complaint"
                  {...register('chief_complaint')}
                  defaultValue={formData.chief_complaint}
                  placeholder="Descripción breve del motivo..."
                  rows={3}
                />
              </div>

              {/* Expected Discharge Date */}
              <div className="space-y-2">
                <Label htmlFor="expected_discharge_date">Fecha Estimada de Alta</Label>
                <Input
                  id="expected_discharge_date"
                  type="date"
                  {...register('expected_discharge_date')}
                  defaultValue={formData.expected_discharge_date}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={!formData.patient_id || !formData.admission_type}>
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Bed Assignment */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Asignación de Cama</CardTitle>
            <CardDescription>Selecciona la cama para el paciente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bed Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="bed_type">Tipo de Cama</Label>
              <Select
                value={formData.bed_type}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, bed_type: value as BedType })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="standard">Estándar</SelectItem>
                  <SelectItem value="semi_private">Semi-privada</SelectItem>
                  <SelectItem value="private">Privada</SelectItem>
                  <SelectItem value="icu">UCI</SelectItem>
                  <SelectItem value="isolation">Aislamiento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Available Beds */}
            <div className="grid gap-3 max-h-[400px] overflow-y-auto">
              {availableBeds?.map((bed) => (
                <div
                  key={bed.bed_id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    formData.bed_id === bed.bed_id
                      ? 'border-primary bg-primary/10'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setFormData({ ...formData, bed_id: bed.bed_id })}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg">{bed.bed_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {bed.unit} {bed.room && `- Hab. ${bed.room}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tipo: {bed.type}
                      </p>
                      {bed.features && bed.features.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {bed.features.join(', ')}
                        </p>
                      )}
                    </div>
                    {formData.bed_id === bed.bed_id && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {availableBeds?.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No hay camas disponibles con los filtros seleccionados
              </p>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Atrás
              </Button>
              <Button onClick={() => setCurrentStep(3)} disabled={!formData.bed_id}>
                Siguiente
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Physicians and Confirmation */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Médicos Tratantes</CardTitle>
            <CardDescription>Asigna los médicos responsables</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(handleFinalSubmit)}
              className="space-y-4"
            >
              {/* Admitting Physician */}
              <div className="space-y-2">
                <Label htmlFor="admitting_physician_id">Médico que Ingresa *</Label>
                <Input
                  id="admitting_physician_id"
                  {...register('admitting_physician_id', { required: 'Campo requerido' })}
                  defaultValue={formData.admitting_physician_id}
                  placeholder="ID del médico que ingresa"
                />
                {errors.admitting_physician_id && (
                  <p className="text-sm text-red-500">{errors.admitting_physician_id.message}</p>
                )}
              </div>

              {/* Attending Physician */}
              <div className="space-y-2">
                <Label htmlFor="attending_physician_id">Médico Tratante *</Label>
                <Input
                  id="attending_physician_id"
                  {...register('attending_physician_id', { required: 'Campo requerido' })}
                  defaultValue={formData.attending_physician_id}
                  placeholder="ID del médico tratante (puede ser el mismo)"
                />
                {errors.attending_physician_id && (
                  <p className="text-sm text-red-500">{errors.attending_physician_id.message}</p>
                )}
              </div>

              {/* Summary */}
              <div className="border-t pt-4 mt-6">
                <h3 className="font-semibold mb-3">Resumen de la Admisión</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <dt className="text-muted-foreground">Paciente:</dt>
                  <dd className="font-medium">
                    {selectedPatient?.first_name} {selectedPatient?.last_name}
                  </dd>
                  <dt className="text-muted-foreground">Tipo de Ingreso:</dt>
                  <dd className="font-medium">{formData.admission_type}</dd>
                  <dt className="text-muted-foreground">Diagnóstico:</dt>
                  <dd className="font-medium">{formData.admitting_diagnosis}</dd>
                  <dt className="text-muted-foreground">Cama:</dt>
                  <dd className="font-medium">
                    {availableBeds?.find((b) => b.bed_id === formData.bed_id)?.bed_number}
                  </dd>
                </dl>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={handleBack} type="button">
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Atrás
                </Button>
                <Button type="submit" disabled={createAdmission.isPending}>
                  {createAdmission.isPending ? 'Creando...' : 'Confirmar Ingreso'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
