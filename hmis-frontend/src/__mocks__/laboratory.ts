/**
 * Mock data generators for Laboratory module
 */

import {
  LabTest,
  LabOrder,
  LabOrderTest,
  LabSpecimen,
  LabDashboardStats,
  PaginatedLabOrders,
  PaginatedLabTests,
  LabTestCategory,
  LabPriority,
  LabOrderStatus,
  LabResultStatus,
  SpecimenType,
  FastingStatus,
} from '@/types/laboratory';

/**
 * Generate a mock LabTest
 */
export function mockLabTest(overrides: Partial<LabTest> = {}): LabTest {
  return {
    id: 'lab-test-1',
    code: 'CBC',
    name: 'Complete Blood Count',
    category: 'hematologia',
    specimen_type: 'blood',
    container_type: 'EDTA tube',
    volume_required: 5,
    fasting_required: false,
    turnaround_time: 2,
    normal_range: '4.5-11.0 x10^9/L',
    units: 'x10^9/L',
    price: 25.00,
    is_active: true,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

/**
 * Generate multiple mock LabTests
 */
export function mockLabTests(count: number = 5): LabTest[] {
  const tests: LabTest[] = [
    mockLabTest({
      id: 'test-1',
      code: 'CBC',
      name: 'Complete Blood Count',
      category: 'hematologia',
    }),
    mockLabTest({
      id: 'test-2',
      code: 'GLU',
      name: 'Glucose',
      category: 'quimica',
      fasting_required: true,
    }),
    mockLabTest({
      id: 'test-3',
      code: 'URINE',
      name: 'Urinalysis',
      category: 'urinalisis',
      specimen_type: 'urine',
    }),
    mockLabTest({
      id: 'test-4',
      code: 'CULTURE',
      name: 'Blood Culture',
      category: 'microbiologia',
      turnaround_time: 48,
    }),
    mockLabTest({
      id: 'test-5',
      code: 'PT',
      name: 'Prothrombin Time',
      category: 'coagulacion',
    }),
  ];

  return tests.slice(0, count);
}

/**
 * Generate a mock LabOrderTest
 */
export function mockLabOrderTest(overrides: Partial<LabOrderTest> = {}): LabOrderTest {
  return {
    id: 'order-test-1',
    order_id: 'order-1',
    test_id: 'test-1',
    test: mockLabTest(),
    status: 'pending',
    result_value: undefined,
    result_numeric: undefined,
    normal_range: '4.5-11.0 x10^9/L',
    units: 'x10^9/L',
    is_abnormal: false,
    is_critical: false,
    notes: undefined,
    performed_by: undefined,
    validated_by: undefined,
    validated_at: undefined,
    created_at: '2026-02-16T08:00:00Z',
    updated_at: '2026-02-16T08:00:00Z',
    ...overrides,
  };
}

/**
 * Generate a mock LabSpecimen
 */
export function mockLabSpecimen(overrides: Partial<LabSpecimen> = {}): LabSpecimen {
  return {
    id: 'specimen-1',
    order_id: 'order-1',
    specimen_type: 'blood',
    collection_date: '2026-02-16',
    collection_time: '08:30:00',
    received_date: '2026-02-16',
    received_by: 'Lab Tech Jane',
    accession_number: 'ACC-2026-001234',
    container_type: 'EDTA tube',
    volume: 5,
    quality: 'acceptable',
    notes: undefined,
    created_at: '2026-02-16T08:30:00Z',
    updated_at: '2026-02-16T08:30:00Z',
    ...overrides,
  };
}

/**
 * Generate a mock LabOrder
 */
export function mockLabOrder(overrides: Partial<LabOrder> = {}): LabOrder {
  return {
    id: 'order-1',
    order_number: 'LAB-2026-001234',
    patient_id: 'patient-1',
    patient_name: 'Juan Pérez',
    patient_mrn: 'MRN-001234',
    encounter_id: 'encounter-1',
    ordering_physician_id: 'physician-1',
    ordering_physician_name: 'Dr. María García',
    priority: 'routine',
    status: 'pending',
    fasting_status: 'non_fasting',
    clinical_info: 'Routine checkup',
    ordered_at: '2026-02-16T08:00:00Z',
    received_at: undefined,
    completed_at: undefined,
    reported_at: undefined,
    tests: [mockLabOrderTest()],
    specimen: mockLabSpecimen(),
    created_at: '2026-02-16T08:00:00Z',
    updated_at: '2026-02-16T08:00:00Z',
    ...overrides,
  };
}

/**
 * Generate multiple mock LabOrders with different statuses
 */
export function mockLabOrders(count: number = 5): LabOrder[] {
  const statuses: LabOrderStatus[] = ['pending', 'received', 'in_process', 'completed', 'cancelled'];
  const priorities: LabPriority[] = ['routine', 'urgent', 'stat'];

  return Array.from({ length: count }, (_, i) => {
    const status = statuses[i % statuses.length];
    const priority = priorities[i % priorities.length];

    return mockLabOrder({
      id: `order-${i + 1}`,
      order_number: `LAB-2026-00${1234 + i}`,
      patient_id: `patient-${i + 1}`,
      patient_name: `Patient ${i + 1}`,
      patient_mrn: `MRN-00${1234 + i}`,
      status,
      priority,
      tests: [
        mockLabOrderTest({
          id: `order-test-${i + 1}`,
          order_id: `order-${i + 1}`,
          status: status === 'completed' ? 'final' : 'pending',
          result_value: status === 'completed' ? '8.5' : undefined,
          result_numeric: status === 'completed' ? 8.5 : undefined,
        }),
      ],
    });
  });
}

/**
 * Generate mock LabDashboardStats
 */
export function mockLabDashboardStats(
  overrides: Partial<LabDashboardStats> = {}
): LabDashboardStats {
  return {
    pending_orders: 12,
    stat_orders: 3,
    critical_values: 2,
    completed_today: 45,
    pending_validation: 8,
    avg_turnaround_time: 2.5,
    orders_by_priority: {
      routine: 35,
      urgent: 8,
      stat: 3,
    },
    orders_by_status: {
      pending: 12,
      received: 15,
      in_process: 10,
      completed: 45,
    },
    ...overrides,
  };
}

/**
 * Generate paginated LabOrders response
 */
export function mockPaginatedLabOrders(
  page: number = 1,
  pageSize: number = 20,
  total: number = 50
): PaginatedLabOrders {
  const items = mockLabOrders(Math.min(pageSize, total - (page - 1) * pageSize));

  return {
    items,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  };
}

/**
 * Generate paginated LabTests response
 */
export function mockPaginatedLabTests(
  page: number = 1,
  pageSize: number = 20,
  total: number = 50
): PaginatedLabTests {
  const items = mockLabTests(Math.min(pageSize, total - (page - 1) * pageSize));

  return {
    items,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  };
}

/**
 * Create a LabOrder with critical result
 */
export function mockCriticalLabOrder(): LabOrder {
  return mockLabOrder({
    priority: 'stat',
    status: 'completed',
    tests: [
      mockLabOrderTest({
        status: 'final',
        result_value: '2.1',
        result_numeric: 2.1,
        is_critical: true,
        is_abnormal: true,
        normal_range: '3.5-5.0 mmol/L',
        notes: 'Critical potassium level - physician notified',
      }),
    ],
  });
}

/**
 * Create a LabOrder with hemolyzed specimen
 */
export function mockHemolyzedSpecimenOrder(): LabOrder {
  return mockLabOrder({
    status: 'rejected',
    specimen: mockLabSpecimen({
      quality: 'hemolyzed',
      notes: 'Specimen hemolyzed - recollection required',
    }),
  });
}
