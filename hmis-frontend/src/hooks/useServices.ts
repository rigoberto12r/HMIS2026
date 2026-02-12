import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ServiceCatalog {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  base_price: number;
  tax_rate: number;
  currency: string;
  cpt_code: string | null;
  created_at: string;
}

interface PaginatedServices {
  items: ServiceCatalog[];
  total: number;
  page: number;
  page_size: number;
}

export function useServices(params?: { page?: number; page_size?: number; query?: string; category?: string }) {
  return useQuery({
    queryKey: ['services', params],
    queryFn: () => api.get<PaginatedServices>('/billing/services', params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      code: string;
      name: string;
      description?: string;
      category: string;
      base_price: number;
      tax_rate?: number;
      currency?: string;
      cpt_code?: string;
    }) => api.post('/billing/services', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string;
      name?: string;
      description?: string;
      category?: string;
      base_price?: number;
      tax_rate?: number;
      currency?: string;
      cpt_code?: string;
    }) => api.patch(`/billing/services/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serviceId: string) => api.delete(`/billing/services/${serviceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}
