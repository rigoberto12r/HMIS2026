import { useQuery, useMutation, UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────

export interface CDSAlert {
  alert_type: 'drug_interaction' | 'allergy' | 'duplicate_therapy';
  severity: 'critical' | 'major' | 'moderate' | 'minor';
  summary: string;
  detail: string;
  source: string;
  interacting_drug?: string;
  management?: string;
}

export interface CDSCheckResponse {
  medication_name: string;
  patient_id: string;
  alerts: CDSAlert[];
  has_critical: boolean;
  has_major: boolean;
  checked_at: string;
  total_alerts: number;
}

export interface CDSCheckRequest {
  patient_id: string;
  medication_name: string;
  product_id?: string;
  encounter_id?: string;
}

export interface CDSOverrideRequest {
  prescription_id: string;
  patient_id: string;
  alert_type: string;
  alert_severity: string;
  alert_summary: string;
  override_reason: string;
  alert_details_json?: Record<string, unknown>;
}

export interface CDSOverrideResponse {
  id: string;
  prescription_id: string;
  patient_id: string;
  overridden_by: string;
  alert_type: string;
  alert_severity: string;
  alert_summary: string;
  override_reason: string;
  created_at: string;
}

// ─── Hooks ──────────────────────────────────────────────

/**
 * Hook to run CDS medication safety check.
 * Enabled only when params are provided.
 */
export function useCDSCheck(
  params: CDSCheckRequest | null,
  options?: Omit<UseQueryOptions<CDSCheckResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['cds', 'check', params],
    queryFn: async () => {
      if (!params) throw new Error('CDS check params required');
      return api.post<CDSCheckResponse>('/cds/check', params);
    },
    enabled: !!params,
    staleTime: 0,
    ...options,
  });
}

/**
 * Mutation hook to record a CDS alert override (audit trail).
 */
export function useCDSOverride() {
  return useMutation({
    mutationFn: async (data: CDSOverrideRequest) => {
      return api.post<CDSOverrideResponse>('/cds/overrides', data);
    },
  });
}
