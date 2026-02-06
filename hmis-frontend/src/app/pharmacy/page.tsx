'use client';

import { Card, CardHeader, KpiCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import {
  Pill,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Package,
  ShieldAlert,
  Timer,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

// ─── Types ──────────────────────────────────────────────

interface Prescription {
  id: string;
  patient: string;
  medication: string;
  dosage: string;
  quantity: number;
  prescriber: string;
  status: string;
  hasAlert: boolean;
  alertMessage?: string;
  date: string;
}

interface StockAlert {
  product: string;
  type: 'bajo' | 'critico' | 'vencimiento';
  stock?: number;
  reorder?: number;
  expiry?: string;
  quantity?: number;
}

// ─── Mock Data ──────────────────────────────────────────

const prescriptionQueue: Prescription[] = [
  {
    id: 'RX-001',
    patient: 'Juan Perez',
    medication: 'Ibuprofeno 400mg',
    dosage: 'c/8h x 5 dias',
    quantity: 15,
    prescriber: 'Dr. Martinez',
    status: 'por_dispensar',
    hasAlert: false,
    date: '06/02/2026 09:15',
  },
  {
    id: 'RX-002',
    patient: 'Maria Rodriguez',
    medication: 'Losartan 50mg',
    dosage: 'c/24h continuo',
    quantity: 30,
    prescriber: 'Dr. Martinez',
    status: 'por_dispensar',
    hasAlert: false,
    date: '06/02/2026 09:00',
  },
  {
    id: 'RX-003',
    patient: 'Carlos Gomez',
    medication: 'Amoxicilina 500mg',
    dosage: 'c/8h x 7 dias',
    quantity: 21,
    prescriber: 'Dra. Lopez',
    status: 'por_dispensar',
    hasAlert: true,
    alertMessage: 'Paciente reporta alergia a Penicilina - verificar',
    date: '06/02/2026 09:30',
  },
  {
    id: 'RX-004',
    patient: 'Ana Gonzalez',
    medication: 'Metformina 850mg',
    dosage: 'c/12h continuo',
    quantity: 60,
    prescriber: 'Dr. Martinez',
    status: 'dispensada',
    hasAlert: false,
    date: '06/02/2026 08:45',
  },
  {
    id: 'RX-005',
    patient: 'Pedro Sanchez',
    medication: 'Insulina NPH 100UI/mL',
    dosage: '20 UI SC c/12h',
    quantity: 2,
    prescriber: 'Dra. Lopez',
    status: 'por_dispensar',
    hasAlert: false,
    date: '06/02/2026 10:00',
  },
];

const stockAlerts: StockAlert[] = [
  { product: 'Omeprazol 20mg', type: 'critico', stock: 12, reorder: 50 },
  { product: 'Amoxicilina 500mg', type: 'bajo', stock: 45, reorder: 100 },
  { product: 'Insulina NPH 100UI', type: 'vencimiento', expiry: '15/03/2026', quantity: 8 },
  { product: 'Diclofenaco 75mg Amp', type: 'bajo', stock: 28, reorder: 60 },
  { product: 'Ceftriaxona 1g', type: 'critico', stock: 5, reorder: 30 },
];

const daySummary = [
  { label: 'Dispensaciones realizadas', value: '24' },
  { label: 'Prescripciones pendientes', value: '4' },
  { label: 'Sustancias controladas', value: '2' },
  { label: 'Lotes por vencer (30d)', value: '5' },
  { label: 'Devoluciones', value: '1' },
];

const alertTypeConfig: Record<string, { bg: string; border: string; text: string; label: string }> = {
  critico: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Critico' },
  bajo: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', label: 'Bajo' },
  vencimiento: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', label: 'Vencimiento' },
};

// ─── Page ───────────────────────────────────────────────

export default function PharmacyPage() {
  const pending = prescriptionQueue.filter((rx) => rx.status === 'por_dispensar').length;
  const dispensed = prescriptionQueue.filter((rx) => rx.status === 'dispensada').length;
  const alerts = prescriptionQueue.filter((rx) => rx.hasAlert).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Farmacia</h1>
          <p className="page-subtitle">Dispensacion de medicamentos e inventario</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Inventario
          </Button>
          <Button variant="outline" size="sm">
            Ordenes de Compra
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          title="Por Dispensar"
          value={pending}
          icon={<Clock className="w-5 h-5" />}
          iconColor="bg-yellow-50 text-yellow-500"
        />
        <KpiCard
          title="Dispensadas Hoy"
          value={dispensed + 23}
          icon={<CheckCircle2 className="w-5 h-5" />}
          iconColor="bg-green-50 text-green-500"
        />
        <KpiCard
          title="Alertas Inventario"
          value={stockAlerts.length}
          change={`${stockAlerts.filter((a) => a.type === 'critico').length} criticas`}
          changeType="negative"
          icon={<AlertTriangle className="w-5 h-5" />}
          iconColor="bg-red-50 text-red-500"
        />
        <KpiCard
          title="Alertas Clinicas"
          value={alerts}
          change="Requieren revision"
          changeType="negative"
          icon={<ShieldAlert className="w-5 h-5" />}
          iconColor="bg-orange-50 text-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prescription Queue */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader
              title="Cola de Prescripciones"
              subtitle={`${pending} pendientes de dispensacion`}
              action={
                <div className="w-64">
                  <Input
                    placeholder="Buscar prescripcion..."
                    leftIcon={<Search className="w-4 h-4" />}
                  />
                </div>
              }
            />
            <div className="space-y-3">
              {prescriptionQueue.map((rx) => (
                <div
                  key={rx.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    rx.hasAlert
                      ? 'border-red-200 bg-red-50'
                      : rx.status === 'dispensada'
                        ? 'border-green-200 bg-green-50/30'
                        : 'border-neutral-200 hover:border-primary-200 hover:bg-primary-50/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-neutral-500">{rx.id}</span>
                        <StatusBadge status={rx.status} />
                        {rx.hasAlert && (
                          <Badge variant="danger" size="sm">
                            <AlertTriangle className="w-3 h-3" />
                            ALERTA
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <Pill className="w-4 h-4 text-secondary-500" />
                        <span className="font-semibold text-neutral-900">{rx.medication}</span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">
                        <span className="font-medium">{rx.patient}</span>
                        <span className="mx-1.5">|</span>
                        {rx.dosage}
                        <span className="mx-1.5">|</span>
                        Cant: {rx.quantity}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        Prescrito por: {rx.prescriber}
                        <span className="mx-1.5">|</span>
                        <Timer className="w-3 h-3 inline" /> {rx.date}
                      </p>

                      {rx.hasAlert && rx.alertMessage && (
                        <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700 font-medium flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          {rx.alertMessage}
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {rx.status === 'por_dispensar' ? (
                        <Button variant="secondary" size="sm">
                          Dispensar
                        </Button>
                      ) : (
                        <Badge variant="success" size="md" dot>
                          Dispensado
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column: Alerts & Summary */}
        <div className="space-y-4">
          {/* Stock Alerts */}
          <Card>
            <CardHeader title="Alertas de Inventario" />
            <div className="space-y-2.5">
              {stockAlerts.map((alert, idx) => {
                const config = alertTypeConfig[alert.type];
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${config.bg} ${config.border}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`text-sm font-medium ${config.text}`}>{alert.product}</p>
                        {alert.type === 'vencimiento' ? (
                          <p className="text-xs text-orange-600 mt-0.5">
                            Vence: {alert.expiry} | {alert.quantity} unidades
                          </p>
                        ) : (
                          <p className={`text-xs mt-0.5 ${config.text}`}>
                            Stock: {alert.stock} | Punto de reorden: {alert.reorder}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={alert.type === 'critico' ? 'danger' : 'warning'}
                        size="sm"
                      >
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Day Summary */}
          <Card>
            <CardHeader title="Resumen del Dia" />
            <div className="space-y-2">
              {daySummary.map(({ label, value }) => (
                <div
                  key={label}
                  className="flex justify-between items-center p-2.5 bg-neutral-50 rounded-lg"
                >
                  <span className="text-sm text-neutral-600">{label}</span>
                  <span className="font-semibold text-neutral-900 text-sm">{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
