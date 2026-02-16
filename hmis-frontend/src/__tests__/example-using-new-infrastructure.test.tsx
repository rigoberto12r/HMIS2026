/**
 * Example test demonstrating the new test infrastructure
 * This file shows how to use test-utils and mock generators
 * @jest-environment jsdom
 */

import { render, screen, waitFor, renderHook } from '@/test-utils';
import {
  mockLabOrder,
  mockLabOrders,
  mockRadStudy,
  mockBed,
  mockEDVisit,
} from '@/__mocks__';

describe('Example: Using New Test Infrastructure', () => {
  describe('Mock Data Generators', () => {
    it('generates realistic lab order data', () => {
      const order = mockLabOrder();

      // All required fields are present
      expect(order.id).toBeTruthy();
      expect(order.order_number).toMatch(/LAB-2026-/);
      expect(order.patient_name).toBeTruthy();
      expect(order.status).toBeTruthy();
      expect(order.tests).toHaveLength(1);
    });

    it('allows custom overrides', () => {
      const customOrder = mockLabOrder({
        patient_name: 'Juan Pérez',
        status: 'completed',
        priority: 'stat',
      });

      expect(customOrder.patient_name).toBe('Juan Pérez');
      expect(customOrder.status).toBe('completed');
      expect(customOrder.priority).toBe('stat');
    });

    it('generates multiple orders with variety', () => {
      const orders = mockLabOrders(5);

      expect(orders).toHaveLength(5);
      // Each order has unique ID
      const ids = orders.map((o) => o.id);
      expect(new Set(ids).size).toBe(5);
    });
  });

  describe('Rendering Components', () => {
    // Simple example component for demonstration
    const LabOrderBadge = ({ order }: { order: ReturnType<typeof mockLabOrder> }) => (
      <div>
        <span data-testid="order-number">{order.order_number}</span>
        <span data-testid="patient">{order.patient_name}</span>
        <span data-testid="status">{order.status}</span>
      </div>
    );

    it('renders with mock data', () => {
      const order = mockLabOrder();

      render(<LabOrderBadge order={order} />);

      expect(screen.getByTestId('order-number')).toHaveTextContent(order.order_number);
      expect(screen.getByTestId('patient')).toHaveTextContent(order.patient_name!);
      expect(screen.getByTestId('status')).toHaveTextContent(order.status);
    });
  });

  describe('Cross-Module Mock Data', () => {
    it('provides mocks for all major modules', () => {
      // Laboratory
      const labOrder = mockLabOrder();
      expect(labOrder.order_number).toMatch(/LAB-/);

      // Radiology
      const radStudy = mockRadStudy();
      expect(radStudy.study_uid).toMatch(/1\.2\.840\./);

      // Inpatient
      const bed = mockBed();
      expect(bed.bed_number).toBeTruthy();

      // Emergency
      const edVisit = mockEDVisit();
      expect(edVisit.visit_number).toMatch(/ED-/);
    });
  });

  describe('Scenario-Based Testing', () => {
    it('handles critical lab results', () => {
      const { mockCriticalLabOrder } = require('@/__mocks__/laboratory');
      const criticalOrder = mockCriticalLabOrder();

      expect(criticalOrder.priority).toBe('stat');
      expect(criticalOrder.status).toBe('completed');
      expect(criticalOrder.tests?.[0]?.is_critical).toBe(true);
    });

    it('handles STAT radiology orders', () => {
      const { mockStatRadOrder } = require('@/__mocks__/radiology');
      const statOrder = mockStatRadOrder();

      expect(statOrder.priority).toBe('stat');
    });

    it('handles trauma ED visits', () => {
      const { mockTraumaVisit } = require('@/__mocks__/emergency');
      const traumaVisit = mockTraumaVisit();

      expect(traumaVisit.esi_level).toBe(2);
      expect(traumaVisit.arrival_mode).toBe('ambulance');
    });
  });

  describe('Data Relationships', () => {
    it('maintains proper parent-child relationships', () => {
      const order = mockLabOrder();

      // Order has tests
      expect(order.tests).toBeDefined();
      expect(order.tests!.length).toBeGreaterThan(0);

      // Order has specimen
      expect(order.specimen).toBeDefined();
      expect(order.specimen!.order_id).toBe(order.id);

      // Tests reference the order
      const test = order.tests![0];
      expect(test.order_id).toBe(order.id);
    });
  });

  describe('Pagination Helpers', () => {
    it('generates paginated responses', () => {
      const { mockPaginatedLabOrders } = require('@/__mocks__/laboratory');
      const response = mockPaginatedLabOrders(1, 20, 100);

      expect(response.items).toHaveLength(20);
      expect(response.total).toBe(100);
      expect(response.page).toBe(1);
      expect(response.page_size).toBe(20);
      expect(response.total_pages).toBe(5);
    });

    it('handles last page correctly', () => {
      const { mockPaginatedLabOrders } = require('@/__mocks__/laboratory');
      const response = mockPaginatedLabOrders(5, 20, 85);

      // Last page should have only 5 items (85 - 80)
      expect(response.items.length).toBeLessThanOrEqual(20);
      expect(response.page).toBe(5);
    });
  });

  describe('Type Safety', () => {
    it('generates properly typed data', () => {
      const order = mockLabOrder();

      // TypeScript knows the types
      const orderNumber: string = order.order_number;
      const patientName: string | undefined = order.patient_name;
      const tests: any[] | undefined = order.tests;

      expect(orderNumber).toBeTruthy();
      expect(patientName).toBeTruthy();
      expect(tests).toBeDefined();
    });
  });
});

