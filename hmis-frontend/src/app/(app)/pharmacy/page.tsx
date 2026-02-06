'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardHeader, KpiCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { Input, Select } from '@/components/ui/input';
import {
  Pill,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  ShoppingCart,
  Shield,
  Calendar,
  Download,
  Plus,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface Product {
  id: string;
  code: string;
  name: string;
  generic_name: string | null;
  category: string;
  presentation: string | null;
  concentration: string | null;
  unit: string;
  requires_prescription: boolean;
  is_controlled: boolean;
  min_stock: number;
  max_stock: number;
  reorder_point: number;
  is_active: boolean;
  created_at: string;
}

interface Prescription {
  id: string;
  patient_id: string;
  doctor_id: string;
  encounter_id: string | null;
  product_id: string;
  dosage: string;
  frequency: string;
  duration_days: number | null;
  quantity: number;
  status: string;
  allergy_alerts: any;
  patient_name: string | null;
  product_name: string | null;
  created_at: string;
}

interface Lot {
  id: string;
  lot_number: string;
  expiration_date: string;
  quantity_available: number;
  product_id: string;
  product_name?: string;
}

interface InventoryAlert {
  id: string;
  product_name: string;
  current_stock: number;
  reorder_point: number;
  unit: string;
  alert_type: string; // 'low_stock' | 'expiring'
  detail: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ─── Status / Category Labels ───────────────────────────

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  dispensed: 'Dispensado',
  cancelled: 'Cancelada',
  expired: 'Vencida',
};

const categoryLabels: Record<string, string> = {
  medication: 'Medicamento',
  supply: 'Insumo',
  device: 'Dispositivo',
};

// Map API status to StatusBadge keys
const statusToBadgeKey: Record<string, string> = {
  pending: 'por_dispensar',
  dispensed: 'dispensada',
  cancelled: 'cancelada',
  expired: 'vencida',
};

// ─── Tabs ───────────────────────────────────────────────

type TabKey = 'dispensacion' | 'inventario' | 'alertas';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'dispensacion', label: 'Cola de Dispensacion' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'alertas', label: 'Alertas' },
];

// ─── Page ───────────────────────────────────────────────

