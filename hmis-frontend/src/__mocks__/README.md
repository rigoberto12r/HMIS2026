# Mock Data Generators

This directory contains comprehensive mock data generators for all major HMIS modules. These generators make it easy to write tests with realistic, consistent data.

## Quick Start

```typescript
import { mockLabOrder, mockRadStudy, mockBed } from '@/__mocks__';

// Use in tests
const order = mockLabOrder();
const study = mockRadStudy();
const bed = mockBed();
```

## Available Generators

### Laboratory (`laboratory.ts`)

**Basic Generators:**
- `mockLabTest()` - Single lab test definition (CBC, Glucose, etc.)
- `mockLabTests(count)` - Multiple test definitions
- `mockLabOrderTest()` - Test result for an order
- `mockLabSpecimen()` - Specimen collection data
- `mockLabOrder()` - Complete lab order with tests and specimen
- `mockLabOrders(count)` - Multiple orders with variety

**Pagination:**
- `mockPaginatedLabOrders(page, pageSize, total)`
- `mockPaginatedLabTests(page, pageSize, total)`

**Scenarios:**
- `mockCriticalLabOrder()` - Critical potassium result
- `mockHemolyzedSpecimenOrder()` - Rejected hemolyzed specimen

**Dashboard:**
- `mockLabDashboardStats()` - Dashboard metrics

### Radiology (`radiology.ts`)

**Basic Generators:**
- `mockRadOrder()` - Imaging order
- `mockRadOrders(count)` - Multiple orders
- `mockRadStudy()` - DICOM study
- `mockRadStudies(count)` - Multiple studies
- `mockRadReport()` - Radiology report
- `mockRadReports(count)` - Multiple reports
- `mockRadTemplate()` - Report template
- `mockRadTemplates(count)` - Multiple templates

**Pagination:**
- `mockPaginatedRadOrders(page, pageSize, total)`
- `mockPaginatedRadStudies(page, pageSize, total)`
- `mockPaginatedRadReports(page, pageSize, total)`

**Scenarios:**
- `mockStatRadOrder()` - STAT priority order
- `mockUnsignedRadReport()` - Draft/unsigned report

**Dashboard:**
- `mockRadDashboardStats()` - Dashboard metrics

### Inpatient (`inpatient.ts`)

**Basic Generators:**
- `mockBed()` - Hospital bed
- `mockBeds(count)` - Multiple beds
- `mockAdmission()` - Patient admission
- `mockAdmissions(count)` - Multiple admissions
- `mockTransfer()` - Bed transfer
- `mockDischarge()` - Discharge summary

**Census:**
- `mockCensusSnapshot()` - Unit-level census
- `mockCensusRealtime()` - Hospital-wide census
- `mockBedAvailability(count)` - Available beds

**Scenarios:**
- `mockOccupiedBed()` - Bed with current patient
- `mockLongStayAdmission()` - 32-day LOS admission
- `mockHomeHealthDischarge()` - Discharge to home health
- `mockAMADischarge()` - Against Medical Advice discharge

### Emergency (`emergency.ts`)

**Basic Generators:**
- `mockEDVisit()` - ED patient visit
- `mockEDVisits(count)` - Multiple visits
- `mockTriageAssessment()` - Triage with vitals
- `mockEDTrackBoardItem()` - Track board entry
- `mockEDTrackBoard(count)` - Full track board

**Metrics:**
- `mockEDMetrics()` - Daily metrics
- `mockEDDashboardStats()` - Real-time dashboard stats

**Scenarios:**
- `mockCriticalEDVisit()` - ESI Level 1 (cardiac arrest)
- `mockCriticalTriageAssessment()` - Critical triage
- `mockTraumaVisit()` - Motor vehicle accident
- `mockTraumaTriageAssessment()` - Trauma triage
- `mockLWBSVisit()` - Left Without Being Seen
- `mockIsolationTriageAssessment()` - Isolation precautions
- `mockPediatricVisit()` - Pediatric patient

## Usage Examples

### Basic Usage

```typescript
import { mockLabOrder } from '@/__mocks__/laboratory';

it('displays lab order', () => {
  const order = mockLabOrder();

  render(<LabOrderCard order={order} />);

  expect(screen.getByText(order.order_number)).toBeInTheDocument();
});
```

### Custom Overrides

```typescript
const customOrder = mockLabOrder({
  patient_name: 'Juan Pérez',
  status: 'completed',
  priority: 'stat',
  tests: [
    mockLabOrderTest({
      result_value: '150',
      is_abnormal: true,
    }),
  ],
});
```

### Multiple Items

```typescript
const orders = mockLabOrders(10);

expect(orders).toHaveLength(10);
expect(orders[0].status).toBeTruthy();
```

### Pagination

