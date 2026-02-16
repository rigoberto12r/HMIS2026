/**
 * Tests for useInpatient hooks (Inpatient ADT module)
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import {
  useRealtimeCensus,
  useAdmissions,
  useAdmission,
  useBeds,
  useAvailableBeds,
  useCreateAdmission,
  useTransferPatient,
  useDischargePatient,
  useUpdateBedStatus,
  useFindBestBed,
  inpatientKeys,
} from '../useInpatient';
import { api } from '@/lib/api';
import type {
  CensusRealtime,
  Admission,
  Bed,
  BedAvailability,
  CreateAdmissionRequest,
  TransferPatientRequest,
  DischargePatientRequest,
  UpdateBedStatusRequest,
} from '@/types/inpatient';

// Mock the API client
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
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

describe('useRealtimeCensus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches real-time census data', async () => {
    const mockCensus: CensusRealtime = {
      total_beds: 100,
      occupied_beds: 75,
      available_beds: 25,
      admissions_today: 12,
      discharges_today: 8,
      transfers_today: 3,
      average_los: 4.5,
      occupancy_rate: 0.75,
      by_unit: [
        {
          unit: 'ICU',
          total_beds: 20,
          occupied_beds: 18,
          available_beds: 2,
          cleaning_beds: 0,
          maintenance_beds: 0,
          occupancy_rate: 0.9,
          average_los: 5.2,
        },
      ],
      recent_admissions: [],
      timestamp: '2026-02-16T10:00:00Z',
    };

    mockApi.get.mockResolvedValueOnce(mockCensus);

    const { result } = renderHook(() => useRealtimeCensus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockCensus);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/inpatient/census/realtime');
  });

  it('returns loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useRealtimeCensus(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useAdmissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches admissions with default params', async () => {
    const mockData = {
      items: [
        {
          id: 'adm-1',
          patient_id: 'pat-1',
          patient_name: 'Juan Perez',
          bed_id: 'bed-1',
          bed_number: '101',
          unit: 'General',
          admission_number: 'ADM-2026-001',
          admission_type: 'emergency' as const,
          admission_date: '2026-02-15T08:00:00Z',
          admitting_diagnosis: 'Chest pain',
          admitting_physician_id: 'doc-1',
          admitting_physician_name: 'Dr. Smith',
          attending_physician_id: 'doc-1',
          attending_physician_name: 'Dr. Smith',
          status: 'active' as const,
          created_at: '2026-02-15T08:00:00Z',
          updated_at: '2026-02-15T08:00:00Z',
        } as Admission,
      ],
      total: 1,
      page: 1,
      page_size: 20,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useAdmissions({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/inpatient/admissions', {});
  });

  it('passes query params correctly', async () => {
    mockApi.get.mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 20 });

    const params = { status: 'active' as const, unit: 'ICU', page: 2 };
    const { result } = renderHook(() => useAdmissions(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/inpatient/admissions', params);
  });
});

describe('useAdmission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches single admission when ID provided', async () => {
    const mockAdmission: Admission = {
      id: 'adm-1',
      patient_id: 'pat-1',
      patient_name: 'Maria Garcia',
      bed_id: 'bed-1',
      bed_number: '202',
      unit: 'Cardiology',
      admission_number: 'ADM-2026-002',
      admission_type: 'elective',
      admission_date: '2026-02-16T07:00:00Z',
      admitting_diagnosis: 'Coronary artery disease',
      admitting_physician_id: 'doc-2',
      admitting_physician_name: 'Dr. Lopez',
      attending_physician_id: 'doc-2',
      attending_physician_name: 'Dr. Lopez',
      status: 'active',
      created_at: '2026-02-16T07:00:00Z',
      updated_at: '2026-02-16T07:00:00Z',
    };

    mockApi.get.mockResolvedValueOnce(mockAdmission);

    const { result } = renderHook(() => useAdmission('adm-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockAdmission);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/inpatient/admissions/adm-1');
  });

  it('does not fetch when ID is undefined', () => {
    const { result } = renderHook(() => useAdmission(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe('useBeds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches beds with filters', async () => {
    const mockBeds: Bed[] = [
      {
        id: 'bed-1',
        bed_number: '101',
        unit: 'ICU',
        type: 'icu',
        status: 'available',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    mockApi.get.mockResolvedValueOnce(mockBeds);

    const params = { unit: 'ICU', status: 'available' as const };
    const { result } = renderHook(() => useBeds(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockBeds);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/inpatient/beds', params);
  });
});

describe('useAvailableBeds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches available beds with filters', async () => {
    const mockBeds: BedAvailability[] = [
      {
        bed_id: 'bed-1',
        bed_number: '101',
        unit: 'General',
        type: 'private',
        score: 0.95,
      },
    ];

    mockApi.get.mockResolvedValueOnce(mockBeds);

    const params = { unit: 'General', type: 'private' as const };
    const { result } = renderHook(() => useAvailableBeds(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockBeds);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/inpatient/beds/available', params);
  });
});

describe('useCreateAdmission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates admission and invalidates queries', async () => {
    const newAdmission: Admission = {
      id: 'adm-new',
      patient_id: 'pat-1',
      patient_name: 'Test Patient',
      bed_id: 'bed-1',
      bed_number: '101',
      unit: 'General',
      admission_number: 'ADM-2026-999',
      admission_type: 'emergency',
      admission_date: '2026-02-16T10:00:00Z',
      admitting_diagnosis: 'Pneumonia',
      admitting_physician_id: 'doc-1',
      admitting_physician_name: 'Dr. Smith',
      attending_physician_id: 'doc-1',
      attending_physician_name: 'Dr. Smith',
      status: 'active',
      created_at: '2026-02-16T10:00:00Z',
      updated_at: '2026-02-16T10:00:00Z',
    };

    mockApi.post.mockResolvedValueOnce(newAdmission);

    const { result } = renderHook(() => useCreateAdmission(), {
      wrapper: createWrapper(),
    });

    const admissionData: CreateAdmissionRequest = {
      patient_id: 'pat-1',
      bed_id: 'bed-1',
      admission_type: 'emergency',
      admitting_diagnosis: 'Pneumonia',
      admitting_physician_id: 'doc-1',
      attending_physician_id: 'doc-1',
    };

    let mutationResult: Admission;
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync(admissionData);
    });

    expect(mutationResult!).toEqual(newAdmission);
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/inpatient/admissions', admissionData);
  });

  it('handles creation errors', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Bed already occupied'));

    const { result } = renderHook(() => useCreateAdmission(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        patient_id: 'pat-1',
        bed_id: 'bed-1',
        admission_type: 'emergency',
        admitting_diagnosis: 'Test',
        admitting_physician_id: 'doc-1',
        attending_physician_id: 'doc-1',
      })
    ).rejects.toThrow('Bed already occupied');
  });
});

describe('useTransferPatient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('transfers patient to another bed', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useTransferPatient(), {
      wrapper: createWrapper(),
    });

    const transferData: TransferPatientRequest = {
      admission_id: 'adm-1',
      to_bed_id: 'bed-2',
      reason: 'Upgrade to private room',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(transferData);
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/inpatient/admissions/adm-1/transfer',
      transferData
    );
  });
});

describe('useDischargePatient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('discharges patient with summary', async () => {
    mockApi.post.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useDischargePatient(), {
      wrapper: createWrapper(),
    });

    const dischargeData: DischargePatientRequest = {
      admission_id: 'adm-1',
      discharge_type: 'home',
      discharge_diagnosis: 'Resolved pneumonia',
      discharge_disposition: 'improved',
      discharge_summary: 'Patient recovered well',
      follow_up_instructions: 'Follow up in 2 weeks',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(dischargeData);
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/inpatient/admissions/adm-1/discharge',
      dischargeData
    );
  });
});

describe('useUpdateBedStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates bed status', async () => {
    mockApi.patch.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useUpdateBedStatus(), {
      wrapper: createWrapper(),
    });

    const statusUpdate: UpdateBedStatusRequest = {
      bed_id: 'bed-1',
      status: 'cleaning',
      notes: 'Terminal cleaning in progress',
    };

    await waitFor(async () => {
      await result.current.mutateAsync(statusUpdate);
    });

    expect(mockApi.patch).toHaveBeenCalledWith('/api/v1/inpatient/beds/bed-1/status', {
      status: 'cleaning',
      notes: 'Terminal cleaning in progress',
    });
  });
});

describe('useFindBestBed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not auto-fetch (enabled: false)', () => {
    const { result } = renderHook(() => useFindBestBed({ unit: 'ICU' }), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('can be manually triggered with refetch', async () => {
    const mockBed: BedAvailability = {
      bed_id: 'bed-best',
      bed_number: '301',
      unit: 'ICU',
      type: 'icu',
      score: 0.98,
    };

    mockApi.get.mockResolvedValueOnce(mockBed);

    const { result } = renderHook(() => useFindBestBed({ unit: 'ICU', type: 'icu' }), {
      wrapper: createWrapper(),
    });

    const refetchResult = await result.current.refetch();

    expect(refetchResult.data).toEqual(mockBed);
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/inpatient/beds/find-best', {
      unit: 'ICU',
      type: 'icu',
    });
  });
});

describe('inpatientKeys', () => {
  it('generates correct query keys', () => {
    expect(inpatientKeys.all).toEqual(['inpatient']);
    expect(inpatientKeys.census()).toEqual(['inpatient', 'census']);
    expect(inpatientKeys.admissions()).toEqual(['inpatient', 'admissions']);
    expect(inpatientKeys.admissionsList({ unit: 'ICU' })).toEqual([
      'inpatient',
      'admissions',
      'list',
      { unit: 'ICU' },
    ]);
    expect(inpatientKeys.admission('adm-1')).toEqual(['inpatient', 'admissions', 'adm-1']);
    expect(inpatientKeys.beds()).toEqual(['inpatient', 'beds']);
    expect(inpatientKeys.bedsList({ status: 'available' })).toEqual([
      'inpatient',
      'beds',
      'list',
      { status: 'available' },
    ]);
    expect(inpatientKeys.availableBeds({ unit: 'General' })).toEqual([
      'inpatient',
      'beds',
      'available',
      { unit: 'General' },
    ]);
  });
});