export default function PharmacyPage() {
  // Active tab
  const [activeTab, setActiveTab] = useState<TabKey>('dispensacion');

  // Data state
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [prescriptionsTotal, setPrescriptionsTotal] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [expiringLots, setExpiringLots] = useState<Lot[]>([]);

  // KPI state
  const [kpiTotalProducts, setKpiTotalProducts] = useState(0);
  const [kpiPendingRx, setKpiPendingRx] = useState(0);
  const [kpiLowStockAlerts, setKpiLowStockAlerts] = useState(0);
  const [kpiExpiringCount, setKpiExpiringCount] = useState(0);

  // Loading / error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [availableLots, setAvailableLots] = useState<Lot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [dispenseQuantity, setDispenseQuantity] = useState('');
  const [pharmacistNotes, setPharmacistNotes] = useState('');
  const [dispensing, setDispensing] = useState(false);
  const [dispenseError, setDispenseError] = useState<string | null>(null);

  // Search / filters
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('');

  // ─── Data Fetching ──────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [productsRes, prescriptionsRes, alertsRes, expiringRes] = await Promise.all([
        api.get<PaginatedResponse<Product>>('/pharmacy/products', {
          page: 1,
          page_size: 100,
        }),
        api.get<PaginatedResponse<Prescription>>('/pharmacy/prescriptions', {
          page: 1,
          page_size: 100,
          status: 'pending',
        }),
        api.get<InventoryAlert[]>('/pharmacy/inventory/alerts'),
        api.get<Lot[]>('/pharmacy/lots/expiring', { days_ahead: 90 }),
      ]);

      setProducts(productsRes.items);
      setProductsTotal(productsRes.total);
      setKpiTotalProducts(productsRes.total);

      setPrescriptions(prescriptionsRes.items);
      setPrescriptionsTotal(prescriptionsRes.total);
      setKpiPendingRx(prescriptionsRes.total);

      const lowStockAlerts = Array.isArray(alertsRes) ? alertsRes : [];
      setAlerts(lowStockAlerts);
      setKpiLowStockAlerts(lowStockAlerts.filter((a) => a.alert_type === 'low_stock').length);

      const expiring = Array.isArray(expiringRes) ? expiringRes : [];
      setExpiringLots(expiring);
      setKpiExpiringCount(expiring.length);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar datos de farmacia');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch products with search/filter
  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResponse<Product>>('/pharmacy/products', {
        page: 1,
        page_size: 100,
        search: productSearch || undefined,
        category: productCategory || undefined,
      });
      setProducts(res.items);
      setProductsTotal(res.total);
    } catch {
      // Silently handle - data already loaded from initial fetch
    }
  }, [productSearch, productCategory]);

  useEffect(() => {
    if (!loading) {
      const debounce = setTimeout(() => {
        fetchProducts();
      }, 300);
      return () => clearTimeout(debounce);
    }
  }, [productSearch, productCategory, fetchProducts, loading]);

  // ─── Dispense Handlers ──────────────────────────────────

  const handleOpenDispenseModal = useCallback(async (rx: Prescription) => {
    setSelectedRx(rx);
    setShowDispenseModal(true);
    setSelectedLotId('');
    setDispenseQuantity(String(rx.quantity));
    setPharmacistNotes('');
    setDispenseError(null);

    // Fetch available lots for this product
    setLotsLoading(true);
    try {
      const lots = await api.get<Lot[]>(`/pharmacy/products/${rx.product_id}/lots`);
      setAvailableLots(Array.isArray(lots) ? lots : []);
    } catch {
      setAvailableLots([]);
    } finally {
      setLotsLoading(false);
    }
  }, []);

  const handleCloseDispenseModal = useCallback(() => {
    setShowDispenseModal(false);
    setSelectedRx(null);
    setAvailableLots([]);
    setSelectedLotId('');
    setDispenseQuantity('');
    setPharmacistNotes('');
    setDispenseError(null);
  }, []);

  const handleConfirmDispense = useCallback(async () => {
    if (!selectedRx || !selectedLotId || !dispenseQuantity) {
      setDispenseError('Debe seleccionar un lote y cantidad.');
      return;
    }

    setDispensing(true);
    setDispenseError(null);

    try {
      await api.post('/pharmacy/dispensations', {
        prescription_id: selectedRx.id,
        product_id: selectedRx.product_id,
        lot_id: selectedLotId,
        quantity_dispensed: Number(dispenseQuantity),
        pharmacist_notes: pharmacistNotes || null,
      });

      handleCloseDispenseModal();
      // Refresh data after successful dispensation
      fetchData();
    } catch (err: any) {
      setDispenseError(err?.message || 'Error al dispensar medicamento');
    } finally {
      setDispensing(false);
    }
  }, [selectedRx, selectedLotId, dispenseQuantity, pharmacistNotes, handleCloseDispenseModal, fetchData]);

  // ─── Prescription Columns ───────────────────────────────

  const prescriptionColumns: Column<Prescription>[] = [
    {
      key: 'id',
      header: 'No. Receta',
      sortable: true,
      width: '130px',
      render: (row) => (
        <span className="font-mono text-primary-600 font-medium text-xs">
          RX-{row.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      key: 'patient_name',
      header: 'Paciente',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-medium text-neutral-900">
            {row.patient_name || 'Paciente sin nombre'}
          </span>
          {row.allergy_alerts && (
            <div className="flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3 text-medical-red" />
              <span className="text-2xs text-medical-red font-medium">Alerta de alergia</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'product_name',
      header: 'Medicamento',
      sortable: true,
      render: (row) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-neutral-900 text-sm">
              {row.product_name || 'Producto'}
            </span>
          </div>
          <span className="text-xs text-neutral-500">
            {row.dosage} | {row.frequency} | Cant: {row.quantity}
          </span>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Fecha/Hora',
      sortable: true,
      width: '140px',
      render: (row) => (
        <span className="text-neutral-500 text-xs">
          {new Date(row.created_at).toLocaleString('es-DO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      width: '130px',
      render: (row) => (
        <StatusBadge status={statusToBadgeKey[row.status] || row.status} />
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '110px',
      align: 'right',
      render: (row) =>
        row.status === 'pending' ? (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            onClick={() => handleOpenDispenseModal(row)}
          >
            Dispensar
          </Button>
        ) : (
          <span className="text-xs text-neutral-400">
            {statusLabels[row.status] || row.status}
          </span>
        ),
    },
  ];

  // ─── Product Columns ────────────────────────────────────

  const productColumns: Column<Product>[] = [
    {
      key: 'code',
      header: 'Codigo',
      sortable: true,
      width: '110px',
      render: (row) => (
        <span className="font-mono text-primary-600 font-medium text-xs">{row.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Nombre',
      sortable: true,
      render: (row) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-neutral-900 text-sm">{row.name}</span>
            {row.is_controlled && (
              <Badge variant="danger" size="sm">
                <Shield className="w-3 h-3 mr-0.5" />
                Controlado
              </Badge>
            )}
          </div>
          {row.generic_name && (
            <span className="text-xs text-neutral-500">{row.generic_name}</span>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Categoria',
      sortable: true,
      width: '120px',
      render: (row) => (
        <Badge variant={row.category === 'medication' ? 'primary' : row.category === 'supply' ? 'info' : 'default'} size="sm">
          {categoryLabels[row.category] || row.category}
        </Badge>
      ),
    },
    {
      key: 'presentation',
      header: 'Presentacion',
      render: (row) => (
        <span className="text-neutral-600 text-xs">
          {[row.presentation, row.concentration].filter(Boolean).join(' - ') || '---'}
        </span>
      ),
    },
    {
      key: 'unit',
      header: 'Unidad',
      width: '90px',
      render: (row) => <span className="text-neutral-600 text-xs">{row.unit}</span>,
    },
    {
      key: 'reorder_point',
      header: 'Pto. Reorden',
      width: '110px',
      align: 'right',
      render: (row) => (
        <span className="text-neutral-600 text-xs font-mono">
          {row.min_stock} / {row.reorder_point} / {row.max_stock}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      width: '90px',
      render: (row) => (
        <StatusBadge status={row.is_active ? 'activo' : 'inactivo'} />
      ),
    },
  ];

  // ─── Alert Helpers ──────────────────────────────────────

  function getAlertSeverity(alert: InventoryAlert) {
    if (alert.alert_type === 'expiring') return 'vencimiento';
    const ratio = alert.current_stock / alert.reorder_point;
    return ratio < 0.3 ? 'critico' : 'bajo';
  }

  const severityConfig = {
    critico: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'text-red-500',
      badge: 'danger' as const,
      label: 'Critico',
    },
    bajo: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: 'text-yellow-500',
      badge: 'warning' as const,
      label: 'Bajo',
    },
    vencimiento: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      icon: 'text-orange-500',
      badge: 'warning' as const,
      label: 'Por Vencer',
    },
  };

  // ─── Render ─────────────────────────────────────────────

  if (error && !loading && products.length === 0 && prescriptions.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Farmacia</h1>
          <p className="page-subtitle">Dispensacion de medicamentos e inventario</p>
        </div>
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">Error al cargar datos</h3>
            <p className="text-sm text-neutral-500 mb-4">{error}</p>
            <Button variant="primary" onClick={fetchData}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Farmacia</h1>
          <p className="page-subtitle">Dispensacion de medicamentos e inventario</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Package className="w-4 h-4" />}
            onClick={() => setActiveTab('inventario')}
          >
            Inventario
          </Button>
          <Button variant="outline" size="sm" leftIcon={<ShoppingCart className="w-4 h-4" />}>
            Ordenes de Compra
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Productos"
          value={loading ? '...' : kpiTotalProducts}
          change="Catalogo activo"
          changeType="neutral"
          icon={<Package className="w-5 h-5" />}
          iconColor="bg-blue-50 text-blue-500"
        />
        <KpiCard
          title="Recetas Pendientes"
          value={loading ? '...' : kpiPendingRx}
          change="Requieren atencion"
          changeType={kpiPendingRx > 0 ? 'negative' : 'positive'}
          icon={<Clock className="w-5 h-5" />}
          iconColor="bg-yellow-50 text-yellow-500"
        />
        <KpiCard
          title="Alertas Stock Bajo"
          value={loading ? '...' : kpiLowStockAlerts}
          change="Productos bajo minimo"
          changeType={kpiLowStockAlerts > 0 ? 'negative' : 'positive'}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconColor="bg-red-50 text-red-500"
        />
        <KpiCard
          title="Productos por Vencer"
          value={loading ? '...' : kpiExpiringCount}
          change="En los proximos 90 dias"
          changeType={kpiExpiringCount > 0 ? 'negative' : 'positive'}
          icon={<Calendar className="w-5 h-5" />}
          iconColor="bg-orange-50 text-orange-500"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
            }`}
          >
            {tab.label}
            {tab.key === 'dispensacion' && kpiPendingRx > 0 && (
              <Badge variant="warning" size="sm" className="ml-2">
                {kpiPendingRx}
              </Badge>
            )}
            {tab.key === 'alertas' && (kpiLowStockAlerts + kpiExpiringCount) > 0 && (
              <Badge variant="danger" size="sm" className="ml-2">
                {kpiLowStockAlerts + kpiExpiringCount}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area (2/3) */}
        <div className="lg:col-span-2">
          {/* Cola de Dispensacion */}
          {activeTab === 'dispensacion' && (
            <Card padding="none">
              <div className="p-4 border-b border-neutral-100">
                <h2 className="section-title">Cola de Dispensacion</h2>
              </div>
              <DataTable
                columns={prescriptionColumns}
                data={prescriptions}
                keyExtractor={(row) => row.id}
                pageSize={10}
                searchable
                searchPlaceholder="Buscar por paciente o medicamento..."
                emptyMessage="No hay prescripciones pendientes."
                loading={loading}
                className="p-4"
              />
            </Card>
          )}

          {/* Inventario */}
          {activeTab === 'inventario' && (
            <Card padding="none">
              <div className="p-4 border-b border-neutral-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h2 className="section-title">Catalogo de Productos</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Buscar producto..."
                        className="form-input pl-9 text-sm h-9"
                      />
                    </div>
                    <select
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                      className="form-input text-sm h-9"
                    >
                      <option value="">Todas las categorias</option>
                      <option value="medication">Medicamento</option>
                      <option value="supply">Insumo</option>
                      <option value="device">Dispositivo</option>
                    </select>
                  </div>
                </div>
              </div>
              <DataTable
                columns={productColumns}
                data={products}
                keyExtractor={(row) => row.id}
                pageSize={10}
                emptyMessage="No se encontraron productos."
                loading={loading}
                className="p-4"
              />
            </Card>
          )}

          {/* Alertas */}
          {activeTab === 'alertas' && (
            <Card padding="none">
              <div className="p-4 border-b border-neutral-100">
                <h2 className="section-title">Alertas de Inventario y Vencimiento</h2>
              </div>
              <div className="p-4 space-y-3">
                {loading ? (
                  <div className="flex flex-col items-center gap-2 py-12">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-neutral-500">Cargando alertas...</span>
                  </div>
                ) : alerts.length === 0 && expiringLots.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                    <p className="text-sm text-neutral-500">No hay alertas activas. Todo en orden.</p>
                  </div>
                ) : (
                  <>
                    {/* Low stock alerts */}
                    {alerts.map((alert) => {
                      const severity = getAlertSeverity(alert);
                      const config = severityConfig[severity];

                      return (
                        <div
                          key={alert.id}
                          className={`p-3 rounded-lg border ${config.bg} ${config.border}`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {alert.alert_type === 'expiring' ? (
                                <Calendar className={`w-4 h-4 ${config.icon}`} />
                              ) : (
                                <Package className={`w-4 h-4 ${config.icon}`} />
                              )}
                              <span className="text-sm font-medium text-neutral-900">
                                {alert.product_name}
                              </span>
                            </div>
                            <Badge variant={config.badge} size="sm">
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-neutral-600 ml-6">{alert.detail}</p>
                          {alert.alert_type !== 'expiring' && (
                            <div className="mt-2 ml-6">
                              <div className="flex items-center justify-between text-2xs text-neutral-500 mb-1">
                                <span>
                                  Stock: {alert.current_stock} {alert.unit}
                                </span>
                                <span>Reorden: {alert.reorder_point}</span>
                              </div>
                              <div className="w-full bg-neutral-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    severity === 'critico' ? 'bg-red-500' : 'bg-yellow-500'
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      (alert.current_stock / alert.reorder_point) * 100,
                                      100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Expiring lots */}
                    {expiringLots.map((lot) => {
                      const config = severityConfig.vencimiento;
                      const expiresDate = new Date(lot.expiration_date);
                      const daysUntil = Math.ceil(
                        (expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      );

                      return (
                        <div
                          key={lot.id}
                          className={`p-3 rounded-lg border ${config.bg} ${config.border}`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Calendar className={`w-4 h-4 ${config.icon}`} />
                              <span className="text-sm font-medium text-neutral-900">
                                {lot.product_name || `Lote ${lot.lot_number}`}
                              </span>
                            </div>
                            <Badge variant={config.badge} size="sm">
                              Por Vencer
                            </Badge>
                          </div>
                          <p className="text-xs text-neutral-600 ml-6">
                            Lote: {lot.lot_number} | Vence:{' '}
                            {expiresDate.toLocaleDateString('es-DO')} |{' '}
                            {lot.quantity_available} unidades | {daysUntil} dias restantes
                          </p>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-4">
          {/* Quick Alerts */}
          <Card>
            <CardHeader
              title="Alertas de Inventario"
              subtitle={`${alerts.length + expiringLots.length} alertas activas`}
            />
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : alerts.length === 0 && expiringLots.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-4">Sin alertas activas</p>
              ) : (
                <>
                  {alerts.slice(0, 3).map((alert) => {
                    const severity = getAlertSeverity(alert);
                    const config = severityConfig[severity];

                    return (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${config.bg} ${config.border}`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {alert.alert_type === 'expiring' ? (
                              <Calendar className={`w-4 h-4 ${config.icon}`} />
                            ) : (
                              <Package className={`w-4 h-4 ${config.icon}`} />
                            )}
                            <span className="text-sm font-medium text-neutral-900">
                              {alert.product_name}
                            </span>
                          </div>
                          <Badge variant={config.badge} size="sm">
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-neutral-600 ml-6">{alert.detail}</p>
                        {alert.alert_type !== 'expiring' && (
                          <div className="mt-2 ml-6">
                            <div className="flex items-center justify-between text-2xs text-neutral-500 mb-1">
                              <span>
                                Stock: {alert.current_stock} {alert.unit}
                              </span>
                              <span>Reorden: {alert.reorder_point}</span>
                            </div>
                            <div className="w-full bg-neutral-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${
                                  severity === 'critico' ? 'bg-red-500' : 'bg-yellow-500'
                                }`}
                                style={{
                                  width: `${Math.min(
                                    (alert.current_stock / alert.reorder_point) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {expiringLots.slice(0, 2).map((lot) => {
                    const config = severityConfig.vencimiento;
                    const expiresDate = new Date(lot.expiration_date);
                    const daysUntil = Math.ceil(
                      (expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );

                    return (
                      <div
                        key={lot.id}
                        className={`p-3 rounded-lg border ${config.bg} ${config.border}`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Calendar className={`w-4 h-4 ${config.icon}`} />
                            <span className="text-sm font-medium text-neutral-900">
                              {lot.product_name || `Lote ${lot.lot_number}`}
                            </span>
                          </div>
                          <Badge variant="warning" size="sm">
                            Por Vencer
                          </Badge>
                        </div>
                        <p className="text-xs text-neutral-600 ml-6">
                          Vence: {expiresDate.toLocaleDateString('es-DO')} - {lot.quantity_available}{' '}
                          unidades en {daysUntil} dias
                        </p>
                      </div>
                    );
                  })}

                  {(alerts.length + expiringLots.length) > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-primary-600"
                      onClick={() => setActiveTab('alertas')}
                    >
                      Ver todas las alertas ({alerts.length + expiringLots.length})
                    </Button>
                  )}
                </>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Generar Orden de Compra
              </Button>
            </div>
          </Card>

          {/* Day Summary */}
          <Card>
            <CardHeader title="Resumen del Dia" />
            <div className="space-y-2">
              {[
                {
                  label: 'Total Productos',
                  value: loading ? '...' : String(kpiTotalProducts),
                  icon: Pill,
                  color: 'text-green-600',
                },
                {
                  label: 'Prescripciones Pendientes',
                  value: loading ? '...' : String(kpiPendingRx),
                  icon: Clock,
                  color: 'text-yellow-600',
                },
                {
                  label: 'Alertas Stock Bajo',
                  value: loading ? '...' : String(kpiLowStockAlerts),
                  icon: AlertTriangle,
                  color: 'text-red-600',
                },
                {
                  label: 'Lotes por Vencer (90d)',
                  value: loading ? '...' : String(kpiExpiringCount),
                  icon: Calendar,
                  color: 'text-orange-600',
                },
                {
                  label: 'Total Alertas',
                  value: loading ? '...' : String(alerts.length + expiringLots.length),
                  icon: Shield,
                  color: 'text-purple-600',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${item.color}`} />
                      <span className="text-sm text-neutral-600">{item.label}</span>
                    </div>
                    <span className="text-sm font-bold text-neutral-900">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Dispense Modal */}
      <Modal
        isOpen={showDispenseModal}
        onClose={handleCloseDispenseModal}
        title="Dispensar Medicamento"
        description={
          selectedRx
            ? `${selectedRx.product_name || 'Producto'} para ${selectedRx.patient_name || 'Paciente'}`
            : ''
        }
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={handleCloseDispenseModal} disabled={dispensing}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={handleConfirmDispense}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              disabled={dispensing || !selectedLotId || !dispenseQuantity}
            >
              {dispensing ? 'Dispensando...' : 'Confirmar Dispensacion'}
            </Button>
          </>
        }
      >
        {selectedRx && (
          <div className="space-y-4">
            {/* Prescription details */}
            <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Receta:</span>
                <span className="font-mono font-medium">
                  RX-{selectedRx.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Medicamento:</span>
                <span className="font-medium">{selectedRx.product_name || 'Producto'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Posologia:</span>
                <span>
                  {selectedRx.dosage} | {selectedRx.frequency}
                  {selectedRx.duration_days ? ` x ${selectedRx.duration_days} dias` : ''}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Cantidad prescrita:</span>
                <span className="font-medium">{selectedRx.quantity} unidades</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Paciente:</span>
                <span>{selectedRx.patient_name || 'Sin nombre'}</span>
              </div>
            </div>

            {/* Allergy Alerts */}
            {selectedRx.allergy_alerts && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-700 font-medium">
                  Alerta: Paciente con alergia registrada. Verificar antes de dispensar.
                </span>
              </div>
            )}

            {/* Dispense Error */}
            {dispenseError && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-700 font-medium">{dispenseError}</span>
              </div>
            )}

            {/* Lot Selection */}
            {lotsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mr-2" />
                <span className="text-sm text-neutral-500">Cargando lotes disponibles...</span>
              </div>
            ) : availableLots.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded-lg border border-yellow-200">
                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <span className="text-xs text-yellow-700 font-medium">
                  No hay lotes disponibles para este producto.
                </span>
              </div>
            ) : (
              <Select
                label="Lote (FEFO)"
                required
                value={selectedLotId}
                onChange={(e) => setSelectedLotId(e.target.value)}
                options={availableLots.map((lot) => ({
                  value: lot.id,
                  label: `${lot.lot_number} - Vence: ${new Date(
                    lot.expiration_date
                  ).toLocaleDateString('es-DO')} - Disp: ${lot.quantity_available} uds`,
                }))}
                placeholder="Seleccionar lote"
              />
            )}

            <Input
              label="Cantidad a Dispensar"
              type="number"
              value={dispenseQuantity}
              onChange={(e) => setDispenseQuantity(e.target.value)}
              placeholder={String(selectedRx.quantity)}
              required
              min={1}
            />

            <Input
              label="Notas del Farmaceutico"
              value={pharmacistNotes}
              onChange={(e) => setPharmacistNotes(e.target.value)}
              placeholder="Notas adicionales (opcional)"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
