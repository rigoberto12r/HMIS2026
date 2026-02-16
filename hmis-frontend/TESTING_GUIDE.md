# HMIS Frontend Testing Guide

This guide explains how to write and run tests in the HMIS frontend codebase. We use **Jest** with **React Testing Library** for unit and integration tests.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Testing Philosophy](#testing-philosophy)
3. [Test Structure](#test-structure)
4. [Common Patterns](#common-patterns)
5. [Testing React Query Hooks](#testing-react-query-hooks)
6. [Testing Components](#testing-components)
7. [Mock Data](#mock-data)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Coverage Requirements](#coverage-requirements)

---

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode (recommended during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- path/to/file.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should render"
```

---

## Testing Philosophy

We follow these principles:

1. **Test behavior, not implementation** - Focus on what the user sees and experiences
2. **Use React Testing Library queries** - Prefer `getByRole`, `getByLabelText` over `getByTestId`
3. **Avoid implementation details** - Don't test internal state or private methods
4. **Write maintainable tests** - Use helper functions and mock data generators
5. **Follow AAA pattern** - Arrange, Act, Assert

---

## Test Structure

All test files follow this naming convention:
- Unit tests: `__tests__/ComponentName.test.tsx` or `ComponentName.test.tsx`
- Hook tests: `hooks/__tests__/useHookName.test.ts`

### Basic Test Template

```typescript
/**
 * Tests for MyComponent
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@/test-utils';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  beforeEach(() => {
    // Setup before each test
    jest.clearAllMocks();
  });

  it('should render correctly', () => {
    // Arrange
    const props = { title: 'Test' };

    // Act
    render(<MyComponent {...props} />);

    // Assert
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

---

## Common Patterns

### 1. Using Custom Render with Providers

Always import from `@/test-utils` instead of `@testing-library/react`:

```typescript
// ✅ GOOD - Includes QueryClient wrapper
import { render, screen } from '@/test-utils';

// ❌ BAD - Missing providers
import { render, screen } from '@testing-library/react';
```

### 2. Mocking API Calls

```typescript
import { api } from '@/lib/api';

// Mock the entire API module
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

// In your test
it('fetches data from API', async () => {
  mockApi.get.mockResolvedValueOnce({ data: 'test' });

  const { result } = renderHook(() => useMyHook());

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mockApi.get).toHaveBeenCalledWith('/endpoint');
});
```

### 3. Mocking localStorage

localStorage is automatically mocked in `jest.setup.js`. Use the helper functions:

```typescript
import { setupMockAuth, clearMockAuth } from '@/test-utils';

it('works with authenticated user', () => {
  setupMockAuth('my_token', 'refresh_token', 'tenant_123');

  // Your test code
});

afterEach(() => {
  clearMockAuth();
});
```

### 4. Waiting for Async Updates

```typescript
import { waitFor } from '@/test-utils';

it('handles async data', async () => {
  render(<MyComponent />);

  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  // Now assert on loaded data
  expect(screen.getByText('Data loaded')).toBeInTheDocument();
});
```

---

## Testing React Query Hooks

### Pattern for Custom Hooks

```typescript
import { renderHook, waitFor } from '@/test-utils';
import { usePatients } from '../usePatients';
import { api } from '@/lib/api';
import { mockPaginatedPatients } from '@/__mocks__/patients';

jest.mock('@/lib/api');
const mockApi = api as jest.Mocked<typeof api>;

describe('usePatients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches patients successfully', async () => {
    const mockData = mockPaginatedPatients(1, 20, 50);
    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => usePatients({ page: 1 }));

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for success
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Check data
    expect(result.current.data).toEqual(mockData);
    expect(mockApi.get).toHaveBeenCalledWith('/patients/search', { page: 1 });
  });

  it('handles errors', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePatients({}));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Network error');
  });
});
```

### Pattern for Mutations

```typescript
it('creates a patient', async () => {
  const newPatient = mockPatient({ id: '123', name: 'New Patient' });
  mockApi.post.mockResolvedValueOnce(newPatient);

  const { result } = renderHook(() => useCreatePatient());

  let mutationResult: any;
  await waitFor(async () => {
    mutationResult = await result.current.mutateAsync({
      name: 'New Patient',
      // ... other fields
    });
  });

  expect(mutationResult).toEqual(newPatient);
  expect(mockApi.post).toHaveBeenCalledWith('/patients', expect.objectContaining({
    name: 'New Patient',
  }));
});
```

---

## Testing Components

### 1. Form Components

```typescript
import { render, screen, fireEvent, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';

it('submits form with valid data', async () => {
  const onSubmit = jest.fn();
  const user = userEvent.setup();

  render(<PatientForm onSubmit={onSubmit} />);

  // Fill form
  await user.type(screen.getByLabelText('First Name'), 'Juan');
  await user.type(screen.getByLabelText('Last Name'), 'Pérez');

  // Submit
  await user.click(screen.getByRole('button', { name: /submit/i }));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({
      firstName: 'Juan',
      lastName: 'Pérez',
    });
  });
});

it('shows validation errors', async () => {
  const user = userEvent.setup();

  render(<PatientForm onSubmit={jest.fn()} />);

  // Submit without filling required fields
  await user.click(screen.getByRole('button', { name: /submit/i }));

  // Check for error messages
  expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
});
```

### 2. Data Tables

```typescript
it('displays patient data in table', () => {
  const patients = mockPatients(3);

  render(<PatientTable patients={patients} />);

  // Check headers
  expect(screen.getByText('Name')).toBeInTheDocument();
  expect(screen.getByText('MRN')).toBeInTheDocument();

  // Check data rows
  patients.forEach((patient) => {
    expect(screen.getByText(patient.name)).toBeInTheDocument();
    expect(screen.getByText(patient.mrn)).toBeInTheDocument();
  });
});
```

### 3. Modal/Dialog Components

```typescript
it('opens and closes modal', async () => {
  const user = userEvent.setup();

  render(<MyComponentWithModal />);

  // Modal should be closed initially
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  // Open modal
  await user.click(screen.getByRole('button', { name: /open/i }));

  // Modal should be visible
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  // Close modal
  await user.click(screen.getByRole('button', { name: /close/i }));

  // Modal should be closed
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

---

## Mock Data

We provide mock data generators in `src/__mocks__/` for all major modules:

### Available Mock Generators

```typescript
// Laboratory
import {
  mockLabTest,
  mockLabOrder,
  mockLabOrders,
  mockLabDashboardStats,
  mockPaginatedLabOrders,
  mockCriticalLabOrder,
} from '@/__mocks__/laboratory';

// Radiology
import {
  mockRadOrder,
  mockRadStudy,
  mockRadReport,
  mockPaginatedRadOrders,
  mockStatRadOrder,
} from '@/__mocks__/radiology';

// Inpatient
import {
  mockBed,
  mockAdmission,
  mockTransfer,
  mockDischarge,
  mockCensusRealtime,
  mockOccupiedBed,
} from '@/__mocks__/inpatient';

// Emergency
import {
  mockEDVisit,
  mockTriageAssessment,
  mockEDTrackBoard,
  mockCriticalEDVisit,
  mockTraumaVisit,
} from '@/__mocks__/emergency';
```

### Using Mock Generators

```typescript
it('displays lab orders', () => {
  const orders = mockLabOrders(5); // Generate 5 mock orders

  render(<LabOrderTable orders={orders} />);

  expect(screen.getAllByRole('row')).toHaveLength(6); // 5 + header
});

it('handles critical lab result', () => {
  const criticalOrder = mockCriticalLabOrder();

  render(<LabOrderCard order={criticalOrder} />);

  expect(screen.getByText(/critical/i)).toBeInTheDocument();
});
```

### Custom Overrides

All mock generators accept overrides:

```typescript
const customOrder = mockLabOrder({
  id: 'my-id',
  patient_name: 'Custom Name',
  status: 'completed',
  priority: 'stat',
});
```

---

## Best Practices

### ✅ DO

1. **Use semantic queries** (in order of preference):
   ```typescript
   screen.getByRole('button', { name: /submit/i })
   screen.getByLabelText('Email')
   screen.getByPlaceholderText('Enter email')
   screen.getByText(/welcome/i)
   screen.getByDisplayValue('test@example.com')
   ```

2. **Use userEvent over fireEvent**:
   ```typescript
   // ✅ Better - simulates real user interaction
   const user = userEvent.setup();
   await user.click(button);
   await user.type(input, 'text');

   // ❌ Less realistic
   fireEvent.click(button);
   fireEvent.change(input, { target: { value: 'text' } });
   ```

3. **Clean up after tests**:
   ```typescript
   afterEach(() => {
     jest.clearAllMocks();
     clearMockAuth();
   });
   ```

4. **Test accessibility**:
   ```typescript
   expect(screen.getByRole('button')).toBeEnabled();
   expect(screen.getByLabelText('Email')).toBeRequired();
   ```

### ❌ DON'T

1. **Don't use getByTestId unless necessary**:
   ```typescript
   // ❌ Avoid
   screen.getByTestId('submit-button')

   // ✅ Better
   screen.getByRole('button', { name: /submit/i })
   ```

2. **Don't test implementation details**:
   ```typescript
   // ❌ Bad - testing internal state
   expect(component.state.count).toBe(5);

   // ✅ Good - testing visible output
   expect(screen.getByText('Count: 5')).toBeInTheDocument();
   ```

3. **Don't forget to await async operations**:
   ```typescript
   // ❌ Missing await
   const { result } = renderHook(() => useData());
   expect(result.current.data).toBeDefined(); // Flaky!

   // ✅ Correct
   await waitFor(() => expect(result.current.isSuccess).toBe(true));
   expect(result.current.data).toBeDefined();
   ```

---

## Troubleshooting

### "Act" Warnings

If you see warnings about updates not being wrapped in `act()`:

```typescript
// Wrap in waitFor
await waitFor(() => {
  expect(screen.getByText('Updated')).toBeInTheDocument();
});
```

### Flaky Tests

Common causes and fixes:

1. **Race conditions** - Use `waitFor` for async updates
2. **Shared state** - Clear mocks and localStorage in `beforeEach`/`afterEach`
3. **Network delays** - Mock API responses with consistent delays

### Mock Not Working

Ensure mocks are defined before imports:

```typescript
// ✅ Correct order
jest.mock('@/lib/api');
import { MyComponent } from './MyComponent';

// ❌ Wrong order
import { MyComponent } from './MyComponent';
jest.mock('@/lib/api'); // Too late!
```

---

## Coverage Requirements

Current coverage thresholds (enforced in CI):

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Check Coverage

```bash
npm run test:coverage
```

This generates an HTML report in `coverage/lcov-report/index.html`.

### Excluding Files from Coverage

Files excluded (see `jest.config.js`):
- `*.d.ts` - Type definitions
- `*.stories.tsx` - Storybook stories
- `_*.tsx` - Internal utilities (e.g., `_app.tsx`)

---

## Running Specific Tests

```bash
# Run tests in a specific file
npm test -- src/hooks/__tests__/usePatients.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should fetch patients"

# Run only changed files
npm test -- --onlyChanged

# Run with verbose output
npm test -- --verbose

# Update snapshots
npm test -- --updateSnapshot
```

---

## Example: Complete Test File

```typescript
/**
 * Tests for LabOrderCard component
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { LabOrderCard } from '../LabOrderCard';
import { mockLabOrder, mockCriticalLabOrder } from '@/__mocks__/laboratory';

describe('LabOrderCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays order information', () => {
    const order = mockLabOrder({
      order_number: 'LAB-2026-001',
      patient_name: 'Juan Pérez',
      status: 'pending',
    });

    render(<LabOrderCard order={order} />);

    expect(screen.getByText('LAB-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it('highlights critical results', () => {
    const criticalOrder = mockCriticalLabOrder();

    render(<LabOrderCard order={criticalOrder} />);

    const criticalBadge = screen.getByText(/critical/i);
    expect(criticalBadge).toBeInTheDocument();
    expect(criticalBadge).toHaveClass('bg-red-600'); // Tailwind class
  });

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const order = mockLabOrder();

    render(<LabOrderCard order={order} onSelect={onSelect} />);

    await user.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledWith(order.id);
  });
});
```

---

## Resources

- [React Testing Library Docs](https://testing-library.com/react)
- [Jest Documentation](https://jestjs.io/)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Best Practices](https://testingjavascript.com/)

---

## Questions?

If you encounter issues or have questions about testing:

1. Check this guide first
2. Look at existing test files for examples
3. Review the mock data generators in `src/__mocks__/`
4. Check the `jest.setup.js` file for global mocks
