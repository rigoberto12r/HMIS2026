/**
 * Lazy Loading Utilities
 * Dynamic imports with loading states for better performance
 */

import dynamic from 'next/dynamic';

// Loading fallback component
export function ComponentLoading({ message = 'Cargando...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-neutral-500">{message}</p>
      </div>
    </div>
  );
}

// Lazy loaded components with error boundary
export const LazyCharts = {
  // Recharts components (heavy - ~150KB)
  LineChart: dynamic(() => import('recharts').then(mod => ({ default: mod.LineChart })), {
    loading: () => <ComponentLoading message="Cargando gráfico..." />,
    ssr: false,
  }),
  BarChart: dynamic(() => import('recharts').then(mod => ({ default: mod.BarChart })), {
    loading: () => <ComponentLoading message="Cargando gráfico..." />,
    ssr: false,
  }),
  PieChart: dynamic(() => import('recharts').then(mod => ({ default: mod.PieChart })), {
    loading: () => <ComponentLoading message="Cargando gráfico..." />,
    ssr: false,
  }),
  AreaChart: dynamic(() => import('recharts').then(mod => ({ default: mod.AreaChart })), {
    loading: () => <ComponentLoading message="Cargando gráfico..." />,
    ssr: false,
  }),
};

// Lazy load heavy domain components
export const LazyComponents = {
  // Reports module (heavy - report builder + templates)
  ReportBuilder: dynamic(() => import('@/components/reports/ReportBuilder'), {
    loading: () => <ComponentLoading message="Cargando constructor de reportes..." />,
    ssr: false,
  }),

  ReportViewer: dynamic(() => import('@/components/reports/ReportViewer'), {
    loading: () => <ComponentLoading message="Cargando visor de reportes..." />,
    ssr: false,
  }),

  ScheduledReports: dynamic(() => import('@/components/reports/ScheduledReports'), {
    loading: () => <ComponentLoading message="Cargando reportes programados..." />,
    ssr: false,
  }),

  // Clinical module (SOAP note editor with rich text)
  SOAPNoteEditor: dynamic(() => import('@/components/clinical/soap-note-editor'), {
    loading: () => <ComponentLoading message="Cargando editor clínico..." />,
    ssr: false,
  }),

  // Payment processing (Stripe)
  PaymentForm: dynamic(() => import('@/components/payments/PaymentForm').catch(() => ({
    default: () => <div>Payment form unavailable</div>
  })), {
    loading: () => <ComponentLoading message="Cargando procesador de pagos..." />,
    ssr: false,
  }),
};

// Lazy load entire page sections
export const LazySections = {
  // Dashboard widgets
  DashboardStats: dynamic(() => import('@/app/(app)/dashboard/page').then(mod => ({
    default: () => null, // Placeholder, will be replaced with actual component
  })), {
    loading: () => <ComponentLoading />,
    ssr: false,
  }),
};

/**
 * Helper to create a lazy loaded component with custom loading
 */
export function createLazyComponent<T = any>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>,
  loadingMessage?: string
) {
  return dynamic(importFn, {
    loading: () => <ComponentLoading message={loadingMessage} />,
    ssr: false,
  });
}
