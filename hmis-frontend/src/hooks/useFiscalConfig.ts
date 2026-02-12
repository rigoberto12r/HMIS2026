import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface FiscalConfig {
  id: string;
  country_code: string;
  tax_id: string;
  fiscal_regime: string | null;
  business_name: string;
  default_tax_rate: number;
  tax_name: string;
  created_at: string;
}

export interface RNCValidationResult {
  tax_id: string;
  valid: boolean;
  document_type: string;
  formatted: string | null;
  message: string;
}

export function useFiscalConfig() {
  return useQuery({
    queryKey: ['fiscal-config'],
    queryFn: async () => {
      // Fiscal config may not exist yet, so handle 404 gracefully
      try {
        const result = await api.get<FiscalConfig[]>('/billing/fiscal-config');
        return Array.isArray(result) ? result : [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveFiscalConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      country_code: string;
      tax_id: string;
      fiscal_regime?: string;
      business_name: string;
      business_address?: string;
      sequence_prefix?: string;
      default_tax_rate?: number;
      tax_name?: string;
    }) => api.post('/billing/fiscal-config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-config'] });
    },
  });
}

export function useValidateRNC() {
  return useMutation({
    mutationFn: (data: { tax_id: string; country_code: string }) =>
      api.post<RNCValidationResult>('/billing/fiscal/validate-rnc', data),
  });
}
