'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
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

// ─── Configuration ──────────────────────────────────────

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
    badge: '12 usuarios',
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
    badge: '8 plantillas',
    badgeVariant: 'primary',
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
    badge: '156 servicios',
    badgeVariant: 'primary',
  },
  {
    id: 'insurance',
    title: 'Aseguradoras',
    description: 'Contratos ARS, tarifarios, reglas de adjudicacion, SISALRIL',
    icon: Shield,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    badge: '5 ARS',
    badgeVariant: 'primary',
  },
  {
    id: 'integrations',
    title: 'Integraciones',
    description: 'APIs externas, HL7 FHIR, laboratorios, imagenologia',
    icon: Plug,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    badge: '2 activas',
    badgeVariant: 'success',
  },
];

const generalSettings = [
  {
    id: 'language',
    label: 'Idioma del Sistema',
    value: 'Espanol (Republica Dominicana)',
    icon: Globe,
  },
  {
    id: 'notifications',
    label: 'Notificaciones',
    value: 'Activadas (Email + In-App)',
    icon: Bell,
  },
  {
    id: 'theme',
    label: 'Tema de Interfaz',
    value: 'Claro',
    icon: Palette,
  },
  {
    id: 'backup',
    label: 'Respaldo de Datos',
    value: 'Automatico cada 24h',
    icon: Database,
  },
  {
    id: 'security',
    label: 'Politica de Contrasenas',
    value: 'Minimo 8 caracteres, cambio cada 90 dias',
    icon: Lock,
  },
  {
    id: 'email',
    label: 'Correo del Sistema',
    value: 'notificaciones@hospital.com',
    icon: Mail,
  },
];

// ─── Page ───────────────────────────────────────────────

export default function SettingsPage() {
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [showHospitalModal, setShowHospitalModal] = useState(false);

  function handleSectionClick(sectionId: string) {
    if (sectionId === 'hospital') {
      setShowHospitalModal(true);
    } else {
      setSelectedSection(sectionId);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Configuracion</h1>
          <p className="page-subtitle">Administre los parametros del sistema</p>
        </div>
        <Button size="sm" leftIcon={<Save className="w-4 h-4" />}>
          Guardar Cambios
        </Button>
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
                  className="cursor-pointer hover:border-primary-300 hover:shadow-card-hover transition-all duration-200"
                >
                  <button
                    className="w-full text-left p-5"
                    onClick={() => handleSectionClick(section.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-xl ${section.iconBg} flex items-center justify-center`}
                      >
                        <Icon className={`w-5 h-5 ${section.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-neutral-900">
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
                        <p className="text-xs text-neutral-500 leading-relaxed">
                          {section.description}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-300 flex-shrink-0 mt-1" />
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
                    className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    <Icon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-700">{setting.label}</p>
                      <p className="text-xs text-neutral-500 truncate">{setting.value}</p>
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
                { label: 'Version', value: 'v1.0.0' },
                { label: 'Tenant', value: 'hospital-demo' },
                { label: 'Plan', value: 'Profesional' },
                { label: 'Usuarios Activos', value: '12 / 25' },
                { label: 'Almacenamiento', value: '2.4 GB / 10 GB' },
                { label: 'Ultimo Respaldo', value: '06/02/2026 03:00' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0"
                >
                  <span className="text-xs text-neutral-500">{item.label}</span>
                  <span className="text-xs font-medium text-neutral-900">{item.value}</span>
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
              onClick={() => setShowHospitalModal(false)}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nombre del Hospital" placeholder="Hospital General" required />
            <Input label="RNC" placeholder="000-00000-0" required />
          </div>
          <Input label="Direccion" placeholder="Calle, numero, sector" required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Ciudad"
              options={[
                { value: 'sd', label: 'Santo Domingo' },
                { value: 'stg', label: 'Santiago' },
                { value: 'pc', label: 'Punta Cana' },
                { value: 'pp', label: 'Puerto Plata' },
              ]}
              placeholder="Seleccionar ciudad"
              required
            />
            <Input label="Telefono" placeholder="(809) 000-0000" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Correo Electronico" type="email" placeholder="info@hospital.com" />
            <Input label="Sitio Web" placeholder="www.hospital.com" />
          </div>
          <Textarea
            label="Descripcion"
            placeholder="Breve descripcion de la institucion..."
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
}
