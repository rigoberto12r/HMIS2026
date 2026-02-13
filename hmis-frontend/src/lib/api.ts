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
// NOTA: Tokens ahora están en httpOnly cookies (no accesibles desde JavaScript)
// Esto previene ataques XSS. Las cookies se envían automáticamente con cada request.

function getTenantId(): string | null {
  if (typeof window === 'undefined') return 'default';
  return localStorage.getItem('hmis_tenant_id') || 'default';
}

function setTenantId(tenantId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('hmis_tenant_id', tenantId);
  }
}

function clearTenantId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('hmis_tenant_id');
  }
}

// ─── Token Refresh Logic ─────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  // If already refreshing, reuse the existing promise (dedup concurrent 401s)
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      // El refresh_token viene automáticamente desde httpOnly cookie
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': getTenantId() || 'default',
        },
        credentials: 'include',  // ← IMPORTANTE: Envía cookies automáticamente
      });

      if (!response.ok) return false;

      // Los nuevos tokens ya fueron establecidos en httpOnly cookies por el backend
      // No necesitamos hacer nada más aquí
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

    // Pydantic 422 errors return detail as an array of objects
    let detail: string | undefined;
    if (typeof errorData.detail === 'string') {
      detail = errorData.detail;
    } else if (Array.isArray(errorData.detail)) {
      detail = errorData.detail
        .map((e: { msg?: string; loc?: string[] }) =>
          e.msg ? `${e.loc?.slice(-1)[0] || 'campo'}: ${e.msg}` : String(e)
        )
        .join(', ');
    }

    throw new ApiClientError({
      message: (errorData.message as string) || detail || `Error ${response.status}`,
      status: response.status,
      detail,
      errors: errorData.errors as Record<string, string[]>,
    });
  }

  if (isJson) {
    return response.json();
  }

  return response.text() as unknown as T;
}

function buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(customHeaders || {}),
  };

  // El access_token ahora viene automáticamente en httpOnly cookie
  // Ya no necesitamos agregarlo manualmente al header Authorization

  // Solo agregamos el tenant ID que sí necesitamos enviar
  const tenantId = getTenantId();
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

  // First attempt - incluir credentials para enviar cookies automáticamente
  let response = await fetch(url, {
    ...restOptions,
    headers: buildHeaders(customHeaders as Record<string, string>),
    body: jsonBody,
    credentials: 'include',  // ← CRÍTICO: Envía httpOnly cookies automáticamente
  });

  // On 401 → try refreshing the token and retry once
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      // Retry with refreshed cookies
      response = await fetch(url, {
        ...restOptions,
        headers: buildHeaders(customHeaders as Record<string, string>),
        body: jsonBody,
        credentials: 'include',
      });
    }

    // Still 401 after refresh → session expired, redirect to login
    if (response.status === 401) {
      clearTenantId();
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
