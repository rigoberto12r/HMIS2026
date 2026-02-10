/**
 * React Query hooks for Dashboard Page
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Invoice } from './useInvoices';

// ─── Types ─────────────────────────────────────────────

export interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  document_number: string;
  gender: string;
  age: number;
  phone: string;
  email: string;
  status: string;
  insurance: string;
  last_visit: string;
}

export interface Appointment {
  id: string;
  time: string;
  patient: string;
  patient_name?: string;
  provider: string;
  type: string;
  status: string;
  duration: string;
  scheduled_date?: string;
  scheduled_time?: string;
  notes?: string;
  created_at?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ARAgingReport {
  generated_at: string;
  currency: string;
  items: Array<{
    invoice_number: string;
    patient_name: string;
    balance: number;
    days_outstanding: number;
    aging_bucket: string;
  }>;
  summary: Record<string, number>;
  total_receivable: number;
}

// ─── Hooks ─────────────────────────────────────────────

export function useDashboardPatients() {
  return useQuery({
    queryKey: ['dashboard-patients'],
    queryFn: () =>
      api.get<PaginatedResponse<Patient>>('/patients/search', {
        page: 1,
        page_size: 5,
      }),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useDashboardAppointments() {
  return useQuery({
    queryKey: ['dashboard-appointments'],
    queryFn: () =>
      api.get<PaginatedResponse<Appointment>>('/appointments', {
        page: 1,
        page_size: 5,
      }),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useDashboardInvoices() {
  return useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: () =>
      api.get<PaginatedResponse<Invoice>>('/billing/invoices', {
        page: 1,
        page_size: 5,
      }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useARAgingReport() {
  return useQuery({
    queryKey: ['ar-aging-report'],
    queryFn: () => api.get<ARAgingReport>('/billing/reports/ar-aging'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Only retry once if fails
  });
}
