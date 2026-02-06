'use client';

import { useState } from 'react';
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
  BarChart3,
  Shield,
  Calendar,
  Download,
  Plus,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface Prescription {
  id: string;
  rxNumber: string;
  patient: string;
  medication: string;
  dosage: string;
  quantity: number;
  prescriber: string;
  date: string;
  status: string;
  alerts: string[];
  controlled: boolean;
}

interface StockAlert {
  id: string;
  product: string;
  stock: number;
  reorderLevel: number;
  unit: string;
  severity: 'critico' | 'bajo' | 'vencimiento';
  detail: string;
}

// ─── Mock Data ──────────────────────────────────────────

const mockPrescriptions: Prescription[] = [
  {
    id: '1',
    rxNumber: 'RX-2026-0048',
    patient: 'Juan Perez',
    medication: 'Ibuprofeno 400mg',
    dosage: 'c/8h x 5 dias',
    quantity: 15,
    prescriber: 'Dr. Martinez',
    date: '06/02/2026 09:15',
    status: 'por_dispensar',
    alerts: [],
    controlled: false,
  },
  {
    id: '2',
    rxNumber: 'RX-2026-0047',
    patient: 'Maria Rodriguez',
    medication: 'Losartan 100mg',
    dosage: 'c/24h continuo',
    quantity: 30,
    prescriber: 'Dr. Martinez',
    date: '06/02/2026 08:50',
    status: 'por_dispensar',
    alerts: [],
    controlled: false,
  },
  {
    id: '3',
    rxNumber: 'RX-2026-0046',
    patient: 'Carlos Gomez',
    medication: 'Amoxicilina 500mg',
    dosage: 'c/8h x 7 dias',
    quantity: 21,
    prescriber: 'Dra. Lopez',
    date: '06/02/2026 08:30',
    status: 'por_dispensar',
    alerts: ['alergia_penicilina'],
    controlled: false,
  },
  {
    id: '4',
    rxNumber: 'RX-2026-0045',
    patient: 'Ana Gonzalez',
    medication: 'Metformina 850mg',
    dosage: 'c/12h continuo',
    quantity: 60,
    prescriber: 'Dr. Martinez',
    date: '06/02/2026 08:10',
    status: 'dispensada',
    alerts: [],
    controlled: false,
  },
  {
    id: '5',
    rxNumber: 'RX-2026-0044',
    patient: 'Pedro Sanchez',
    medication: 'Tramadol 50mg',
    dosage: 'c/8h PRN x 3 dias',
    quantity: 9,
    prescriber: 'Dr. Martinez',
    date: '05/02/2026 16:20',
    status: 'dispensada',
    alerts: [],
    controlled: true,
  },
  {
    id: '6',
    rxNumber: 'RX-2026-0043',
    patient: 'Laura Diaz',
    medication: 'Omeprazol 20mg',
    dosage: 'c/24h x 14 dias',
    quantity: 14,
    prescriber: 'Dra. Lopez',
    date: '05/02/2026 15:45',
    status: 'dispensada',
    alerts: [],
    controlled: false,
  },
];

const stockAlerts: StockAlert[] = [
  {
    id: '1',
    product: 'Omeprazol 20mg',
    stock: 12,
    reorderLevel: 50,
    unit: 'tabletas',
    severity: 'critico',
    detail: 'Stock critico - 76% por debajo del nivel de reorden',
  },
  {
    id: '2',
    product: 'Amoxicilina 500mg',
    stock: 45,
    reorderLevel: 100,
    unit: 'capsulas',
    severity: 'bajo',
    detail: 'Stock bajo - 55% por debajo del nivel de reorden',
  },
  {
    id: '3',
    product: 'Insulina NPH 100UI/mL',
    stock: 8,
    reorderLevel: 20,
    unit: 'frascos',
    severity: 'vencimiento',
    detail: 'Vence: 15/03/2026 - 8 unidades por vencer en 37 dias',
  },
  {
    id: '4',
    product: 'Diclofenaco Sodico 75mg/3mL',
    stock: 18,
    reorderLevel: 40,
    unit: 'ampollas',
    severity: 'bajo',
    detail: 'Stock bajo - 55% por debajo del nivel de reorden',
  },
];

