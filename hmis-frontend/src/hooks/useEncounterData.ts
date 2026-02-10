/**
 * Custom hook for EMR Encounter data fetching with React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Encounter,
  SOAPNote,
  VitalSigns,
  Diagnosis,
  Allergy,
  SOAPFormData,
  VitalsFormData,
  DiagnosisFormData,
} from '@/app/(app)/emr/[encounterId]/types';

// Helper to extract items array from API response
function extractItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'items' in data) {
    return (data as { items: T[] }).items;
  }
  return [];
}

// ─── Query Hooks ───────────────────────────────────────

export function useEncounter(encounterId: string) {
  return useQuery({
    queryKey: ['encounter', encounterId],
    queryFn: () => api.get<Encounter>(`/emr/encounters/${encounterId}`),
  });
}

export function useEncounterNotes(encounterId: string) {
  return useQuery({
    queryKey: ['encounter-notes', encounterId],
    queryFn: async () => {
      const data = await api.get<SOAPNote[]>(`/emr/notes/encounter/${encounterId}`);
      return extractItems<SOAPNote>(data);
    },
  });
}

export function usePatientVitals(patientId: string, enabled = true) {
  return useQuery({
    queryKey: ['patient-vitals', patientId],
    queryFn: async () => {
      const data = await api.get<VitalSigns[]>(`/emr/vitals/patient/${patientId}`);
      return extractItems<VitalSigns>(data);
    },
    enabled,
  });
}

export function usePatientDiagnoses(patientId: string, enabled = true) {
  return useQuery({
    queryKey: ['patient-diagnoses', patientId],
    queryFn: async () => {
      const data = await api.get<Diagnosis[]>(`/emr/patients/${patientId}/diagnoses`);
      return extractItems<Diagnosis>(data);
    },
    enabled,
  });
}

export function usePatientAllergies(patientId: string, enabled = true) {
  return useQuery({
    queryKey: ['patient-allergies', patientId],
    queryFn: async () => {
      const data = await api.get<Allergy[]>(`/emr/patients/${patientId}/allergies`);
      return extractItems<Allergy>(data);
    },
    enabled,
  });
}

// ─── Mutation Hooks ────────────────────────────────────

export function useSaveSOAPNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ encounterId, data }: { encounterId: string; data: SOAPFormData }) =>
      api.post('/emr/notes', {
        encounter_id: encounterId,
        note_type: 'soap',
        ...data,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['encounter-notes', variables.encounterId] });
    },
  });
}

export function useSignNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, encounterId }: { noteId: string; encounterId: string }) =>
      api.post(`/emr/notes/${noteId}/sign`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['encounter-notes', variables.encounterId] });
    },
  });
}

export function useSaveVitals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ patientId, encounterId, data }: { patientId: string; encounterId: string; data: VitalsFormData }) =>
      api.post('/emr/vitals', {
        patient_id: patientId,
        encounter_id: encounterId,
        heart_rate: data.heart_rate ? Number(data.heart_rate) : null,
        blood_pressure_systolic: data.blood_pressure_systolic ? Number(data.blood_pressure_systolic) : null,
        blood_pressure_diastolic: data.blood_pressure_diastolic ? Number(data.blood_pressure_diastolic) : null,
        temperature: data.temperature ? Number(data.temperature) : null,
        respiratory_rate: data.respiratory_rate ? Number(data.respiratory_rate) : null,
        oxygen_saturation: data.oxygen_saturation ? Number(data.oxygen_saturation) : null,
        weight_kg: data.weight_kg ? Number(data.weight_kg) : null,
        height_cm: data.height_cm ? Number(data.height_cm) : null,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patient-vitals', variables.patientId] });
    },
  });
}

export function useSaveDiagnosis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ patientId, encounterId, data }: { patientId: string; encounterId: string; data: DiagnosisFormData }) =>
      api.post('/emr/diagnoses', {
        patient_id: patientId,
        encounter_id: encounterId,
        ...data,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patient-diagnoses', variables.patientId] });
    },
  });
}

export function useCompleteEncounter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ encounterId, disposition }: { encounterId: string; disposition: string }) =>
      api.post(`/emr/encounters/${encounterId}/complete`, { disposition }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['encounter', variables.encounterId] });
    },
  });
}
