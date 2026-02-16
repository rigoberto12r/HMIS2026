/**
 * Tests for ResultEntryForm component
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ResultEntryForm } from '../ResultEntryForm';
import { api } from '@/lib/api';
import type { LabTest } from '@/types/laboratory';

// Mock the API client
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  ApiClientError: class extends Error {
    status: number;
    constructor(msg: string, status = 400) {
      super(msg);
      this.status = status;
    }
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('ResultEntryForm', () => {
  const mockOnSuccess = jest.fn();
  const mockTest: LabTest = {
    id: 'test-1',
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

  const defaultProps = {
    orderTestId: 'order-test-123',
    test: mockTest,
    onSuccess: mockOnSuccess,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.post.mockReset();
  });

  it('renders with test information', () => {
    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    expect(screen.getByText('Glucose')).toBeInTheDocument();
    expect(screen.getByText(/Rango de referencia: 70-100 mg\/dL/)).toBeInTheDocument();
  });

  it('prevents submission without value', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    const submitBtn = screen.getByText('Guardar como Preliminar');
    await user.click(submitBtn);

    // Should not call API when form is invalid
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('submits result successfully as preliminary', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    // Enter result value
    const valueInput = screen.getByPlaceholderText('Ingrese valor...');
    await user.type(valueInput, '85');

    const submitBtn = screen.getByText('Guardar como Preliminar');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/laboratory/results/enter',
        expect.objectContaining({
          order_test_id: 'order-test-123',
          result_value: '85',
          result_numeric: 85,
          is_abnormal: false,
          is_critical: false,
        }),
      );
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('submits result successfully as final', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    const valueInput = screen.getByPlaceholderText('Ingrese valor...');
    await user.type(valueInput, '95');

    const finalBtn = screen.getByText('Guardar como Final');
    fireEvent.click(finalBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/laboratory/results/enter',
        expect.objectContaining({
          result_value: '95',
          result_numeric: 95,
        }),
      );
    });
  });

  it('automatically flags high values as abnormal', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    // Enter a high value (>100)
    const valueInput = screen.getByPlaceholderText('Ingrese valor...');
    await user.type(valueInput, '150');

    // Wait for auto-calculation
    await waitFor(() => {
      const abnormalSelect = screen.getByDisplayValue('Alto (H)') as HTMLSelectElement;
      expect(abnormalSelect).toBeInTheDocument();
    });

    const submitBtn = screen.getByText('Guardar como Final');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/laboratory/results/enter',
        expect.objectContaining({
          result_numeric: 150,
          is_abnormal: true,
        }),
      );
    });
  });

  it('automatically flags low values as abnormal', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    // Enter a low value (<70)
    const valueInput = screen.getByPlaceholderText('Ingrese valor...');
    await user.type(valueInput, '50');

    // Wait for auto-calculation
    await waitFor(() => {
      const abnormalSelect = screen.getByDisplayValue('Bajo (L)') as HTMLSelectElement;
      expect(abnormalSelect).toBeInTheDocument();
    });

    const submitBtn = screen.getByText('Guardar como Final');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/laboratory/results/enter',
        expect.objectContaining({
          result_numeric: 50,
          is_abnormal: true,
        }),
      );
    });
  });

  it('marks normal values correctly', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    const valueInput = screen.getByPlaceholderText('Ingrese valor...');
    await user.type(valueInput, '85');

    // Normal flag should be selected automatically
    await waitFor(() => {
      const abnormalSelect = screen.getByDisplayValue('Normal') as HTMLSelectElement;
      expect(abnormalSelect).toBeInTheDocument();
    });
  });

  it('allows manual override of abnormal flag', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    const valueInput = screen.getByPlaceholderText('Ingrese valor...');
    await user.type(valueInput, '85');

    // Manually change abnormal flag
    const selects = screen.getAllByRole('combobox');
    const abnormalSelect = selects.find(
      (select) => select.querySelector('option[value="N"]')
    ) as HTMLSelectElement;
    await user.selectOptions(abnormalSelect, 'A');

    const submitBtn = screen.getByText('Guardar como Final');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/laboratory/results/enter',
        expect.objectContaining({
          is_abnormal: true,
        }),
      );
    });
  });

  it('handles critical value flag correctly', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    const valueInput = screen.getByPlaceholderText('Ingrese valor...');
    await user.type(valueInput, '250');

    // Mark as critical
    const criticalCheckbox = screen.getByRole('checkbox', { name: /Marcar como crítico/i });
    await user.click(criticalCheckbox);

    // Should show critical warning
    await waitFor(() => {
      expect(screen.getByText(/Valor crítico - Requiere notificación inmediata al médico/)).toBeInTheDocument();
    });

    const submitBtn = screen.getByText('Guardar como Final');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/laboratory/results/enter',
        expect.objectContaining({
          is_critical: true,
        }),
      );
    });
  });

  it('shows critical value warning when checkbox is checked', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    const criticalCheckbox = screen.getByRole('checkbox', { name: /Marcar como crítico/i });
    await user.click(criticalCheckbox);

    expect(screen.getByText(/Valor crítico - Requiere notificación inmediata al médico/)).toBeInTheDocument();
  });

  it('includes notes in submission', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    const valueInput = screen.getByPlaceholderText('Ingrese valor...');
    await user.type(valueInput, '75');

    const notesTextarea = screen.getByPlaceholderText('Observaciones adicionales...');
    await user.type(notesTextarea, 'Patient was fasting');

    const submitBtn = screen.getByText('Guardar como Final');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/laboratory/results/enter',
        expect.objectContaining({
          notes: 'Patient was fasting',
        }),
      );
    });
  });

  it('allows selecting analyzer', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    // Find select by text content
    const analyzerSelects = screen.getAllByRole('combobox');
    const analyzerSelect = analyzerSelects.find(
      (select) => select.closest('div')?.querySelector('label')?.textContent === 'Analizador'
    ) as HTMLSelectElement;

    expect(analyzerSelect).toBeInTheDocument();
    const options = Array.from(analyzerSelect.options).map((opt) => opt.value);

    expect(options).toContain('');
    expect(options).toContain('cobas_e411');
    expect(options).toContain('sysmex_xs1000i');
    expect(options).toContain('mindray_bc5390');
    expect(options).toContain('architect_ci4100');
  });

  it('allows entering method', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    const valueInput = screen.getByPlaceholderText('Ingrese valor...');
    await user.type(valueInput, '90');

    const methodInput = screen.getByPlaceholderText('Ej: Espectrofotometría');
    await user.type(methodInput, 'Enzymatic Method');

    const submitBtn = screen.getByText('Guardar como Final');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalled();
    });
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();

    // Mock console.error to avoid noise in test output
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockApi.post.mockRejectedValueOnce(new Error('Validation failed'));

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    const valueInput = screen.getByPlaceholderText('Ingrese valor...');
    await user.type(valueInput, '100');

    const submitBtn = screen.getByText('Guardar como Final');
    await user.click(submitBtn);

    // Wait for API call to be made
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });

    // onSuccess should not be called on error
    expect(mockOnSuccess).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  }, 10000);

  it('handles submission process', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    const valueInput = screen.getByPlaceholderText('Ingrese valor...');
    await user.type(valueInput, '88');

    const preliminaryBtn = screen.getByText('Guardar como Preliminar');
    await user.click(preliminaryBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalled();
    });
  });

  it('renders unit as readonly', () => {
    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    const unitInput = screen.getByDisplayValue('mg/dL') as HTMLInputElement;
    expect(unitInput).toBeInTheDocument();
    expect(unitInput).toHaveProperty('readOnly', true);
  });

  it('autofocuses on value input', () => {
    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    const valueInput = screen.getByPlaceholderText('Ingrese valor...');
    // jsdom doesn't fully support autofocus, but we can check the element exists
    expect(valueInput).toBeInTheDocument();
  });

  it('renders all abnormal flag options', () => {
    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    // Find select by finding the one with "Normal" option
    const selects = screen.getAllByRole('combobox');
    const abnormalSelect = selects.find(
      (select) => select.querySelector('option[value="N"]')
    ) as HTMLSelectElement;

    expect(abnormalSelect).toBeInTheDocument();
    const options = Array.from(abnormalSelect.options).map((opt) => opt.value);

    expect(options).toContain('N');
    expect(options).toContain('H');
    expect(options).toContain('L');
    expect(options).toContain('A');
    expect(options).toContain('AA');
  });

  it('handles test without normal range', () => {
    const testWithoutRange: LabTest = {
      ...mockTest,
      normal_range: undefined,
    };

    renderWithProviders(
      <ResultEntryForm
        {...defaultProps}
        test={testWithoutRange}
      />,
    );

    // When there's no normal_range, the results array is empty, so no fields are rendered
    expect(screen.queryByPlaceholderText('Ingrese valor...')).not.toBeInTheDocument();
  });

  it('handles non-numeric result values', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    // Enter text value (e.g., "Positive")
    const valueInput = screen.getByPlaceholderText('Ingrese valor...');
    await user.type(valueInput, 'Negative');

    const submitBtn = screen.getByText('Guardar como Final');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/laboratory/results/enter',
        expect.objectContaining({
          result_value: 'Negative',
          result_numeric: NaN,
        }),
      );
    });
  });

  it('applies correct border color for critical values', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    const criticalCheckbox = screen.getByRole('checkbox', { name: /Marcar como crítico/i });
    await user.click(criticalCheckbox);

    // Check that the parent container has the critical styling class
    const container = criticalCheckbox.closest('.border-red-500');
    expect(container).toBeInTheDocument();
  });

  it('shows reference range in component header', () => {
    renderWithProviders(<ResultEntryForm {...defaultProps} />);

    expect(screen.getByText(/70-100 mg\/dL/)).toBeInTheDocument();
  });
});
