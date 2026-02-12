import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Appointment {
  id: string;
  patient_id: string;
  patient_name?: string;
  appointment_datetime: string;
  appointment_type: string;
  status: 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  provider_name?: string;
  reason?: string;
  notes?: string;
  duration_minutes?: number;
  created_at: string;
}

export interface AppointmentsResponse {
  items: Appointment[];
  total: number;
  page: number;
  page_size: number;
}

export interface AppointmentSearchParams {
  page?: number;
  page_size?: number;
  date_from?: string;
  date_to?: string;
  status?: string;
  patient_id?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface AppointmentCreateData {
  patient_id: string;
  provider_id: string;
  scheduled_start: string;
  scheduled_end: string;
  appointment_type?: string;
  reason?: string;
  notes?: string;
  location_id?: string;
  source?: string;
}

/**
 * Hook to fetch appointments with filters.
 */
export function useAppointments(params: AppointmentSearchParams = {}) {
  return useQuery({
    queryKey: ['appointments', params],
    queryFn: async () => {
      const response = await api.get<AppointmentsResponse>('/appointments', params);
      return response;
    },
  });
}

/**
 * Hook to fetch a single appointment by ID.
 */
export function useAppointment(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ['appointments', appointmentId],
    queryFn: async () => {
      if (!appointmentId) throw new Error('Appointment ID is required');
      const response = await api.get<Appointment>(`/appointments/${appointmentId}`);
      return response;
    },
    enabled: !!appointmentId,
  });
}

/**
 * Hook to create a new appointment.
 */
export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AppointmentCreateData) => {
      const response = await api.post<Appointment>('/appointments', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

/**
 * Hook to update appointment status.
 */
export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Appointment['status'] }) => {
      const response = await api.patch<Appointment>(`/appointments/${id}/status`, { status });
      return response;
    },
    onMutate: async ({ id, status }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['appointments'] });

      const previousData = queryClient.getQueryData(['appointments']);

      queryClient.setQueryData(['appointments', id], (old: Appointment | undefined) => {
        if (!old) return old;
        return { ...old, status };
      });

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['appointments'], context.previousData);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['appointments', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

/**
 * Hook to check in a patient for an appointment.
 * Backend: PATCH /appointments/{id}/status with AppointmentStatusUpdate schema
 */
export function useCheckInAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await api.patch<Appointment>(`/appointments/${appointmentId}/status`, {
        status: 'arrived',
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

/**
 * Hook to cancel an appointment.
 * Backend: PATCH /appointments/{id}/status with AppointmentStatusUpdate schema
 */
export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await api.patch<Appointment>(`/appointments/${id}/status`, {
        status: 'cancelled',
        cancellation_reason: reason,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

/**
 * Hook to fetch appointment statistics.
 */
export function useAppointmentStats(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['appointments', 'stats', { dateFrom, dateTo }],
    queryFn: async () => {
      const response = await api.get<{
        total: number;
        scheduled: number;
        completed: number;
        cancelled: number;
        no_show: number;
      }>('/appointments/stats', { date_from: dateFrom, date_to: dateTo });
      return response;
    },
    staleTime: 5 * 60 * 1000,
  });
}
