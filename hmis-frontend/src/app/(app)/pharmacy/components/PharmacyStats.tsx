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
        changeType="neutral"
      />
      <KpiCard
        title="Recetas Pendientes"
        value={stats.pending_prescriptions}
        icon={Pill}
        changeType={stats.pending_prescriptions > 10 ? 'negative' : 'neutral'}
        iconColor="bg-blue-50 text-blue-500"
      />
      <KpiCard
        title="Alertas Stock Bajo"
        value={stats.low_stock_alerts}
        icon={AlertTriangle}
        changeType={stats.low_stock_alerts > 0 ? 'negative' : 'positive'}
        variant={stats.low_stock_alerts > 0 ? 'danger' : 'success'}
      />
      <KpiCard
        title="Próximos a Vencer"
        value={stats.expiring_soon_count}
        icon={Clock}
        changeType={stats.expiring_soon_count > 0 ? 'negative' : 'neutral'}
        variant={stats.expiring_soon_count > 5 ? 'warning' : 'default'}
      />
    </div>
  );
}
