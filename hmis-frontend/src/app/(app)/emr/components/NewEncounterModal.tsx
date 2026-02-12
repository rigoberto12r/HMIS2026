'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, User, AlertTriangle } from 'lucide-react';
import { useCreateEncounter } from '@/hooks/useEncounters';
import { usePatients, type Patient } from '@/hooks/usePatients';
import { useAuthStore } from '@/lib/auth';

interface NewEncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewEncounterModal({ isOpen, onClose }: NewEncounterModalProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const createEncounter = useCreateEncounter();

  const [newPatientId, setNewPatientId] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);
  const [newType, setNewType] = useState('');
  const [newReason, setNewReason] = useState('');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(patientSearch), 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const { data: patientResults, isFetching: searchingPatients } = usePatients(
    { query: debouncedSearch || undefined, page_size: 8 },
    { enabled: isOpen && debouncedSearch.length >= 2 },
  );

  const patientOptions = useMemo(() => patientResults?.items || [], [patientResults]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPatient = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setNewPatientId(patient.id);
    setPatientSearch('');
    setShowPatientDropdown(false);
  }, []);

  const handleClearPatient = useCallback(() => {
    setSelectedPatient(null);
    setNewPatientId('');
    setPatientSearch('');
  }, []);

  const handleClose = useCallback(() => {
    createEncounter.reset();
    setNewPatientId('');
    setSelectedPatient(null);
    setPatientSearch('');
    setNewType('');
    setNewReason('');
    onClose();
  }, [createEncounter, onClose]);

  const handleCreate = useCallback(async () => {
    if (!newPatientId || !newType || !user?.id) return;
    try {
      const created = await createEncounter.mutateAsync({
        patient_id: newPatientId,
        provider_id: user.id,
        encounter_type: newType,
        chief_complaint: newReason || undefined,
      });
      handleClose();
      router.push(`/emr/${created.id}`);
    } catch {
      // Error available via createEncounter.error
    }
  }, [newPatientId, newType, newReason, user, router, createEncounter, handleClose]);

  const createErrorMessage = createEncounter.error instanceof Error
    ? createEncounter.error.message
    : createEncounter.error ? 'Error al crear encuentro' : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Iniciar Nuevo Encuentro Clinico"
      description="Ingrese los datos para iniciar un nuevo encuentro."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createEncounter.isPending || !newPatientId || !newType}
          >
            {createEncounter.isPending ? 'Creando...' : 'Iniciar Encuentro'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {createErrorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700">{createErrorMessage}</span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Patient search selector */}
          <div ref={patientSearchRef} className="relative">
            <label className="form-label">
              Paciente<span className="text-medical-red ml-0.5">*</span>
            </label>
            {selectedPatient ? (
              <div className="flex items-center gap-3 p-2.5 bg-primary-50 border border-primary-200 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-700 text-xs font-bold">
                    {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {selectedPatient.first_name} {selectedPatient.last_name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    MRN: {selectedPatient.mrn} | {selectedPatient.document_number}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearPatient}
                  className="text-neutral-400 hover:text-neutral-600 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Buscar por nombre, MRN o cedula..."
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setShowPatientDropdown(true);
                  }}
                  onFocus={() => { if (patientSearch.length > 0) setShowPatientDropdown(true); }}
                  leftIcon={<Search className="w-4 h-4" />}
                  rightIcon={searchingPatients ? (
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  ) : undefined}
                />
                {showPatientDropdown && patientSearch.length >= 2 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {patientOptions.length === 0 && !searchingPatients ? (
                      <div className="p-3 text-center text-sm text-neutral-400">
                        No se encontraron pacientes
                      </div>
                    ) : (
                      patientOptions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 text-left transition-colors"
                          onClick={() => handleSelectPatient(p)}
                        >
                          <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-neutral-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-neutral-900 truncate">
                              {p.first_name} {p.last_name}
                            </p>
                            <p className="text-xs text-neutral-500">
                              MRN: {p.mrn} | {p.document_number}
                            </p>
                          </div>
                          <Badge variant="default" size="sm">
                            {p.gender === 'M' ? 'M' : p.gender === 'F' ? 'F' : 'O'}
                          </Badge>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <Select
            label="Tipo de Encuentro"
            required
            options={[
              { value: 'ambulatory', label: 'Ambulatorio' },
              { value: 'emergency', label: 'Emergencia' },
              { value: 'inpatient', label: 'Hospitalizacion' },
            ]}
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="Seleccionar tipo"
          />
          <div className="md:col-span-2">
            <Textarea
              label="Motivo de Consulta"
              placeholder="Describa el motivo principal de la consulta..."
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
