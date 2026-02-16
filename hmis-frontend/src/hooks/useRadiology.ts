/**
 * React Query hooks for Radiology Information System (RIS)
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  RadDashboardStats,
  RadOrder,
  RadStudy,
  RadReport,
  RadTemplate,
  RadOrderFilters,
  RadWorklistFilters,
  RadReportFilters,
  RadTemplateFilters,
  RadOrderCreateData,
  RadStudyCreateData,
  RadReportCreateData,
  RadReportUpdateData,
  PaginatedRadOrders,
  PaginatedRadStudies,
  PaginatedRadReports,
  PaginatedRadTemplates,
  PaginatedRadWorklist,
  RadModalityType,
} from '@/types/radiology';

// ─── Dashboard ─────────────────────────────────────────────

/**
 * Hook to fetch radiology dashboard statistics.
 */
export function useRadDashboard() {
  return useQuery({
    queryKey: ['radiology', 'dashboard'],
    queryFn: async () => {
      const response = await api.get<RadDashboardStats>('/radiology/dashboard');
      return response;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ─── Orders ────────────────────────────────────────────────

/**
 * Hook to fetch paginated and filtered radiology orders.
 */
export function useRadOrders(
  params: RadOrderFilters = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['radiology', 'orders', params],
    queryFn: async () => {
      const response = await api.get<PaginatedRadOrders>('/radiology/orders', params);
      return response;
    },
    ...(options?.enabled !== undefined ? { enabled: options.enabled } : {}),
  });
}

/**
 * Hook to fetch a single radiology order by ID.
 */
export function useRadOrder(
  orderId: string | undefined,
  options?: Omit<UseQueryOptions<RadOrder>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['radiology', 'orders', orderId],
    queryFn: async () => {
      if (!orderId) throw new Error('Order ID is required');
      const response = await api.get<RadOrder>(`/radiology/orders/${orderId}`);
      return response;
    },
    enabled: !!orderId,
    ...options,
  });
}

/**
 * Hook to create a new radiology order.
 * Automatically invalidates the orders list on success.
 */
export function useCreateRadOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RadOrderCreateData) => {
      const response = await api.post<RadOrder>('/radiology/orders', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'dashboard'] });
    },
  });
}

/**
 * Hook to update a radiology order.
 */
export function useUpdateRadOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<RadOrderCreateData>;
    }) => {
      const response = await api.patch<RadOrder>(`/radiology/orders/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'orders', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'dashboard'] });
    },
  });
}

/**
 * Hook to cancel a radiology order.
 */
export function useCancelRadOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      await api.patch(`/radiology/orders/${orderId}/cancel`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'dashboard'] });
    },
  });
}

// ─── Worklist ──────────────────────────────────────────────

/**
 * Hook to fetch technician worklist (scheduled studies).
 */
export function useRadWorklist(
  params: RadWorklistFilters = {},
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  return useQuery({
    queryKey: ['radiology', 'worklist', params],
    queryFn: async () => {
      const response = await api.get<PaginatedRadWorklist>('/radiology/worklist', params);
      return response;
    },
    refetchInterval: options?.refetchInterval ?? 30000, // Default 30 seconds
    ...(options?.enabled !== undefined ? { enabled: options.enabled } : {}),
  });
}

// ─── Studies ───────────────────────────────────────────────

/**
 * Hook to fetch a single study by ID.
 */
export function useRadStudy(
  studyId: string | undefined,
  options?: Omit<UseQueryOptions<RadStudy>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['radiology', 'studies', studyId],
    queryFn: async () => {
      if (!studyId) throw new Error('Study ID is required');
      const response = await api.get<RadStudy>(`/radiology/studies/${studyId}`);
      return response;
    },
    enabled: !!studyId,
    ...options,
  });
}

/**
 * Hook to fetch paginated studies.
 */
export function useRadStudies(
  params: { patient_id?: string; page?: number; page_size?: number } = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['radiology', 'studies', params],
    queryFn: async () => {
      const response = await api.get<PaginatedRadStudies>('/radiology/studies', params);
      return response;
    },
    ...(options?.enabled !== undefined ? { enabled: options.enabled } : {}),
  });
}

/**
 * Hook to create a study (called after DICOM images received).
 * Automatically invalidates affected queries on success.
 */
export function useCreateStudy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RadStudyCreateData) => {
      const response = await api.post<RadStudy>('/radiology/studies', data);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'studies'] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'worklist'] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'orders', data.order_id] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'dashboard'] });
    },
  });
}

/**
 * Hook to update study metadata.
 */
export function useUpdateStudy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<RadStudyCreateData>;
    }) => {
      const response = await api.patch<RadStudy>(`/radiology/studies/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'studies', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'studies'] });
    },
  });
}

/**
 * Hook to delete a study (admin only).
 */
