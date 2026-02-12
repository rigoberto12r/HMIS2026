'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from './button';
import { modalOverlay, modalPanel } from '@/lib/motion';

// ─── Types ──────────────────────────────────────────────

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  closeOnOverlay?: boolean;
  showCloseButton?: boolean;
}

// ─── Styles ─────────────────────────────────────────────

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm sm:max-w-sm',
  md: 'max-w-full sm:max-w-lg',
  lg: 'max-w-full sm:max-w-2xl',
  xl: 'max-w-full sm:max-w-4xl',
  full: 'max-w-full sm:max-w-[90vw]',
};

// ─── Component ──────────────────────────────────────────

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  closeOnOverlay = true,
  showCloseButton = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <dialog
          ref={dialogRef}
          className="fixed inset-0 z-50 bg-transparent p-0 m-0 max-w-none max-h-none w-full h-full"
          onClick={(e) => {
            if (closeOnOverlay && e.target === e.currentTarget) {
              onClose();
            }
          }}
          aria-labelledby={title ? 'modal-title' : undefined}
          aria-describedby={description ? 'modal-desc' : undefined}
        >
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            aria-hidden="true"
          />

          {/* Modal panel */}
          <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              className={cn(
                'w-full bg-white dark:bg-surface-100 rounded-t-xl sm:rounded-xl shadow-xl',
                'max-h-[90vh] sm:max-h-[85vh] flex flex-col',
                sizeStyles[size]
              )}
              variants={modalPanel}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {(title || showCloseButton) && (
                <div className="flex items-start justify-between p-4 sm:p-5 border-b border-surface-100 dark:border-surface-700 relative">
                  <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary-500/20 to-transparent" />
                  <div>
                    {title && (
                      <h2 id="modal-title" className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p id="modal-desc" className="text-sm text-surface-500 mt-0.5">
                        {description}
                      </p>
                    )}
                  </div>
                  {showCloseButton && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      aria-label="Cerrar"
                      className="flex-shrink-0 -mr-1 -mt-1"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              )}

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>

              {/* Footer */}
              {footer && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 p-4 sm:p-5 border-t border-surface-100 dark:border-surface-700">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </dialog>
      )}
    </AnimatePresence>
  );
}
