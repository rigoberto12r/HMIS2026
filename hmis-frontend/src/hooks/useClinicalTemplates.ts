import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ClinicalTemplate {
  id: string;
  name: string;
  specialty_code: string | null;
  template_type: string;
  version: number;
  schema_json: Record<string, unknown>;
  ui_layout_json: Record<string, unknown> | null;
  is_default: boolean;
  created_at: string;
}

export function useClinicalTemplates(params?: { specialty_code?: string; template_type?: string }) {
  return useQuery({
    queryKey: ['clinical-templates', params],
    queryFn: () => api.get<ClinicalTemplate[]>('/emr/templates', params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateClinicalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      specialty_code?: string;
      template_type: string;
      schema_json: Record<string, unknown>;
      ui_layout_json?: Record<string, unknown>;
      is_default?: boolean;
    }) => api.post<ClinicalTemplate>('/emr/templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-templates'] });
    },
  });
}

export function useUpdateClinicalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      api.patch<ClinicalTemplate>(`/emr/templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-templates'] });
    },
  });
}

export function useDeleteClinicalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/emr/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-templates'] });
    },
  });
}
