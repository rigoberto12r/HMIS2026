/**
 * Tests for useNursing hooks (Nursing module)
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import {
  useKardex,
  useMAR,
  useVitalSigns,
  useFluidBalance,
  useNursingNotes,
  usePendingTasks,
  useAdministerMedication,
  useHoldMedication,
  useRefuseMedication,
  useRecordVitals,
  useRecordFluidBalance,
  useCreateNursingNote,
  nursingKeys,
} from '../useNursing';
import { api } from '@/lib/api';
import type {
  Kardex,
  MedicationAdministration,
  VitalSigns,
  FluidBalance,
  NursingNote,
  AdministerMedicationRequest,
  HoldMedicationRequest,
  RefuseMedicationRequest,
  RecordVitalsRequest,
  RecordFluidBalanceRequest,
  CreateNursingNoteRequest,
} from '@/types/nursing';

// Mock the API client
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
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

describe('useKardex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches kardex for admission', async () => {
    const mockKardex: Kardex = {
      admission: {
        id: 'adm-1',
        admission_number: 'ADM-2026-001',
        admission_date: '2026-02-15T08:00:00Z',
        days_stayed: 2,
        diagnosis: 'Pneumonia',
        bed_number: '101',
        unit: 'General',
      },
      patient: {
        id: 'pat-1',
        name: 'Juan Perez',
        age: 45,
        gender: 'M',
        date_of_birth: '1981-05-20',
        allergies: ['Penicillin'],
      },
      physicians: {
        admitting: { id: 'doc-1', name: 'Dr. Smith' },
        attending: { id: 'doc-1', name: 'Dr. Smith' },
      },
      active_medications: [],
      vital_signs_trend: [],
      assessments: [],
      recent_notes: [],
    };

    mockApi.get.mockResolvedValueOnce(mockKardex);

    const { result } = renderHook(() => useKardex('adm-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockKardex);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/nursing/kardex/adm-1');
  });

  it('does not fetch when admission ID is undefined', () => {
    const { result } = renderHook(() => useKardex(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe('useMAR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches medication administration record', async () => {
    const mockMAR: MedicationAdministration[] = [
      {
        id: 'mar-1',
        admission_id: 'adm-1',
        patient_id: 'pat-1',
        medication_order_id: 'order-1',
        medication_name: 'Amoxicillin 500mg',
        dose: '500mg',
        route: 'PO',
        frequency: 'TID',
        scheduled_time: '2026-02-16T08:00:00Z',
        status: 'scheduled',
        created_at: '2026-02-16T00:00:00Z',
        updated_at: '2026-02-16T00:00:00Z',
      },
    ];

    mockApi.get.mockResolvedValueOnce(mockMAR);

    const { result } = renderHook(() => useMAR('adm-1', '2026-02-16'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockMAR);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/nursing/mar', {
      admission_id: 'adm-1',
      date: '2026-02-16',
    });
  });

  it('does not fetch when admission ID or date is missing', () => {
    const { result } = renderHook(() => useMAR(undefined, '2026-02-16'), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe('useVitalSigns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches vital signs with query params', async () => {
    const mockVitals: VitalSigns[] = [
      {
        id: 'vital-1',
        admission_id: 'adm-1',
        patient_id: 'pat-1',
        temperature: 37.2,
        heart_rate: 72,
        respiratory_rate: 16,
        blood_pressure_systolic: 120,
        blood_pressure_diastolic: 80,
        oxygen_saturation: 98,
        recorded_at: '2026-02-16T08:00:00Z',
        recorded_by_id: 'nurse-1',
        recorded_by_name: 'Nurse Smith',
        created_at: '2026-02-16T08:00:00Z',
      },
    ];

    mockApi.get.mockResolvedValueOnce(mockVitals);

    const params = { admission_id: 'adm-1', limit: 10 };
    const { result } = renderHook(() => useVitalSigns(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockVitals);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/nursing/vitals', params);
  });
});

describe('useFluidBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches fluid balance records', async () => {
    const mockFluidBalance: FluidBalance[] = [
      {
        id: 'fluid-1',
        admission_id: 'adm-1',
        patient_id: 'pat-1',
        date: '2026-02-16',
        shift: 'day',
        oral_intake: 500,
        iv_intake: 1000,
        total_intake: 1500,
        urine_output: 800,
        total_output: 800,
        balance: 700,
        recorded_by_id: 'nurse-1',
        recorded_by_name: 'Nurse Smith',
        created_at: '2026-02-16T08:00:00Z',
        updated_at: '2026-02-16T08:00:00Z',
      },
    ];

    mockApi.get.mockResolvedValueOnce(mockFluidBalance);

    const { result } = renderHook(() => useFluidBalance('adm-1', '2026-02-16'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockFluidBalance);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/nursing/fluid-balance/adm-1', {
      date: '2026-02-16',
    });
  });
});

describe('useNursingNotes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches nursing notes for admission', async () => {
    const mockNotes: NursingNote[] = [
      {
        id: 'note-1',
        admission_id: 'adm-1',
        patient_id: 'pat-1',
        patient_name: 'Juan Perez',
        note_type: 'progress',
        shift: 'day',
        note_text: 'Patient resting comfortably',
        note_date: '2026-02-16',
        created_by_id: 'nurse-1',
        created_by_name: 'Nurse Smith',
        created_at: '2026-02-16T10:00:00Z',
        updated_at: '2026-02-16T10:00:00Z',
      },
    ];

    mockApi.get.mockResolvedValueOnce(mockNotes);

    const { result } = renderHook(() => useNursingNotes('adm-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockNotes);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/nursing/notes/adm-1');
  });
});

describe('usePendingTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches pending tasks for unit', async () => {
    const mockTasks = {
      medications_pending: [
        {
          type: 'medication' as const,
          admission_id: 'adm-1',
          patient_id: 'pat-1',
          patient_name: 'Juan Perez',
          bed_number: '101',
          unit: 'General',
          due_time: '2026-02-16T12:00:00Z',
          medication: {
            id: 'med-1',
            name: 'Amoxicillin',
            dose: '500mg',
            route: 'PO',
          },
          priority: 'high' as const,
        },
      ],
      vitals_due: [],
      assessments_due: [],
    };

    mockApi.get.mockResolvedValueOnce(mockTasks);

    const { result } = renderHook(() => usePendingTasks({ unit: 'General' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTasks);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/nursing/pending-tasks', { unit: 'General' });
  });
});

describe('useAdministerMedication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('administers medication successfully', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useAdministerMedication(), {
      wrapper: createWrapper(),
    });

    const adminData: AdministerMedicationRequest = {
      medication_administration_id: 'mar-1',
      administration_time: '2026-02-16T08:00:00Z',
      site: 'Left deltoid',
      barcode: 'MED123456',
      notes: 'Patient tolerated well',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(adminData);
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/nursing/medications/mar-1/administer',
      adminData
    );
  });
});

describe('useHoldMedication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('holds medication with reason', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useHoldMedication(), {
      wrapper: createWrapper(),
    });

    const holdData: HoldMedicationRequest = {
      medication_administration_id: 'mar-1',
      reason_held: 'Blood pressure too low',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(holdData);
    });

    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/nursing/medications/mar-1/hold', holdData);
  });
});

describe('useRefuseMedication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records patient refusal', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useRefuseMedication(), {
      wrapper: createWrapper(),
    });

    const refuseData: RefuseMedicationRequest = {
      medication_administration_id: 'mar-1',
      reason_refused: 'Patient experiencing nausea',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(refuseData);
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/nursing/medications/mar-1/refuse',
      refuseData
    );
  });
});

describe('useRecordVitals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records vital signs', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useRecordVitals(), {
      wrapper: createWrapper(),
    });

    const vitalsData: RecordVitalsRequest = {
      admission_id: 'adm-1',
      temperature: 37.5,
      heart_rate: 80,
      respiratory_rate: 18,
      blood_pressure_systolic: 130,
      blood_pressure_diastolic: 85,
      oxygen_saturation: 97,
      pain_score: 3,
      consciousness_level: 'alert',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(vitalsData);
    });

    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/nursing/vitals', vitalsData);
  });
});

describe('useRecordFluidBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records fluid balance', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useRecordFluidBalance(), {
      wrapper: createWrapper(),
    });

    const fluidData: RecordFluidBalanceRequest = {
      admission_id: 'adm-1',
      date: '2026-02-16',
      shift: 'day',
      oral_intake: 600,
      iv_intake: 1200,
      urine_output: 900,
      notes: 'Patient drinking well',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(fluidData);
    });

    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/nursing/fluid-balance', fluidData);
  });
});

describe('useCreateNursingNote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates nursing note', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useCreateNursingNote(), {
      wrapper: createWrapper(),
    });

    const noteData: CreateNursingNoteRequest = {
      admission_id: 'adm-1',
      note_type: 'progress',
      shift: 'night',
      note_text: 'Patient slept well throughout the night',
      note_date: '2026-02-16',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(noteData);
    });

    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/nursing/notes', noteData);
  });

  it('handles note creation errors', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Validation error'));

    const { result } = renderHook(() => useCreateNursingNote(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        admission_id: 'adm-1',
        note_type: 'progress',
        shift: 'day',
        note_text: 'Test note',
      })
    ).rejects.toThrow('Validation error');
  });
});

describe('nursingKeys', () => {
  it('generates correct query keys', () => {
    expect(nursingKeys.all).toEqual(['nursing']);
    expect(nursingKeys.kardex('adm-1')).toEqual(['nursing', 'kardex', 'adm-1']);
    expect(nursingKeys.mar({ admission_id: 'adm-1', date: '2026-02-16' })).toEqual([
      'nursing',
      'mar',
      { admission_id: 'adm-1', date: '2026-02-16' },
    ]);
    expect(nursingKeys.vitals({ admission_id: 'adm-1' })).toEqual([
      'nursing',
      'vitals',
      { admission_id: 'adm-1' },
    ]);
    expect(nursingKeys.fluidBalance('adm-1', '2026-02-16')).toEqual([
      'nursing',
      'fluid-balance',
      'adm-1',
      '2026-02-16',
    ]);
    expect(nursingKeys.notes('adm-1')).toEqual(['nursing', 'notes', 'adm-1']);
    expect(nursingKeys.pendingTasks({ unit: 'ICU' })).toEqual([
      'nursing',
      'pending-tasks',
      { unit: 'ICU' },
    ]);
  });
});
