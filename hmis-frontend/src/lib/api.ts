/**
 * API client for HMIS backend communication.
 * Provides a fetch-based wrapper with authentication, tenant headers,
 * automatic JSON handling, and transparent token refresh on 401.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
}

interface ApiError {
  message: string;
  status: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

class ApiClientError extends Error {
  status: number;
  detail?: string;
  errors?: Record<string, string[]>;

  constructor({ message, status, detail, errors }: ApiError) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.detail = detail;
    this.errors = errors;
  }
}

// ─── Token Management ────────────────────────────────────

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hmis_access_token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hmis_refresh_token');
}

function getTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hmis_tenant_id');
}

function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('hmis_access_token', accessToken);
  localStorage.setItem('hmis_refresh_token', refreshToken);
}

function clearTokens(): void {
  localStorage.removeItem('hmis_access_token');
  localStorage.removeItem('hmis_refresh_token');
  localStorage.removeItem('hmis_tenant_id');
}

// ─── Token Refresh Logic ─────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  // If already refreshing, reuse the existing promise (dedup concurrent 401s)
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ─── Request Helpers ─────────────────────────────────────

function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    let errorData: Record<string, unknown> = {};
    if (isJson) {
      try {
        errorData = await response.json();
      } catch {
        // Ignore JSON parse errors
      }
    }

    throw new ApiClientError({
      message: (errorData.message as string) || (errorData.detail as string) || `Error ${response.status}`,
      status: response.status,
      detail: errorData.detail as string,
      errors: errorData.errors as Record<string, string[]>,
    });
  }

  if (isJson) {
    return response.json();
  }

  return response.text() as unknown as T;
}

function buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
  const token = getAuthToken();
  const tenantId = getTenantId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(customHeaders || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  return headers;
}

// ─── Core Request (with auto-refresh on 401) ─────────────

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, params, headers: customHeaders, ...restOptions } = options;
  const url = buildUrl(endpoint, params);
  const jsonBody = body ? JSON.stringify(body) : undefined;

  // First attempt
  let response = await fetch(url, {
    ...restOptions,
    headers: buildHeaders(customHeaders as Record<string, string>),
    body: jsonBody,
  });

  // On 401 → try refreshing the token and retry once
  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      response = await fetch(url, {
        ...restOptions,
        headers: buildHeaders(customHeaders as Record<string, string>),
        body: jsonBody,
      });
    }

    // Still 401 after refresh → session expired, redirect to login
    if (response.status === 401) {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
  }

  return handleResponse<T>(response);
}

// ─── API Client ──────────────────────────────────────────

export const api = {
  get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
    return request<T>(endpoint, { method: 'GET', params });
  },

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, { method: 'POST', body });
  },

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, { method: 'PUT', body });
  },

  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, { method: 'PATCH', body });
  },

  delete<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: 'DELETE' });
  },
};

export { ApiClientError };
export type { ApiError };
