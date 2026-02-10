/**
 * Portal API Client
 * Dedicated client for patient portal with separate authentication
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

class PortalAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'PortalAPIError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('portal_access_token')
    : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}/portal${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 - token expired
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('portal_access_token');
        window.location.href = '/portal/login';
      }
      throw new PortalAPIError('Session expired', 401);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new PortalAPIError(
        errorData.detail || `Request failed with status ${response.status}`,
        response.status,
        errorData
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof PortalAPIError) {
      throw error;
    }
    throw new PortalAPIError(
      error instanceof Error ? error.message : 'Network error'
    );
  }
}

export const portalApi = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
