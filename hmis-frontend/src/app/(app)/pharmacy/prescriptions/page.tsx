/**
 * Prescriptions Page - Pending prescriptions for dispensation
 * Shows list of prescriptions awaiting pharmacy processing
 */

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/input';
import { DispenseModal } from '@/components/pharmacy/DispenseModal';
import { usePrescriptions } from '@/hooks/usePharmacyData';
import type { Prescription } from '../types';
import {
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Pill,
  Clock,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'dispensed', label: 'Dispensado' },
  { value: 'cancelled', label: 'Cancelado' },
];

export default function PrescriptionsPage() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  const { data, isLoading, error } = usePrescriptions({
    page,
    page_size: 20,
    status: statusFilter || undefined,
  });

  const prescriptions = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  // Filter prescriptions locally by search term (patient name or product)
  const filteredPrescriptions = prescriptions.filter((rx) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      rx.patient_name?.toLowerCase().includes(search) ||
      rx.product_name?.toLowerCase().includes(search) ||
      rx.id.toLowerCase().includes(search)
    );
  });

  const handleDownload = (rx: Prescription) => {
    const token = localStorage.getItem('hmis_access_token');
    const tenantId = localStorage.getItem('hmis_tenant_id') || 'default';

    fetch(`${API_BASE_URL}/pharmacy/prescriptions/${rx.id}/pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error descargando PDF');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receta_${rx.id.substring(0, 8)}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error('Error downloading prescription PDF:', err);
        toast.error('No se pudo descargar el PDF de la receta');
      });
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      dispensed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };

    const statusLabels = {
      pending: 'Pendiente',
      dispensed: 'Dispensado',
      cancelled: 'Cancelado',
    };

    return (
      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusStyles[status as keyof typeof statusStyles] || 'bg-neutral-100 text-neutral-800'}`}>
        {statusLabels[status as keyof typeof statusLabels] || status}
      </span>
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <p>Error cargando recetas: {error.message}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
          Recetas Médicas
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Gestión de recetas pendientes de dispensación
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Recetas Pendientes
              </p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-500 mt-1">
                {prescriptions.filter(rx => rx.status === 'pending').length}
              </p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Dispensadas Hoy
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-500 mt-1">
                {prescriptions.filter(rx => rx.status === 'dispensed').length}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Pill className="w-6 h-6 text-green-600 dark:text-green-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Total Recetas
              </p>
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-500 mt-1">
                {total}
              </p>
            </div>
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Calendar className="w-6 h-6 text-primary-600 dark:text-primary-500" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por paciente, medicamento o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="w-full md:w-48">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={<Filter className="w-4 h-4" />}
          >
            Filtros
          </Button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Fecha desde"
              type="date"
              placeholder="Fecha inicio"
            />
            <Input
              label="Fecha hasta"
              type="date"
              placeholder="Fecha fin"
            />
            <div className="flex items-end">
              <Button variant="outline" className="w-full">
                Aplicar Filtros
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Prescriptions List */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Cargando recetas...
            </p>
          </div>
        ) : filteredPrescriptions.length === 0 ? (
          <div className="text-center py-12">
            <Pill className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-500 dark:text-neutral-400">
              {searchTerm ? 'No se encontraron recetas con ese criterio' : 'No hay recetas pendientes'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {filteredPrescriptions.map((rx) => (
              <div
                key={rx.id}
                className="p-5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left side - Prescription details */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                        <User className="w-4 h-4 text-neutral-400" />
                        {rx.patient_name || 'Paciente desconocido'}
                      </h3>
                      {getStatusBadge(rx.status)}
                    </div>

                    <div className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-primary-500" />
                      <p className="font-medium text-neutral-700 dark:text-neutral-300">
                        {rx.product_name || 'Medicamento no especificado'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-500">Dosis:</span>{' '}
                        <span className="font-medium">{rx.dosage}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-500">Frecuencia:</span>{' '}
                        <span className="font-medium">{rx.frequency}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-500">Cantidad:</span>{' '}
                        <span className="font-medium">{rx.quantity}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-500">Fecha:</span>{' '}
                        <span className="font-medium">
                          {new Date(rx.created_at).toLocaleDateString('es-DO')}
                        </span>
                      </div>
                    </div>

                    {!!rx.allergy_alerts && (
                      <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-800 dark:text-red-400">
                          Alerta: Paciente tiene alergias registradas
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right side - Actions */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(rx)}
                      leftIcon={<Download className="w-4 h-4" />}
                    >
                      Descargar
                    </Button>
                    {rx.status === 'pending' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setSelectedPrescription(rx)}
                        leftIcon={<Pill className="w-4 h-4" />}
                      >
                        Dispensar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Mostrando {filteredPrescriptions.length} de {total} recetas
          </p>
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <div className="px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300">
              Página {page} de {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Dispense Modal */}
      <DispenseModal
        isOpen={!!selectedPrescription}
        onClose={() => setSelectedPrescription(null)}
        prescription={selectedPrescription}
      />
    </div>
  );
}
