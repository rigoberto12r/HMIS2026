'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, List } from 'lucide-react';
import { CreateAppointmentModal } from './CreateAppointmentModal';

/**
 * Appointment Header - Client Component
 *
 * Handles view toggle (list/calendar) and create appointment button.
 * Updates URL state for view preference.
 */

interface AppointmentHeaderProps {
  initialView: 'list' | 'calendar';
}

export function AppointmentHeader({ initialView }: AppointmentHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleViewChange = (newView: 'list' | 'calendar') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', newView);
    router.push(`/appointments?${params.toString()}`);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Citas</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Gestiona las citas médicas del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={initialView === 'list' ? 'primary' : 'outline'}
            size="md"
            onClick={() => handleViewChange('list')}
          >
            <List className="w-4 h-4 mr-2" />
            Lista
          </Button>
          <Button
            variant={initialView === 'calendar' ? 'primary' : 'outline'}
            size="md"
            onClick={() => handleViewChange('calendar')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Calendario
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Cita
          </Button>
        </div>
      </div>

      <CreateAppointmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  );
}