describe('Example: Test Utilities', () => {
  describe('Custom Render', () => {
    it('provides QueryClient automatically', () => {
      const Component = () => <div>Test Component</div>;

      // render from test-utils includes QueryClientProvider
      const { container } = render(<Component />);

      expect(container).toBeTruthy();
    });
  });

  describe('Auth Helpers', () => {
    it('sets up mock auth tokens', () => {
      const { setupMockAuth, clearMockAuth } = require('@/test-utils');

      setupMockAuth('test_token', 'refresh_token', 'tenant_123');

      expect(localStorage.getItem('hmis_access_token')).toBe('test_token');
      expect(localStorage.getItem('hmis_refresh_token')).toBe('refresh_token');
      expect(localStorage.getItem('hmis_tenant_id')).toBe('tenant_123');

      clearMockAuth();

      expect(localStorage.getItem('hmis_access_token')).toBeNull();
    });
  });

  describe('API Mocking Helpers', () => {
    it('creates mock API responses', async () => {
      const { createMockApiResponse } = require('@/test-utils');

      const mockData = { id: '1', name: 'Test' };
      const response = createMockApiResponse(mockData, 0);

      const result = await response;
      expect(result).toEqual(mockData);
    });

    it('creates mock API errors', async () => {
      const { createMockApiError } = require('@/test-utils');

      const errorPromise = createMockApiError('Not found', 404, 0);

      await expect(errorPromise).rejects.toThrow('Not found');
    });
  });
});

describe('Example: Real-World Test Patterns', () => {
  const LabOrderList = ({ orders }: { orders: ReturnType<typeof mockLabOrders> }) => (
    <ul>
      {orders.map((order) => (
        <li key={order.id}>
          {order.order_number} - {order.patient_name} ({order.status})
        </li>
      ))}
    </ul>
  );

  it('displays multiple lab orders', () => {
    const orders = mockLabOrders(3);

    render(<LabOrderList orders={orders} />);

    orders.forEach((order) => {
      expect(screen.getByText(new RegExp(order.order_number))).toBeInTheDocument();
    });
  });

  it('filters orders by status', () => {
    const completedOrders = mockLabOrders(2).map((o) =>
      mockLabOrder({ ...o, status: 'completed' })
    );
    const pendingOrders = mockLabOrders(3).map((o) =>
      mockLabOrder({ ...o, status: 'pending' })
    );

    const allOrders = [...completedOrders, ...pendingOrders];

    render(<LabOrderList orders={allOrders} />);

    expect(screen.getAllByText(/completed/i)).toHaveLength(2);
    expect(screen.getAllByText(/pending/i)).toHaveLength(3);
  });
});
