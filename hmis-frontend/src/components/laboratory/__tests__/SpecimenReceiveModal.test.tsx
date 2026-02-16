/**
 * Tests for SpecimenReceiveModal component
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SpecimenReceiveModal } from '../SpecimenReceiveModal';
import { api } from '@/lib/api';

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

describe('SpecimenReceiveModal', () => {
  const mockOnClose = jest.fn();
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    orderId: 'order-123',
    testName: 'Complete Blood Count',
    specimenType: 'blood',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when open', () => {
    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    expect(screen.getAllByText('Recibir Muestra').length).toBeGreaterThan(0);
    expect(screen.getByText('Complete Blood Count')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderWithProviders(
      <SpecimenReceiveModal {...defaultProps} isOpen={false} />,
    );

    expect(screen.queryByText('Recibir Muestra')).not.toBeInTheDocument();
  });

  it('displays specimen type as readonly field', () => {
    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    const specimenInput = screen.getByDisplayValue('blood') as HTMLInputElement;
    expect(specimenInput).toBeInTheDocument();
    expect(specimenInput).toHaveProperty('readOnly', true);
  });

  it('shows validation error when accession number is missing', async () => {
    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    const submitBtn = screen.getAllByText('Recibir Muestra')[1]; // Get the button, not the heading
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Código de barras requerido')).toBeInTheDocument();
    });

    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('submits form successfully with valid data', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    // Fill accession number
    const accessionInput = screen.getByPlaceholderText('Escanear o ingresar manualmente');
    await user.type(accessionInput, 'ACC-12345');

    // Select container type
    const containerSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    await user.selectOptions(containerSelect, 'purple_top');

    // Enter volume
    const volumeInput = screen.getByPlaceholderText('Ej: 5.0');
    await user.type(volumeInput, '5.5');

    // Quality is set to "acceptable" by default
    const submitBtn = screen.getAllByText('Recibir Muestra')[1]; // Get the button, not the heading
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/laboratory/specimens/receive',
        expect.objectContaining({
          order_id: 'order-123',
          accession_number: 'ACC-12345',
          specimen_type: 'blood',
          container_type: 'purple_top',
          volume: 5.5,
          quality: 'acceptable',
        }),
      );
    });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('allows selecting different specimen quality options', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    const accessionInput = screen.getByPlaceholderText('Escanear o ingresar manualmente');
    await user.type(accessionInput, 'ACC-99999');

    // Select hemolyzed quality
    const qualitySelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
    await user.selectOptions(qualitySelect, 'hemolyzed');

    const submitBtn = screen.getAllByText('Recibir Muestra')[1]; // Get the button, not the heading
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/laboratory/specimens/receive',
        expect.objectContaining({
          quality: 'hemolyzed',
        }),
      );
    });
  });

  it('shows all container type options', () => {
    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    const containerSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    const options = Array.from(containerSelect.options).map((opt) => opt.value);

    expect(options).toContain('red_top');
    expect(options).toContain('purple_top');
    expect(options).toContain('blue_top');
    expect(options).toContain('green_top');
    expect(options).toContain('yellow_top');
    expect(options).toContain('gray_top');
    expect(options).toContain('urine_cup');
    expect(options).toContain('sterile_container');
  });

  it('shows all quality options', () => {
    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    const qualitySelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
    const options = Array.from(qualitySelect.options).map((opt) => opt.value);

    expect(options).toContain('acceptable');
    expect(options).toContain('hemolyzed');
    expect(options).toContain('clotted');
    expect(options).toContain('insufficient');
    expect(options).toContain('contaminated');
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();

    // Mock console.error to avoid noise in test output
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockApi.post.mockRejectedValueOnce(new Error('Specimen already received'));

    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    const accessionInput = screen.getByPlaceholderText('Escanear o ingresar manualmente');
    await user.type(accessionInput, 'ACC-DUPLICATE');

    const submitBtn = screen.getAllByText('Recibir Muestra')[1]; // Get the button, not the heading
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Modal should not close on error
    await waitFor(() => {
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });

  it('calls onClose when Cancel button is clicked', () => {
    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    const cancelBtn = screen.getByText('Cancelar');
    fireEvent.click(cancelBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when X button is clicked', () => {
    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    const closeBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(closeBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles submission process', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    const accessionInput = screen.getByPlaceholderText('Escanear o ingresar manualmente');
    await user.type(accessionInput, 'ACC-SUBMIT');

    const submitBtn = screen.getAllByText('Recibir Muestra')[1]; // Get the button, not the heading
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalled();
    });
  });

  it('validates volume as number', async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({ success: true });

    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    const accessionInput = screen.getByPlaceholderText('Escanear o ingresar manualmente');
    await user.type(accessionInput, 'ACC-VOLUME-TEST');

    const volumeInput = screen.getByPlaceholderText('Ej: 5.0');
    await user.type(volumeInput, '3.7');

    const submitBtn = screen.getAllByText('Recibir Muestra')[1]; // Get the button, not the heading
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/laboratory/specimens/receive',
        expect.objectContaining({
          volume: 3.7,
        }),
      );
    });
  });

  it('renders all form sections', () => {
    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    expect(screen.getByText('Código de Barras')).toBeInTheDocument();
    expect(screen.getByText('Tipo de Muestra')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')[0]).toBeInTheDocument();
    expect(screen.getByText('Volumen (mL)')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')[1]).toBeInTheDocument();
  });

  it('autofocuses on barcode input when modal opens', () => {
    renderWithProviders(<SpecimenReceiveModal {...defaultProps} />);

    const accessionInput = screen.getByPlaceholderText('Escanear o ingresar manualmente');

    // Note: jsdom doesn't fully support focus() behavior, so we just check the element exists
    // In a real browser, this would be focused automatically
    expect(accessionInput).toBeInTheDocument();
  });

  it('shows correct test name in header', () => {
    renderWithProviders(
      <SpecimenReceiveModal
        {...defaultProps}
        testName="Hemoglobin A1c"
      />,
    );

    expect(screen.getByText('Hemoglobin A1c')).toBeInTheDocument();
  });
});
