'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreatePatientModal } from './CreatePatientModal';

/**
 * Create Patient Button - Client Component
 *
 * Handles modal state for creating new patients.
 * Separated from Server Component to maintain interactivity.
 */

export function CreatePatientButton() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button
        variant="primary"
        size="lg"
        onClick={() => setShowModal(true)}
        className="w-full sm:w-auto"
      >
        <UserPlus className="w-5 h-5 mr-2" />
        Nuevo Paciente
      </Button>

      <CreatePatientModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
