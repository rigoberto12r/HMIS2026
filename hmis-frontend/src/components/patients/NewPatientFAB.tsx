'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { CreatePatientModal } from './CreatePatientModal';
import { cn } from '@/lib/utils';

export function NewPatientFAB() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'fixed bottom-8 right-8 z-40',
          'group',
          'w-16 h-16 rounded-full',
          'bg-gradient-to-r from-primary-500 to-primary-600',
          'text-white',
          'shadow-2xl hover:shadow-glow-primary',
          'transition-all duration-300 ease-out',
          'hover:scale-110 active:scale-95',
          'flex items-center justify-center',
          'focus:outline-none focus:ring-4 focus:ring-primary-500/50'
        )}
        aria-label="Nuevo paciente"
      >
        <UserPlus
          className={cn(
            'w-7 h-7 transition-transform duration-300',
            isHovered && 'scale-110'
          )}
        />

        {/* Ripple effect on hover */}
        <span
          className={cn(
            'absolute inset-0 rounded-full bg-primary-400 opacity-0',
            'transition-all duration-700',
            isHovered && 'opacity-20 scale-150'
          )}
        />
      </button>

      {/* Tooltip */}
      <div
        className={cn(
          'fixed bottom-8 right-28 z-40',
          'px-4 py-2 rounded-lg',
          'bg-surface-900 dark:bg-surface-800 text-white text-sm font-medium',
          'shadow-lg',
          'transition-all duration-200',
          'pointer-events-none',
          isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
        )}
      >
        Nuevo Paciente
      </div>

      {/* Modal */}
      <CreatePatientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
