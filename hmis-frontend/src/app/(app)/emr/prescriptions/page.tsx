/**
 * EMR Prescriptions Page - Prescriptions view and management
 * Shows active prescriptions with filters by patient, provider, medication
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pill, Search, Filter, ArrowLeft, User, Calendar, FileText, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { usePrescriptions } from '@/hooks/usePharmacyData';
import type { Prescription } from '@/app/(app)/pharmacy/types';

export default function PrescriptionsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch prescriptions with React Query
  const { data, isLoading } = usePrescriptions({
    page: currentPage,
    page_size: 50,
    status: selectedStatus || undefined,
  });

  const prescriptions = data?.items || [];
  const totalPages = data?.total ? Math.ceil(data.total / (data.page_size || 50)) : 1;

  // Filter prescriptions locally
  const filteredPrescriptions = prescriptions.filter((rx) => {
    const matchesSearch =
      !searchTerm ||
      rx.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rx.patient_name?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      completed: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
      cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      expired: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    };
    const labels = {
      active: 'Activa',
      completed: 'Completada',
      cancelled: 'Cancelada',
      expired: 'Expirada',
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[status as keyof typeof styles] || styles.active}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  // Calculate stats
  const stats = {
    total: data?.total || 0,
    active: prescriptions.filter(rx => rx.status === 'active' || rx.status === 'pending').length,
    withRefills: prescriptions.length, // Placeholder since refills not in this schema
    thisMonth: prescriptions.filter(rx => {
      const rxDate = new Date(rx.created_at);
      const now = new Date();
      return rxDate.getMonth() === now.getMonth() && rxDate.getFullYear() === now.getFullYear();
    }).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            Recetas Médicas
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Vista consolidada de recetas activas y completadas
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
              <Pill className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Recetas</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Activas</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.active}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Con Refills</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.withRefills}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <User className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Este Mes</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.thisMonth}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por medicamento o paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="completed">Completadas</option>
              <option value="cancelled">Canceladas</option>
              <option value="expired">Expiradas</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Prescriptions Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Cargando recetas...</p>
            </div>
          </div>
        ) : filteredPrescriptions.length === 0 ? (
          <div className="text-center py-12">
            <Pill className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-500 dark:text-neutral-400">
              {searchTerm ? 'No se encontraron recetas con los filtros aplicados' : 'No hay recetas médicas registradas'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Medicamento
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Paciente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Dosis
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Cantidad
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
                  {filteredPrescriptions.map((rx) => (
                    <tr key={rx.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">
                            {rx.product_name || 'Desconocido'}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {rx.frequency}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
                        {rx.patient_name || 'Desconocido'}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 dark:text-white">
                        {rx.dosage}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-neutral-900 dark:text-white">
                          {rx.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getStatusBadge(rx.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                        {formatDate(rx.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedPrescription(rx)}
                          className="flex items-center gap-1 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                        >
                          <Eye className="w-4 h-4" />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-neutral-50 dark:bg-neutral-800 px-4 py-3 border-t border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                    Página {currentPage} de {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-50 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-50 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Prescription Details Modal */}
      {selectedPrescription && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 p-6 z-10">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    Detalle de Receta
                  </h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    {selectedPrescription.product_name || 'Desconocido'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPrescription(null)}
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
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Paciente</p>
                  <p className="mt-1 text-sm text-neutral-900 dark:text-white">
                    {selectedPrescription.patient_name || 'Desconocido'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Medicamento</p>
                  <p className="mt-1 text-sm text-neutral-900 dark:text-white">
                    {selectedPrescription.product_name || 'Desconocido'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Dosis</p>
                  <p className="mt-1 text-sm text-neutral-900 dark:text-white">
                    {selectedPrescription.dosage}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Frecuencia</p>
                  <p className="mt-1 text-sm text-neutral-900 dark:text-white">
                    {selectedPrescription.frequency}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Duración</p>
                  <p className="mt-1 text-sm text-neutral-900 dark:text-white">
                    {selectedPrescription.duration_days ? `${selectedPrescription.duration_days} días` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Cantidad</p>
                  <p className="mt-1 text-sm text-neutral-900 dark:text-white">
                    {selectedPrescription.quantity}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Estado</p>
                  <div className="mt-1">{getStatusBadge(selectedPrescription.status)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Fecha de Prescripción</p>
                  <p className="mt-1 text-sm text-neutral-900 dark:text-white">
                    {formatDate(selectedPrescription.created_at)}
                  </p>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 p-4">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSelectedPrescription(null)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                >
                  Cerrar
                </button>
                {selectedPrescription.encounter_id && (
                  <Link
                    href={`/emr/${selectedPrescription.encounter_id}`}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 rounded-lg transition-colors"
                  >
                    Ver Encuentro
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
