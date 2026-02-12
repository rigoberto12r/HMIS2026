/**
 * Tests for CreatePatientModal component
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreatePatientModal } from '../CreatePatientModal';
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

describe('CreatePatientModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when open', () => {
    renderWithProviders(
      <CreatePatientModal isOpen={true} onClose={mockOnClose} />,
    );

    expect(screen.getByText('Registrar Nuevo Paciente')).toBeInTheDocument();
    expect(screen.getByText('Guardar Paciente')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderWithProviders(
      <CreatePatientModal isOpen={false} onClose={mockOnClose} />,
    );

    expect(screen.queryByText('Registrar Nuevo Paciente')).not.toBeInTheDocument();
  });

  it('shows validation error when submitting empty form', async () => {
    renderWithProviders(
      <CreatePatientModal isOpen={true} onClose={mockOnClose} />,
    );

    const submitBtn = screen.getByText('Guardar Paciente');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Nombre y apellido son requeridos')).toBeInTheDocument();
    });

    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('shows validation error when only name is filled (missing DOB)', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <CreatePatientModal isOpen={true} onClose={mockOnClose} />,
    );

    // Fill in name fields
    const nombreInput = screen.getByPlaceholderText('Ej: Juan');
    const apellidoInput = screen.getByPlaceholderText('Ej: Pérez');
    await user.type(nombreInput, 'Juan');
    await user.type(apellidoInput, 'Perez');

    const submitBtn = screen.getByText('Guardar Paciente');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Fecha de nacimiento es requerida')).toBeInTheDocument();
    });
  });

  it('shows validation error when document number is missing', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <CreatePatientModal isOpen={true} onClose={mockOnClose} />,
    );

    // Fill name and DOB but not document
    await user.type(screen.getByPlaceholderText('Ej: Juan'), 'Juan');
    await user.type(screen.getByPlaceholderText('Ej: Pérez'), 'Perez');

    // Fill DOB - find the date input by type attribute
    const dobInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dobInput, { target: { value: '1990-05-15' } });

    fireEvent.click(screen.getByText('Guardar Paciente'));

    await waitFor(() => {
      expect(screen.getByText('Número de documento es requerido')).toBeInTheDocument();
    });
  });

  it('submits form successfully with valid data', async () => {
    const user = userEvent.setup();

    const createdPatient = {
      id: 'uuid-123',
      mrn: 'MRN-001',
      first_name: 'Juan',
      last_name: 'Perez',
      date_of_birth: '1990-05-15',
      gender: 'M',
      document_type: 'cedula',
      document_number: '001-1234567-8',
      status: 'active',
      created_at: '2026-02-11T00:00:00Z',
    };

    mockApi.post.mockResolvedValueOnce(createdPatient);

    renderWithProviders(
      <CreatePatientModal isOpen={true} onClose={mockOnClose} />,
    );

    // Fill all required fields
    await user.type(screen.getByPlaceholderText('Ej: Juan'), 'Juan');
    await user.type(screen.getByPlaceholderText('Ej: Pérez'), 'Perez');

    const dobInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dobInput, { target: { value: '1990-05-15' } });

    await user.type(screen.getByPlaceholderText('Ej: 001-1234567-8'), '001-1234567-8');

    fireEvent.click(screen.getByText('Guardar Paciente'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/patients',
        expect.objectContaining({
          first_name: 'Juan',
          last_name: 'Perez',
          document_number: '001-1234567-8',
        }),
      );
    });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('shows API error on failed submission', async () => {
    const user = userEvent.setup();

    mockApi.post.mockRejectedValueOnce(new Error('Documento duplicado en el sistema'));

    renderWithProviders(
      <CreatePatientModal isOpen={true} onClose={mockOnClose} />,
    );

    await user.type(screen.getByPlaceholderText('Ej: Juan'), 'Test');
    await user.type(screen.getByPlaceholderText('Ej: Pérez'), 'User');
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: '2000-01-01' },
    });
    await user.type(screen.getByPlaceholderText('Ej: 001-1234567-8'), '001-0000000-0');

    fireEvent.click(screen.getByText('Guardar Paciente'));

    await waitFor(() => {
      expect(screen.getByText('Documento duplicado en el sistema')).toBeInTheDocument();
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', () => {
    renderWithProviders(
      <CreatePatientModal isOpen={true} onClose={mockOnClose} />,
    );

    fireEvent.click(screen.getByText('Cancelar'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('renders all form sections', () => {
    renderWithProviders(
      <CreatePatientModal isOpen={true} onClose={mockOnClose} />,
    );

    expect(screen.getByText('Información Básica')).toBeInTheDocument();
    expect(screen.getByText('Identificación')).toBeInTheDocument();
    expect(screen.getByText('Información de Contacto')).toBeInTheDocument();
    expect(screen.getByText('Información Médica')).toBeInTheDocument();
    expect(screen.getByText('Contacto de Emergencia')).toBeInTheDocument();
  });
});
