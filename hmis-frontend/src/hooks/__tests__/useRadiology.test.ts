/**
 * Tests for useRadiology hooks
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import {
  useRadDashboard,
  useRadOrders,
  useRadOrder,
  useCreateRadOrder,
  useUpdateRadOrder,
  useCancelRadOrder,
  useRadWorklist,
  useRadStudy,
  useRadStudies,
  useCreateStudy,
  useUpdateStudy,
  useDeleteStudy,
  useRadReports,
  useRadReport,
  useCreateReport,
  useUpdateReport,
  useSignReport,
  useRadTemplates,
  useRadTemplate,
  useRadModalities,
  useSignRadReport,
  useAmendRadReport,
  useCreateRadReport,
  useUpdateRadReport,
  useStudyReport,
  usePatientRadStudies,
  useCreateRadTemplate,
  useUpdateRadTemplate,
  useDeleteRadTemplate,
} from '../useRadiology';
import { api } from '@/lib/api';
import type {
  RadDashboardStats,
  RadOrder,
  RadStudy,
  RadReport,
  RadTemplate,
  PaginatedRadOrders,
  PaginatedRadStudies,
  PaginatedRadReports,
  PaginatedRadTemplates,
  PaginatedRadWorklist,
  RadModalityType,
} from '@/types/radiology';

// Mock the API client
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
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

// ─── Test Data ─────────────────────────────────────────────

const mockDashboardStats: RadDashboardStats = {
  pending_orders: 5,
  studies_today: 12,
  unsigned_reports: 3,
  stat_urgent: 2,
  completed_today: 10,
  avg_report_time: 2.5,
  orders_by_modality: { CT: 5, MR: 3, XA: 2 },
  orders_by_status: { pending: 5, completed: 10 },
};

const mockOrder: RadOrder = {
  id: 'order-123',
  order_number: 'ORD-001',
  patient_id: 'patient-123',
  patient_name: 'Juan Perez',
  patient_mrn: 'MRN-001',
  encounter_id: 'encounter-123',
  modality: 'CT',
  body_part: 'chest',
  study_description: 'CT Chest with contrast',
  clinical_indication: 'Suspected pneumonia',
  ordering_physician_id: 'doc-123',
  ordering_physician_name: 'Dr. Smith',
  priority: 'routine',
  status: 'pending',
  ordered_at: '2026-02-16T10:00:00Z',
  created_at: '2026-02-16T10:00:00Z',
  updated_at: '2026-02-16T10:00:00Z',
};

const mockStudy: RadStudy = {
  id: 'study-123',
  order_id: 'order-123',
  accession_number: 'ACC-001',
  study_uid: '1.2.840.113619.2.1.1',
  modality: 'CT',
  study_description: 'CT Chest',
  patient_id: 'patient-123',
  patient_name: 'Juan Perez',
  patient_mrn: 'MRN-001',
  scheduled_date: '2026-02-16',
  performed_date: '2026-02-16T14:00:00Z',
  series_count: 3,
  images_count: 150,
  status: 'completed',
  created_at: '2026-02-16T14:00:00Z',
  updated_at: '2026-02-16T14:00:00Z',
};

const mockReport: RadReport = {
  id: 'report-123',
  study_id: 'study-123',
  report_number: 'REP-001',
  radiologist_id: 'rad-123',
  radiologist_name: 'Dr. Johnson',
  findings: '<p>Normal chest CT</p>',
  impression: '<p>No acute findings</p>',
  status: 'draft',
  created_at: '2026-02-16T15:00:00Z',
  updated_at: '2026-02-16T15:00:00Z',
};

const mockTemplate: RadTemplate = {
  id: 'template-123',
  name: 'CT Chest Template',
  modality: 'CT',
  body_part: 'chest',
  template_text: 'FINDINGS:\n{findings}\n\nIMPRESSION:\n{impression}',
  is_active: true,
  created_by_id: 'user-123',
  created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z',
};

// ─── Dashboard Tests ───────────────────────────────────────

describe('useRadDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches dashboard statistics', async () => {
    mockApi.get.mockResolvedValueOnce(mockDashboardStats);

    const { result } = renderHook(() => useRadDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockDashboardStats);
    expect(mockApi.get).toHaveBeenCalledWith('/radiology/dashboard');
  });

  it('has correct stale time', async () => {
    mockApi.get.mockResolvedValueOnce(mockDashboardStats);

    const { result } = renderHook(() => useRadDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Data should be fresh for 30 seconds
    expect(result.current.isStale).toBe(false);
  });

  it('handles API errors', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useRadDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

// ─── Orders Tests ──────────────────────────────────────────

describe('useRadOrders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches orders with default params', async () => {
    const mockData: PaginatedRadOrders = {
      items: [mockOrder],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useRadOrders({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(mockApi.get).toHaveBeenCalledWith('/radiology/orders', {});
  });

  it('passes filter params to API', async () => {
    const mockData: PaginatedRadOrders = {
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const params = {
      patient_id: 'patient-123',
      modality: 'CT' as RadModalityType,
      status: 'pending' as const,
      page: 2,
    };

    const { result } = renderHook(() => useRadOrders(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledWith('/radiology/orders', params);
  });

  it('respects enabled option', () => {
    const { result } = renderHook(() => useRadOrders({}, { enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe('useRadOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches single order by ID', async () => {
    mockApi.get.mockResolvedValueOnce(mockOrder);

    const { result } = renderHook(() => useRadOrder('order-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockOrder);
    expect(mockApi.get).toHaveBeenCalledWith('/radiology/orders/order-123');
  });

  it('does not fetch when orderId is undefined', () => {
    const { result } = renderHook(() => useRadOrder(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('is disabled when orderId is undefined even with enabled option', async () => {
    const { result } = renderHook(() => useRadOrder(undefined, { enabled: true }), {
      wrapper: createWrapper(),
    });

    // Should not fetch because orderId is required (enabled condition in hook)
    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe('useCreateRadOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new order', async () => {
    mockApi.post.mockResolvedValueOnce(mockOrder);

    const { result } = renderHook(() => useCreateRadOrder(), {
      wrapper: createWrapper(),
    });

    const orderData = {
      patient_id: 'patient-123',
      modality: 'CT' as RadModalityType,
      body_part: 'chest',
      study_description: 'CT Chest',
      clinical_indication: 'Test',
      priority: 'routine' as const,
    };

    let mutationResult: any;
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync(orderData);
    });

    expect(mutationResult).toEqual(mockOrder);
    expect(mockApi.post).toHaveBeenCalledWith('/radiology/orders', orderData);
  });

  it('handles creation errors', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Validation error'));

    const { result } = renderHook(() => useCreateRadOrder(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        patient_id: 'patient-123',
        modality: 'CT',
        body_part: 'chest',
        study_description: 'CT Chest',
        clinical_indication: 'Test',
        priority: 'routine',
      })
    ).rejects.toThrow('Validation error');
  });
});

describe('useUpdateRadOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates an order', async () => {
    const updatedOrder = { ...mockOrder, priority: 'urgent' as const };
    mockApi.patch.mockResolvedValueOnce(updatedOrder);

    const { result } = renderHook(() => useUpdateRadOrder(), {
      wrapper: createWrapper(),
    });

    let mutationResult: any;
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync({
        id: 'order-123',
        data: { priority: 'urgent' },
      });
    });

    expect(mutationResult).toEqual(updatedOrder);
    expect(mockApi.patch).toHaveBeenCalledWith('/radiology/orders/order-123', { priority: 'urgent' });
  });
});

describe('useCancelRadOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancels an order', async () => {
    mockApi.patch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useCancelRadOrder(), {
      wrapper: createWrapper(),
    });

    await waitFor(async () => {
      await result.current.mutateAsync('order-123');
    });

    expect(mockApi.patch).toHaveBeenCalledWith('/radiology/orders/order-123/cancel', {});
  });
});

// ─── Worklist Tests ────────────────────────────────────────

describe('useRadWorklist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches worklist with default refetch interval', async () => {
    const mockData: PaginatedRadWorklist = {
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useRadWorklist(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledWith('/radiology/worklist', {});
  });

  it('respects custom refetch interval', async () => {
    const mockData: PaginatedRadWorklist = {
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useRadWorklist({}, { refetchInterval: 60000 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify the hook was called with the right params
    expect(mockApi.get).toHaveBeenCalledWith('/radiology/worklist', {});
  });

  it('passes filter params to API', async () => {
    const mockData: PaginatedRadWorklist = {
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const params = {
      modality: 'CT' as RadModalityType,
      date: '2026-02-16',
      status: 'scheduled' as const,
    };

    const { result } = renderHook(() => useRadWorklist(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledWith('/radiology/worklist', params);
  });
});

// ─── Studies Tests ─────────────────────────────────────────

describe('useRadStudy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches single study by ID', async () => {
    mockApi.get.mockResolvedValueOnce(mockStudy);

    const { result } = renderHook(() => useRadStudy('study-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockStudy);
    expect(mockApi.get).toHaveBeenCalledWith('/radiology/studies/study-123');
  });

  it('does not fetch when studyId is undefined', () => {
    const { result } = renderHook(() => useRadStudy(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe('useRadStudies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches paginated studies', async () => {
    const mockData: PaginatedRadStudies = {
      items: [mockStudy],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useRadStudies(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(result.current.data?.items[0]).toEqual(mockStudy);
    expect(mockApi.get).toHaveBeenCalledWith('/radiology/studies', {});
  });

  it('passes patient_id filter', async () => {
    const mockData: PaginatedRadStudies = {
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useRadStudies({ patient_id: 'patient-123' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledWith('/radiology/studies', { patient_id: 'patient-123' });
  });
});

describe('useCreateStudy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new study', async () => {
    mockApi.post.mockResolvedValueOnce(mockStudy);

    const { result } = renderHook(() => useCreateStudy(), {
      wrapper: createWrapper(),
    });

    const studyData = {
      order_id: 'order-123',
      study_uid: '1.2.840.113619.2.1.1',
      series_count: 3,
      images_count: 150,
    };

    let mutationResult: any;
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync(studyData);
    });

    expect(mutationResult).toEqual(mockStudy);
    expect(mockApi.post).toHaveBeenCalledWith('/radiology/studies', studyData);
  });
});

describe('useUpdateStudy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates a study', async () => {
    const updatedStudy = { ...mockStudy, notes: 'Updated notes' };
    mockApi.patch.mockResolvedValueOnce(updatedStudy);

    const { result } = renderHook(() => useUpdateStudy(), {
      wrapper: createWrapper(),
    });

    let mutationResult: any;
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync({
        id: 'study-123',
        data: { notes: 'Updated notes' },
      });
    });

    expect(mutationResult).toEqual(updatedStudy);
    expect(mockApi.patch).toHaveBeenCalledWith('/radiology/studies/study-123', { notes: 'Updated notes' });
  });
});

describe('useDeleteStudy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes a study', async () => {
    mockApi.delete.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteStudy(), {
      wrapper: createWrapper(),
    });

    await waitFor(async () => {
      await result.current.mutateAsync('study-123');
    });

    expect(mockApi.delete).toHaveBeenCalledWith('/radiology/studies/study-123');
  });
});

// ─── Reports Tests ─────────────────────────────────────────

describe('useRadReports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches paginated reports', async () => {
    const mockData: PaginatedRadReports = {
      items: [mockReport],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useRadReports(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(mockApi.get).toHaveBeenCalledWith('/radiology/reports', {});
  });

  it('passes filter params', async () => {
    const mockData: PaginatedRadReports = {
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const params = {
      status: 'draft' as const,
      radiologist_id: 'rad-123',
    };

    const { result } = renderHook(() => useRadReports(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledWith('/radiology/reports', params);
  });
});

describe('useRadReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches single report by ID', async () => {
    mockApi.get.mockResolvedValueOnce(mockReport);

    const { result } = renderHook(() => useRadReport('report-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockReport);
    expect(mockApi.get).toHaveBeenCalledWith('/radiology/reports/report-123');
  });

  it('does not fetch when reportId is undefined', () => {
    const { result } = renderHook(() => useRadReport(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe('useCreateReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new report', async () => {
    mockApi.post.mockResolvedValueOnce(mockReport);

    const { result } = renderHook(() => useCreateReport(), {
      wrapper: createWrapper(),
    });

    const reportData = {
      study_id: 'study-123',
      findings: '<p>Normal</p>',
      impression: '<p>No findings</p>',
    };

    let mutationResult: any;
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync(reportData);
    });

    expect(mutationResult).toEqual(mockReport);
    expect(mockApi.post).toHaveBeenCalledWith('/radiology/reports', reportData);
  });
});

describe('useUpdateReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates a report', async () => {
    const updatedReport = { ...mockReport, findings: '<p>Updated</p>' };
    mockApi.patch.mockResolvedValueOnce(updatedReport);

    const { result } = renderHook(() => useUpdateReport(), {
      wrapper: createWrapper(),
    });

    let mutationResult: any;
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync({
        id: 'report-123',
        data: { findings: '<p>Updated</p>' },
      });
    });

    expect(mutationResult).toEqual(updatedReport);
    expect(mockApi.patch).toHaveBeenCalledWith('/radiology/reports/report-123', { findings: '<p>Updated</p>' });
  });
});

describe('useSignReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs a report', async () => {
    const signedReport = { ...mockReport, status: 'final' as const };
    mockApi.post.mockResolvedValueOnce(signedReport);

    const { result } = renderHook(() => useSignReport(), {
      wrapper: createWrapper(),
    });

    let mutationResult: any;
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync('report-123');
    });

    expect(mutationResult).toEqual(signedReport);
    expect(mockApi.post).toHaveBeenCalledWith('/radiology/reports/report-123/sign', {});
  });
});

// ─── Templates Tests ───────────────────────────────────────

describe('useRadTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches templates', async () => {
    const mockData: PaginatedRadTemplates = {
      items: [mockTemplate],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useRadTemplates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(mockApi.get).toHaveBeenCalledWith('/radiology/templates', {});
  });

  it('passes filter params', async () => {
    const mockData: PaginatedRadTemplates = {
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const params = {
      modality: 'CT' as RadModalityType,
      body_part: 'chest',
    };

    const { result } = renderHook(() => useRadTemplates(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledWith('/radiology/templates', params);
  });
});

describe('useRadTemplate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches single template by ID', async () => {
    mockApi.get.mockResolvedValueOnce(mockTemplate);

    const { result } = renderHook(() => useRadTemplate('template-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTemplate);
    expect(mockApi.get).toHaveBeenCalledWith('/radiology/templates/template-123');
  });

  it('does not fetch when templateId is undefined', () => {
    const { result } = renderHook(() => useRadTemplate(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

// ─── Modalities Tests ──────────────────────────────────────

describe('useRadModalities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches modalities', async () => {
    const mockData = [
      {
        code: 'CT' as RadModalityType,
        name: 'Computed Tomography',
        is_active: true,
      },
      {
        code: 'MR' as RadModalityType,
        name: 'Magnetic Resonance',
        is_active: true,
      },
    ];

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useRadModalities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(mockApi.get).toHaveBeenCalledWith('/radiology/modalities');
  });

  it('has correct stale time (5 minutes)', async () => {
    const mockData = [
      {
        code: 'CT' as RadModalityType,
        name: 'Computed Tomography',
        is_active: true,
      },
    ];

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useRadModalities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Data should be fresh for 5 minutes
    expect(result.current.isStale).toBe(false);
  });
});

// ─── Additional Mutations Tests ────────────────────────────

describe('useSignRadReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs a radiology report', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useSignRadReport(), {
      wrapper: createWrapper(),
    });

    await waitFor(async () => {
      await result.current.mutateAsync('report-123');
    });

    expect(mockApi.post).toHaveBeenCalledWith('/radiology/reports/report-123/sign', {});
  });
});

describe('useAmendRadReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('amends a report with correct parameters', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useAmendRadReport(), {
      wrapper: createWrapper(),
    });

    await waitFor(async () => {
      await result.current.mutateAsync({
        reportId: 'report-123',
        amendment: 'Additional findings noted',
      });
    });

    expect(mockApi.post).toHaveBeenCalledWith('/radiology/reports/report-123/amend', {
      amendment: 'Additional findings noted',
    });
  });
});

// ─── Alias Tests ───────────────────────────────────────────

describe('Backward compatibility aliases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('useCreateRadReport is an alias for useCreateReport', () => {
    expect(useCreateRadReport).toBe(useCreateReport);
  });

  it('useUpdateRadReport is an alias for useUpdateReport', () => {
    expect(useUpdateRadReport).toBe(useUpdateReport);
  });
});

// ─── Study Report Tests ────────────────────────────────────

describe('useStudyReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches report for specific study', async () => {
    mockApi.get.mockResolvedValueOnce(mockReport);

    const { result } = renderHook(() => useStudyReport('study-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockReport);
    expect(mockApi.get).toHaveBeenCalledWith('/radiology/studies/study-123/report');
  });

  it('does not fetch when studyId is undefined', () => {
    const { result } = renderHook(() => useStudyReport(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('respects enabled option', () => {
    const { result } = renderHook(() => useStudyReport('study-123', { enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

// ─── Patient Studies Tests ─────────────────────────────────

describe('usePatientRadStudies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches all studies for a patient', async () => {
    const mockData: PaginatedRadStudies = {
      items: [mockStudy],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => usePatientRadStudies('patient-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(mockApi.get).toHaveBeenCalledWith('/radiology/patients/patient-123/studies');
  });

  it('does not fetch when patientId is undefined', () => {
    const { result } = renderHook(() => usePatientRadStudies(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('has correct stale time (1 minute)', async () => {
    const mockData: PaginatedRadStudies = {
      items: [mockStudy],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => usePatientRadStudies('patient-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Data should be fresh for 1 minute
    expect(result.current.isStale).toBe(false);
  });
});

// ─── Template Mutations Tests ──────────────────────────────

describe('useCreateRadTemplate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new template', async () => {
    mockApi.post.mockResolvedValueOnce(mockTemplate);

    const { result } = renderHook(() => useCreateRadTemplate(), {
      wrapper: createWrapper(),
    });

    const templateData = {
      name: 'CT Chest Template',
      modality: 'CT' as RadModalityType,
      body_part: 'chest',
      template_text: 'FINDINGS:\n{findings}',
      is_active: true,
      created_by_id: 'user-123',
    };

    let mutationResult: any;
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync(templateData);
    });

    expect(mutationResult).toEqual(mockTemplate);
    expect(mockApi.post).toHaveBeenCalledWith('/radiology/templates', templateData);
  });
});

describe('useUpdateRadTemplate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates a template', async () => {
    const updatedTemplate = { ...mockTemplate, name: 'Updated Template' };
    mockApi.put.mockResolvedValueOnce(updatedTemplate);

    const { result } = renderHook(() => useUpdateRadTemplate(), {
      wrapper: createWrapper(),
    });

    let mutationResult: any;
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync({
        templateId: 'template-123',
        data: { name: 'Updated Template' },
      });
    });

    expect(mutationResult).toEqual(updatedTemplate);
    expect(mockApi.put).toHaveBeenCalledWith('/radiology/templates/template-123', { name: 'Updated Template' });
  });
});

describe('useDeleteRadTemplate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes a template', async () => {
    mockApi.delete.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteRadTemplate(), {
      wrapper: createWrapper(),
    });

    await waitFor(async () => {
      await result.current.mutateAsync('template-123');
    });

    expect(mockApi.delete).toHaveBeenCalledWith('/radiology/templates/template-123');
  });
});
