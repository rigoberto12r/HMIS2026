'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, Calendar, AlertCircle, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { usePatients } from '@/hooks/usePatients';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  document_type: string;
  document_number: string;
  date_of_birth: string;
  phone?: string;
  email?: string;
}

export default function PatientHistorySearchPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search with 300ms delay
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setTimeout(() => setDebouncedSearch(value), 300);
  };

  // Fetch patients with search query
  const { data: patientsData, isLoading } = usePatients({
    page: 1,
    page_size: 10,
    search: debouncedSearch || undefined,
  });

  const patients = patientsData?.items || [];

  const handleSelectPatient = (patientId: string) => {
    router.push(`/patients/${patientId}/history`);
  };

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-white">
              Historial Clínico
            </h1>
            <p className="text-surface-600 dark:text-surface-400">
              Busca un paciente para ver su historial médico completo
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, apellido o documento..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            autoFocus
          />
        </div>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">
          Escribe al menos 2 caracteres para buscar
        </p>
      </Card>

      {/* Loading State */}
      {isLoading && searchQuery.length >= 2 && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-surface-600 dark:text-surface-400 mt-4">Buscando pacientes...</p>
        </div>
      )}

      {/* Empty State - No Search */}
      {!searchQuery && !isLoading && (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
            Comienza tu búsqueda
          </h3>
          <p className="text-surface-600 dark:text-surface-400 max-w-md mx-auto">
            Ingresa el nombre, apellido o número de documento del paciente para ver su historial
            clínico completo
          </p>
        </Card>
      )}

      {/* Empty State - No Results */}
      {searchQuery.length >= 2 && !isLoading && patients.length === 0 && (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
            No se encontraron resultados
          </h3>
          <p className="text-surface-600 dark:text-surface-400 max-w-md mx-auto">
            No encontramos ningún paciente que coincida con &quot;{searchQuery}&quot;. Intenta con
            otro término de búsqueda.
          </p>
        </Card>
      )}

      {/* Search Results */}
      {searchQuery.length >= 2 && !isLoading && patients.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-surface-600 dark:text-surface-400">
              {patients.length} {patients.length === 1 ? 'paciente encontrado' : 'pacientes encontrados'}
            </p>
          </div>

          {patients.map((patient: Patient) => (
            <Card
              key={patient.id}
              className="p-4 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer group"
              onClick={() => handleSelectPatient(patient.id)}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <span className="text-lg font-bold text-white">
                    {patient.first_name[0]}
                    {patient.last_name[0]}
                  </span>
                </div>

                {/* Patient Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-surface-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {patient.first_name} {patient.last_name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-surface-600 dark:text-surface-400 mt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {patient.document_type}: {patient.document_number}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {calculateAge(patient.date_of_birth)} años
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="flex flex-wrap gap-3 text-sm text-surface-500 dark:text-surface-400">
                    {patient.phone && (
                      <span>📱 {patient.phone}</span>
                    )}
                    {patient.email && (
                      <span>✉️ {patient.email}</span>
                    )}
                    <span className="text-surface-400 dark:text-surface-500">
                      Nacimiento: {formatDate(patient.date_of_birth)}
                    </span>
                  </div>
                </div>

                {/* Action Indicator */}
                <div className="flex items-center text-surface-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
            </Card>
          ))}

          {/* Hint */}
          <div className="text-center mt-6">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              💡 Haz clic en un paciente para ver su historial clínico completo
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
