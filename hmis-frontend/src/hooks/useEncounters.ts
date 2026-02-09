import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Encounter {
  id: string;
  patient_id: string;
  patient_name?: string;
  encounter_type: 'outpatient' | 'inpatient' | 'emergency' | 'telemedicine';
  start_datetime: string;
  end_datetime?: string;
  status: 'active' | 'completed' | 'cancelled';
  reason: string;
  provider_name?: string;
  chief_complaint?: string;
  soap_note?: SOAPNote;
  diagnoses: Diagnosis[];
  orders: Order[];
  created_at: string;
}

export interface SOAPNote {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface Diagnosis {
  id: string;
  code: string;
  description: string;
  type: 'primary' | 'secondary';
}

export interface Order {
  id: string;
  order_type: 'lab' | 'imaging' | 'medication' | 'procedure';
  description: string;
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
}

export interface EncountersResponse {
  items: Encounter[];
  total: number;
  page: number;
  page_size: number;
}

export interface EncounterSearchParams {
  page?: number;
  page_size?: number;
  patient_id?: string;
  status?: string;
  encounter_type?: string;
  date_from?: string;
  date_to?: string;
}

export interface EncounterCreateData {
  patient_id: string;
  encounter_type: 'outpatient' | 'inpatient' | 'emergency' | 'telemedicine';
  reason: string;
  chief_complaint?: string;
  provider_name?: string;
}

/**
 * Hook to fetch encounters with filters.
 */
export function useEncounters(params: EncounterSearchParams = {}) {
  return useQuery({
    queryKey: ['encounters', params],
    queryFn: async () => {
      const response = await api.get<EncountersResponse>('/emr/encounters', params);
      return response;
    },
  });
}

/**
 * Hook to fetch a single encounter by ID with full details.
 */
export function useEncounter(encounterId: string | undefined) {
  return useQuery({
    queryKey: ['encounters', encounterId],
    queryFn: async () => {
      if (!encounterId) throw new Error('Encounter ID is required');
      const response = await api.get<Encounter>(`/emr/encounters/${encounterId}`);
      return response;
    },
    enabled: !!encounterId,
  });
}

/**
 * Hook to create a new encounter.
 */
export function useCreateEncounter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EncounterCreateData) => {
      const response = await api.post<Encounter>('/emr/encounters', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounters'] });
    },
  });
}

/**
 * Hook to update SOAP note for an encounter.
 */
export function useUpdateSOAPNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ encounterId, soapNote }: { encounterId: string; soapNote: SOAPNote }) => {
      const response = await api.patch<Encounter>(`/emr/encounters/${encounterId}/soap`, soapNote);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['encounters', variables.encounterId] });
    },
  });
}

/**
 * Hook to add a diagnosis to an encounter.
 */
export function useAddDiagnosis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      encounterId,
      code,
      description,
      type,
    }: {
      encounterId: string;
      code: string;
      description: string;
      type: 'primary' | 'secondary';
    }) => {
      const response = await api.post<Diagnosis>(`/emr/encounters/${encounterId}/diagnoses`, {
        code,
        description,
        type,
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['encounters', variables.encounterId] });
    },
  });
}

/**
 * Hook to create an order (lab, imaging, medication, etc.).
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      encounterId,
      order_type,
      description,
      notes,
    }: {
      encounterId: string;
      order_type: Order['order_type'];
      description: string;
      notes?: string;
    }) => {
      const response = await api.post<Order>(`/emr/encounters/${encounterId}/orders`, {
        order_type,
        description,
        notes,
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['encounters', variables.encounterId] });
    },
  });
}

/**
 * Hook to complete an encounter.
 */
export function useCompleteEncounter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (encounterId: string) => {
      const response = await api.post<Encounter>(`/emr/encounters/${encounterId}/complete`);
      return response;
    },
    onSuccess: (_, encounterId) => {
      queryClient.invalidateQueries({ queryKey: ['encounters', encounterId] });
      queryClient.invalidateQueries({ queryKey: ['encounters'] });
    },
  });
}
