/**
 * React Query hooks for Laboratory Information System (LIS)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  LabDashboardStats,
  LabOrder,
  LabOrderFilters,
  LabOrderCreateData,
  LabSpecimenReceiveData,
  LabResultEntryData,
  LabResultValidationData,
  LabTest,
  PaginatedLabOrders,
  PaginatedLabTests,
} from '@/types/laboratory';

// ─── Dashboard ──────────────────────────────────────────

/**
 * Hook to fetch laboratory dashboard statistics.
 * Refetches every 30 seconds to show real-time data.
 */
export function useLabDashboard() {
  return useQuery({
    queryKey: ['laboratory', 'dashboard'],
    queryFn: async () => {
      const response = await api.get<LabDashboardStats>('/laboratory/dashboard');
      return response;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 20000, // Data is fresh for 20 seconds
  });
}

// ─── Lab Orders ─────────────────────────────────────────

/**
 * Hook to fetch paginated and filtered lab orders.
 */
export function useLabOrders(filters: LabOrderFilters = {}) {
  return useQuery({
    queryKey: ['laboratory', 'orders', filters],
    queryFn: async () => {
      const response = await api.get<PaginatedLabOrders>('/laboratory/orders', filters);
      return response;
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch a single lab order by ID with all details.
 */
export function useLabOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ['laboratory', 'orders', orderId],
    queryFn: async () => {
      if (!orderId) throw new Error('Order ID is required');
      const response = await api.get<LabOrder>(`/laboratory/orders/${orderId}`);
      return response;
    },
    enabled: !!orderId,
  });
}

/**
 * Hook to create a new lab order.
 * Automatically invalidates orders list on success.
 */
export function useCreateLabOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LabOrderCreateData) => {
      const response = await api.post<LabOrder>('/laboratory/orders', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'dashboard'] });
    },
  });
}

/**
 * Hook to cancel a lab order.
 */
export function useCancelLabOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason?: string }) => {
      const response = await api.post(`/laboratory/orders/${orderId}/cancel`, { reason });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'orders', variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'dashboard'] });
    },
  });
}

// ─── Specimen Management ────────────────────────────────

/**
 * Hook to receive a specimen for a lab order.
 * Updates order status to 'received'.
 */
export function useReceiveSpecimen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LabSpecimenReceiveData) => {
      const response = await api.post('/laboratory/specimens/receive', data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'orders', variables.order_id] });
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'dashboard'] });
    },
  });
}

// ─── Results Management ─────────────────────────────────

/**
 * Hook to enter results for a lab test.
 */
export function useEnterResults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LabResultEntryData) => {
      const response = await api.post('/laboratory/results/enter', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'dashboard'] });
    },
  });
}

/**
 * Hook to validate a lab result.
 * Only authorized personnel can validate.
 */
export function useValidateResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LabResultValidationData) => {
      const response = await api.post('/laboratory/results/validate', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'dashboard'] });
    },
  });
}

// ─── Lab Tests Catalog ──────────────────────────────────

/**
 * Hook to fetch lab tests catalog.
 * Used for test selection in order creation.
 */
export function useLabTests(params: { category?: string; search?: string } = {}) {
  return useQuery({
    queryKey: ['laboratory', 'tests', params],
    queryFn: async () => {
      const response = await api.get<PaginatedLabTests>('/laboratory/tests', {
        ...params,
        page_size: 100, // Load all active tests
      });
      return response;
    },
    staleTime: 5 * 60 * 1000, // Test catalog is stable, cache for 5 minutes
  });
}

/**
 * Hook to fetch a single lab test by ID.
 */
export function useLabTest(testId: string | undefined) {
  return useQuery({
    queryKey: ['laboratory', 'tests', testId],
    queryFn: async () => {
      if (!testId) throw new Error('Test ID is required');
      const response = await api.get<LabTest>(`/laboratory/tests/${testId}`);
      return response;
    },
    enabled: !!testId,
  });
}

// ─── Critical Values ────────────────────────────────────

/**
 * Hook to fetch orders with critical values.
 * Used in critical values monitoring page.
 */
export function useCriticalValues(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['laboratory', 'critical-values'],
    queryFn: async () => {
      const response = await api.get<PaginatedLabOrders>('/laboratory/critical-values', {
        page: 1,
        page_size: 50,
      });
      return response;
    },
    refetchInterval: options?.refetchInterval ?? 60000, // Refetch every minute for critical alerts (default)
    staleTime: 30000,
  });
}

/**
 * Hook to mark critical value as acknowledged.
 */
export function useAcknowledgeCriticalValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderTestId, notes }: { orderTestId: string; notes?: string }) => {
      const response = await api.post(`/laboratory/critical-values/${orderTestId}/acknowledge`, {
        notes,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'critical-values'] });
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'dashboard'] });
    },
  });
}
