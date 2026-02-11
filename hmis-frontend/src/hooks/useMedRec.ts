import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface HomeMedication {
  name: string;
  dose?: string;
  frequency?: string;
  route?: string;
  source: string;
  last_taken?: string;
}

export interface MedicationDecision {
  prescription_id: string;
  action: 'continue' | 'discontinue';
  reason?: string;
}

export interface NewMedicationEntry {
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  reason?: string;
}

export interface MedRecResponse {
  id: string;
  encounter_id: string;
  patient_id: string;
  reconciliation_type: string;
  status: string;
  home_medications: HomeMedication[] | null;
  continue_medications: Record<string, unknown>[] | null;
  discontinue_medications: Record<string, unknown>[] | null;
  new_medications: Record<string, unknown>[] | null;
  changes: Record<string, unknown>[] | null;
  reconciled_by: string | null;
  reconciled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StartMedRecData {
  encounter_id: string;
  patient_id: string;
  reconciliation_type: 'admission' | 'transfer' | 'discharge';
  home_medications?: HomeMedication[];
}

export interface CompleteMedRecData {
  decisions?: MedicationDecision[];
  new_medications?: NewMedicationEntry[];
  notes?: string;
}

/**
 * Fetch medication reconciliation for an encounter.
 */
export function useMedRecByEncounter(encounterId: string | undefined) {
  return useQuery({
    queryKey: ['med-rec', 'encounter', encounterId],
    queryFn: async () => {
      if (!encounterId) throw new Error('Encounter ID is required');
      return api.get<MedRecResponse>(
        `/pharmacy/medication-reconciliation/encounter/${encounterId}`
      );
    },
    enabled: !!encounterId,
    retry: false,
  });
}

/**
 * Start a new medication reconciliation.
 */
export function useStartMedRec() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StartMedRecData) =>
      api.post<MedRecResponse>('/pharmacy/medication-reconciliation', data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['med-rec', 'encounter', variables.encounter_id],
      });
    },
  });
}

/**
 * Update home medications for a reconciliation.
 */
export function useUpdateHomeMeds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      medRecId,
      home_medications,
    }: {
      medRecId: string;
      home_medications: HomeMedication[];
    }) =>
      api.put<MedRecResponse>(
        `/pharmacy/medication-reconciliation/${medRecId}/home-medications`,
        { home_medications }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['med-rec'] });
    },
  });
}

/**
 * Complete a medication reconciliation.
 */
export function useCompleteMedRec() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      medRecId,
      data,
    }: {
      medRecId: string;
      data: CompleteMedRecData;
    }) =>
      api.put<MedRecResponse>(
        `/pharmacy/medication-reconciliation/${medRecId}/complete`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['med-rec'] });
    },
  });
}

/**
 * Fetch reconciliation history for a patient.
 */
export function useMedRecHistory(patientId: string | undefined) {
  return useQuery({
    queryKey: ['med-rec', 'patient', patientId],
    queryFn: async () => {
      if (!patientId) throw new Error('Patient ID is required');
      return api.get<MedRecResponse[]>(
        `/pharmacy/medication-reconciliation/patient/${patientId}`
      );
    },
    enabled: !!patientId,
  });
}
