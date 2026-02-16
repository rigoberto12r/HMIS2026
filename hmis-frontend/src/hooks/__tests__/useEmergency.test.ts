/**
 * Tests for useEmergency hooks (Emergency Department module)
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import {
  useEDTrackBoard,
  useEDDashboard,
  useEDVisits,
  useEDVisit,
  useEDMetrics,
  useRegisterArrival,
  usePerformTriage,
  useAssignPhysician,
  useSetDisposition,
  emergencyKeys,
} from '../useEmergency';
import { api } from '@/lib/api';
import type {
  EDTrackBoardItem,
  EDDashboardStats,
  EDVisit,
  EDMetrics,
  RegisterArrivalRequest,
  PerformTriageRequest,
  AssignPhysicianRequest,
  SetDispositionRequest,
  ESILevel,
} from '@/types/emergency';

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

describe('useEDTrackBoard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches track board data', async () => {
    const mockTrackBoard: EDTrackBoardItem[] = [
      {
        visit_id: 'visit-1',
        visit_number: 'ED-2026-001',
        bed_number: 'ED-101',
        patient_name: 'Juan Perez',
        patient_age: 45,
        chief_complaint: 'Chest pain',
        esi_level: 2,
        status: 'in_treatment',
        arrival_time: '2026-02-16T08:00:00Z',
        waiting_time_minutes: 15,
        door_to_doc_minutes: 12,
        assigned_physician: 'Dr. Smith',
      },
    ];

    mockApi.get.mockResolvedValueOnce(mockTrackBoard);

    const { result } = renderHook(() => useEDTrackBoard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTrackBoard);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/emergency/track-board');
  });

  it('returns loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useEDTrackBoard(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useEDDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches dashboard statistics', async () => {
    const mockDashboard: EDDashboardStats = {
      patients_waiting: 5,
      patients_in_treatment: 8,
      avg_door_to_doc_minutes: 18.5,
      avg_los_hours: 3.2,
      visits_by_esi: {
        esi_1: 1,
        esi_2: 3,
        esi_3: 6,
        esi_4: 2,
        esi_5: 1,
      },
      recent_arrivals: [],
      lwbs_count_today: 2,
      timestamp: '2026-02-16T10:00:00Z',
    };

    mockApi.get.mockResolvedValueOnce(mockDashboard);

    const { result } = renderHook(() => useEDDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockDashboard);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/emergency/dashboard');
  });
});

describe('useEDVisits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches ED visits with default params', async () => {
    const mockData = {
      items: [
        {
          id: 'visit-1',
          visit_number: 'ED-2026-001',
          patient_id: 'pat-1',
          patient_name: 'Maria Garcia',
          patient_age: 32,
          patient_gender: 'F',
          arrival_mode: 'walk_in' as const,
          arrival_time: '2026-02-16T09:00:00Z',
          chief_complaint: 'Abdominal pain',
          esi_level: 3 as ESILevel,
          status: 'waiting' as const,
          created_at: '2026-02-16T09:00:00Z',
          updated_at: '2026-02-16T09:00:00Z',
        } as EDVisit,
      ],
      total: 1,
      page: 1,
      page_size: 20,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useEDVisits({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/emergency/visits', {});
  });

  it('passes query params correctly', async () => {
    mockApi.get.mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 20 });

    const params = { status: 'in_treatment' as const, esi_level: 2 as ESILevel, page: 2 };
    const { result } = renderHook(() => useEDVisits(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/emergency/visits', params);
  });

  it('handles API errors', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useEDVisits({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useEDVisit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches single ED visit when ID provided', async () => {
    const mockVisit: EDVisit = {
      id: 'visit-1',
      visit_number: 'ED-2026-005',
      patient_id: 'pat-1',
      patient_name: 'Carlos Rodriguez',
      patient_age: 58,
      patient_gender: 'M',
      arrival_mode: 'ambulance',
      arrival_time: '2026-02-16T10:30:00Z',
      chief_complaint: 'Shortness of breath',
      esi_level: 2,
      status: 'triage',
      triage_time: '2026-02-16T10:35:00Z',
      waiting_time_minutes: 5,
      created_at: '2026-02-16T10:30:00Z',
      updated_at: '2026-02-16T10:35:00Z',
    };

    mockApi.get.mockResolvedValueOnce(mockVisit);

    const { result } = renderHook(() => useEDVisit('visit-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockVisit);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/emergency/visits/visit-1');
  });

  it('does not fetch when ID is undefined', () => {
    const { result } = renderHook(() => useEDVisit(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe('useEDMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches ED metrics for date range', async () => {
    const mockMetrics: EDMetrics[] = [
      {
        date: '2026-02-16',
        total_visits: 45,
        visits_by_esi: {
          esi_1: 2,
          esi_2: 8,
          esi_3: 18,
          esi_4: 12,
          esi_5: 5,
        },
        avg_door_to_doc_minutes: 22.5,
        avg_los_minutes: 180,
        lwbs_count: 3,
        lwbs_rate: 6.7,
        admission_count: 12,
        admission_rate: 26.7,
        discharge_count: 30,
        transfer_count: 2,
        ama_count: 1,
        deceased_count: 0,
      },
    ];

    mockApi.get.mockResolvedValueOnce(mockMetrics);

    const params = { date_from: '2026-02-16', date_to: '2026-02-16' };
    const { result } = renderHook(() => useEDMetrics(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockMetrics);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/emergency/metrics', params);
  });

  it('does not fetch when date range is incomplete', () => {
    const { result } = renderHook(
      () => useEDMetrics({ date_from: '2026-02-16', date_to: '' }),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe('useRegisterArrival', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers new ED arrival', async () => {
    const newVisit: EDVisit = {
      id: 'visit-new',
      visit_number: 'ED-2026-999',
      patient_id: 'pat-1',
      patient_name: 'Test Patient',
      arrival_mode: 'walk_in',
      arrival_time: '2026-02-16T11:00:00Z',
      chief_complaint: 'Fever',
      status: 'waiting',
      created_at: '2026-02-16T11:00:00Z',
      updated_at: '2026-02-16T11:00:00Z',
    };

    mockApi.post.mockResolvedValueOnce(newVisit);

    const { result } = renderHook(() => useRegisterArrival(), {
      wrapper: createWrapper(),
    });

    const arrivalData: RegisterArrivalRequest = {
      patient_id: 'pat-1',
      arrival_mode: 'walk_in',
      chief_complaint: 'Fever',
      send_to_triage: true,
    };

    let mutationResult: EDVisit;
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync(arrivalData);
    });

    expect(mutationResult!).toEqual(newVisit);
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/emergency/arrivals', arrivalData);
  });

  it('handles registration errors', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Patient already in ED'));

    const { result } = renderHook(() => useRegisterArrival(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        patient_id: 'pat-1',
        arrival_mode: 'walk_in',
        chief_complaint: 'Test',
      })
    ).rejects.toThrow('Patient already in ED');
  });
});

describe('usePerformTriage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('performs triage assessment', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => usePerformTriage(), {
      wrapper: createWrapper(),
    });

    const triageData: PerformTriageRequest = {
      visit_id: 'visit-1',
      esi_level: 3,
      temperature: 38.5,
      heart_rate: 95,
      respiratory_rate: 20,
      blood_pressure_systolic: 140,
      blood_pressure_diastolic: 90,
      oxygen_saturation: 96,
      pain_score: 6,
      allergies: ['Sulfa drugs'],
      notes: 'Patient anxious but stable',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(triageData);
    });

    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/emergency/visits/visit-1/triage', triageData);
  });

  it('handles ESI level as number correctly', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => usePerformTriage(), {
      wrapper: createWrapper(),
    });

    // Test ESI level 1 (most critical)
    const criticalTriage: PerformTriageRequest = {
      visit_id: 'visit-critical',
      esi_level: 1,
      heart_rate: 140,
      blood_pressure_systolic: 80,
      blood_pressure_diastolic: 50,
      oxygen_saturation: 88,
      notes: 'Critical - immediate intervention needed',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(criticalTriage);
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/emergency/visits/visit-critical/triage',
      criticalTriage
    );
  });
});

describe('useAssignPhysician', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('assigns physician to ED visit', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useAssignPhysician(), {
      wrapper: createWrapper(),
    });

    const assignData: AssignPhysicianRequest = {
      visit_id: 'visit-1',
      physician_id: 'doc-1',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(assignData);
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/emergency/visits/visit-1/assign-physician',
      assignData
    );
  });
});

describe('useSetDisposition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets admission disposition', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useSetDisposition(), {
      wrapper: createWrapper(),
    });

    const dispositionData: SetDispositionRequest = {
      visit_id: 'visit-1',
      disposition_type: 'admitted',
      bed_id: 'bed-301',
      notes: 'Admitted to cardiology for observation',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(dispositionData);
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/emergency/visits/visit-1/disposition',
      dispositionData
    );
  });

  it('sets discharge disposition', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useSetDisposition(), {
      wrapper: createWrapper(),
    });

    const dispositionData: SetDispositionRequest = {
      visit_id: 'visit-2',
      disposition_type: 'discharged',
      discharge_instructions: 'Follow up with primary care in 1 week. Continue current medications.',
      disposition_time: '2026-02-16T14:00:00Z',
      notes: 'Patient stable, symptoms resolved',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(dispositionData);
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/emergency/visits/visit-2/disposition',
      dispositionData
    );
  });

  it('sets transfer disposition', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useSetDisposition(), {
      wrapper: createWrapper(),
    });

    const dispositionData: SetDispositionRequest = {
      visit_id: 'visit-3',
      disposition_type: 'transferred',
      transfer_facility: 'University Hospital Trauma Center',
      notes: 'Transfer for higher level of care',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(dispositionData);
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/emergency/visits/visit-3/disposition',
      dispositionData
    );
  });
});

describe('emergencyKeys', () => {
  it('generates correct query keys', () => {
    expect(emergencyKeys.all).toEqual(['emergency']);
    expect(emergencyKeys.trackBoard()).toEqual(['emergency', 'track-board']);
    expect(emergencyKeys.dashboard()).toEqual(['emergency', 'dashboard']);
    expect(emergencyKeys.visits()).toEqual(['emergency', 'visits']);
    expect(emergencyKeys.visitsList({ status: 'waiting' })).toEqual([
      'emergency',
      'visits',
      'list',
      { status: 'waiting' },
    ]);
    expect(emergencyKeys.visit('visit-1')).toEqual(['emergency', 'visits', 'visit-1']);
    expect(
      emergencyKeys.metrics({ date_from: '2026-02-01', date_to: '2026-02-16' })
    ).toEqual([
      'emergency',
      'metrics',
      { date_from: '2026-02-01', date_to: '2026-02-16' },
    ]);
  });
});
