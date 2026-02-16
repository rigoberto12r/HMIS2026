'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FlaskConical,
  CheckCircle,
  XCircle,
  RotateCcw,
  Search,
  Filter,
  Eye,
  Calendar,
} from 'lucide-react';
import { useLabOrders, useValidateResult } from '@/hooks/useLaboratory';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LabOrder } from '@/types/laboratory';

export default function ResultsValidationPage() {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showAbnormalOnly, setShowAbnormalOnly] = useState(false);
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [validationModal, setValidationModal] = useState<{
    orderTestId: string;
    testName: string;
    patientName: string;
    value: string;
  } | null>(null);

  const { data: ordersData, isLoading } = useLabOrders({
    status: 'in_process',
    page: 1,
    page_size: 100,
  });

  const validateMutation = useValidateResult();

  const orders = ordersData?.items ?? [];

  const filteredOrders = orders.filter((order) => {
    const hasTests = order.tests && order.tests.length > 0;
    if (!hasTests) return false;

    if (showAbnormalOnly && !order.tests?.some((t) => t.is_abnormal)) return false;
    if (showCriticalOnly && !order.tests?.some((t) => t.is_critical)) return false;

    return order.tests?.some((t) => t.status === 'preliminary') ?? false;
  });

  const handleValidate = async (orderTestId: string, action: 'approve' | 'reject' | 'rerun', notes?: string) => {
    try {
      await validateMutation.mutateAsync({
        order_test_id: orderTestId,
        validated: action === 'approve',
        notes,
      });
      setValidationModal(null);
    } catch (error) {
      console.error('Failed to validate result:', error);
    }
  };

  const handleBatchValidate = async () => {
    for (const orderId of selectedOrders) {
      const order = orders.find((o) => o.id === orderId);
      if (!order?.tests) continue;

      for (const test of order.tests) {
        if (test.status === 'preliminary') {
          await validateMutation.mutateAsync({
            order_test_id: test.id,
            validated: true,
          });
        }
      }
    }
    setSelectedOrders(new Set());
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-DO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className="-m-4 lg:-m-6 p-4 lg:p-6 min-h-screen"
      style={{ background: `rgb(var(--hos-bg-primary))` }}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
              <FlaskConical className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Validación de Resultados</h1>
              <p className="text-sm text-white/50">Revisión y aprobación de resultados preliminares</p>
            </div>
          </div>

          {selectedOrders.size > 0 && (
            <Button
              variant="primary"
              onClick={handleBatchValidate}
              isLoading={validateMutation.isPending}
              leftIcon={<CheckCircle className="w-4 h-4" />}
            >
              Validar Seleccionados ({selectedOrders.size})
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por paciente, orden, o prueba..."
              className="w-full h-11 pl-11 pr-4 rounded-lg border border-white/[0.06] bg-white/[0.03] text-white placeholder:text-white/30 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <Search className="absolute left-3 top-3 w-5 h-5 text-white/40" />
          </div>

          <button
            onClick={() => setShowAbnormalOnly(!showAbnormalOnly)}
            className={cn(
              'h-11 px-4 rounded-lg border text-sm font-medium transition-colors',
              showAbnormalOnly
                ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                : 'border-white/[0.06] bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'
            )}
          >
            Solo Anormales
          </button>

          <button
            onClick={() => setShowCriticalOnly(!showCriticalOnly)}
            className={cn(
              'h-11 px-4 rounded-lg border text-sm font-medium transition-colors',
              showCriticalOnly
                ? 'border-red-500 bg-red-500/10 text-red-400'
                : 'border-white/[0.06] bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'
            )}
          >
            Solo Críticos
          </button>
        </div>

        <div className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ background: `rgba(var(--hos-bg-card))` }}>
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white/50" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Sin resultados pendientes</h3>
              <p className="text-white/50">No hay resultados preliminares para validar</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-white/[0.02] border-b border-white/[0.06]">
                <tr>
                  <th className="px-5 py-3 text-left">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrders(new Set(filteredOrders.map((o) => o.id)));
                        } else {
                          setSelectedOrders(new Set());
                        }
                      }}
                      className="w-4 h-4 rounded border-white/[0.06] bg-white/[0.03] text-primary-500"
                    />
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase">
                    Orden #
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase">
                    Paciente
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase">
                    Prueba
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase">
                    Resultado
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase">
                    Fecha
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredOrders.map((order, index) =>
                  order.tests
                    ?.filter((t) => t.status === 'preliminary')
                    .map((test) => (
                      <motion.tr
                        key={test.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className="hover:bg-white/[0.02]"
                      >
                        <td className="px-5 py-4">
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(order.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedOrders);
                              if (e.target.checked) {
                                newSet.add(order.id);
                              } else {
                                newSet.delete(order.id);
                              }
                              setSelectedOrders(newSet);
                            }}
                            className="w-4 h-4 rounded border-white/[0.06] bg-white/[0.03] text-primary-500"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm font-medium text-white">{order.order_number}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-medium text-white">{order.patient_name}</p>
                            <p className="text-xs text-white/40">{order.patient_mrn}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white/70">{test.test?.name}</span>
                            {test.is_critical && (
                              <Badge variant="danger" size="sm">
                                CRÍTICO
                              </Badge>
                            )}
                            {test.is_abnormal && !test.is_critical && (
                              <Badge variant="warning" size="sm">
                                ANORMAL
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {test.result_value} {test.units}
                            </p>
                            <p className="text-xs text-white/40">{test.normal_range}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm text-white/70">{formatDate(order.ordered_at)}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setValidationModal({
                                  orderTestId: test.id,
                                  testName: test.test?.name || '',
                                  patientName: order.patient_name || '',
                                  value: `${test.result_value} ${test.units}`,
                                })
                              }
                              leftIcon={<Eye className="w-4 h-4" />}
                            >
                              Revisar
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {validationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="w-full max-w-lg rounded-xl border border-white/[0.06] shadow-2xl"
            style={{ background: `rgba(var(--hos-bg-card))` }}
          >
            <div className="p-5 border-b border-white/[0.06]">
              <h2 className="text-lg font-semibold text-white">Validar Resultado</h2>
              <p className="text-sm text-white/50 mt-0.5">
                {validationModal.patientName} - {validationModal.testName}
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <p className="text-xs text-white/40 mb-1">Resultado</p>
                <p className="text-2xl font-bold text-white">{validationModal.value}</p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="success"
                  className="flex-1"
                  onClick={() => handleValidate(validationModal.orderTestId, 'approve')}
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                >
                  Aprobar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleValidate(validationModal.orderTestId, 'rerun', 'Solicitar repetición')}
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                >
                  Repetir
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleValidate(validationModal.orderTestId, 'reject', 'Resultado rechazado')}
                  leftIcon={<XCircle className="w-4 h-4" />}
                >
                  Rechazar
                </Button>
              </div>

              <Button variant="ghost" className="w-full" onClick={() => setValidationModal(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
