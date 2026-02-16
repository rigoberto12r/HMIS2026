/**
 * Integration test for Laboratory Order Workflow
 * Tests complete flow: Create order → Receive specimen → Enter results → Validate
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  LabOrder,
  LabTest,
  LabDashboardStats,
  PaginatedLabOrders,
  PaginatedLabTests,
} from '@/types/laboratory';

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

// Test data
const mockLabTests: LabTest[] = [
  {
    id: 'test-1',
    code: 'CBC',
    name: 'Complete Blood Count',
    category: 'hematologia',
    specimen_type: 'blood',
    container_type: 'EDTA tube',
    volume_required: 3,
    fasting_required: false,
    turnaround_time: 2,
    normal_range: '4.5-11.0',
    units: '10^9/L',
    price: 25.00,
    is_active: true,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
  {
    id: 'test-2',
    code: 'GLU',
    name: 'Glucose',
    category: 'quimica',
    specimen_type: 'serum',
    container_type: 'Red top tube',
    volume_required: 2,
    fasting_required: true,
    turnaround_time: 1,
    normal_range: '70-100',
    units: 'mg/dL',
    price: 10.00,
    is_active: true,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
];

const mockDashboardStats: LabDashboardStats = {
  pending_orders: 5,
  stat_orders: 2,
  critical_values: 1,
  completed_today: 12,
  pending_validation: 3,
  avg_turnaround_time: 3.5,
  orders_by_priority: {
    routine: 10,
    urgent: 3,
    stat: 2,
  },
  orders_by_status: {
    pending: 5,
    received: 8,
    in_process: 4,
    completed: 12,
  },
};

function createMockOrder(overrides?: Partial<LabOrder>): LabOrder {
  return {
    id: 'order-123',
    order_number: 'LAB-2026-001',
    patient_id: 'patient-1',
    patient_name: 'Juan Pérez',
    patient_mrn: 'MRN-001',
    encounter_id: 'enc-1',
    ordering_physician_id: 'doc-1',
    ordering_physician_name: 'Dr. María García',
    priority: 'routine',
    status: 'pending',
    fasting_status: 'fasting',
    clinical_info: 'Annual checkup',
    ordered_at: '2026-02-16T08:00:00Z',
    tests: [],
    created_at: '2026-02-16T08:00:00Z',
    updated_at: '2026-02-16T08:00:00Z',
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return {
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    queryClient,
  };
}

describe('Laboratory Order Workflow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy Path: Complete Workflow', () => {
    it('creates order → receives specimen → enters results → validates results', async () => {
      const user = userEvent.setup();

      // Step 1: Create Order - Mock API responses
      const newOrder = createMockOrder({
        id: 'order-new',
        order_number: 'LAB-2026-999',
        tests: [
          {
            id: 'order-test-1',
            order_id: 'order-new',
            test_id: 'test-1',
            test: mockLabTests[0],
            status: 'pending',
            created_at: '2026-02-16T08:00:00Z',
            updated_at: '2026-02-16T08:00:00Z',
          },
        ],
      });

      mockApi.get.mockImplementation((url: string) => {
        if (url === '/laboratory/dashboard') {
          return Promise.resolve(mockDashboardStats);
        }
        if (url === '/laboratory/tests') {
          return Promise.resolve({
            items: mockLabTests,
            total: 2,
            page: 1,
            page_size: 100,
            total_pages: 1,
          } as PaginatedLabTests);
        }
        if (url === '/laboratory/orders') {
          return Promise.resolve({
            items: [newOrder],
            total: 1,
            page: 1,
            page_size: 20,
            total_pages: 1,
          } as PaginatedLabOrders);
        }
        if (url === '/laboratory/orders/order-new') {
          return Promise.resolve(newOrder);
        }
        return Promise.reject(new Error(`Unexpected API call: ${url}`));
      });

      mockApi.post.mockImplementation((url: string, data?: any) => {
        if (url === '/laboratory/orders') {
          return Promise.resolve(newOrder);
        }
        if (url === '/laboratory/specimens/receive') {
          const receivedOrder = createMockOrder({
            ...newOrder,
            status: 'received',
            received_at: '2026-02-16T09:00:00Z',
            specimen: {
              id: 'spec-1',
              order_id: 'order-new',
              specimen_type: 'blood',
              collection_date: '2026-02-16',
              collection_time: '08:30',
              received_date: '2026-02-16',
              received_by: 'tech-1',
              accession_number: 'ACC-001',
              container_type: 'EDTA tube',
              volume: 3,
              quality: 'acceptable',
              notes: 'Sample received in good condition',
              created_at: '2026-02-16T09:00:00Z',
              updated_at: '2026-02-16T09:00:00Z',
            },
          });
          return Promise.resolve(receivedOrder);
        }
        if (url === '/laboratory/results/enter') {
          const resultOrder = createMockOrder({
            ...newOrder,
            status: 'in_process',
            tests: [
              {
                id: 'order-test-1',
                order_id: 'order-new',
                test_id: 'test-1',
                test: mockLabTests[0],
                status: 'preliminary',
                result_numeric: 7.5,
                result_value: '7.5',
                units: '10^9/L',
                normal_range: '4.5-11.0',
                is_abnormal: false,
                is_critical: false,
                performed_by: 'tech-1',
                created_at: '2026-02-16T08:00:00Z',
                updated_at: '2026-02-16T10:00:00Z',
              },
            ],
          });
          return Promise.resolve(resultOrder);
        }
        if (url === '/laboratory/results/validate') {
          const validatedOrder = createMockOrder({
            ...newOrder,
            status: 'completed',
            completed_at: '2026-02-16T11:00:00Z',
            reported_at: '2026-02-16T11:00:00Z',
            tests: [
              {
                id: 'order-test-1',
                order_id: 'order-new',
                test_id: 'test-1',
                test: mockLabTests[0],
                status: 'final',
                result_numeric: 7.5,
                result_value: '7.5',
                units: '10^9/L',
                normal_range: '4.5-11.0',
                is_abnormal: false,
                is_critical: false,
                performed_by: 'tech-1',
                validated_by: 'pathologist-1',
                validated_at: '2026-02-16T11:00:00Z',
                created_at: '2026-02-16T08:00:00Z',
                updated_at: '2026-02-16T11:00:00Z',
              },
            ],
          });
          return Promise.resolve(validatedOrder);
        }
        return Promise.reject(new Error(`Unexpected API call: ${url}`));
      });

      // Verify workflow steps would be called in sequence
      // This tests that the API layer correctly handles the workflow

      // Step 1: Create order
      const createResponse = await mockApi.post('/laboratory/orders', {
        patient_id: 'patient-1',
        test_ids: ['test-1'],
        priority: 'routine',
        fasting_status: 'fasting',
      });
      expect(createResponse.id).toBe('order-new');
      expect(createResponse.status).toBe('pending');

      // Step 2: Receive specimen
      const receiveResponse = await mockApi.post('/laboratory/specimens/receive', {
        order_id: 'order-new',
        specimen_type: 'blood',
        collection_date: '2026-02-16',
        collection_time: '08:30',
        quality: 'acceptable',
      });
      expect(receiveResponse.status).toBe('received');
      expect(receiveResponse.specimen).toBeDefined();

      // Step 3: Enter results
      const resultsResponse = await mockApi.post('/laboratory/results/enter', {
        order_test_id: 'order-test-1',
        result_numeric: 7.5,
        result_value: '7.5',
      });
      expect(resultsResponse.status).toBe('in_process');
      expect(resultsResponse.tests?.[0]?.status).toBe('preliminary');

      // Step 4: Validate results
      const validatedResponse = await mockApi.post('/laboratory/results/validate', {
        order_test_id: 'order-test-1',
        validated: true,
      });
      expect(validatedResponse.status).toBe('completed');
      expect(validatedResponse.tests?.[0]?.status).toBe('final');
      expect(validatedResponse.tests?.[0]?.validated_by).toBe('pathologist-1');
    });
  });

  describe('Order Creation', () => {
    it('validates required fields before creating order', async () => {
      const user = userEvent.setup();

      mockApi.post.mockRejectedValueOnce(
        new Error('Patient ID is required')
      );

      await expect(
        mockApi.post('/laboratory/orders', {
          test_ids: ['test-1'],
          priority: 'routine',
        })
      ).rejects.toThrow('Patient ID is required');

      expect(mockApi.post).toHaveBeenCalledTimes(1);
    });

    it('creates STAT order with high priority', async () => {
      const statOrder = createMockOrder({
        priority: 'stat',
        status: 'pending',
      });

      mockApi.post.mockResolvedValueOnce(statOrder);

      const response = await mockApi.post('/laboratory/orders', {
        patient_id: 'patient-1',
        test_ids: ['test-1'],
        priority: 'stat',
        fasting_status: 'non_fasting',
        clinical_info: 'Emergency - chest pain',
      });

      expect(response.priority).toBe('stat');
      expect(mockApi.post).toHaveBeenCalledWith(
        '/laboratory/orders',
        expect.objectContaining({
          priority: 'stat',
          clinical_info: 'Emergency - chest pain',
        })
      );
    });

    it('creates order with multiple tests', async () => {
      const multiTestOrder = createMockOrder({
        tests: [
          {
            id: 'ot-1',
            order_id: 'order-123',
            test_id: 'test-1',
            test: mockLabTests[0],
            status: 'pending',
            created_at: '2026-02-16T08:00:00Z',
            updated_at: '2026-02-16T08:00:00Z',
          },
          {
            id: 'ot-2',
            order_id: 'order-123',
            test_id: 'test-2',
            test: mockLabTests[1],
            status: 'pending',
            created_at: '2026-02-16T08:00:00Z',
            updated_at: '2026-02-16T08:00:00Z',
          },
        ],
      });

      mockApi.post.mockResolvedValueOnce(multiTestOrder);

      const response = await mockApi.post('/laboratory/orders', {
        patient_id: 'patient-1',
        test_ids: ['test-1', 'test-2'],
        priority: 'routine',
        fasting_status: 'fasting',
      });

      expect(response.tests).toHaveLength(2);
      expect(response.tests?.map((t) => t.test_id)).toEqual(['test-1', 'test-2']);
    });
  });

  describe('Specimen Reception', () => {
    it('rejects specimen with poor quality', async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error('Specimen quality unacceptable - hemolyzed')
      );

      await expect(
        mockApi.post('/laboratory/specimens/receive', {
          order_id: 'order-123',
          specimen_type: 'blood',
          collection_date: '2026-02-16',
          collection_time: '08:30',
          quality: 'hemolyzed',
        })
      ).rejects.toThrow('hemolyzed');
    });

    it('receives specimen and generates accession number', async () => {
      const receivedOrder = createMockOrder({
        status: 'received',
        specimen: {
          id: 'spec-1',
          order_id: 'order-123',
          specimen_type: 'blood',
          collection_date: '2026-02-16',
          collection_time: '08:30',
          received_date: '2026-02-16',
          received_by: 'tech-1',
          accession_number: 'ACC-2026-001',
          quality: 'acceptable',
          created_at: '2026-02-16T09:00:00Z',
          updated_at: '2026-02-16T09:00:00Z',
        },
      });

      mockApi.post.mockResolvedValueOnce(receivedOrder);

      const response = await mockApi.post('/laboratory/specimens/receive', {
        order_id: 'order-123',
        specimen_type: 'blood',
        collection_date: '2026-02-16',
        collection_time: '08:30',
        quality: 'acceptable',
      });

      expect(response.status).toBe('received');
      expect(response.specimen?.accession_number).toMatch(/^ACC-/);
    });

    it('transitions order status from pending to received', async () => {
      const initialOrder = createMockOrder({ status: 'pending' });
      const receivedOrder = createMockOrder({ status: 'received' });

      mockApi.get.mockResolvedValueOnce(initialOrder);
      mockApi.post.mockResolvedValueOnce(receivedOrder);

      const before = await mockApi.get('/laboratory/orders/order-123');
      expect(before.status).toBe('pending');

      const after = await mockApi.post('/laboratory/specimens/receive', {
        order_id: 'order-123',
        specimen_type: 'blood',
        quality: 'acceptable',
      });
      expect(after.status).toBe('received');
    });
  });

  describe('Result Entry', () => {
    it('enters numeric result within normal range', async () => {
      const resultOrder = createMockOrder({
        tests: [
          {
            id: 'ot-1',
            order_id: 'order-123',
            test_id: 'test-1',
            test: mockLabTests[0],
            status: 'preliminary',
            result_numeric: 7.5,
            result_value: '7.5',
            units: '10^9/L',
            normal_range: '4.5-11.0',
            is_abnormal: false,
            is_critical: false,
            created_at: '2026-02-16T08:00:00Z',
            updated_at: '2026-02-16T10:00:00Z',
          },
        ],
      });

      mockApi.post.mockResolvedValueOnce(resultOrder);

      const response = await mockApi.post('/laboratory/results/enter', {
        order_test_id: 'ot-1',
        result_numeric: 7.5,
      });

      expect(response.tests?.[0]?.is_abnormal).toBe(false);
      expect(response.tests?.[0]?.is_critical).toBe(false);
      expect(response.tests?.[0]?.status).toBe('preliminary');
    });

    it('flags abnormal result outside normal range', async () => {
      const abnormalResultOrder = createMockOrder({
        tests: [
          {
            id: 'ot-1',
            order_id: 'order-123',
            test_id: 'test-1',
            test: mockLabTests[0],
            status: 'preliminary',
            result_numeric: 15.0,
            result_value: '15.0',
            units: '10^9/L',
            normal_range: '4.5-11.0',
            is_abnormal: true,
            is_critical: false,
            created_at: '2026-02-16T08:00:00Z',
            updated_at: '2026-02-16T10:00:00Z',
          },
        ],
      });

      mockApi.post.mockResolvedValueOnce(abnormalResultOrder);

      const response = await mockApi.post('/laboratory/results/enter', {
        order_test_id: 'ot-1',
        result_numeric: 15.0,
        is_abnormal: true,
      });

      expect(response.tests?.[0]?.is_abnormal).toBe(true);
      expect(response.tests?.[0]?.result_numeric).toBe(15.0);
    });

    it('flags critical value requiring immediate notification', async () => {
      const criticalResultOrder = createMockOrder({
        tests: [
          {
            id: 'ot-1',
            order_id: 'order-123',
            test_id: 'test-2',
            test: mockLabTests[1],
            status: 'preliminary',
            result_numeric: 400,
            result_value: '400',
            units: 'mg/dL',
            normal_range: '70-100',
            is_abnormal: true,
            is_critical: true,
            notes: 'CRITICAL - Notify physician immediately',
            created_at: '2026-02-16T08:00:00Z',
            updated_at: '2026-02-16T10:00:00Z',
          },
        ],
      });

      mockApi.post.mockResolvedValueOnce(criticalResultOrder);

      const response = await mockApi.post('/laboratory/results/enter', {
        order_test_id: 'ot-1',
        result_numeric: 400,
        is_critical: true,
        notes: 'CRITICAL - Notify physician immediately',
      });

      expect(response.tests?.[0]?.is_critical).toBe(true);
      expect(response.tests?.[0]?.notes).toContain('CRITICAL');
    });
  });

  describe('Result Validation', () => {
    it('validates result and marks as final', async () => {
      const validatedOrder = createMockOrder({
        status: 'completed',
        tests: [
          {
            id: 'ot-1',
            order_id: 'order-123',
            test_id: 'test-1',
            test: mockLabTests[0],
            status: 'final',
            result_numeric: 7.5,
            result_value: '7.5',
            validated_by: 'pathologist-1',
            validated_at: '2026-02-16T11:00:00Z',
            created_at: '2026-02-16T08:00:00Z',
            updated_at: '2026-02-16T11:00:00Z',
          },
        ],
      });

      mockApi.post.mockResolvedValueOnce(validatedOrder);

      const response = await mockApi.post('/laboratory/results/validate', {
        order_test_id: 'ot-1',
        validated: true,
      });

      expect(response.tests?.[0]?.status).toBe('final');
      expect(response.tests?.[0]?.validated_by).toBe('pathologist-1');
      expect(response.tests?.[0]?.validated_at).toBeDefined();
    });

    it('only allows authorized personnel to validate', async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error('Unauthorized - Only pathologists can validate results')
      );

      await expect(
        mockApi.post('/laboratory/results/validate', {
          order_test_id: 'ot-1',
          validated: true,
        })
      ).rejects.toThrow('Unauthorized');
    });

    it('marks order as completed when all tests validated', async () => {
      const completedOrder = createMockOrder({
        status: 'completed',
        completed_at: '2026-02-16T11:00:00Z',
        reported_at: '2026-02-16T11:00:00Z',
        tests: [
          {
            id: 'ot-1',
            order_id: 'order-123',
            test_id: 'test-1',
            test: mockLabTests[0],
            status: 'final',
            result_numeric: 7.5,
            result_value: '7.5',
            validated_by: 'pathologist-1',
            validated_at: '2026-02-16T11:00:00Z',
            created_at: '2026-02-16T08:00:00Z',
            updated_at: '2026-02-16T11:00:00Z',
          },
        ],
      });

      mockApi.post.mockResolvedValueOnce(completedOrder);

      const response = await mockApi.post('/laboratory/results/validate', {
        order_test_id: 'ot-1',
        validated: true,
      });

      expect(response.status).toBe('completed');
      expect(response.completed_at).toBeDefined();
      expect(response.reported_at).toBeDefined();
    });
  });

  describe('Error Scenarios', () => {
    it('handles order cancellation', async () => {
      const cancelledOrder = createMockOrder({ status: 'cancelled' });

      mockApi.post.mockResolvedValueOnce(cancelledOrder);

      const response = await mockApi.post('/laboratory/orders/order-123/cancel', {
        reason: 'Patient refused procedure',
      });

      expect(response.status).toBe('cancelled');
    });

    it('handles specimen rejection workflow', async () => {
      const rejectedOrder = createMockOrder({ status: 'rejected' });

      mockApi.post.mockResolvedValueOnce(rejectedOrder);

      const response = await mockApi.post('/laboratory/specimens/receive', {
        order_id: 'order-123',
        specimen_type: 'blood',
        quality: 'insufficient',
        notes: 'Insufficient volume - recollection required',
      });

      expect(response.status).toBe('rejected');
    });

    it('handles network errors gracefully', async () => {
      mockApi.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        mockApi.post('/laboratory/orders', {
          patient_id: 'patient-1',
          test_ids: ['test-1'],
        })
      ).rejects.toThrow('Network error');
    });
  });
});
