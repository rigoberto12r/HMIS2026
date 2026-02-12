/**
 * Tests for usePatients hook
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { usePatients, useCreatePatient } from '../usePatients';
import { api } from '@/lib/api';

// Mock the API client
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
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
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('usePatients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches patients with default params', async () => {
    const mockData = {
      items: [
        { id: '1', mrn: 'MRN-001', first_name: 'Juan', last_name: 'Perez', gender: 'M', status: 'active' },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    };

    mockApi.get.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => usePatients({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(mockApi.get).toHaveBeenCalledWith('/patients/search', {});
  });

  it('passes search params to API', async () => {
    mockApi.get.mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 20 });

    const params = { page: 2, page_size: 10, query: 'Juan' };
    const { result } = renderHook(() => usePatients(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledWith('/patients/search', params);
  });

  it('returns loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => usePatients({}), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('handles API errors', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePatients({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useCreatePatient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a patient and returns data', async () => {
    const newPatient = {
      id: '123',
      mrn: 'MRN-100',
      first_name: 'Maria',
      last_name: 'Garcia',
      date_of_birth: '1990-01-15',
      gender: 'F',
      document_type: 'cedula',
      document_number: '001-1234567-8',
      status: 'active',
      created_at: '2026-02-11T00:00:00Z',
    };

    mockApi.post.mockResolvedValueOnce(newPatient);

    const { result } = renderHook(() => useCreatePatient(), {
      wrapper: createWrapper(),
    });

    let mutationResult: any;
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync({
        first_name: 'Maria',
        last_name: 'Garcia',
        date_of_birth: '1990-01-15',
        gender: 'F',
        document_type: 'cedula',
        document_number: '001-1234567-8',
      });
    });

    expect(mutationResult).toEqual(newPatient);
    expect(mockApi.post).toHaveBeenCalledWith('/patients', expect.objectContaining({
      first_name: 'Maria',
      last_name: 'Garcia',
    }));
  });

  it('handles creation errors', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Documento duplicado'));

    const { result } = renderHook(() => useCreatePatient(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        first_name: 'Test',
        last_name: 'User',
        date_of_birth: '2000-01-01',
        gender: 'M',
        document_type: 'cedula',
        document_number: '001-0000000-0',
      }),
    ).rejects.toThrow('Documento duplicado');
  });
});
