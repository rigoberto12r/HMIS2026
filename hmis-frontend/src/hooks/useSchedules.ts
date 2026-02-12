import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ScheduleTemplate {
  id: string;
  provider_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_min: number;
  max_overbooking: number;
  is_active: boolean;
}

export interface ScheduleBlock {
  id: string;
  provider_id: string;
  start_datetime: string;
  end_datetime: string;
  reason: string;
  description: string | null;
  created_at: string;
}

export function useScheduleTemplates(params?: { provider_id?: string }) {
  return useQuery({
    queryKey: ['schedule-templates', params],
    queryFn: () => api.get<ScheduleTemplate[]>('/appointments/schedules', params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateScheduleTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      provider_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      slot_duration_min?: number;
      max_overbooking?: number;
    }) => api.post<ScheduleTemplate>('/appointments/schedules', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-templates'] });
    },
  });
}

export function useUpdateScheduleTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      api.patch<ScheduleTemplate>(`/appointments/schedules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-templates'] });
    },
  });
}

export function useDeleteScheduleTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/appointments/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-templates'] });
    },
  });
}

export function useScheduleBlocks(params?: { provider_id?: string }) {
  return useQuery({
    queryKey: ['schedule-blocks', params],
    queryFn: () => api.get<ScheduleBlock[]>('/appointments/schedule-blocks', params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateScheduleBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      provider_id: string;
      start_datetime: string;
      end_datetime: string;
      reason: string;
      description?: string;
    }) => api.post<ScheduleBlock>('/appointments/schedule-blocks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-blocks'] });
    },
  });
}

export function useDeleteScheduleBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/appointments/schedule-blocks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-blocks'] });
    },
  });
}
