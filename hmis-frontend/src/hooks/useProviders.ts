import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Provider {
  id: string;
  first_name: string;
  last_name: string;
  specialty_code: string | null;
  specialty_name: string | null;
  license_number: string;
  consultation_duration_min: number;
  status: string;
  created_at: string;
}

interface PaginatedProviders {
  items: Provider[];
  total: number;
  page: number;
  page_size: number;
}

export function useProviders(params?: { specialty?: string; page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ['providers', params],
    queryFn: () => api.get<PaginatedProviders>('/appointments/providers', params),
    staleTime: 2 * 60 * 1000,
  });
}
