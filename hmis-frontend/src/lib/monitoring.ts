/**
 * Error Monitoring and Telemetry
 *
 * Provides centralized error tracking with multiple backends:
 * - Console logging (development)
 * - Sentry integration (if available)
 * - Backend telemetry endpoint
 *
 * Usage:
 * ```typescript
 * import { captureException } from '@/lib/monitoring';
 *
 * try {
 *   // ... operation
 * } catch (error) {
 *   captureException(error, {
 *     context: 'create_invoice',
 *     userId: currentUser.id,
 *   });
 * }
 * ```
 */

export interface ErrorContext {
  [key: string]: unknown;
}

/**
 * Captures an exception and sends it to monitoring services
 *
 * @param error - The error object or message
 * @param context - Additional context information (sanitized automatically)
 */
export const captureException = (
  error: unknown,
  context?: ErrorContext
) => {
  // Extract error details
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[Monitoring] Exception captured:', {
      error: errorMessage,
      stack: errorStack,
      context,
    });
  }

  // Send to Sentry if available
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    try {
      (window as any).Sentry.captureException(error, {
        extra: sanitizeContext(context),
      });
    } catch (sentryError) {
      console.error('[Monitoring] Failed to send to Sentry:', sentryError);
    }
  }

  // Send to backend telemetry
  if (typeof window !== 'undefined') {
    sendToBackendTelemetry({
      error: errorMessage,
      stack: errorStack,
      context: sanitizeContext(context),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      environment: process.env.NODE_ENV,
    }).catch((telemetryError) => {
      // Silently fail if telemetry is down
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Monitoring] Failed to send telemetry:', telemetryError);
      }
    });
  }
};

/**
 * Sanitizes context data to remove sensitive information
 * Removes fields like: password, token, secret, credit_card, ssn
 */
function sanitizeContext(context?: ErrorContext): ErrorContext | undefined {
  if (!context) return undefined;

  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'api_key',
    'apiKey',
    'credit_card',
    'creditCard',
    'ssn',
    'social_security',
    'pin',
    'cvv',
    'card_number',
  ];

  const sanitized: ErrorContext = {};

  for (const [key, value] of Object.entries(context)) {
    // Check if key contains sensitive data
    const isSensitive = sensitiveKeys.some((sensitiveKey) =>
      key.toLowerCase().includes(sensitiveKey.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeContext(value as ErrorContext);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sends error data to backend telemetry endpoint
 */
async function sendToBackendTelemetry(payload: {
  error: string;
  stack?: string;
  context?: ErrorContext;
  timestamp: string;
  userAgent: string;
  url: string;
  environment?: string;
}): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const tenantId = localStorage.getItem('hmis_tenant_id');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add tenant header if available
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  // Add auth token if available (optional - telemetry might be unauthenticated)
  const token = localStorage.getItem('hmis_access_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${apiUrl}/telemetry/errors`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    // Log if request failed
    if (!response.ok && process.env.NODE_ENV === 'development') {
      console.warn(`[Monitoring] Telemetry endpoint returned ${response.status}`);
    }
  } catch (error) {
    // Network error - silently fail
    throw error;
  }
}

/**
 * Captures a custom event for analytics
 * Use this for non-error events like feature usage
 */
export const captureEvent = (
  eventName: string,
  properties?: Record<string, unknown>
) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Monitoring] Event:', eventName, properties);
  }

  // Send to analytics providers
  if (typeof window !== 'undefined' && (window as any).analytics) {
    try {
      (window as any).analytics.track(eventName, properties);
    } catch (error) {
      console.error('[Monitoring] Failed to send event:', error);
    }
  }
};

/**
 * Sets user context for error tracking
 */
export const setUserContext = (user: {
  id: string;
  email?: string;
  role?: string;
}) => {
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    try {
      (window as any).Sentry.setUser({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    } catch (error) {
      console.error('[Monitoring] Failed to set user context:', error);
    }
  }
};

/**
 * Clears user context (call on logout)
 */
export const clearUserContext = () => {
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    try {
      (window as any).Sentry.setUser(null);
    } catch (error) {
      console.error('[Monitoring] Failed to clear user context:', error);
    }
  }
};
