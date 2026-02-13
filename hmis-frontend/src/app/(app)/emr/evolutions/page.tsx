/**
 * EMR Evolutions Page - Medical progress notes view
 * Shows evolution notes for all hospitalized patients
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, User, Calendar, Filter, Search, Eye, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ProgressNote {
  id: string;
  encounter_id: string;
  patient_name: string;
  patient_id: string;
  provider_name: string;
  note_type: string;
  content_json: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    summary?: string;
  };
  is_signed: boolean;
  created_at: string;
  signed_at?: string;
}

interface Encounter {
  id: string;
  patient_id: string;
  patient_name?: string;
  provider_name?: string;
  encounter_type: string;
  status: string;
  start_datetime: string;
}

export default function EvolutionsPage() {
  const [selectedNote, setSelectedNote] = useState<ProgressNote | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');

  // Fetch all inpatient encounters
  const { data: encountersData, isLoading: loadingEncounters } = useQuery({
    queryKey: ['encounters', { encounter_type: 'inpatient', status: 'active' }],
    queryFn: async () => {
      const params = new URLSearchParams({
        encounter_type: 'inpatient',
        status: 'active',
        page_size: '100',
      });
      return api.get<{ items: Encounter[] }>(`/emr/encounters?${params.toString()}`);
    },
  });

  // Fetch progress notes for all encounters
  const { data: notesData, isLoading: loadingNotes } = useQuery({
    queryKey: ['progress-notes', encountersData?.items],
    queryFn: async () => {
      if (!encountersData?.items || encountersData.items.length === 0) return [];

      // Fetch notes for each encounter
      const notesPromises = encountersData.items.map(async (encounter) => {
        try {
          const notes = await api.get<ProgressNote[]>(`/emr/encounters/${encounter.id}/notes`);
          const progressNotes = (Array.isArray(notes) ? notes : []).filter(
            (note) => note.note_type === 'progress'
          );

          return progressNotes.map((note) => ({
            ...note,
            patient_name: encounter.patient_name || 'Desconocido',
            provider_name: encounter.provider_name || 'N/A',
          }));
        } catch (error) {
          console.error(`Error fetching notes for encounter ${encounter.id}:`, error);
          return [];
        }
      });

      const notesArrays = await Promise.all(notesPromises);
      return notesArrays.flat().sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!encountersData?.items && encountersData.items.length > 0,
  });

  const isLoading = loadingEncounters || loadingNotes;
  const notes = notesData || [];

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      !searchTerm ||
      note.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.provider_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDate =
      !dateFilter ||
      new Date(note.created_at).toISOString().split('T')[0] === dateFilter;

    return matchesSearch && matchesDate;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            Evoluciones Médicas
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Notas de evolución de pacientes hospitalizados
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

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por paciente o médico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Service Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todos los servicios</option>
              <option value="medicina_interna">Medicina Interna</option>
              <option value="cirugia">Cirugía</option>
              <option value="pediatria">Pediatría</option>
              <option value="ginecologia">Ginecología</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Notes List */}
      <Card className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Cargando evoluciones...</p>
            </div>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-500 dark:text-neutral-400">
              {searchTerm || dateFilter
                ? 'No se encontraron evoluciones con los filtros aplicados'
                : 'No hay evoluciones médicas registradas'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-600 transition-colors bg-white dark:bg-neutral-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-neutral-900 dark:text-white">
                        {note.patient_name}
                      </h3>
                      {note.is_signed && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                          Firmada
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{note.provider_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(note.created_at)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-2">
                      {note.content_json?.summary ||
                        note.content_json?.assessment ||
                        note.content_json?.subjective ||
                        'Sin resumen'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedNote(note)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Ver
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* View Modal */}
      {selectedNote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 p-6 z-10">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    Evolución Médica
                  </h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    {selectedNote.patient_name} - {formatDate(selectedNote.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedNote(null)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {selectedNote.content_json?.subjective && (
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Subjetivo (S)
                  </h3>
                  <p className="text-sm text-neutral-900 dark:text-white whitespace-pre-wrap">
                    {selectedNote.content_json.subjective}
                  </p>
                </div>
              )}

              {selectedNote.content_json?.objective && (
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Objetivo (O)
                  </h3>
                  <p className="text-sm text-neutral-900 dark:text-white whitespace-pre-wrap">
                    {selectedNote.content_json.objective}
                  </p>
                </div>
              )}

              {selectedNote.content_json?.assessment && (
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Evaluación (A)
                  </h3>
                  <p className="text-sm text-neutral-900 dark:text-white whitespace-pre-wrap">
                    {selectedNote.content_json.assessment}
                  </p>
                </div>
              )}

              {selectedNote.content_json?.plan && (
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Plan (P)
                  </h3>
                  <p className="text-sm text-neutral-900 dark:text-white whitespace-pre-wrap">
                    {selectedNote.content_json.plan}
                  </p>
                </div>
              )}

              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-6">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium">Médico:</span> {selectedNote.provider_name}
                  </div>
                  {selectedNote.is_signed && selectedNote.signed_at && (
                    <div className="text-green-600 dark:text-green-400">
                      Firmada el {formatDate(selectedNote.signed_at)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 p-4">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSelectedNote(null)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                >
                  Cerrar
                </button>
                <Link
                  href={`/emr/${selectedNote.encounter_id}`}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 rounded-lg transition-colors"
                >
                  Ver Encuentro Completo
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
