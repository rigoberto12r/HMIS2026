/**
 * React Query hooks for Pharmacy Module
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Product,
  Prescription,
  Lot,
  InventoryAlert,
  PharmacyStats,
  PaginatedResponse,
} from '@/app/(app)/pharmacy/types';

// ─── Stats ─────────────────────────────────────────────

export function usePharmacyStats() {
  return useQuery({
    queryKey: ['pharmacy-stats'],
    queryFn: () => api.get<PharmacyStats>('/pharmacy/stats'),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ─── Prescriptions ─────────────────────────────────────

export function usePrescriptions(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  patient_id?: string;
}) {
  return useQuery({
    queryKey: ['prescriptions', params],
    queryFn: () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.patient_id) queryParams.append('patient_id', params.patient_id);

      return api.get<PaginatedResponse<Prescription>>(
        `/pharmacy/prescriptions?${queryParams.toString()}`
      );
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Dispense a prescription.
 * Backend: POST /pharmacy/dispensations with DispensationCreate schema
 */
export function useDispensePrescription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      prescriptionId,
      lotId,
      patientId,
      quantity,
      notes,
    }: {
      prescriptionId: string;
      lotId: string;
      patientId: string;
      quantity: number;
      notes?: string;
    }) =>
      api.post('/pharmacy/dispensations', {
        prescription_id: prescriptionId,
        product_lot_id: lotId,
        patient_id: patientId,
        quantity_dispensed: quantity,
        notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
    },
  });
}

/**
 * Cancel a prescription.
 * Backend: POST /pharmacy/prescriptions/{id}/cancel with PrescriptionCancel schema
 */
export function useCancelPrescription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ prescriptionId, reason }: { prescriptionId: string; reason: string }) =>
      api.post(`/pharmacy/prescriptions/${prescriptionId}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy-stats'] });
    },
  });
}

// ─── Products ──────────────────────────────────────────

export function useProducts(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  category?: string;
}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.category) queryParams.append('category', params.category);

      return api.get<PaginatedResponse<Product>>(
        `/pharmacy/products?${queryParams.toString()}`
      );
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ─── Lots ──────────────────────────────────────────────

export function useProductLots(productId: string, enabled = true) {
  return useQuery({
    queryKey: ['product-lots', productId],
    queryFn: () => api.get<Lot[]>(`/pharmacy/products/${productId}/lots`),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useExpiringLots(days = 90) {
  return useQuery({
    queryKey: ['expiring-lots', days],
    queryFn: () => api.get<Lot[]>(`/pharmacy/lots/expiring?days=${days}`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ─── Alerts ────────────────────────────────────────────

/**
 * Fetch inventory alerts.
 * Backend: GET /pharmacy/inventory/alerts
 */
export function useInventoryAlerts() {
  return useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: () => api.get<InventoryAlert[]>('/pharmacy/inventory/alerts'),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
