import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface UserRole {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  permissions: string[];
  is_system_role: boolean;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  license_number: string | null;
  specialty: string | null;
  department: string | null;
  is_active: boolean;
  is_verified: boolean;
  mfa_enabled: boolean;
  language: string;
  timezone: string;
  roles: UserRole[];
  last_login: string | null;
  created_at: string;
}

interface PaginatedUsers {
  items: User[];
  total: number;
  page: number;
  page_size: number;
}

export function useUsers(params?: { page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => api.get<PaginatedUsers>('/auth/users', params),
    staleTime: 60 * 1000,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get<UserRole[]>('/auth/roles'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
      phone?: string;
      specialty?: string;
      department?: string;
      role_ids?: string[];
    }) => api.post('/auth/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
      specialty?: string;
      department?: string;
      is_active?: boolean;
    }) => api.patch(`/auth/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => api.delete(`/auth/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
