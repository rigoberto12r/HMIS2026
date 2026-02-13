'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronUp,
  X,
  Filter,
  Calendar,
  Users,
  Heart,
  CreditCard,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PatientAdvancedFiltersProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function PatientAdvancedFilters({ isOpen, onToggle }: PatientAdvancedFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter states from URL
  const [ageMin, setAgeMin] = useState(searchParams.get('age_min') || '');
  const [ageMax, setAgeMax] = useState(searchParams.get('age_max') || '');
  const [gender, setGender] = useState(searchParams.get('gender') || '');
  const [bloodType, setBloodType] = useState(searchParams.get('blood_type') || '');
  const [hasInsurance, setHasInsurance] = useState(searchParams.get('has_insurance') || '');
  const [hasDebt, setHasDebt] = useState(searchParams.get('has_debt') || '');
  const [hasAppointment, setHasAppointment] = useState(searchParams.get('has_appointment') || '');
  const [hasAlert, setHasAlert] = useState(searchParams.get('has_alert') || '');

  // Collapsible sections
  const [demographicsOpen, setDemographicsOpen] = useState(true);
  const [clinicalOpen, setClinicalOpen] = useState(true);
  const [administrativeOpen, setAdministrativeOpen] = useState(true);

  const updateFilters = () => {
    const params = new URLSearchParams(searchParams.toString());

    // Add/remove filter params
    const filters = {
      age_min: ageMin,
      age_max: ageMax,
      gender,
      blood_type: bloodType,
      has_insurance: hasInsurance,
      has_debt: hasDebt,
      has_appointment: hasAppointment,
      has_alert: hasAlert,
    };

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Reset to page 1
    params.set('page', '1');

    router.push(`/patients?${params.toString()}`);
  };

  const clearFilters = () => {
    setAgeMin('');
    setAgeMax('');
    setGender('');
    setBloodType('');
    setHasInsurance('');
    setHasDebt('');
    setHasAppointment('');
    setHasAlert('');

    const params = new URLSearchParams(searchParams.toString());
    // Keep only search and page
    const search = params.get('search');
    const newParams = new URLSearchParams();
    if (search) newParams.set('search', search);
    newParams.set('page', '1');

    router.push(`/patients?${newParams.toString()}`);
  };

  const activeFiltersCount = [
    ageMin,
    ageMax,
    gender,
    bloodType,
    hasInsurance,
    hasDebt,
    hasAppointment,
    hasAlert,
  ].filter(Boolean).length;

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed left-0 top-1/2 -translate-y-1/2 bg-primary-500 text-white p-3 rounded-r-lg shadow-lg hover:bg-primary-600 transition-all z-10 group"
      >
        <Filter className="w-5 h-5" />
        {activeFiltersCount > 0 && (
          <Badge
            variant="danger"
            size="sm"
            className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center"
          >
            {activeFiltersCount}
          </Badge>
        )}
      </button>
    );
  }

  return (
    <Card className="h-full overflow-y-auto" padding="none">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-surface-100 border-b border-surface-200 dark:border-surface-700 p-4 z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary-500" />
            <h3 className="font-semibold text-surface-900 dark:text-surface-50">
              Filtros Avanzados
            </h3>
            {activeFiltersCount > 0 && (
              <Badge variant="primary" size="sm">
                {activeFiltersCount}
              </Badge>
            )}
          </div>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-surface-100 dark:hover:bg-surface-200 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={updateFilters}
            className="flex-1"
          >
            Aplicar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearFilters}
            disabled={activeFiltersCount === 0}
          >
            Limpiar
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Demographics Section */}
        <div className="space-y-3">
          <button
            onClick={() => setDemographicsOpen(!demographicsOpen)}
            className="flex items-center justify-between w-full text-left group"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-500" />
              <span className="font-medium text-sm text-surface-700 dark:text-surface-300">
                Demografía
              </span>
            </div>
            {demographicsOpen ? (
              <ChevronUp className="w-4 h-4 text-surface-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-surface-400" />
            )}
          </button>

          {demographicsOpen && (
            <div className="space-y-3 pl-6">
              {/* Age Range */}
              <div>
                <label className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-2 block">
                  Rango de Edad
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={ageMin}
                    onChange={(e) => setAgeMin(e.target.value)}
                    className="text-sm h-9"
                    min="0"
                    max="150"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={ageMax}
                    onChange={(e) => setAgeMax(e.target.value)}
                    className="text-sm h-9"
                    min="0"
                    max="150"
                  />
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-2 block">
                  Género
                </label>
                <div className="space-y-2">
                  {[
                    { value: '', label: 'Todos' },
                    { value: 'M', label: 'Masculino' },
                    { value: 'F', label: 'Femenino' },
                    { value: 'O', label: 'Otro' },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value={option.value}
                        checked={gender === option.value}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-surface-700 dark:text-surface-300">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Clinical Section */}
        <div className="space-y-3 border-t border-surface-200 dark:border-surface-700 pt-4">
          <button
            onClick={() => setClinicalOpen(!clinicalOpen)}
            className="flex items-center justify-between w-full text-left group"
          >
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              <span className="font-medium text-sm text-surface-700 dark:text-surface-300">
                Clínico
              </span>
            </div>
            {clinicalOpen ? (
              <ChevronUp className="w-4 h-4 text-surface-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-surface-400" />
            )}
          </button>

          {clinicalOpen && (
            <div className="space-y-3 pl-6">
              {/* Blood Type */}
              <div>
                <label className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-2 block">
                  Tipo de Sangre
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="w-full text-sm h-9 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-100 px-3 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Todos</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              {/* Has Alert */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAlert === 'true'}
                  onChange={(e) => setHasAlert(e.target.checked ? 'true' : '')}
                  className="w-4 h-4 text-primary-500 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-surface-700 dark:text-surface-300">
                  Con alertas clínicas
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Administrative Section */}
        <div className="space-y-3 border-t border-surface-200 dark:border-surface-700 pt-4">
          <button
            onClick={() => setAdministrativeOpen(!administrativeOpen)}
            className="flex items-center justify-between w-full text-left group"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-accent-500" />
              <span className="font-medium text-sm text-surface-700 dark:text-surface-300">
                Administrativo
              </span>
            </div>
            {administrativeOpen ? (
              <ChevronUp className="w-4 h-4 text-surface-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-surface-400" />
            )}
          </button>

          {administrativeOpen && (
            <div className="space-y-3 pl-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasInsurance === 'true'}
                  onChange={(e) => setHasInsurance(e.target.checked ? 'true' : '')}
                  className="w-4 h-4 text-primary-500 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-surface-700 dark:text-surface-300">
                  Con seguro/ARS
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAppointment === 'true'}
                  onChange={(e) => setHasAppointment(e.target.checked ? 'true' : '')}
                  className="w-4 h-4 text-primary-500 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-surface-700 dark:text-surface-300">
                  Con citas pendientes
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDebt === 'true'}
                  onChange={(e) => setHasDebt(e.target.checked ? 'true' : '')}
                  className="w-4 h-4 text-primary-500 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-surface-700 dark:text-surface-300 flex items-center gap-1">
                  Con deuda
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                </span>
              </label>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
