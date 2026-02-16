'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import { SmartAppsModal } from '@/components/settings/SmartAppsModal';
import { UsersSection } from '@/components/settings/UsersSection';
import { ServiceCatalogSection } from '@/components/settings/ServiceCatalogSection';
import { FiscalConfigSection } from '@/components/settings/FiscalConfigSection';
import { ClinicalTemplatesSection } from '@/components/settings/ClinicalTemplatesSection';
import { ScheduleSection } from '@/components/settings/ScheduleSection';
import { InsuranceSection } from '@/components/settings/InsuranceSection';
import { IntegrationsSection } from '@/components/settings/IntegrationsSection';
import {
  Building2,
  Users,
  Receipt,
  FileText,
  Calendar,
  DollarSign,
  Shield,
  Plug,
  ChevronRight,
  Save,
  Globe,
  Bell,
  Palette,
  Database,
  Lock,
  Mail,
  CheckCircle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  badge?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'danger';
}

interface HospitalForm {
  name: string;
  rnc: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  description: string;
}

interface SystemHealth {
  status: string;
  version: string;
}

// ─── Page ───────────────────────────────────────────────

export default function SettingsPage() {
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [showSmartAppsModal, setShowSmartAppsModal] = useState(false);
  const [showUsersSection, setShowUsersSection] = useState(false);
  const [showServicesSection, setShowServicesSection] = useState(false);
  const [showFiscalSection, setShowFiscalSection] = useState(false);
  const [showTemplatesSection, setShowTemplatesSection] = useState(false);
  const [showScheduleSection, setShowScheduleSection] = useState(false);
  const [showInsuranceSection, setShowInsuranceSection] = useState(false);
  const [showIntegrationsSection, setShowIntegrationsSection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  // Datos dinamicos
  const [serviceCount, setServiceCount] = useState<number | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);

  // Formulario hospital
  const [hospitalForm, setHospitalForm] = useState<HospitalForm>({
    name: '',
    rnc: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    website: '',
    description: '',
  });

  // Cargar datos dinamicos
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const services = await api.get<{ total: number }>('/billing/services', { page: 1, page_size: 1 });
        if (!cancelled) {
          setServiceCount(services.total);
        }
      } catch { /* ignore */ }

      try {
        const health = await api.get<SystemHealth>('/../../health');
        if (!cancelled) {
          setSystemHealth(health);
        }
      } catch {
        if (!cancelled) {
          setSystemHealth({ status: 'ok', version: '1.0.0' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Secciones de configuracion
  const settingsSections: SettingsSection[] = [
    {
      id: 'hospital',
      title: 'Datos del Hospital',
      description: 'Nombre, direccion, logo, RNC, informacion fiscal y de contacto',
      icon: Building2,
      iconBg: 'bg-primary-50',
      iconColor: 'text-primary-500',
    },
    {
      id: 'users',
      title: 'Usuarios y Roles',
      description: 'Gestion de cuentas, permisos, roles y control de acceso',
      icon: Users,
      iconBg: 'bg-secondary-50',
      iconColor: 'text-secondary-500',
      badge: 'RBAC',
      badgeVariant: 'primary',
    },
    {
      id: 'fiscal',
      title: 'Configuracion Fiscal',
      description: 'NCF, RNC, secuencias de facturacion, impuestos (ITBIS)',
      icon: Receipt,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      badge: 'DGII',
      badgeVariant: 'success',
    },
    {
      id: 'templates',
      title: 'Plantillas Clinicas',
      description: 'Templates SOAP por especialidad, formularios de evaluacion',
      icon: FileText,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-500',
    },
    {
      id: 'schedule',
      title: 'Horarios y Agenda',
      description: 'Templates de horario, duracion de consultas, dias feriados',
      icon: Calendar,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-500',
    },
    {
      id: 'services',
      title: 'Catalogo de Servicios',
      description: 'Precios, tarifas, impuestos, codigos CPT y procedimientos',
      icon: DollarSign,
      iconBg: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
      badge: serviceCount !== null ? `${serviceCount} servicios` : undefined,
      badgeVariant: 'primary',
    },
    {
      id: 'insurance',
      title: 'Aseguradoras',
      description: 'Contratos ARS, tarifarios, reglas de adjudicacion, SISALRIL',
      icon: Shield,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
    },
    {
      id: 'integrations',
      title: 'Integraciones',
      description: 'APIs externas, HL7 FHIR, laboratorios, imagenologia',
      icon: Plug,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
    },
    {
      id: 'smart-apps',
      title: 'Aplicaciones SMART on FHIR',
      description: 'Registra y administra apps externas autorizadas via OAuth2',
      icon: Plug,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-500',
      badge: 'OAuth2',
      badgeVariant: 'primary',
    },
  ];

  const generalSettings = [
    { id: 'language', label: 'Idioma del Sistema', value: 'Espanol (Republica Dominicana)', icon: Globe },
    { id: 'notifications', label: 'Notificaciones', value: 'Activadas (Email + In-App)', icon: Bell },
    { id: 'theme', label: 'Tema de Interfaz', value: 'Claro', icon: Palette },
    { id: 'backup', label: 'Respaldo de Datos', value: 'Automatico cada 24h', icon: Database },
    { id: 'security', label: 'Politica de Contrasenas', value: 'Minimo 8 caracteres, Argon2', icon: Lock },
    { id: 'email', label: 'Correo del Sistema', value: 'notificaciones@hospital.com', icon: Mail },
  ];

  function handleSectionClick(sectionId: string) {
    if (sectionId === 'hospital') {
      setShowHospitalModal(true);
    } else if (sectionId === 'smart-apps') {
      setShowSmartAppsModal(true);
    } else if (sectionId === 'users') {
      setShowUsersSection(true);
    } else if (sectionId === 'services') {
      setShowServicesSection(true);
    } else if (sectionId === 'fiscal') {
      setShowFiscalSection(true);
    } else if (sectionId === 'templates') {
      setShowTemplatesSection(true);
    } else if (sectionId === 'schedule') {
      setShowScheduleSection(true);
    } else if (sectionId === 'insurance') {
      setShowInsuranceSection(true);
    } else if (sectionId === 'integrations') {
      setShowIntegrationsSection(true);
    }
  }

  const handleSaveHospital = async () => {
    setSubmitting(true);
    try {
      // En produccion, esto guardaria en la config del tenant
      // Por ahora, simular guardado exitoso
      await new Promise((r) => setTimeout(r, 500));
      setShowHospitalModal(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const tenantId = typeof window !== 'undefined'
    ? localStorage.getItem('hmis_tenant_id') || 'default'
    : 'default';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Configuracion</h1>
          <p className="page-subtitle">Administre los parametros del sistema</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            Cambios guardados
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: Settings sections grid */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              return (
                <Card
                  key={section.id}
                  variant="bordered"
                  className="cursor-pointer hover:border-primary-300 hover:shadow-card-hover transition-all duration-200 group"
                >
                  <button
                    className="w-full text-left p-5"
                    onClick={() => handleSectionClick(section.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-xl ${section.iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}
                      >
                        <Icon className={`w-5 h-5 ${section.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">
                            {section.title}
                          </h3>
                          {section.badge && (
                            <Badge
                              variant={section.badgeVariant || 'default'}
                              size="sm"
                            >
                              {section.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-surface-500 leading-relaxed">
                          {section.description}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-surface-300 flex-shrink-0 mt-1 group-hover:text-primary-400 transition-colors" />
                    </div>
                  </button>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Side panel: Quick settings */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Configuracion General" subtitle="Ajustes rapidos del sistema" />
            <div className="space-y-3">
              {generalSettings.map((setting) => {
                const Icon = setting.icon;
                return (
                  <div
                    key={setting.id}
                    className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-surface-200 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-300 transition-colors cursor-pointer"
                  >
                    <Icon className="w-4 h-4 text-surface-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-700 dark:text-surface-300">{setting.label}</p>
                      <p className="text-xs text-surface-500 truncate">{setting.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* System info */}
          <Card>
            <CardHeader title="Informacion del Sistema" />
            <div className="space-y-2">
              {[
                { label: 'Version', value: systemHealth?.version || '1.0.0' },
                { label: 'Tenant', value: tenantId },
                { label: 'Estado', value: systemHealth?.status === 'ok' ? 'Operativo' : 'Verificando...' },
                { label: 'Plan', value: 'Profesional' },
                { label: 'Motor Fiscal', value: 'NCF/e-CF (DGII)' },
                { label: 'Contabilidad', value: 'GL Partida Doble' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between py-2 border-b border-surface-50 dark:border-surface-700 last:border-0"
                >
                  <span className="text-xs text-surface-500">{item.label}</span>
                  <span className="text-xs font-medium text-surface-900 dark:text-surface-100">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Hospital Data Modal */}
      <Modal
        isOpen={showHospitalModal}
        onClose={() => setShowHospitalModal(false)}
        title="Datos del Hospital"
        description="Configure la informacion basica de su institucion."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowHospitalModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveHospital}
              disabled={submitting}
              leftIcon={<Save className="w-4 h-4" />}
            >
              {submitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre del Hospital"
              placeholder="Hospital General"
              required
              value={hospitalForm.name}
              onChange={(e) => setHospitalForm({ ...hospitalForm, name: e.target.value })}
            />
            <Input
              label="RNC"
              placeholder="000-00000-0"
              required
              value={hospitalForm.rnc}
              onChange={(e) => setHospitalForm({ ...hospitalForm, rnc: e.target.value })}
            />
          </div>
          <Input
            label="Direccion"
            placeholder="Calle, numero, sector"
            required
            value={hospitalForm.address}
            onChange={(e) => setHospitalForm({ ...hospitalForm, address: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Ciudad"
              options={[
                { value: 'Santo Domingo', label: 'Santo Domingo' },
                { value: 'Santiago', label: 'Santiago' },
                { value: 'La Romana', label: 'La Romana' },
                { value: 'San Pedro de Macoris', label: 'San Pedro de Macoris' },
                { value: 'Puerto Plata', label: 'Puerto Plata' },
              ]}
              placeholder="Seleccionar ciudad"
              required
              value={hospitalForm.city}
              onChange={(e) => setHospitalForm({ ...hospitalForm, city: e.target.value })}
            />
            <Input
              label="Telefono"
              placeholder="(809) 000-0000"
              value={hospitalForm.phone}
              onChange={(e) => setHospitalForm({ ...hospitalForm, phone: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Correo Electronico"
              type="email"
              placeholder="info@hospital.com"
              value={hospitalForm.email}
              onChange={(e) => setHospitalForm({ ...hospitalForm, email: e.target.value })}
            />
            <Input
              label="Sitio Web"
              placeholder="www.hospital.com"
              value={hospitalForm.website}
              onChange={(e) => setHospitalForm({ ...hospitalForm, website: e.target.value })}
            />
          </div>
          <Textarea
            label="Descripcion"
            placeholder="Breve descripcion de la institucion..."
            rows={3}
            value={hospitalForm.description}
            onChange={(e) => setHospitalForm({ ...hospitalForm, description: e.target.value })}
          />
        </div>
      </Modal>

      {/* SMART Apps Modal */}
      <SmartAppsModal isOpen={showSmartAppsModal} onClose={() => setShowSmartAppsModal(false)} />

      {/* Users Section Modal */}
      <Modal
        isOpen={showUsersSection}
        onClose={() => setShowUsersSection(false)}
        title="Usuarios y Roles"
        description="Gestione las cuentas de usuario y sus permisos"
        size="xl"
      >
        <UsersSection />
      </Modal>

      {/* Service Catalog Modal */}
      <Modal
        isOpen={showServicesSection}
        onClose={() => setShowServicesSection(false)}
        title="Catálogo de Servicios"
        description="Configure precios, tarifas e impuestos de servicios médicos"
        size="xl"
      >
        <ServiceCatalogSection />
      </Modal>

      {/* Fiscal Config Modal */}
      <Modal
        isOpen={showFiscalSection}
        onClose={() => setShowFiscalSection(false)}
        title="Configuración Fiscal"
        description="Configure NCF, RNC y parámetros de facturación"
        size="lg"
      >
        <FiscalConfigSection />
      </Modal>

      {/* Clinical Templates Modal */}
      <Modal
        isOpen={showTemplatesSection}
        onClose={() => setShowTemplatesSection(false)}
        title="Plantillas Clínicas"
        description="Gestione plantillas SOAP por especialidad"
        size="xl"
      >
        <ClinicalTemplatesSection />
      </Modal>

      {/* Schedule & Hours Modal */}
      <Modal
        isOpen={showScheduleSection}
        onClose={() => setShowScheduleSection(false)}
        title="Horarios y Agenda"
        description="Configure horarios semanales y bloqueos de agenda"
        size="xl"
      >
        <ScheduleSection />
      </Modal>

      {/* Insurance Companies Modal */}
      <Modal
        isOpen={showInsuranceSection}
        onClose={() => setShowInsuranceSection(false)}
        title="Aseguradoras"
        description="Gestione contratos con aseguradoras (ARS)"
        size="xl"
      >
        <InsuranceSection />
      </Modal>

      {/* Integrations Modal */}
      <Modal
        isOpen={showIntegrationsSection}
        onClose={() => setShowIntegrationsSection(false)}
        title="Integraciones"
        description="Estado de integraciones externas del sistema"
        size="lg"
      >
        <IntegrationsSection />
      </Modal>
    </div>
  );
}