// ─── Page ───────────────────────────────────────────────

export default function PharmacyPage() {
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);

  const pendientes = mockPrescriptions.filter((rx) => rx.status === 'por_dispensar').length;
  const dispensadas = mockPrescriptions.filter((rx) => rx.status === 'dispensada').length;
  const conAlertas = mockPrescriptions.filter((rx) => rx.alerts.length > 0).length;
  const controladas = mockPrescriptions.filter((rx) => rx.controlled).length;

  function handleDispense(rx: Prescription) {
    setSelectedRx(rx);
    setShowDispenseModal(true);
  }

  const columns: Column<Prescription>[] = [
    {
      key: 'rxNumber',
      header: 'No. Receta',
      sortable: true,
      width: '130px',
      render: (row) => (
        <span className="font-mono text-primary-600 font-medium text-xs">{row.rxNumber}</span>
      ),
    },
    {
      key: 'patient',
      header: 'Paciente',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-medium text-neutral-900">{row.patient}</span>
          {row.alerts.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3 text-medical-red" />
              <span className="text-2xs text-medical-red font-medium">Alerta de alergia</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'medication',
      header: 'Medicamento',
      sortable: true,
      render: (row) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-neutral-900 text-sm">{row.medication}</span>
            {row.controlled && (
              <Badge variant="danger" size="sm">
                <Shield className="w-3 h-3 mr-0.5" />
                Controlado
              </Badge>
            )}
          </div>
          <span className="text-xs text-neutral-500">{row.dosage} | Cant: {row.quantity}</span>
        </div>
      ),
    },
    {
      key: 'prescriber',
      header: 'Prescriptor',
      render: (row) => <span className="text-neutral-600 text-xs">{row.prescriber}</span>,
    },
    {
      key: 'date',
      header: 'Fecha/Hora',
      sortable: true,
      width: '140px',
      render: (row) => <span className="text-neutral-500 text-xs">{row.date}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      width: '130px',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      width: '110px',
      align: 'right',
      render: (row) =>
        row.status === 'por_dispensar' ? (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            onClick={() => handleDispense(row)}
          >
            Dispensar
          </Button>
        ) : (
          <span className="text-xs text-neutral-400">Completado</span>
        ),
    },
  ];

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
          <Button variant="outline" size="sm" leftIcon={<Package className="w-4 h-4" />}>
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
          title="Pendientes de Dispensar"
          value={pendientes}
          change="Requieren atencion"
          changeType="negative"
          icon={<Clock className="w-5 h-5" />}
          iconColor="bg-yellow-50 text-yellow-500"
        />
        <KpiCard
          title="Dispensadas Hoy"
          value={dispensadas}
          change="+8% vs ayer"
          changeType="positive"
          icon={<CheckCircle2 className="w-5 h-5" />}
          iconColor="bg-green-50 text-green-500"
        />
        <KpiCard
          title="Alertas Activas"
          value={conAlertas}
          change="Alergias o interacciones"
          changeType="negative"
          icon={<AlertTriangle className="w-5 h-5" />}
          iconColor="bg-red-50 text-red-500"
        />
        <KpiCard
          title="Sustancias Controladas"
          value={controladas}
          change="Dispensadas hoy"
          changeType="neutral"
          icon={<Shield className="w-5 h-5" />}
          iconColor="bg-purple-50 text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prescription Queue */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="p-4 border-b border-neutral-100">
              <h2 className="section-title">Cola de Prescripciones</h2>
            </div>
            <DataTable
              columns={columns}
              data={mockPrescriptions}
              keyExtractor={(row) => row.id}
              pageSize={10}
              searchable
              searchPlaceholder="Buscar por receta, paciente o medicamento..."
              emptyMessage="No hay prescripciones pendientes."
              className="p-4"
            />
          </Card>
        </div>

        {/* Sidebar: Alerts + Summary */}
        <div className="space-y-4">
          {/* Stock Alerts */}
          <Card>
            <CardHeader
              title="Alertas de Inventario"
              subtitle={`${stockAlerts.length} alertas activas`}
            />
            <div className="space-y-3">
              {stockAlerts.map((alert) => {
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
                const config = severityConfig[alert.severity];

                return (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border ${config.bg} ${config.border}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {alert.severity === 'vencimiento' ? (
                          <Calendar className={`w-4 h-4 ${config.icon}`} />
                        ) : (
                          <Package className={`w-4 h-4 ${config.icon}`} />
                        )}
                        <span className="text-sm font-medium text-neutral-900">
                          {alert.product}
                        </span>
                      </div>
                      <Badge variant={config.badge} size="sm">
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-600 ml-6">{alert.detail}</p>
                    {alert.severity !== 'vencimiento' && (
                      <div className="mt-2 ml-6">
                        <div className="flex items-center justify-between text-2xs text-neutral-500 mb-1">
                          <span>
                            Stock: {alert.stock} {alert.unit}
                          </span>
                          <span>Reorden: {alert.reorderLevel}</span>
                        </div>
                        <div className="w-full bg-neutral-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              alert.severity === 'critico' ? 'bg-red-500' : 'bg-yellow-500'
                            }`}
                            style={{
                              width: `${Math.min((alert.stock / alert.reorderLevel) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

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
                  label: 'Total Dispensaciones',
                  value: '24',
                  icon: Pill,
                  color: 'text-green-600',
                },
                {
                  label: 'Prescripciones Pendientes',
                  value: String(pendientes),
                  icon: Clock,
                  color: 'text-yellow-600',
                },
                {
                  label: 'Sustancias Controladas',
                  value: '2',
                  icon: Shield,
                  color: 'text-purple-600',
                },
                {
                  label: 'Lotes por Vencer (30d)',
                  value: '5',
                  icon: Calendar,
                  color: 'text-orange-600',
                },
                {
                  label: 'Alertas Resueltas',
                  value: '3',
                  icon: CheckCircle2,
                  color: 'text-green-600',
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
        onClose={() => setShowDispenseModal(false)}
        title="Confirmar Dispensacion"
        description={
          selectedRx
            ? `${selectedRx.medication} para ${selectedRx.patient}`
            : ''
        }
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDispenseModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowDispenseModal(false)}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirmar Dispensacion
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
                <span className="font-mono font-medium">{selectedRx.rxNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Medicamento:</span>
                <span className="font-medium">{selectedRx.medication}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Posologia:</span>
                <span>{selectedRx.dosage}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Cantidad:</span>
                <span className="font-medium">{selectedRx.quantity} unidades</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Prescriptor:</span>
                <span>{selectedRx.prescriber}</span>
              </div>
            </div>

            {/* Alerts */}
            {selectedRx.alerts.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-700 font-medium">
                  Alerta: Paciente con alergia registrada. Verificar antes de dispensar.
                </span>
              </div>
            )}

            {selectedRx.controlled && (
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
                <Shield className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <span className="text-xs text-purple-700 font-medium">
                  Sustancia controlada: Requiere registro en libro de estupefacientes.
                </span>
              </div>
            )}

            {/* Dispensing details */}
            <Input
              label="Lote"
              placeholder="Numero de lote del medicamento"
              required
              leftIcon={<Search className="w-4 h-4" />}
            />
            <Input label="Fecha de Vencimiento del Lote" type="date" required />
            <Input
              label="Cantidad a Dispensar"
              type="number"
              placeholder={String(selectedRx.quantity)}
              required
            />
            <Select
              label="Farmaceutico Responsable"
              required
              options={[
                { value: 'farm1', label: 'Lic. Rosa Mejia' },
                { value: 'farm2', label: 'Lic. Pedro Castillo' },
              ]}
              placeholder="Seleccionar farmaceutico"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
