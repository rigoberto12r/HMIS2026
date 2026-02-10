/**
 * Performance Monitoring Utilities
 * Client-side performance tracking for Core Web Vitals
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
}

// Core Web Vitals thresholds (Google recommendations)
const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 },   // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte
  INP: { good: 200, poor: 500 },   // Interaction to Next Paint
};

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = WEB_VITALS_THRESHOLDS[name as keyof typeof WEB_VITALS_THRESHOLDS];
  if (!threshold) return 'good';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Report Web Vitals to analytics
 * Can be used with Google Analytics, Vercel Analytics, or custom endpoint
 */
export function reportWebVitals(metric: PerformanceMetric) {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${metric.name}:`, {
      value: `${metric.value.toFixed(2)}ms`,
      rating: metric.rating,
      delta: metric.delta ? `${metric.delta.toFixed(2)}ms` : undefined,
    });
  }

  // Send to analytics endpoint
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to custom analytics endpoint
    fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        timestamp: Date.now(),
        url: window.location.pathname,
      }),
    }).catch(() => {
      // Silently fail - don't break the app for analytics
    });
  }
}

/**
 * Create a performance metric from PerformanceEntry
 */
export function createMetric(entry: PerformanceEntry): PerformanceMetric {
  const value = 'duration' in entry ? entry.duration : (entry as any).value || 0;
  return {
    name: entry.name,
    value,
    rating: getRating(entry.name, value),
  };
}

/**
 * Measure component render time
 */
export function measureRender(componentName: string, callback: () => void) {
  const startMark = `${componentName}-start`;
  const endMark = `${componentName}-end`;
  const measureName = `${componentName}-render`;

  performance.mark(startMark);
  callback();
  performance.mark(endMark);

  try {
    performance.measure(measureName, startMark, endMark);
    const measure = performance.getEntriesByName(measureName)[0];

    if (measure) {
      const metric = createMetric(measure);

      if (process.env.NODE_ENV === 'development' && metric.value > 16) {
        console.warn(`[Performance] Slow render detected: ${componentName} took ${metric.value.toFixed(2)}ms`);
      }
    }

    // Cleanup
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
  } catch (error) {
    // Performance API not supported or error in measurement
  }
}

/**
 * Track data fetching performance
 */
export async function trackFetch<T>(
  name: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await fetchFn();
    const duration = performance.now() - startTime;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Fetch] ${name}: ${duration.toFixed(2)}ms`);

      if (duration > 1000) {
        console.warn(`[Fetch] Slow request detected: ${name} took ${duration.toFixed(2)}ms`);
      }
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[Fetch] Failed ${name} after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}

/**
 * Get performance summary
 */
export function getPerformanceSummary() {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

  if (!navigation) return null;

  return {
    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcp: navigation.connectEnd - navigation.connectStart,
    ttfb: navigation.responseStart - navigation.requestStart,
    download: navigation.responseEnd - navigation.responseStart,
    domInteractive: navigation.domInteractive - navigation.fetchStart,
    domComplete: navigation.domComplete - navigation.fetchStart,
    loadComplete: navigation.loadEventEnd - navigation.fetchStart,
  };
}
