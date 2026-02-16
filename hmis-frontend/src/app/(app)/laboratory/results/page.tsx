'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FlaskConical,
  AlertCircle,
  Clock,
  User,
  FileText,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';
import { useLabOrders } from '@/hooks/useLaboratory';
import { ResultEntryForm } from '@/components/laboratory/ResultEntryForm';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LabOrder, LabPriority } from '@/types/laboratory';

export default function ResultsEntryPage() {
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [selectedTestIndex, setSelectedTestIndex] = useState(0);

  const { data: ordersData, isLoading } = useLabOrders({
    status: 'received',
    page: 1,
    page_size: 100,
  });

  const pendingOrders = ordersData?.items ?? [];

  const sortedOrders = [...pendingOrders].sort((a, b) => {
    const priorityOrder = { stat: 0, urgent: 1, routine: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  useEffect(() => {
    let cancelled = false;

    if (sortedOrders.length > 0 && !selectedOrder && !cancelled) {
      setSelectedOrder(sortedOrders[0]);
    }

    return () => {
      cancelled = true;
    };
  }, [sortedOrders, selectedOrder]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
      }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        loadNextPendingOrder();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrder, sortedOrders]);

  const loadNextPendingOrder = () => {
    if (!selectedOrder) return;
    const currentIndex = sortedOrders.findIndex((o) => o.id === selectedOrder.id);
    const nextOrder = sortedOrders[currentIndex + 1];
    if (nextOrder) {
      setSelectedOrder(nextOrder);
      setSelectedTestIndex(0);
    }
  };

  const priorityConfig: Record<LabPriority, { label: string; variant: 'danger' | 'warning' | 'info' }> = {
    stat: { label: 'STAT', variant: 'danger' },
    urgent: { label: 'Urgente', variant: 'warning' },
    routine: { label: 'Rutina', variant: 'info' },
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const currentTest = selectedOrder?.tests?.[selectedTestIndex];

  return (
    <div
      className="-m-4 lg:-m-6 min-h-[calc(100vh-4rem)] flex"
      style={{ background: `rgb(var(--hos-bg-primary))` }}
    >
      <div className="w-[30%] border-r border-white/[0.06] flex flex-col" style={{ background: `rgba(var(--hos-bg-card))` }}>
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Órdenes Pendientes</h2>
              <p className="text-xs text-white/40">{sortedOrders.length} órdenes</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-white/50">STAT</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-white/50">Urgente</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-white/50">Rutina</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white/50" />
            </div>
          ) : sortedOrders.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No hay órdenes pendientes</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {sortedOrders.map((order, index) => {
                const isSelected = selectedOrder?.id === order.id;
                const priorityData = priorityConfig[order.priority];

                return (
                  <motion.button
                    key={order.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => {
                      setSelectedOrder(order);
                      setSelectedTestIndex(0);
                    }}
                    className={cn(
                      'w-full p-4 text-left transition-colors relative',
                      isSelected
                        ? 'bg-primary-500/10 border-l-2 border-primary-500'
                        : 'hover:bg-white/[0.02]'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white truncate">
                            {order.patient_name}
                          </span>
                        </div>
                        <p className="text-xs text-white/40">#{order.order_number}</p>
                      </div>
                      <Badge variant={priorityData.variant} size="sm">
                        {priorityData.label}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/50">
                        {order.tests?.length} prueba(s)
                      </span>
                      <span className="text-white/40">
                        {formatTime(order.ordered_at)}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <ChevronRight className="w-4 h-4 text-primary-400" />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/[0.06] bg-white/[0.02]">
          <p className="text-xs text-white/40 text-center">
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-white/50 bg-white/[0.06] border border-white/[0.06] rounded">
              Ctrl
            </kbd>{' '}
            +{' '}
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-white/50 bg-white/[0.06] border border-white/[0.06] rounded">
              N
            </kbd>{' '}
            para siguiente orden
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedOrder && currentTest ? (
          <div className="p-6">
            <div className="max-w-3xl mx-auto">
              <div className="mb-6 p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-white mb-1">
                      Ingreso de Resultados
                    </h1>
                    <p className="text-sm text-white/50">Orden #{selectedOrder.order_number}</p>
                  </div>
                  <Badge variant={priorityConfig[selectedOrder.priority].variant}>
                    {priorityConfig[selectedOrder.priority].label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-white/70">
                    <User className="w-4 h-4 text-white/40" />
                    <span>{selectedOrder.patient_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/70">
                    <FileText className="w-4 h-4 text-white/40" />
                    <span>{selectedOrder.patient_mrn}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/70">
                    <Clock className="w-4 h-4 text-white/40" />
                    <span>{formatTime(selectedOrder.ordered_at)}</span>
                  </div>
                  {selectedOrder.clinical_info && (
                    <div className="flex items-center gap-2 text-white/70 col-span-2">
                      <AlertCircle className="w-4 h-4 text-white/40" />
                      <span className="truncate">{selectedOrder.clinical_info}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedOrder.tests && selectedOrder.tests.length > 1 && (
                <div className="mb-6">
                  <p className="text-sm text-white/50 mb-2">Seleccionar prueba:</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedOrder.tests.map((test, idx) => (
                      <button
                        key={test.id}
                        onClick={() => setSelectedTestIndex(idx)}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          selectedTestIndex === idx
                            ? 'bg-primary-500 text-white'
                            : 'bg-white/[0.03] text-white/70 hover:bg-white/[0.06] border border-white/[0.06]'
                        )}
                      >
                        {test.test?.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-white/[0.06] p-6" style={{ background: `rgba(var(--hos-bg-card))` }}>
                <ResultEntryForm
                  key={currentTest.id}
                  orderTestId={currentTest.id}
                  test={currentTest.test!}
                  onSuccess={loadNextPendingOrder}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FlaskConical className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/40">
                Selecciona una orden de la lista para comenzar
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