```typescript
const page1 = mockPaginatedLabOrders(1, 20, 100);

expect(page1.items).toHaveLength(20);
expect(page1.total).toBe(100);
expect(page1.total_pages).toBe(5);
```

### Scenarios

```typescript
// Critical lab result
const critical = mockCriticalLabOrder();
expect(critical.tests[0].is_critical).toBe(true);

// STAT radiology order
const stat = mockStatRadOrder();
expect(stat.priority).toBe('stat');

// Trauma patient
const trauma = mockTraumaVisit();
expect(trauma.esi_level).toBe(2);
expect(trauma.arrival_mode).toBe('ambulance');
```

### Cross-Module Testing

```typescript
import {
  mockLabOrder,
  mockRadStudy,
  mockAdmission,
  mockEDVisit,
} from '@/__mocks__';

it('creates patient workflow', () => {
  // ED visit
  const visit = mockEDVisit({ patient_id: 'patient-123' });

  // Admission from ED
  const admission = mockAdmission({
    patient_id: 'patient-123',
    admission_type: 'emergency',
  });

  // Lab order for admitted patient
  const labOrder = mockLabOrder({
    patient_id: 'patient-123',
    encounter_id: admission.id,
  });

  // Radiology study
  const radStudy = mockRadStudy({
    patient_id: 'patient-123',
  });
});
```

## Mock Data Features

### Realistic Defaults

All generators provide production-like data:

```typescript
const order = mockLabOrder();

// Results in:
{
  id: 'order-1',
  order_number: 'LAB-2026-001234',
  patient_id: 'patient-1',
  patient_name: 'Juan Pérez',
  patient_mrn: 'MRN-001234',
  priority: 'routine',
  status: 'pending',
  fasting_status: 'non_fasting',
  clinical_info: 'Routine checkup',
  ordered_at: '2026-02-16T08:00:00Z',
  tests: [ /* lab test objects */ ],
  specimen: { /* specimen object */ },
  // ... etc
}
```

### Proper Relationships

Generators maintain parent-child relationships:

```typescript
const order = mockLabOrder();

// Specimen references order
expect(order.specimen.order_id).toBe(order.id);

// Tests reference order
expect(order.tests[0].order_id).toBe(order.id);

// Test references test definition
expect(order.tests[0].test).toBeDefined();
```

### TypeScript Support

All mocks are fully typed:

```typescript
const order: LabOrder = mockLabOrder();
const study: RadStudy = mockRadStudy();
const bed: Bed = mockBed();

// TypeScript knows all fields
order.patient_name; // string | undefined
study.study_uid; // string
bed.status; // BedStatus
```

### Deterministic IDs

IDs follow predictable patterns for easy testing:

```typescript
const orders = mockLabOrders(3);

expect(orders[0].id).toBe('order-1');
expect(orders[1].id).toBe('order-2');
expect(orders[2].id).toBe('order-3');
```

## Best Practices

### DO:

✅ Use mock generators for all test data
```typescript
const order = mockLabOrder();
```

✅ Override only what you need
```typescript
const order = mockLabOrder({ status: 'completed' });
```

✅ Use scenario generators for edge cases
```typescript
const critical = mockCriticalLabOrder();
```

✅ Import from central export
```typescript
import { mockLabOrder, mockRadStudy } from '@/__mocks__';
```

### DON'T:

❌ Create raw objects manually
```typescript
// Bad - fragile, incomplete
const order = {
  id: '1',
  patient_name: 'Test',
  // Missing required fields!
};
```

❌ Duplicate generator logic in tests
```typescript
// Bad - duplicates mock logic
function createTestOrder() {
  return { /* ... */ };
}
```

❌ Import individual files
```typescript
// Bad - verbose
import { mockLabOrder } from '@/__mocks__/laboratory';

// Good - cleaner
import { mockLabOrder } from '@/__mocks__';
```

## Adding New Generators

When adding a new module:

1. Create `src/__mocks__/module-name.ts`
2. Export all generators
3. Add exports to `src/__mocks__/index.ts`
4. Update this README

Example template:

```typescript
// src/__mocks__/pharmacy.ts

import { Prescription } from '@/types/pharmacy';

export function mockPrescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    id: 'rx-1',
    patient_id: 'patient-1',
    medication: 'Aspirin 81mg',
    // ... all required fields
    ...overrides,
  };
}

export function mockPrescriptions(count: number = 5): Prescription[] {
  return Array.from({ length: count }, (_, i) =>
    mockPrescription({ id: `rx-${i + 1}` })
  );
}
```

## Testing the Generators

Run the example test:

```bash
npm test -- src/__tests__/example-using-new-infrastructure.test.tsx
```

This verifies all generators work correctly.

## Questions?

- See `TESTING_GUIDE.md` for usage in tests
- See `TEST_INFRASTRUCTURE_SUMMARY.md` for overview
- Check `src/__tests__/example-using-new-infrastructure.test.tsx` for examples
