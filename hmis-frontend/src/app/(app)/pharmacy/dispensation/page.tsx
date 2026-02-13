/**
 * Dispensation Page - Medication dispensing workflow
 * Search prescriptions and dispense medications with lot tracking
 */

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DispenseModal } from '@/components/pharmacy/DispenseModal';
import { usePrescriptions, useDispensePrescription } from '@/hooks/usePharmacyData';
import type { Prescription } from '../types';
import {
  Search,
  Pill,
  User,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Package,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

export default function DispensationPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [searchTriggered, setSearchTriggered] = useState(false);

  const { data: pendingData, isLoading } = usePrescriptions({
    page: 1,
    page_size: 50,
    status: 'pending',
  });

  const prescriptions = pendingData?.items || [];

  // Filter prescriptions by search term
  const searchResults = searchTerm && searchTriggered
    ? prescriptions.filter((rx) => {
        const search = searchTerm.toLowerCase();
        return (
          rx.id.toLowerCase().includes(search) ||
          rx.patient_name?.toLowerCase().includes(search) ||
          rx.product_name?.toLowerCase().includes(search)
        );
      })
    : [];

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      toast.error('Ingrese un término de búsqueda');
      return;
    }
    setSearchTriggered(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleDispense = (rx: Prescription) => {
    setSelectedPrescription(rx);
  };

  const handleCloseModal = () => {
    setSelectedPrescription(null);
    // Reset search after successful dispensation
    if (searchTriggered) {
      setSearchTerm('');
      setSearchTriggered(false);
    }
  };

  const recentlyDispensed = prescriptions
    .filter(rx => rx.status === 'dispensed')
    .slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
          Despacho de Medicamentos
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Búsqueda y dispensación de recetas médicas
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Pendientes Hoy
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
                {recentlyDispensed.length}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                En Cola
              </p>
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-500 mt-1">
                {prescriptions.length}
              </p>
            </div>
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Package className="w-6 h-6 text-primary-600 dark:text-primary-500" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search Section */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-primary-500" />
          Buscar Receta para Despachar
        </h2>

        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="ID de receta, nombre del paciente o medicamento..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (!e.target.value.trim()) {
                  setSearchTriggered(false);
                }
              }}
              onKeyPress={handleKeyPress}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Button
            variant="primary"
            onClick={handleSearch}
            disabled={!searchTerm.trim()}
          >
            Buscar
          </Button>
        </div>

        {/* Search Results */}
        {searchTriggered && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
              Resultados de búsqueda ({searchResults.length})
            </h3>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Buscando...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                <AlertTriangle className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-500 dark:text-neutral-400">
                  No se encontraron recetas pendientes con ese criterio
                </p>
                <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
                  Verifique el ID, nombre del paciente o medicamento
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((rx) => (
                  <div
                    key={rx.id}
                    className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:shadow-md dark:hover:shadow-primary-500/10 transition-all bg-white dark:bg-neutral-800"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Prescription Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-neutral-400" />
                          <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {rx.patient_name || 'Paciente desconocido'}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <Pill className="w-4 h-4 text-primary-500" />
                          <p className="font-medium text-neutral-700 dark:text-neutral-300">
                            {rx.product_name || 'Medicamento no especificado'}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                          <div>
                            <span className="text-neutral-500">Dosis:</span>{' '}
                            <span className="font-medium">{rx.dosage}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Frecuencia:</span>{' '}
                            <span className="font-medium">{rx.frequency}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Cantidad:</span>{' '}
                            <span className="font-semibold text-primary-600 dark:text-primary-500">
                              {rx.quantity}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Fecha:</span>{' '}
                            <span className="font-medium">
                              {new Date(rx.created_at).toLocaleDateString('es-DO')}
                            </span>
                          </div>
                        </div>

                        {!!rx.allergy_alerts && (
                          <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-800 dark:text-red-400 font-medium">
                              ⚠️ ALERTA: Paciente tiene alergias registradas. Verificar antes de dispensar.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Action */}
                      <div>
                        <Button
                          variant="primary"
                          onClick={() => handleDispense(rx)}
                          leftIcon={<Package className="w-4 h-4" />}
                        >
                          Dispensar Ahora
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Recently Dispensed (Quick Reference) */}
      {!searchTriggered && recentlyDispensed.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Últimas Dispensaciones
          </h2>
          <div className="space-y-3">
            {recentlyDispensed.map((rx) => (
              <div
                key={rx.id}
                className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-3 h-3 text-neutral-500" />
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {rx.patient_name}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {rx.product_name} - {rx.quantity} unidades
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-500">
                    <Calendar className="w-3 h-3" />
                    {new Date(rx.created_at).toLocaleTimeString('es-DO', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pending Queue (if no search) */}
      {!searchTriggered && prescriptions.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Cola de Recetas Pendientes ({prescriptions.filter(rx => rx.status === 'pending').length})
          </h2>
          <div className="space-y-2">
            {prescriptions.filter(rx => rx.status === 'pending').slice(0, 10).map((rx) => (
              <div
                key={rx.id}
                className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleDispense(rx)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {rx.patient_name}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {rx.product_name}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {rx.dosage} - {rx.frequency} - Cantidad: {rx.quantity}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Dispensar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Dispense Modal */}
      <DispenseModal
        isOpen={!!selectedPrescription}
        onClose={handleCloseModal}
        prescription={selectedPrescription}
      />
    </div>
  );
}
