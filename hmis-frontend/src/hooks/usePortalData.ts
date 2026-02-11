/**
 * React Query hooks for Patient Portal
 * Centralized data fetching with automatic caching and refetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portalApi } from '@/lib/portal-api';

// ─── Types ─────────────────────────────────────────────

interface DashboardStats {
  upcoming_appointments_count: number;
  pending_prescriptions_count: number;
  unread_lab_results_count: number;
  outstanding_balance: number;
  last_visit_date: string | null;
}

interface Appointment {
  id: string;
  provider_name: string;
  provider_specialty: string | null;
  scheduled_start: string;
  appointment_type: string;
  status: string;
}

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  created_at: string;
  action_url: string | null;
}

interface DashboardData {
  stats: DashboardStats;
  upcoming_appointments: Appointment[];
  recent_alerts: Alert[];
}

interface MedicalRecord {
  id: string;
  encounter_id: string;
  provider_name: string;
  visit_date: string;
  visit_type: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  has_attachments: boolean;
}

interface Prescription {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  prescribed_date: string;
  status: string;
  refills_remaining: number;
  instructions: string | null;
}

interface LabResult {
  id: string;
  test_name: string;
  result_date: string;
  status: string;
  is_read: boolean;
  provider_name: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  date: string;
  amount: number;
  status: string;
  description: string;
}

interface PatientProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  mobile_phone: string | null;
  birth_date: string;
  gender: string;
  address_line1: string | null;
  city: string | null;
  state_province: string | null;
  country: string;
}

// ─── Dashboard ─────────────────────────────────────────

export function usePortalDashboard() {
  return useQuery({
    queryKey: ['portal-dashboard'],
    queryFn: () => portalApi.get<DashboardData>('/dashboard'),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ─── Appointments ──────────────────────────────────────

export function usePortalAppointments(params?: { status?: string; from?: string; to?: string }) {
  const queryString = new URLSearchParams(params as Record<string, string>).toString();
  return useQuery({
    queryKey: ['portal-appointments', params],
    queryFn: () => portalApi.get<Appointment[]>(`/appointments${queryString ? `?${queryString}` : ''}`),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useRequestAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { provider_id?: string; preferred_date: string; reason: string }) =>
      portalApi.post('/appointments/request', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    },
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) =>
      portalApi.post(`/appointments/${appointmentId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    },
  });
}

// ─── Medical Records ───────────────────────────────────

export function usePortalMedicalRecords(params?: { from?: string; to?: string; page?: number }) {
  return useQuery({
    queryKey: ['portal-medical-records', params],
    queryFn: () => {
      const queryString = new URLSearchParams(params as Record<string, string>).toString();
      return portalApi.get<{ items: MedicalRecord[]; total: number }>(
        `/medical-records${queryString ? `?${queryString}` : ''}`
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePortalMedicalRecordDetail(recordId: string) {
  return useQuery({
    queryKey: ['portal-medical-record', recordId],
    queryFn: () => portalApi.get<MedicalRecord>(`/medical-records/${recordId}`),
    enabled: !!recordId,
  });
}

// ─── Prescriptions ─────────────────────────────────────

export function usePortalPrescriptions(params?: { status?: string }) {
  return useQuery({
    queryKey: ['portal-prescriptions', params],
    queryFn: () => {
      const queryString = new URLSearchParams(params as Record<string, string>).toString();
      return portalApi.get<Prescription[]>(`/prescriptions${queryString ? `?${queryString}` : ''}`);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useRequestRefill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prescriptionId: string) =>
      portalApi.post(`/prescriptions/${prescriptionId}/request-refill`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    },
  });
}

// ─── Lab Results ───────────────────────────────────────

export function usePortalLabResults(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['portal-lab-results', params],
    queryFn: () => {
      const queryString = new URLSearchParams(params as Record<string, string>).toString();
      return portalApi.get<LabResult[]>(`/lab-results${queryString ? `?${queryString}` : ''}`);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useMarkLabResultAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resultId: string) =>
      portalApi.post(`/lab-results/${resultId}/mark-read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-lab-results'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    },
  });
}

// ─── Billing ───────────────────────────────────────────

export function usePortalInvoices(params?: { status?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: ['portal-invoices', params],
    queryFn: () => {
      const queryString = new URLSearchParams(params as Record<string, string>).toString();
      return portalApi.get<Invoice[]>(`/billing/invoices${queryString ? `?${queryString}` : ''}`);
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function usePortalInvoiceDetail(invoiceId: string) {
  return useQuery({
    queryKey: ['portal-invoice', invoiceId],
    queryFn: () => portalApi.get<Invoice>(`/billing/invoices/${invoiceId}`),
    enabled: !!invoiceId,
  });
}

export function usePayInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, paymentData }: { invoiceId: string; paymentData: unknown }) =>
      portalApi.post(`/billing/invoices/${invoiceId}/pay`, paymentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    },
  });
}

// ─── Profile ───────────────────────────────────────────

export function usePortalProfile() {
  return useQuery({
    queryKey: ['portal-profile'],
    queryFn: () => portalApi.get<PatientProfile>('/profile'),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PatientProfile>) =>
      portalApi.put('/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-profile'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      portalApi.post('/profile/change-password', data),
  });
}
