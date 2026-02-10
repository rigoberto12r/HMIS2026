/**
 * React Query hooks for Patient Detail Page
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────

export interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  document_type: string;
  document_number: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  blood_type: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  scheduled_at: string;
  appointment_type: string;
  provider_name: string;
  status: string;
  notes?: string | null;
}

export interface Diagnosis {
  id: string;
  patient_id: string;
  icd10_code: string;
  description: string;
  diagnosed_at: string;
  provider_name: string;
  notes?: string | null;
  status: string;
}

export interface Allergy {
  id: string;
  patient_id: string;
  allergen: string;
  severity: string;
  reaction?: string | null;
  noted_at: string;
}

// ─── Hooks ─────────────────────────────────────────────

export function usePatient(patientId: string) {
  return useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api.get<Patient>(`/patients/${patientId}`),
    staleTime: 60 * 1000, // 1 minute
    enabled: !!patientId,
  });
}

export function usePatientAppointments(patientId: string, enabled = true) {
  return useQuery({
    queryKey: ['patient-appointments', patientId],
    queryFn: async () => {
      const data = await api.get<Appointment[]>('/appointments', {
        patient_id: patientId,
      });
      return Array.isArray(data) ? data : [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: enabled && !!patientId,
  });
}

export function usePatientInvoices(patientId: string, enabled = true) {
  return useQuery({
    queryKey: ['patient-invoices', patientId],
    queryFn: async () => {
      const data = await api.get('/billing/invoices', {
        patient_id: patientId,
      });
      return Array.isArray(data) ? data : [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: enabled && !!patientId,
  });
}

export function usePatientDiagnoses(patientId: string, enabled = true) {
  return useQuery({
    queryKey: ['patient-diagnoses', patientId],
    queryFn: () => api.get<Diagnosis[]>(`/emr/patients/${patientId}/diagnoses`),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: enabled && !!patientId,
  });
}

export function usePatientAllergies(patientId: string, enabled = true) {
  return useQuery({
    queryKey: ['patient-allergies', patientId],
    queryFn: () => api.get<Allergy[]>(`/emr/patients/${patientId}/allergies`),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: enabled && !!patientId,
  });
}
