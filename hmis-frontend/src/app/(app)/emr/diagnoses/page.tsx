/**
 * EMR Diagnoses Page - Diagnosis management and statistics
 * Shows frequent diagnoses, ICD-10 search, and diagnostic statistics
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Stethoscope, Search, TrendingUp, ArrowLeft, BarChart3, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Diagnosis {
  id: string;
  encounter_id: string;
  patient_id: string;
  patient_name?: string;
  icd10_code: string;
  description: string;
  diagnosis_type: string;
  status: string;
  onset_date?: string;
  resolved_date?: string;
  notes?: string;
  created_at: string;
}

interface DiagnosisStats {
  code: string;
  description: string;
  count: number;
  percentage: number;
}

export default function DiagnosesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');

  // Fetch all diagnoses
  const { data: diagnosesData, isLoading } = useQuery({
    queryKey: ['all-diagnoses', selectedStatus],
    queryFn: async () => {
      // Since there's no global diagnoses endpoint, we'll fetch from encounters
      const encounters = await api.get<{ items: any[] }>('/emr/encounters?page_size=100');

      if (!encounters.items || encounters.items.length === 0) return [];

      const diagnosesPromises = encounters.items.map(async (encounter) => {
        try {
          const diagnoses = await api.get<Diagnosis[]>(`/emr/patients/${encounter.patient_id}/diagnoses`);
          const diagnosesArray = Array.isArray(diagnoses) ? diagnoses : (diagnoses as any).items || [];

          return diagnosesArray.map((diag: Diagnosis) => ({
            ...diag,
            patient_name: encounter.patient_name || 'Desconocido',
          }));
        } catch (error) {
          return [];
        }
      });

      const diagnosesArrays = await Promise.all(diagnosesPromises);
      const allDiagnoses = diagnosesArrays.flat();

      // Remove duplicates by diagnosis ID
      const uniqueDiagnoses = Array.from(
        new Map(allDiagnoses.map(item => [item.id, item])).values()
      );

      return uniqueDiagnoses.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });

  const diagnoses = diagnosesData || [];

  // Filter diagnoses
  const filteredDiagnoses = diagnoses.filter((diag) => {
    const matchesSearch =
      !searchTerm ||
      diag.icd10_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      diag.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      diag.patient_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = !selectedType || diag.diagnosis_type === selectedType;
    const matchesStatus = !selectedStatus || diag.status === selectedStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate statistics
  const diagnosisStats: DiagnosisStats[] = (() => {
    const statsMap = new Map<string, { description: string; count: number }>();

    diagnoses.forEach((diag) => {
      const key = diag.icd10_code;
      const existing = statsMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        statsMap.set(key, { description: diag.description, count: 1 });
      }
    });

    const total = diagnoses.length;
    return Array.from(statsMap.entries())
      .map(([code, data]) => ({
        code,
        description: data.description,
        count: data.count,
        percentage: total > 0 ? (data.count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  })();

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
      active: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      resolved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      ruled_out: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
    };
    const labels = {
      active: 'Activo',
      resolved: 'Resuelto',
      ruled_out: 'Descartado',
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[status as keyof typeof styles] || styles.active}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const styles = {
      principal: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      secondary: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      complication: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    };
    const labels = {
      principal: 'Principal',
      secondary: 'Secundario',
      complication: 'Complicación',
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[type as keyof typeof styles] || styles.secondary}`}>
        {labels[type as keyof typeof labels] || type}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            Gestión de Diagnósticos
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Búsqueda CIE-10 y estadísticas de diagnósticos
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
              <Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Diagnósticos</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{diagnoses.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Activos</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {diagnoses.filter(d => d.status === 'active').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <BarChart3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Códigos Únicos</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {new Set(diagnoses.map(d => d.icd10_code)).size}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Resueltos</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {diagnoses.filter(d => d.status === 'resolved').length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            viewMode === 'list'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Lista
        </button>
        <button
          onClick={() => setViewMode('stats')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            viewMode === 'stats'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Estadísticas
        </button>
      </div>

      {viewMode === 'list' ? (
        <>
          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar por código CIE-10, descripción o paciente..."
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
                <option value="principal">Principal</option>
                <option value="secondary">Secundario</option>
                <option value="complication">Complicación</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="resolved">Resueltos</option>
                <option value="ruled_out">Descartados</option>
              </select>
            </div>
          </Card>

          {/* Diagnoses Table */}
          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Cargando diagnósticos...</p>
                </div>
              </div>
            ) : filteredDiagnoses.length === 0 ? (
              <div className="text-center py-12">
                <Stethoscope className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-500 dark:text-neutral-400">
                  {searchTerm ? 'No se encontraron diagnósticos con los filtros aplicados' : 'No hay diagnósticos registrados'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Código CIE-10
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Descripción
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Paciente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-700">
                    {filteredDiagnoses.map((diag) => (
                      <tr key={diag.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                        <td className="px-4 py-3 text-sm font-mono font-medium text-primary-600 dark:text-primary-400">
                          {diag.icd10_code}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-900 dark:text-white">
                          {diag.description}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
                          {diag.patient_name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {getTypeBadge(diag.diagnosis_type)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {getStatusBadge(diag.status)}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                          {formatDate(diag.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : (
        /* Statistics View */
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Top 20 Diagnósticos Más Frecuentes
          </h2>
          {diagnosisStats.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-500 dark:text-neutral-400">No hay estadísticas disponibles</p>
            </div>
          ) : (
            <div className="space-y-3">
              {diagnosisStats.map((stat, index) => (
                <div key={stat.code} className="flex items-center gap-4">
                  <div className="w-8 text-center">
                    <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-sm font-mono font-medium text-primary-600 dark:text-primary-400">
                          {stat.code}
                        </span>
                        <span className="text-sm text-neutral-700 dark:text-neutral-300 ml-2">
                          {stat.description}
                        </span>
                      </div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">
                        {stat.count} casos ({stat.percentage.toFixed(1)}%)
                      </div>
                    </div>
                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                      <div
                        className="bg-primary-500 dark:bg-primary-400 h-2 rounded-full transition-all"
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
