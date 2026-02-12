import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface InsurerContract {
  id: string;
  insurer_name: string;
  insurer_code: string;
  contract_number: string;
  effective_date: string;
  expiration_date: string | null;
  status: string;
  created_at: string;
}

interface PaginatedInsurers {
  items: InsurerContract[];
  total: number;
  page: number;
  page_size: number;
}

export function useInsurers(params?: { status?: string; page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ['insurers', params],
    queryFn: () => api.get<PaginatedInsurers>('/billing/insurers', params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateInsurer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      insurer_name: string;
      insurer_code: string;
      contract_number: string;
      effective_date: string;
      expiration_date?: string;
      status?: string;
    }) => api.post<InsurerContract>('/billing/insurers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurers'] });
    },
  });
}

export function useUpdateInsurer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      api.patch<InsurerContract>(`/billing/insurers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurers'] });
    },
  });
}

export function useDeleteInsurer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/billing/insurers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurers'] });
    },
  });
}
