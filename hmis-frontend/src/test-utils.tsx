/**
 * Test Utilities for HMIS Frontend
 *
 * Provides helper functions and custom render methods for testing React components
 * with necessary providers (QueryClient, Router, etc.)
 */

import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactElement, ReactNode } from 'react';

/**
 * Creates a new QueryClient instance configured for testing
 * - Disables retries to make tests faster and more predictable
 * - Disables refetch behaviors that can cause race conditions in tests
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Wrapper component that provides QueryClient context
 * Used by customRender to wrap components with necessary providers
 */
interface TestProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

function TestProviders({ children, queryClient }: TestProvidersProps) {
  const client = queryClient || createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Custom render function that wraps components with test providers
 *
 * @example
 * ```tsx
 * const { getByText } = customRender(<MyComponent />, { queryClient: myClient });
 * ```
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

export function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): ReturnType<typeof render> {
  const { queryClient, ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders queryClient={queryClient}>
        {children}
      </TestProviders>
    ),
    ...renderOptions,
  });
}

/**
 * Waits for React Query to finish loading
 * Useful when you need to wait for a query to complete
 */
export async function waitForLoadingToFinish() {
  // Wait for loading states to resolve
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Mock for Next.js router
 * Automatically mocked in jest.setup.js, but can be customized per test
 */
export function createMockRouter(overrides = {}) {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    ...overrides,
  };
}

/**
 * Mock for Next.js useSearchParams
 */
export function createMockSearchParams(params: Record<string, string> = {}) {
  return new URLSearchParams(params);
}

/**
 * Helper to simulate API responses
 */
export function createMockApiResponse<T>(data: T, delay = 0): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
}

/**
 * Helper to simulate API errors
 */
export function createMockApiError(
  message: string,
  status = 400,
  delay = 0
): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(message) as any;
      error.status = status;
      reject(error);
    }, delay);
  });
}

/**
 * Clears all localStorage data
 * Useful for test cleanup
 */
export function clearLocalStorage() {
  localStorage.clear();
}

/**
 * Sets up mock auth tokens in localStorage
 */
export function setupMockAuth(
  accessToken = 'mock_access_token',
  refreshToken = 'mock_refresh_token',
  tenantId = 'mock_tenant_id'
) {
  localStorage.setItem('hmis_access_token', accessToken);
  localStorage.setItem('hmis_refresh_token', refreshToken);
  localStorage.setItem('hmis_tenant_id', tenantId);
}

/**
 * Removes mock auth tokens from localStorage
 */
export function clearMockAuth() {
  localStorage.removeItem('hmis_access_token');
  localStorage.removeItem('hmis_refresh_token');
  localStorage.removeItem('hmis_tenant_id');
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Override render with our custom version
export { customRender as render };
