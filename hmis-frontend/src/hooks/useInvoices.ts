import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Invoice {
  id: string;
  invoice_number: string;
  fiscal_number: string | null;
  patient_id: string;
  customer_name: string | null;
  customer_email?: string | null;
  customer_tax_id?: string | null;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  grand_total: number;
  currency: string;
  status: string;
  due_date?: string | null;
  paid_date?: string | null;
  country_code?: string;
  lines?: InvoiceLineItem[];
  created_at: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
  line_total: number;
}

export interface InvoicesResponse {
  items: Invoice[];
  total: number;
  page: number;
  page_size: number;
}

export interface InvoiceSearchParams {
  page?: number;
  page_size?: number;
  status?: string;
  patient_id?: string;
  date_from?: string;
  date_to?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface InvoiceCreateData {
  patient_id: string;
  issue_date: string;
  due_date: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
  notes?: string;
}

/**
 * Hook to fetch invoices with filters.
 */
export function useInvoices(params: InvoiceSearchParams = {}) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: async () => {
      const response = await api.get<InvoicesResponse>('/billing/invoices', params);
      return response;
    },
  });
}

/**
 * Hook to fetch a single invoice by ID.
 */
export function useInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['invoices', invoiceId],
    queryFn: async () => {
      if (!invoiceId) throw new Error('Invoice ID is required');
      const response = await api.get<Invoice>(`/billing/invoices/${invoiceId}`);
      return response;
    },
    enabled: !!invoiceId,
  });
}

/**
 * Hook to create a new invoice.
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InvoiceCreateData) => {
      const response = await api.post<Invoice>('/billing/invoices', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

/**
 * Hook to void an invoice.
 * Backend: POST /billing/invoices/{id}/void with InvoiceVoidRequest schema
 * Returns { mensaje, invoice_id, status } — NOT a full Invoice object.
 */
export function useVoidInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await api.post<{ mensaje: string; invoice_id: string; status: string }>(
        `/billing/invoices/${id}/void`,
        { reason }
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

/**
 * Hook to record a payment for an invoice.
 * Backend: POST /billing/payments with PaymentCreate schema
 */
export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, amount, method }: { invoiceId: string; amount: number; method: string }) => {
      const response = await api.post('/billing/payments', {
        invoice_id: invoiceId,
        amount,
        payment_method: method,
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

/**
 * Hook to fetch billing statistics.
 */
export function useBillingStats(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['billing', 'stats', { dateFrom, dateTo }],
    queryFn: async () => {
      const response = await api.get<{
        total_billed: number;
        total_collected: number;
        total_pending: number;
        invoices_count: number;
      }>('/billing/stats', { date_from: dateFrom, date_to: dateTo });
      return response;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================
// Insurance Claims
// ============================================================

export interface InsuranceClaim {
  id: string;
  patient_id: string;
  patient_name: string;
  invoice_id: string;
  insurer_name: string;
  claim_number: string;
  claim_amount: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  submission_date?: string;
  adjudication_date?: string;
  approved_amount?: number;
  rejection_reason?: string;
  created_at: string;
}

export interface ClaimsResponse {
  items: InsuranceClaim[];
  total: number;
  page: number;
  page_size: number;
}

export interface ClaimSearchParams {
  page?: number;
  page_size?: number;
  status?: string;
  patient_id?: string;
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Hook to fetch insurance claims.
 */
export function useInsuranceClaims(params: ClaimSearchParams = {}) {
  return useQuery({
    queryKey: ['claims', params],
    queryFn: async () => {
      const response = await api.get<ClaimsResponse>('/billing/claims', params);
      return response;
    },
  });
}

/**
 * Hook to submit a claim to insurer.
 */
export function useSubmitClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (claimId: string) => {
      const response = await api.post<InsuranceClaim>(`/billing/claims/${claimId}/submit`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

/**
 * Hook to update claim status (adjudication).
 */
export function useUpdateClaimStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      claimId,
      status,
      approvedAmount,
      rejectionReason,
    }: {
      claimId: string;
      status: string;
      approvedAmount?: number;
      rejectionReason?: string;
    }) => {
      const response = await api.patch<InsuranceClaim>(`/billing/claims/${claimId}/status`, {
        status,
        approved_amount: approvedAmount,
        rejection_reason: rejectionReason,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

// ============================================================
// Billing Reports
// ============================================================

export interface BillingReport {
  type: 'sales' | 'collections' | 'pending' | 'ar_aging';
  date_from?: string;
  date_to?: string;
  data: unknown;
}

/**
 * Hook to fetch billing reports.
 */
export function useBillingReport(reportType: string, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['billing', 'reports', reportType, { dateFrom, dateTo }],
    queryFn: async () => {
      if (reportType === 'ar_aging') {
        const response = await api.get<{
          current: number;
          days_30: number;
          days_60: number;
          days_90: number;
          over_90: number;
          total: number;
        }>('/billing/reports/ar-aging');
        return response;
      }
      return null;
    },
    enabled: !!reportType,
  });
}
