'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Bell,
  Phone,
  MessageSquare,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useCriticalValues, useAcknowledgeCriticalValue } from '@/hooks/useLaboratory';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function CriticalValuesPage() {
  const [notifyModal, setNotifyModal] = useState<{
    orderTestId: string;
    testName: string;
    value: string;
    patientName: string;
  } | null>(null);

  const { data: criticalData, isLoading } = useCriticalValues({
    refetchInterval: 10000,
  });

  const acknowledgeMutation = useAcknowledgeCriticalValue();

  const criticalOrders = criticalData?.items ?? [];

  const pendingCount = criticalOrders.filter((o) =>
    o.tests?.some((t) => t.is_critical && !t.validated_at)
  ).length;

  const notifiedToday = criticalOrders.filter((o) =>
    o.tests?.some((t) => {
      if (!t.validated_at) return false;
      const today = new Date().toDateString();
      return new Date(t.validated_at).toDateString() === today;
    })
  ).length;

  const handleNotify = async (orderTestId: string, method: 'phone' | 'sms' | 'in_app') => {
    try {
      await acknowledgeMutation.mutateAsync({
        orderTestId,
        notes: `Notificado vía ${method}`,
      });
      setNotifyModal(null);
    } catch (error) {
      console.error('Failed to acknowledge critical value:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-DO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeSince = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <div
      className="-m-4 lg:-m-6 p-4 lg:p-6 min-h-screen"
      style={{ background: `rgb(var(--hos-bg-primary))` }}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/25">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Valores Críticos</h1>
            <p className="text-sm text-white/50">Monitoreo y notificación de valores críticos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl border border-red-500/20 bg-red-500/5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase mb-1">
                  Pendientes de Notificar
                </p>
                <p className="text-3xl font-bold text-red-400">{pendingCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-white/[0.06]" style={{ background: `rgba(var(--hos-bg-card))` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase mb-1">
                  Notificados Hoy
                </p>
                <p className="text-3xl font-bold text-white">{notifiedToday}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Bell className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-white/[0.06]" style={{ background: `rgba(var(--hos-bg-card))` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase mb-1">
                  Tiempo Promedio
                </p>
                <p className="text-3xl font-bold text-white">12m</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ background: `rgba(var(--hos-bg-card))` }}>
          <div className="p-5 border-b border-white/[0.06]">
            <h2 className="text-lg font-semibold text-white">Valores Críticos Activos</h2>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white/50" />
            </div>
          ) : criticalOrders.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Sin valores críticos</h3>
              <p className="text-white/50">No hay valores críticos pendientes de notificación</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/[0.02] border-b border-white/[0.06]">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase">
                      Orden
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase">
                      Paciente
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase">
                      Prueba
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase">
                      Valor
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase">
                      Detectado
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase">
                      Estado
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {criticalOrders.map((order, index) =>
                    order.tests
                      ?.filter((t) => t.is_critical)
                      .map((test) => {
                        const isNotified = !!test.validated_at;

                        return (
                          <motion.tr
                            key={test.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.03 }}
                            className={cn(
                              'hover:bg-white/[0.02]',
                              !isNotified && 'bg-red-500/5'
                            )}
                          >
                            <td className="px-5 py-4">
                              <span className="text-sm font-medium text-white">
                                {order.order_number}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {order.patient_name}
                                </p>
                                <p className="text-xs text-white/40">{order.patient_mrn}</p>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-sm text-white/70">{test.test?.name}</span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-400" />
                                <span className="text-sm font-bold text-red-400">
                                  {test.result_value} {test.units}
                                </span>
                              </div>
                              <p className="text-xs text-white/40 mt-0.5">
                                Ref: {test.normal_range}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-xs">
                                <p className="text-white/70">{formatDate(order.ordered_at)}</p>
                                <p className="text-white/40">{getTimeSince(order.ordered_at)} ago</p>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              {isNotified ? (
                                <Badge variant="success" size="sm">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Notificado
                                </Badge>
                              ) : (
                                <Badge variant="danger" size="sm">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pendiente
                                </Badge>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {!isNotified && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() =>
                                    setNotifyModal({
                                      orderTestId: test.id,
                                      testName: test.test?.name || '',
                                      value: `${test.result_value} ${test.units}`,
                                      patientName: order.patient_name || '',
                                    })
                                  }
                                  leftIcon={<Bell className="w-4 h-4" />}
                                >
                                  Notificar
                                </Button>
                              )}
                            </td>
                          </motion.tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {notifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-xl border border-white/[0.06] shadow-2xl"
            style={{ background: `rgba(var(--hos-bg-card))` }}
          >
            <div className="p-5 border-b border-white/[0.06] bg-red-500/5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Notificar Valor Crítico</h2>
                  <p className="text-sm text-white/50 mt-0.5">{notifyModal.patientName}</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400/70 mb-1">Valor Crítico</p>
                <p className="text-xl font-bold text-red-400">
                  {notifyModal.testName}: {notifyModal.value}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-white/70 mb-3">Método de Notificación:</p>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleNotify(notifyModal.orderTestId, 'phone')}
                    leftIcon={<Phone className="w-4 h-4" />}
                  >
                    Llamada Telefónica
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleNotify(notifyModal.orderTestId, 'sms')}
                    leftIcon={<MessageSquare className="w-4 h-4" />}
                  >
                    Mensaje de Texto (SMS)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleNotify(notifyModal.orderTestId, 'in_app')}
                    leftIcon={<Bell className="w-4 h-4" />}
                  >
                    Notificación In-App
                  </Button>
                </div>
              </div>

              <Button variant="ghost" className="w-full" onClick={() => setNotifyModal(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
