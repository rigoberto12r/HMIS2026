import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Invoice {
  id: string;
  invoice_number: string;
  patient_id: string;
  patient_name?: string;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  tax: number;
  total: number;
  paid_amount: number;
  balance: number;
  items: InvoiceItem[];
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
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
 * Hook to update invoice status.
 */
export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Invoice['status'] }) => {
      const response = await api.patch<Invoice>(`/billing/invoices/${id}/status`, { status });
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
 */
export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, amount, method }: { invoiceId: string; amount: number; method: string }) => {
      const response = await api.post<Invoice>(`/billing/invoices/${invoiceId}/payments`, {
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
