import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'M' | 'F' | 'O';
  blood_type?: string;
  phone_number?: string;
  email?: string;
  document_type: string;
  document_number: string;
  status: string;
  created_at: string;
}

export interface PatientsResponse {
  items: Patient[];
  total: number;
  page: number;
  page_size: number;
}

export interface PatientSearchParams {
  page?: number;
  page_size?: number;
  query?: string;
  gender?: string;
  document_type?: string;
  status?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface PatientCreateData {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'M' | 'F' | 'O';
  document_type: string;
  document_number: string;
  phone_number?: string;
  email?: string;
  blood_type?: string;
  allergies?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  insurance_policies?: Array<{
    insurer_name: string;
    policy_number: string;
    is_primary: boolean;
  }>;
}

/**
 * Hook to fetch paginated and filtered patients list.
 */
export function usePatients(
  params: PatientSearchParams = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['patients', params],
    queryFn: async () => {
      const response = await api.get<PatientsResponse>('/patients/search', params);
      return response;
    },
    ...(options?.enabled !== undefined ? { enabled: options.enabled } : {}),
  });
}

/**
 * Hook to fetch a single patient by ID.
 */
export function usePatient(patientId: string | undefined, options?: Omit<UseQueryOptions<Patient>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: ['patients', patientId],
    queryFn: async () => {
      if (!patientId) throw new Error('Patient ID is required');
      const response = await api.get<Patient>(`/patients/${patientId}`);
      return response;
    },
    enabled: !!patientId,
    ...options,
  });
}

/**
 * Hook to create a new patient.
 * Automatically invalidates the patients list on success.
 */
export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PatientCreateData) => {
      const response = await api.post<Patient>('/patients', data);
      return response;
    },
    onSuccess: () => {
      // Invalidate all patients queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

/**
 * Hook to update an existing patient.
 * Automatically invalidates affected queries on success.
 */
export function useUpdatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PatientCreateData> }) => {
      const response = await api.patch<Patient>(`/patients/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      // Invalidate specific patient and list
      queryClient.invalidateQueries({ queryKey: ['patients', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

/**
 * Hook to soft delete a patient.
 * Automatically invalidates queries on success.
 */
export function useDeletePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patientId: string) => {
      await api.delete(`/patients/${patientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

/**
 * Hook to fetch patient statistics.
 */
export function usePatientStats() {
  return useQuery({
    queryKey: ['patients', 'stats'],
    queryFn: async () => {
      const response = await api.get<{
        total_patients: number;
        new_this_month: number;
        active_patients: number;
      }>('/patients/stats');
      return response;
    },
    staleTime: 5 * 60 * 1000, // Stats can be stale for 5 minutes
  });
}
