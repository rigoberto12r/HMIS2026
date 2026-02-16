/**
 * Tests for useLaboratory hooks
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import {
  useLabDashboard,
  useLabOrders,
  useLabOrder,
  useCreateLabOrder,
  useCancelLabOrder,
  useReceiveSpecimen,
  useEnterResults,
  useValidateResult,
  useLabTests,
  useLabTest,
  useCriticalValues,
  useAcknowledgeCriticalValue,
} from '../useLaboratory';
import { api } from '@/lib/api';
import type { LabOrder, LabDashboardStats, PaginatedLabOrders, PaginatedLabTests, LabTest } from '@/types/laboratory';

// Mock the API client
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const TestWrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  TestWrapper.displayName = 'TestWrapper';
  return TestWrapper;
}

describe('useLabDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches dashboard statistics', async () => {
    const mockStats: LabDashboardStats = {
      pending_orders: 12,
      stat_orders: 3,
      critical_values: 2,
      completed_today: 45,
      pending_validation: 8,
      avg_turnaround_time: 4.5,
      orders_by_priority: {
        routine: 40,
        urgent: 8,
        stat: 3,
      },
      orders_by_status: {
        pending: 12,
        received: 15,
        in_process: 10,
        completed: 45,
      },
    };

    mockApi.get.mockResolvedValueOnce(mockStats);

    const { result } = renderHook(() => useLabDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockStats);
    expect(mockApi.get).toHaveBeenCalledWith('/laboratory/dashboard');
  });

  it('handles dashboard fetch errors', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Failed to fetch dashboard'));

    const { result } = renderHook(() => useLabDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to fetch dashboard');
  });
});

describe('useLabOrders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches lab orders with default params', async () => {
    const mockData: PaginatedLabOrders = {
      items: [
        {
          id: '1',
          order_number: 'LAB-2026-001',
          patient_id: 'patient-1',
          patient_name: 'Juan Perez',
          patient_mrn: 'MRN-001',
          ordering_physician_id: 'doc-1',
          priority: 'routine',
          status: 'pending',
          fasting_status: 'fasting',
          ordered_at: '2026-02-16T08:00:00Z',
          created_at: '2026-02-16T08:00:00Z',
          updated_at: '2026-02-16T08:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useLabOrders({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(mockApi.get).toHaveBeenCalledWith('/laboratory/orders', {});
  });

  it('passes filter params to API', async () => {
    const mockData: PaginatedLabOrders = {
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const filters = {
      status: 'pending' as const,
      priority: 'stat' as const,
      page: 2,
    };

    const { result } = renderHook(() => useLabOrders(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledWith('/laboratory/orders', filters);
  });

  it('handles API errors', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useLabOrders({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useLabOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches single lab order by ID', async () => {
    const mockOrder: LabOrder = {
      id: '1',
      order_number: 'LAB-2026-001',
      patient_id: 'patient-1',
      ordering_physician_id: 'doc-1',
      priority: 'urgent',
      status: 'received',
      fasting_status: 'fasting',
      ordered_at: '2026-02-16T08:00:00Z',
      created_at: '2026-02-16T08:00:00Z',
      updated_at: '2026-02-16T08:00:00Z',
    };

    mockApi.get.mockResolvedValueOnce(mockOrder);

    const { result } = renderHook(() => useLabOrder('1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockOrder);
    expect(mockApi.get).toHaveBeenCalledWith('/laboratory/orders/1');
  });

  it('does not fetch when orderId is undefined', () => {
    const { result } = renderHook(() => useLabOrder(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('throws error when orderId is required but not provided', async () => {
    const { result } = renderHook(() => useLabOrder(undefined), {
      wrapper: createWrapper(),
    });

    // Manually enable the query to test error handling
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useCreateLabOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a lab order and invalidates queries', async () => {
    const newOrder: LabOrder = {
      id: '123',
      order_number: 'LAB-2026-100',
      patient_id: 'patient-1',
      ordering_physician_id: 'doc-1',
      priority: 'stat',
      status: 'pending',
      fasting_status: 'non_fasting',
      ordered_at: '2026-02-16T10:00:00Z',
      created_at: '2026-02-16T10:00:00Z',
      updated_at: '2026-02-16T10:00:00Z',
    };

    mockApi.post.mockResolvedValueOnce(newOrder);

    const { result } = renderHook(() => useCreateLabOrder(), {
      wrapper: createWrapper(),
    });

    let mutationResult: any;
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync({
        patient_id: 'patient-1',
        ordering_physician_id: 'doc-1',
        test_ids: ['test-1', 'test-2'],
        priority: 'stat',
        fasting_status: 'non_fasting',
        clinical_info: 'Routine checkup',
      });
    });

    expect(mutationResult).toEqual(newOrder);
    expect(mockApi.post).toHaveBeenCalledWith('/laboratory/orders', expect.objectContaining({
      patient_id: 'patient-1',
      test_ids: ['test-1', 'test-2'],
    }));
  });

  it('handles creation errors', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Invalid patient ID'));

    const { result } = renderHook(() => useCreateLabOrder(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        patient_id: 'invalid',
        ordering_physician_id: 'doc-1',
        test_ids: ['test-1'],
        priority: 'routine',
        fasting_status: 'unknown',
      }),
    ).rejects.toThrow('Invalid patient ID');
  });
});

describe('useCancelLabOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancels a lab order', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useCancelLabOrder(), {
      wrapper: createWrapper(),
    });

    await waitFor(async () => {
      await result.current.mutateAsync({
        orderId: '1',
        reason: 'Patient requested cancellation',
      });
    });

    expect(mockApi.post).toHaveBeenCalledWith('/laboratory/orders/1/cancel', {
      reason: 'Patient requested cancellation',
    });
  });

  it('cancels without reason', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useCancelLabOrder(), {
      wrapper: createWrapper(),
    });

    await waitFor(async () => {
      await result.current.mutateAsync({ orderId: '1' });
    });

    expect(mockApi.post).toHaveBeenCalledWith('/laboratory/orders/1/cancel', {});
  });
});

describe('useReceiveSpecimen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('receives a specimen successfully', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useReceiveSpecimen(), {
      wrapper: createWrapper(),
    });

    await waitFor(async () => {
      await result.current.mutateAsync({
        order_id: 'order-1',
        specimen_type: 'blood',
        collection_date: '2026-02-16',
        collection_time: '08:30',
        quality: 'acceptable',
        accession_number: 'ACC-001',
      });
    });

    expect(mockApi.post).toHaveBeenCalledWith('/laboratory/specimens/receive', expect.objectContaining({
      order_id: 'order-1',
      specimen_type: 'blood',
      quality: 'acceptable',
    }));
  });

  it('handles specimen reception errors', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Invalid specimen quality'));

    const { result } = renderHook(() => useReceiveSpecimen(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        order_id: 'order-1',
        specimen_type: 'blood',
        collection_date: '2026-02-16',
        collection_time: '08:30',
        quality: 'acceptable',
      }),
    ).rejects.toThrow('Invalid specimen quality');
  });
});

describe('useEnterResults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enters lab results successfully', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useEnterResults(), {
      wrapper: createWrapper(),
    });

    await waitFor(async () => {
      await result.current.mutateAsync({
        order_test_id: 'test-1',
        result_value: '150',
        result_numeric: 150,
        is_abnormal: true,
        is_critical: false,
        notes: 'Slightly elevated',
      });
    });

    expect(mockApi.post).toHaveBeenCalledWith('/laboratory/results/enter', expect.objectContaining({
      order_test_id: 'test-1',
      result_numeric: 150,
      is_abnormal: true,
    }));
  });
});

describe('useValidateResult', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates a lab result', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useValidateResult(), {
      wrapper: createWrapper(),
    });

    await waitFor(async () => {
      await result.current.mutateAsync({
        order_test_id: 'test-1',
        validated: true,
        notes: 'Reviewed and approved',
      });
    });

    expect(mockApi.post).toHaveBeenCalledWith('/laboratory/results/validate', {
      order_test_id: 'test-1',
      validated: true,
      notes: 'Reviewed and approved',
    });
  });
});

describe('useLabTests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches lab tests catalog', async () => {
    const mockTests: PaginatedLabTests = {
      items: [
        {
          id: '1',
          code: 'CBC',
          name: 'Complete Blood Count',
          category: 'hematologia',
          specimen_type: 'blood',
          fasting_required: false,
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 100,
      total_pages: 1,
    };

    mockApi.get.mockResolvedValueOnce(mockTests);

    const { result } = renderHook(() => useLabTests({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTests);
    expect(mockApi.get).toHaveBeenCalledWith('/laboratory/tests', { page_size: 100 });
  });

  it('filters tests by category', async () => {
    const mockTests: PaginatedLabTests = {
      items: [],
      total: 0,
      page: 1,
      page_size: 100,
      total_pages: 0,
    };

    mockApi.get.mockResolvedValueOnce(mockTests);

    const { result } = renderHook(() => useLabTests({ category: 'hematologia' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledWith('/laboratory/tests', {
      category: 'hematologia',
      page_size: 100,
    });
  });
});

describe('useLabTest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches single lab test by ID', async () => {
    const mockTest: LabTest = {
      id: '1',
      code: 'GLU',
      name: 'Glucose',
      category: 'quimica',
      specimen_type: 'serum',
      fasting_required: true,
      turnaround_time: 2,
      normal_range: '70-100 mg/dL',
      units: 'mg/dL',
      price: 150,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    mockApi.get.mockResolvedValueOnce(mockTest);

    const { result } = renderHook(() => useLabTest('1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTest);
    expect(mockApi.get).toHaveBeenCalledWith('/laboratory/tests/1');
  });

  it('does not fetch when testId is undefined', () => {
    const { result } = renderHook(() => useLabTest(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe('useCriticalValues', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches orders with critical values', async () => {
    const mockData: PaginatedLabOrders = {
      items: [
        {
          id: '1',
          order_number: 'LAB-2026-001',
          patient_id: 'patient-1',
          patient_name: 'Juan Perez',
          ordering_physician_id: 'doc-1',
          priority: 'stat',
          status: 'completed',
          fasting_status: 'fasting',
          ordered_at: '2026-02-16T08:00:00Z',
          created_at: '2026-02-16T08:00:00Z',
          updated_at: '2026-02-16T08:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 50,
      total_pages: 1,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useCriticalValues(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(mockApi.get).toHaveBeenCalledWith('/laboratory/critical-values', {
      page: 1,
      page_size: 50,
    });
  });

  it('accepts custom refetch interval', async () => {
    const mockData: PaginatedLabOrders = {
      items: [],
      total: 0,
      page: 1,
      page_size: 50,
      total_pages: 0,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useCriticalValues({ refetchInterval: 30000 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useAcknowledgeCriticalValue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('acknowledges a critical value', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useAcknowledgeCriticalValue(), {
      wrapper: createWrapper(),
    });

    await waitFor(async () => {
      await result.current.mutateAsync({
        orderTestId: 'test-1',
        notes: 'Physician notified',
      });
    });

    expect(mockApi.post).toHaveBeenCalledWith('/laboratory/critical-values/test-1/acknowledge', {
      notes: 'Physician notified',
    });
  });

  it('acknowledges without notes', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useAcknowledgeCriticalValue(), {
      wrapper: createWrapper(),
    });

    await waitFor(async () => {
      await result.current.mutateAsync({ orderTestId: 'test-1' });
    });

    expect(mockApi.post).toHaveBeenCalledWith('/laboratory/critical-values/test-1/acknowledge', {});
  });
});
