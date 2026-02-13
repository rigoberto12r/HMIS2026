/**
 * EMR Orders Page - Medical orders management
 * Shows pending medical orders (lab, imaging, procedures, referrals)
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Search,
  Filter,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  TestTube,
  Scan,
  Stethoscope,
  UserPlus,
  Pill,
  UtensilsCrossed,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface MedicalOrder {
  id: string;
  encounter_id: string;
  patient_id: string;
  patient_name?: string;
  ordered_by: string;
  provider_name?: string;
  order_type: string;
  priority: string;
  details_json: Record<string, any>;
  clinical_indication?: string;
  status: string;
  result_summary?: string;
  completed_at?: string;
  created_at: string;
}

interface Encounter {
  id: string;
  patient_id: string;
  patient_name?: string;
  provider_name?: string;
  status: string;
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<MedicalOrder | null>(null);

  // Fetch active encounters to get orders
  const { data: encountersData, isLoading: loadingEncounters } = useQuery({
    queryKey: ['encounters', 'active'],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: 'active',
        page_size: '100',
      });
      return api.get<{ items: Encounter[] }>(`/emr/encounters?${params.toString()}`);
    },
  });

  // Fetch all orders from active encounters
  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ['medical-orders', encountersData?.items],
    queryFn: async () => {
      if (!encountersData?.items || encountersData.items.length === 0) return [];

      const ordersPromises = encountersData.items.map(async (encounter) => {
        try {
          const orders = await api.get<MedicalOrder[]>(`/emr/encounters/${encounter.id}/orders`);
          const ordersArray = Array.isArray(orders) ? orders : [];

          return ordersArray.map((order) => ({
            ...order,
            patient_name: encounter.patient_name || 'Desconocido',
            provider_name: encounter.provider_name || 'N/A',
          }));
        } catch (error) {
          return [];
        }
      });

      const ordersArrays = await Promise.all(ordersPromises);
      return ordersArrays.flat().sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!encountersData?.items && encountersData.items.length > 0,
  });

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
      result,
    }: {
      orderId: string;
      status: string;
      result?: string;
    }) => {
      return api.patch(`/emr/orders/${orderId}/status`, {
        status,
        result_summary: result || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-orders'] });
      setSelectedOrder(null);
    },
  });

  const isLoading = loadingEncounters || loadingOrders;
  const orders = ordersData || [];

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !searchTerm ||
      order.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.provider_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clinical_indication?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = !selectedType || order.order_type === selectedType;
    const matchesStatus = !selectedStatus || order.status === selectedStatus;
    const matchesPriority = !selectedPriority || order.priority === selectedPriority;

    return matchesSearch && matchesType && matchesStatus && matchesPriority;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getOrderIcon = (type: string) => {
    const icons = {
      lab: TestTube,
      imaging: Scan,
      procedure: Stethoscope,
      referral: UserPlus,
      medication: Pill,
      diet: UtensilsCrossed,
    };
    return icons[type as keyof typeof icons] || ClipboardList;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      cancelled: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
    };
    const labels = {
      pending: 'Pendiente',
      in_progress: 'En Proceso',
      completed: 'Completada',
      cancelled: 'Cancelada',
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[status as keyof typeof styles] || styles.pending}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      stat: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      urgent: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
      routine: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
    };
    const labels = {
      stat: 'STAT',
      urgent: 'Urgente',
      routine: 'Rutina',
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[priority as keyof typeof styles] || styles.routine}`}>
        {labels[priority as keyof typeof labels] || priority}
      </span>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      lab: 'Laboratorio',
      imaging: 'Imagen',
      procedure: 'Procedimiento',
      referral: 'Referencia',
      medication: 'Medicamento',
      diet: 'Dieta',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const handleCompleteOrder = async (result?: string) => {
    if (!selectedOrder) return;
    await updateStatusMutation.mutateAsync({
      orderId: selectedOrder.id,
      status: 'completed',
      result,
    });
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    await updateStatusMutation.mutateAsync({
      orderId: selectedOrder.id,
      status: 'cancelled',
    });
  };

  // Calculate stats
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    inProgress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            Órdenes Médicas
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Gestión de órdenes de laboratorio, imagen y procedimientos
          </p>
        </div>
        <Link
          href="/emr"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a encuentros
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Órdenes</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Pendientes</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.pending}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">En Proceso</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.inProgress}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Completadas</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.completed}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por paciente, médico o indicación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Todos los tipos</option>
            <option value="lab">Laboratorio</option>
            <option value="imaging">Imagen</option>
            <option value="procedure">Procedimiento</option>
            <option value="referral">Referencia</option>
            <option value="medication">Medicamento</option>
            <option value="diet">Dieta</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="in_progress">En Proceso</option>
            <option value="completed">Completadas</option>
            <option value="cancelled">Canceladas</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Todas las prioridades</option>
            <option value="stat">STAT</option>
            <option value="urgent">Urgente</option>
            <option value="routine">Rutina</option>
          </select>
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Cargando órdenes...</p>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-500 dark:text-neutral-400">
              {searchTerm || selectedType || selectedStatus || selectedPriority
                ? 'No se encontraron órdenes con los filtros aplicados'
                : 'No hay órdenes médicas registradas'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Paciente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Indicación
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Prioridad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-700">
                {filteredOrders.map((order) => {
                  const Icon = getOrderIcon(order.order_type);
                  return (
                    <tr key={order.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                          <span className="text-sm font-medium text-neutral-900 dark:text-white">
                            {getTypeLabel(order.order_type)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 dark:text-white">
                        {order.patient_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300 max-w-xs truncate">
                        {order.clinical_indication || order.details_json?.description || 'Sin indicación'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getPriorityBadge(order.priority)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 p-6 z-10">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    Detalles de la Orden
                  </h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    {getTypeLabel(selectedOrder.order_type)} - {selectedOrder.patient_name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Estado</p>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Prioridad</p>
                  <div className="mt-1">{getPriorityBadge(selectedOrder.priority)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Ordenado por</p>
                  <p className="mt-1 text-sm text-neutral-900 dark:text-white">{selectedOrder.provider_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Fecha</p>
                  <p className="mt-1 text-sm text-neutral-900 dark:text-white">
                    {formatDate(selectedOrder.created_at)}
                  </p>
                </div>
              </div>

              {selectedOrder.clinical_indication && (
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    Indicación Clínica
                  </p>
                  <p className="text-sm text-neutral-900 dark:text-white whitespace-pre-wrap">
                    {selectedOrder.clinical_indication}
                  </p>
                </div>
              )}

              {selectedOrder.details_json && Object.keys(selectedOrder.details_json).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                    Detalles
                  </p>
                  <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3 space-y-1">
                    {Object.entries(selectedOrder.details_json).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">{key}:</span>{' '}
                        <span className="text-neutral-900 dark:text-white">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.result_summary && (
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    Resultado
                  </p>
                  <p className="text-sm text-neutral-900 dark:text-white whitespace-pre-wrap">
                    {selectedOrder.result_summary}
                  </p>
                </div>
              )}
            </div>

            {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
              <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 p-4">
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleCancelOrder}
                    disabled={updateStatusMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancelar Orden
                  </button>
                  <button
                    onClick={() => handleCompleteOrder()}
                    disabled={updateStatusMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Marcar Completada
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
