/**
 * PharmacyStats Component
 * KPI cards for pharmacy overview
 */

import { Package, Pill, AlertTriangle, Clock } from 'lucide-react';
import { KpiCard } from '@/components/ui/card';
import { usePharmacyStats } from '@/hooks/usePharmacyData';

export function PharmacyStats() {
  const { data: stats, isLoading } = usePharmacyStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-neutral-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Total Productos"
        value={stats.total_products}
        icon={Package}
        trend="neutral"
      />
      <KpiCard
        title="Recetas Pendientes"
        value={stats.pending_prescriptions}
        icon={Pill}
        trend={stats.pending_prescriptions > 10 ? 'down' : 'neutral'}
        color="blue"
      />
      <KpiCard
        title="Alertas Stock Bajo"
        value={stats.low_stock_alerts}
        icon={AlertTriangle}
        trend={stats.low_stock_alerts > 0 ? 'down' : 'up'}
        color={stats.low_stock_alerts > 0 ? 'red' : 'green'}
      />
      <KpiCard
        title="Próximos a Vencer"
        value={stats.expiring_soon_count}
        icon={Clock}
        trend={stats.expiring_soon_count > 0 ? 'down' : 'neutral'}
        color={stats.expiring_soon_count > 5 ? 'orange' : 'neutral'}
      />
    </div>
  );
}
