/**
 * React Query hooks for SMART on FHIR OAuth2 client management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SmartClient {
  id: string;
  client_id: string;
  client_name: string;
  client_type: string;
  scope: string;
  is_active: boolean;
}

export interface RegisterClientRequest {
  client_name: string;
  client_type: 'public' | 'confidential';
  redirect_uris: string[];
  scope: string;
  launch_uri?: string;
}

export interface RegisterClientResponse extends SmartClient {
  client_secret: string;
  redirect_uris: string[];
  launch_uri: string | null;
}

export function useSmartClients() {
  return useQuery({
    queryKey: ['smart-clients'],
    queryFn: () => api.get<SmartClient[]>('/smart/clients'),
    retry: false,
  });
}

export function useRegisterSmartClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterClientRequest) =>
      api.post<RegisterClientResponse>('/smart/clients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-clients'] });
    },
  });
}

export function useDeleteSmartClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      api.delete<void>(`/smart/clients/${clientId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-clients'] });
    },
  });
}
