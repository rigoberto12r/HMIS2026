'use client';

import { useState } from 'react';
import { Card, KpiCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/badge';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────

interface CashTransaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  payment_method: string;
  reference: string;
  description: string;
  created_at: string;
  created_by_name?: string;
}

interface CashierSession {
  id: string;
  opened_at: string;
  closed_at?: string;
  opening_balance: number;
  closing_balance?: number;
  total_income: number;
  total_expenses: number;
  status: 'open' | 'closed';
  transactions: CashTransaction[];
}

interface CashierStats {
  total_income: number;
  total_expenses: number;
  net_balance: number;
  cash_count: number;
  card_count: number;
  transfer_count: number;
}

// ─── Hooks ──────────────────────────────────────────────

function useCashierSession() {
  return useQuery({
    queryKey: ['cashier', 'session'],
    queryFn: async () => {
      // Mock data - replace with real API call
      const mockSession: CashierSession = {
        id: '1',
        opened_at: new Date().toISOString(),
        opening_balance: 5000,
        total_income: 45800,
        total_expenses: 12300,
        status: 'open',
        transactions: generateMockTransactions(),
      };
      return mockSession;
    },
  });
}

function generateMockTransactions(): CashTransaction[] {
  const types: ('income' | 'expense')[] = ['income', 'income', 'income', 'expense'];
  const methods = ['cash', 'card', 'transfer'];
  const descriptions = [
    'Consulta médica',
    'Laboratorio',
    'Medicamentos',
    'Compra de insumos',
    'Pago a proveedor',
  ];

  return Array.from({ length: 15 }, (_, i) => ({
    id: `txn-${i}`,
    type: types[Math.floor(Math.random() * types.length)],
    amount: Math.floor(Math.random() * 5000) + 500,
    payment_method: methods[Math.floor(Math.random() * methods.length)],
    reference: `REF-${Math.random().toString(36).substring(7).toUpperCase()}`,
    description: descriptions[Math.floor(Math.random() * descriptions.length)],
    created_at: new Date(Date.now() - Math.random() * 8 * 60 * 60 * 1000).toISOString(),
    created_by_name: 'Usuario Demo',
  }));
}

function generateHourlyData() {
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM
  return hours.map((hour) => ({
    hour: `${hour}:00`,
    ingresos: Math.floor(Math.random() * 8000) + 2000,
    egresos: Math.floor(Math.random() * 3000) + 500,
  }));
}

// ─── Component ──────────────────────────────────────────

const formatRD = (amount: number) =>
  `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
};

export default function CashierPage() {
  const [showCloseModal, setShowCloseModal] = useState(false);
  const { data: session, isLoading } = useCashierSession();

  const stats: CashierStats = {
    total_income: session?.total_income || 0,
    total_expenses: session?.total_expenses || 0,
    net_balance: (session?.total_income || 0) - (session?.total_expenses || 0),
    cash_count: session?.transactions.filter((t) => t.payment_method === 'cash').length || 0,
    card_count: session?.transactions.filter((t) => t.payment_method === 'card').length || 0,
    transfer_count:
      session?.transactions.filter((t) => t.payment_method === 'transfer').length || 0,
  };

  const hourlyData = generateHourlyData();

  const columns: Column<CashTransaction>[] = [
    {
      key: 'created_at',
      header: 'Hora',
      render: (txn) => formatTime(txn.created_at),
    },
    {
      key: 'reference',
      header: 'Referencia',
      render: (txn) => (
        <span className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
          {txn.reference}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Descripción',
      render: (txn) => txn.description,
    },
    {
      key: 'payment_method',
      header: 'Método',
      render: (txn) => (
        <StatusBadge
          status={
            txn.payment_method === 'cash'
              ? 'Efectivo'
              : txn.payment_method === 'card'
              ? 'Tarjeta'
              : 'Transferencia'
          }
        />
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (txn) =>
        txn.type === 'income' ? (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <TrendingUp className="w-4 h-4" />
            Ingreso
          </span>
        ) : (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <TrendingDown className="w-4 h-4" />
            Egreso
          </span>
        ),
    },
    {
      key: 'amount',
      header: 'Monto',
      render: (txn) => (
        <span className={txn.type === 'income' ? 'text-green-600' : 'text-red-600'}>
          {txn.type === 'income' ? '+' : '-'}
          {formatRD(txn.amount)}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">Cargando caja...</Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Caja</h1>
          <p className="text-neutral-500">
            Monitoreo de ingresos y egresos del día -{' '}
            {new Date().toLocaleDateString('es-DO', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-2">
          {session?.status === 'open' ? (
            <>
              <Button variant="outline">
                <Wallet className="w-4 h-4 mr-2" />
                Nueva Transacción
              </Button>
              <Button variant="danger" onClick={() => setShowCloseModal(true)}>
                <XCircle className="w-4 h-4 mr-2" />
                Cerrar Caja
              </Button>
            </>
          ) : (
            <Button>
              <CheckCircle className="w-4 h-4 mr-2" />
              Abrir Caja
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {session?.status === 'open' && (
        <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">
                  Caja Abierta
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Abierta a las {formatTime(session.opened_at)} - Saldo Inicial:{' '}
                  {formatRD(session.opening_balance)}
                </p>
              </div>
            </div>
            <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
        </Card>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Ingresos del Día"
          value={formatRD(stats.total_income)}
          icon={TrendingUp}
          variant="success"
          loading={isLoading}
        />
        <KpiCard
          title="Egresos del Día"
          value={formatRD(stats.total_expenses)}
          icon={TrendingDown}
          variant="danger"
          loading={isLoading}
        />
        <KpiCard
          title="Saldo Neto"
          value={formatRD(stats.net_balance)}
          icon={DollarSign}
          variant="default"
          loading={isLoading}
        />
        <KpiCard
          title="Transacciones"
          value={session?.transactions.length.toString() || '0'}
          icon={Wallet}
          variant="primary"
          loading={isLoading}
        />
      </div>

      {/* Payment Methods Breakdown */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Desglose por Método de Pago</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Efectivo</p>
              <p className="text-2xl font-bold">{stats.cash_count} transacciones</p>
            </div>
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Tarjeta</p>
              <p className="text-2xl font-bold">{stats.card_count} transacciones</p>
            </div>
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                Transferencia
              </p>
              <p className="text-2xl font-bold">{stats.transfer_count} transacciones</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Hourly Income Chart */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Ingresos y Egresos por Hora</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(0,0,0,0.1)"
                  className="dark:stroke-white/10"
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  className="text-neutral-500"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  className="text-neutral-500"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white dark:bg-neutral-800 p-3 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700">
                        <p className="text-xs text-neutral-500 mb-2">{label}</p>
                        {payload.map((entry, i) => (
                          <div key={i} className="flex items-center justify-between gap-4 mb-1">
                            <span className="text-xs" style={{ color: entry.color }}>
                              {entry.name}:
                            </span>
                            <span className="text-sm font-semibold">
                              RD$ {entry.value?.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  iconType="circle"
                />
                <Bar dataKey="ingresos" name="Ingresos" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="egresos" name="Egresos" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Transacciones del Día</h2>
          <DataTable
            data={session?.transactions || []}
            columns={columns}
            keyExtractor={(txn) => txn.id}
            loading={isLoading}
            emptyMessage="No hay transacciones registradas hoy"
          />
        </div>
      </Card>
    </div>
  );
}