export function useDeleteStudy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (studyId: string) => {
      await api.delete(`/radiology/studies/${studyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'studies'] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'dashboard'] });
    },
  });
}

// ─── Reports ───────────────────────────────────────────────

/**
 * Hook to fetch paginated radiology reports.
 */
export function useRadReports(
  params: RadReportFilters = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['radiology', 'reports', params],
    queryFn: async () => {
      const response = await api.get<PaginatedRadReports>('/radiology/reports', params);
      return response;
    },
    ...(options?.enabled !== undefined ? { enabled: options.enabled } : {}),
  });
}

/**
 * Hook to fetch a single report by ID.
 */
export function useRadReport(
  reportId: string | undefined,
  options?: Omit<UseQueryOptions<RadReport>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['radiology', 'reports', reportId],
    queryFn: async () => {
      if (!reportId) throw new Error('Report ID is required');
      const response = await api.get<RadReport>(`/radiology/reports/${reportId}`);
      return response;
    },
    enabled: !!reportId,
    ...options,
  });
}

/**
 * Hook to create a new radiology report.
 * Automatically invalidates affected queries on success.
 */
export function useCreateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RadReportCreateData) => {
      const response = await api.post<RadReport>('/radiology/reports', data);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'studies', data.study_id] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'dashboard'] });
    },
  });
}

/**
 * Hook to update a radiology report.
 */
export function useUpdateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: RadReportUpdateData;
    }) => {
      const response = await api.patch<RadReport>(`/radiology/reports/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'reports', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'dashboard'] });
    },
  });
}

/**
 * Hook to sign a radiology report (finalizes it).
 */
export function useSignReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const response = await api.post<RadReport>(
        `/radiology/reports/${reportId}/sign`,
        {}
      );
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'reports', data.id] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'dashboard'] });
    },
  });
}

// ─── Templates ─────────────────────────────────────────────

/**
 * Hook to fetch radiology report templates.
 */
export function useRadTemplates(
  params: RadTemplateFilters = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['radiology', 'templates', params],
    queryFn: async () => {
      const response = await api.get<PaginatedRadTemplates>(
        '/radiology/templates',
        params
      );
      return response;
    },
    ...(options?.enabled !== undefined ? { enabled: options.enabled } : {}),
  });
}

/**
 * Hook to fetch a single template by ID.
 */
export function useRadTemplate(
  templateId: string | undefined,
  options?: Omit<UseQueryOptions<RadTemplate>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['radiology', 'templates', templateId],
    queryFn: async () => {
      if (!templateId) throw new Error('Template ID is required');
      const response = await api.get<RadTemplate>(`/radiology/templates/${templateId}`);
      return response;
    },
    enabled: !!templateId,
    ...options,
  });
}

// ─── Modalities ────────────────────────────────────────────

export interface RadModalityInfo {
  code: RadModalityType;
  name: string;
  description?: string;
  ae_title?: string;
  ip_address?: string;
  port?: number;
  is_active: boolean;
}

/**
 * Hook to fetch available radiology modalities.
 */
export function useRadModalities() {
  return useQuery({
    queryKey: ['radiology', 'modalities'],
    queryFn: async () => {
      const response = await api.get<RadModalityInfo[]>('/radiology/modalities');
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (modalities rarely change)
  });
}

// ─── Mutations ────────────────────────────────────────────

/**
 * Hook to sign a radiology report.
 */
export function useSignRadReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const response = await api.post(`/radiology/reports/${reportId}/sign`, {});
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'reports'] });
    },
  });
}

/**
 * Hook to amend a radiology report.
 */
export function useAmendRadReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reportId, amendment }: { reportId: string; amendment: string }) => {
      const response = await api.post(`/radiology/reports/${reportId}/amend`, { amendment });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'reports'] });
    },
  });
}

// ─── Missing Hooks (Aliases and Additional) ────────────────

/**
 * Alias for useCreateReport (backward compatibility)
 */
export const useCreateRadReport = useCreateReport;

/**
 * Alias for useUpdateReport (backward compatibility)
 */
export const useUpdateRadReport = useUpdateReport;

/**
 * Hook to fetch report for a specific study.
 */
export function useStudyReport(studyId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['radiology', 'studies', studyId, 'report'],
    queryFn: async () => {
      if (!studyId) throw new Error('Study ID is required');
      const response = await api.get<RadReport>(`/radiology/studies/${studyId}/report`);
      return response;
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!studyId,
  });
}

/**
 * Hook to fetch all radiology studies for a specific patient.
 */
export function usePatientRadStudies(patientId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['radiology', 'patients', patientId, 'studies'],
    queryFn: async () => {
      if (!patientId) throw new Error('Patient ID is required');
      const response = await api.get<PaginatedRadStudies>(`/radiology/patients/${patientId}/studies`);
      return response;
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!patientId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to create a radiology template.
 */
export function useCreateRadTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<RadTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      const response = await api.post<RadTemplate>('/radiology/templates', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'templates'] });
    },
  });
}

/**
 * Hook to update a radiology template.
 */
export function useUpdateRadTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, data }: { templateId: string; data: Partial<RadTemplate> }) => {
      const response = await api.put<RadTemplate>(`/radiology/templates/${templateId}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'templates', variables.templateId] });
      queryClient.invalidateQueries({ queryKey: ['radiology', 'templates'] });
    },
  });
}

/**
 * Hook to delete a radiology template.
 */
export function useDeleteRadTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const response = await api.delete(`/radiology/templates/${templateId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology', 'templates'] });
    },
  });
}
