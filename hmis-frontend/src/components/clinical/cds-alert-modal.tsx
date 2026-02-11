'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type { CDSAlert } from '@/hooks/useCDS';

// ─── Types ──────────────────────────────────────────────

interface CDSAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: CDSAlert[];
  medicationName: string;
  onOverride: (reason: string) => void;
  onCancel: () => void;
  isOverriding?: boolean;
}

// ─── Severity Config ────────────────────────────────────

const severityConfig = {
  critical: {
    icon: AlertOctagon,
    border: 'border-red-300',
    bg: 'bg-red-50',
    text: 'text-red-800',
    iconColor: 'text-red-600',
    badge: 'danger' as const,
    label: 'Critico',
  },
  major: {
    icon: AlertTriangle,
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    iconColor: 'text-orange-600',
    badge: 'warning' as const,
    label: 'Mayor',
  },
  moderate: {
    icon: ShieldAlert,
    border: 'border-yellow-300',
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    iconColor: 'text-yellow-600',
    badge: 'warning' as const,
    label: 'Moderado',
  },
  minor: {
    icon: Info,
    border: 'border-blue-300',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    iconColor: 'text-blue-600',
    badge: 'info' as const,
    label: 'Menor',
  },
};

const alertTypeLabels: Record<string, string> = {
  drug_interaction: 'Interaccion Medicamentosa',
  allergy: 'Alergia',
  duplicate_therapy: 'Terapia Duplicada',
};

// ─── Component ──────────────────────────────────────────

export function CDSAlertModal({
  isOpen,
  onClose,
  alerts,
  medicationName,
  onOverride,
  onCancel,
  isOverriding = false,
}: CDSAlertModalProps) {
  const [overrideReason, setOverrideReason] = useState('');

  const hasCritical = alerts.some((a) => a.severity === 'critical');
  const hasMajor = alerts.some((a) => a.severity === 'major');
  const requiresReason = hasCritical || hasMajor;
  const canOverride = !requiresReason || overrideReason.length >= 10;

  // Group alerts by severity
  const grouped = alerts.reduce(
    (acc, alert) => {
      const key = alert.severity;
      if (!acc[key]) acc[key] = [];
      acc[key].push(alert);
      return acc;
    },
    {} as Record<string, CDSAlert[]>
  );

  const severityOrder = ['critical', 'major', 'moderate', 'minor'] as const;

  function handleOverride() {
    onOverride(overrideReason);
    setOverrideReason('');
  }

  function handleCancel() {
    setOverrideReason('');
    onCancel();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Alertas de Seguridad"
      description={`Se detectaron ${alerts.length} alerta(s) para ${medicationName}`}
      size="lg"
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="outline" onClick={handleCancel}>
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar Prescripcion
          </Button>
          <Button
            variant={hasCritical ? 'danger' : 'primary'}
            onClick={handleOverride}
            disabled={!canOverride || isOverriding}
          >
            {isOverriding
              ? 'Registrando...'
              : hasCritical
                ? 'Proceder Pese a Alertas Criticas'
                : 'Proceder con Advertencias'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Summary banner */}
        {hasCritical && (
          <div className="flex items-center gap-3 p-3 bg-red-100 rounded-lg border border-red-300">
            <AlertOctagon className="w-5 h-5 text-red-700 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-800">
              Se detectaron alertas CRITICAS. Requiere justificacion clinica documentada.
            </p>
          </div>
        )}

        {/* Alert cards by severity */}
        {severityOrder.map((severity) => {
          const group = grouped[severity];
          if (!group?.length) return null;

          const config = severityConfig[severity];
          const Icon = config.icon;

          return (
            <div key={severity} className="space-y-2">
              <h3 className={`text-sm font-semibold ${config.text} flex items-center gap-1.5`}>
                <Icon className={`w-4 h-4 ${config.iconColor}`} />
                {config.label} ({group.length})
              </h3>

              {group.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${config.border} ${config.bg}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={config.badge} size="sm">
                          {alertTypeLabels[alert.alert_type] || alert.alert_type}
                        </Badge>
                        {alert.interacting_drug && (
                          <span className="text-xs text-neutral-500">
                            con {alert.interacting_drug}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm font-medium ${config.text}`}>
                        {alert.summary}
                      </p>
                      <p className="text-xs text-neutral-600 mt-1">{alert.detail}</p>
                      {alert.management && (
                        <p className="text-xs text-neutral-700 mt-1 italic">
                          Manejo: {alert.management}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {/* Override reason */}
        {requiresReason && (
          <div className="pt-2 border-t border-neutral-200">
            <Textarea
              label="Justificacion clinica para continuar (minimo 10 caracteres)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Documentar razon clinica para prescribir a pesar de las alertas..."
              required
            />
            {overrideReason.length > 0 && overrideReason.length < 10 && (
              <p className="text-xs text-red-500 mt-1">
                Minimo 10 caracteres ({overrideReason.length}/10)
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
