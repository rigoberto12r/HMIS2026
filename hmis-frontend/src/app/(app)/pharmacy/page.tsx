/**
 * Pharmacy Page - Refactored
 * Reduced from 1,095 → 325 → 75 lines using modular tab components
 */

'use client';

import { useState } from 'react';
import { Pill, Package, AlertTriangle, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PharmacyStats } from './components/PharmacyStats';
import { PrescriptionList } from './components/PrescriptionList';
import { ProductCatalog } from './components/ProductCatalog';
import { InventoryAlerts } from './components/InventoryAlerts';
import { ExpiringLots } from './components/ExpiringLots';
import { DispenseModal } from '@/components/pharmacy/DispenseModal';
import type { Prescription } from './types';

type TabKey = 'dispensacion' | 'inventario' | 'productos' | 'lotes';

const tabs = [
  { key: 'dispensacion' as TabKey, label: 'Dispensación', icon: Pill },
  { key: 'productos' as TabKey, label: 'Productos', icon: Package },
  { key: 'inventario' as TabKey, label: 'Alertas de Inventario', icon: AlertTriangle },
  { key: 'lotes' as TabKey, label: 'Lotes por Vencer', icon: Calendar },
];

export default function PharmacyPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dispensacion');
  const [dispensePrescription, setDispensePrescription] = useState<Prescription | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Farmacia</h1>
        <p className="text-sm text-neutral-500 mt-1">Gestión de recetas, inventario y dispensación</p>
      </div>

      <PharmacyStats />

      {/* Tab Navigation */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isActive
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <Card className="p-6">
        {activeTab === 'dispensacion' && <PrescriptionList onDispense={setDispensePrescription} />}
        {activeTab === 'productos' && <ProductCatalog />}
        {activeTab === 'inventario' && <InventoryAlerts />}
        {activeTab === 'lotes' && <ExpiringLots />}
      </Card>

      <DispenseModal
        isOpen={!!dispensePrescription}
        onClose={() => setDispensePrescription(null)}
        prescription={dispensePrescription}
      />
    </div>
  );
}
