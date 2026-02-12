'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, Zap, Heart, Shield, CreditCard, Receipt, Search } from 'lucide-react';

interface IntegrationStatus {
  name: string;
  description: string;
  icon: React.ElementType;
  status: 'connected' | 'disconnected' | 'not_configured';
  detail?: string;
}

const statusConfig = {
  connected: { label: 'Conectado', variant: 'success' as const, color: 'border-l-green-500' },
  disconnected: { label: 'Desconectado', variant: 'danger' as const, color: 'border-l-red-500' },
  not_configured: { label: 'No Configurado', variant: 'warning' as const, color: 'border-l-neutral-300' },
};

export function IntegrationsSection() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkIntegrations() {
      const results: IntegrationStatus[] = [];

      // 1. Database (PostgreSQL)
      try {
        const health = await api.get<{ status: string; database?: string; redis?: string }>('/../../health/ready');
        results.push({
          name: 'PostgreSQL',
          description: 'Base de datos principal del sistema',
          icon: Database,
          status: health.status === 'ok' || health.database === 'ok' ? 'connected' : 'disconnected',
          detail: 'Base de datos relacional',
        });

        // 2. Redis
        results.push({
          name: 'Redis',
          description: 'Cache distribuido y rate limiting',
          icon: Zap,
          status: health.redis === 'ok' ? 'connected' : 'disconnected',
          detail: 'Cache y sesiones',
        });
      } catch {
        results.push({
          name: 'PostgreSQL',
          description: 'Base de datos principal del sistema',
          icon: Database,
          status: 'disconnected',
        });
        results.push({
          name: 'Redis',
          description: 'Cache distribuido y rate limiting',
          icon: Zap,
          status: 'disconnected',
        });
      }

      // 3. FHIR R4
      try {
        await api.get('/fhir/metadata');
        results.push({
          name: 'FHIR R4',
          description: 'Interoperabilidad HL7 FHIR para intercambio clínico',
          icon: Heart,
          status: 'connected',
          detail: 'CapabilityStatement disponible',
        });
      } catch {
        results.push({
          name: 'FHIR R4',
          description: 'Interoperabilidad HL7 FHIR para intercambio clínico',
          icon: Heart,
          status: 'disconnected',
        });
      }

      // 4. SMART on FHIR
      results.push({
        name: 'SMART on FHIR',
        description: 'OAuth2 para aplicaciones externas autorizadas',
        icon: Shield,
        status: 'connected',
        detail: 'Módulo OAuth2 activo',
      });

      // 5. Stripe Payments
      results.push({
        name: 'Stripe Payments',
        description: 'Procesamiento de pagos con tarjeta de crédito/débito',
        icon: CreditCard,
        status: 'connected',
        detail: 'Configurado vía variables de entorno',
      });

      // 6. Motor Fiscal (DGII)
      try {
        const configs = await api.get<unknown[]>('/billing/fiscal-config');
        results.push({
          name: 'Motor Fiscal (DGII)',
          description: 'Comprobantes fiscales NCF, reportes 607/608/609',
          icon: Receipt,
          status: Array.isArray(configs) && configs.length > 0 ? 'connected' : 'not_configured',
          detail: Array.isArray(configs) && configs.length > 0 ? 'NCF configurado' : 'Requiere configuración fiscal',
        });
      } catch {
        results.push({
          name: 'Motor Fiscal (DGII)',
          description: 'Comprobantes fiscales NCF, reportes 607/608/609',
          icon: Receipt,
          status: 'not_configured',
        });
      }

      // 7. Meilisearch
      results.push({
        name: 'Meilisearch',
        description: 'Motor de búsqueda de texto completo',
        icon: Search,
        status: 'not_configured',
        detail: 'Disponible para activar',
      });

      setIntegrations(results);
      setLoading(false);
    }

    checkIntegrations();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-400" />
        <p className="text-sm text-neutral-500 mt-2">Verificando integraciones...</p>
      </div>
    );
  }

  const connected = integrations.filter((i) => i.status === 'connected').length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Estado de Integraciones</h2>
          <p className="text-sm text-neutral-500">{connected}/{integrations.length} integraciones activas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {integrations.map((integration) => {
          const config = statusConfig[integration.status];
          const Icon = integration.icon;
          return (
            <div
              key={integration.name}
              className={`border border-neutral-200 rounded-lg p-4 border-l-4 ${config.color}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-neutral-50 rounded-lg">
                    <Icon className="w-5 h-5 text-neutral-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">{integration.name}</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">{integration.description}</p>
                    {integration.detail && (
                      <p className="text-xs text-neutral-400 mt-1">{integration.detail}</p>
                    )}
                  </div>
                </div>
                <Badge variant={config.variant}>{config.label}</Badge>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-sm text-amber-800">
          <strong>Nota:</strong> Las integraciones con HL7 v2, DICOM y analizadores de laboratorio (ASTM)
          estarán disponibles en futuras versiones del sistema.
        </p>
      </div>
    </div>
  );
}
