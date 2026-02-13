'use client';

import { useState } from 'react';
import { usePatient } from '@/hooks/usePatients';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  X,
  User,
  Heart,
  Calendar,
  FileText,
  DollarSign,
  Image,
  Mail,
  Phone,
  MapPin,
  Edit,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Patient } from '@/hooks/usePatients';

interface PatientDetailDrawerProps {
  patientId: string | null;
  onClose: () => void;
}

type TabType = 'resumen' | 'consultas' | 'lab' | 'imagenes' | 'facturacion' | 'documentos';

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

function getAvatarColor(id: string): string {
  const colors = [
    'bg-gradient-to-br from-blue-400 to-blue-600',
    'bg-gradient-to-br from-green-400 to-green-600',
    'bg-gradient-to-br from-purple-400 to-purple-600',
    'bg-gradient-to-br from-pink-400 to-pink-600',
    'bg-gradient-to-br from-indigo-400 to-indigo-600',
    'bg-gradient-to-br from-teal-400 to-teal-600',
    'bg-gradient-to-br from-orange-400 to-orange-600',
  ];
  const index = id.charCodeAt(0) % colors.length;
  return colors[index];
}

export function PatientDetailDrawer({ patientId, onClose }: PatientDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('resumen');
  const { data: patient, isLoading, error } = usePatient(patientId || undefined);

  if (!patientId) return null;

  const tabs: Array<{ id: TabType; label: string; icon: any }> = [
    { id: 'resumen', label: 'Resumen', icon: User },
    { id: 'consultas', label: 'Consultas', icon: Heart },
    { id: 'lab', label: 'Laboratorio', icon: FileText },
    { id: 'imagenes', label: 'Imágenes', icon: Image },
    { id: 'facturacion', label: 'Facturación', icon: DollarSign },
    { id: 'documentos', label: 'Documentos', icon: FileText },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white dark:bg-surface-100 shadow-2xl transform transition-transform duration-300 ease-out">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-primary-500 to-accent-500 text-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              {patient && (
                <div
                  className={cn(
                    'w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg ring-4 ring-white/30',
                    getAvatarColor(patient.id)
                  )}
                >
                  {getInitials(patient.first_name, patient.last_name)}
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold">
                  {isLoading ? 'Cargando...' : patient ? `${patient.first_name} ${patient.last_name}` : 'Paciente'}
                </h2>
                {patient && (
                  <p className="text-white/80 text-sm font-mono">{patient.mrn}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Quick Stats */}
          {patient && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{calculateAge(patient.date_of_birth)} años</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>{patient.gender === 'M' ? 'Masculino' : patient.gender === 'F' ? 'Femenino' : 'Otro'}</span>
              </div>
              {patient.blood_type && (
                <div className="flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  <span className="font-bold">{patient.blood_type}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="sticky top-[120px] z-10 bg-white dark:bg-surface-100 border-b border-surface-200 dark:border-surface-700">
          <div className="flex overflow-x-auto hide-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                    activeTab === tab.id
                      ? 'text-primary-600 dark:text-primary-400 border-primary-500'
                      : 'text-surface-600 dark:text-surface-400 border-transparent hover:text-surface-900 dark:hover:text-surface-200'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-220px)] p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-surface-100 dark:bg-surface-200 rounded-lg shimmer" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">Error al cargar los datos del paciente</p>
            </div>
          ) : patient ? (
            <div className="space-y-6">
              {activeTab === 'resumen' && (
                <>
                  {/* Personal Info */}
                  <Card>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-surface-900 dark:text-surface-50">
                        Información Personal
                      </h3>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between py-2 border-b border-surface-100 dark:border-surface-700">
                        <span className="text-sm text-surface-500">Nombre completo</span>
                        <span className="text-sm font-medium text-surface-900 dark:text-surface-50">
                          {patient.first_name} {patient.last_name}
                        </span>
                      </div>
                      <div className="flex items-start justify-between py-2 border-b border-surface-100 dark:border-surface-700">
                        <span className="text-sm text-surface-500">Fecha de nacimiento</span>
                        <span className="text-sm font-medium text-surface-900 dark:text-surface-50">
                          {formatDate(patient.date_of_birth)} ({calculateAge(patient.date_of_birth)} años)
                        </span>
                      </div>
                      <div className="flex items-start justify-between py-2 border-b border-surface-100 dark:border-surface-700">
                        <span className="text-sm text-surface-500">Documento</span>
                        <span className="text-sm font-medium font-mono text-surface-900 dark:text-surface-50">
                          {patient.document_type}: {patient.document_number}
                        </span>
                      </div>
                      <div className="flex items-start justify-between py-2 border-b border-surface-100 dark:border-surface-700">
                        <span className="text-sm text-surface-500">Estado</span>
                        <Badge variant={patient.status === 'active' ? 'success' : 'default'} dot>
                          {patient.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </div>
                  </Card>

                  {/* Contact Info */}
                  <Card>
                    <h3 className="font-semibold text-surface-900 dark:text-surface-50 mb-4">
                      Información de Contacto
                    </h3>
                    <div className="space-y-3">
                      {patient.phone_number && (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                            <Phone className="w-5 h-5 text-primary-500" />
                          </div>
                          <div>
                            <p className="text-xs text-surface-500">Teléfono</p>
                            <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                              {patient.phone_number}
                            </p>
                          </div>
                        </div>
                      )}
                      {patient.email && (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-accent-50 dark:bg-accent-900/30 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-accent-500" />
                          </div>
                          <div>
                            <p className="text-xs text-surface-500">Email</p>
                            <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                              {patient.email}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Clinical Info */}
                  {patient.blood_type && (
                    <Card>
                      <h3 className="font-semibold text-surface-900 dark:text-surface-50 mb-4">
                        Información Clínica
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between py-2 border-b border-surface-100 dark:border-surface-700">
                          <span className="text-sm text-surface-500">Tipo de sangre</span>
                          <span className="text-sm font-bold text-red-600 dark:text-red-400">
                            {patient.blood_type}
                          </span>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Timeline */}
                  <Card>
                    <h3 className="font-semibold text-surface-900 dark:text-surface-50 mb-4">
                      Actividad Reciente
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                          <Clock className="w-4 h-4 text-primary-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                            Paciente registrado
                          </p>
                          <p className="text-xs text-surface-500">
                            {formatDate(patient.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {activeTab === 'consultas' && (
                <Card>
                  <h3 className="font-semibold text-surface-900 dark:text-surface-50 mb-4">
                    Historial de Consultas
                  </h3>
                  <p className="text-sm text-surface-500 text-center py-8">
                    No hay consultas registradas
                  </p>
                </Card>
              )}

              {activeTab === 'lab' && (
                <Card>
                  <h3 className="font-semibold text-surface-900 dark:text-surface-50 mb-4">
                    Resultados de Laboratorio
                  </h3>
                  <p className="text-sm text-surface-500 text-center py-8">
                    No hay resultados de laboratorio
                  </p>
                </Card>
              )}

              {activeTab === 'imagenes' && (
                <Card>
                  <h3 className="font-semibold text-surface-900 dark:text-surface-50 mb-4">
                    Estudios de Imagen
                  </h3>
                  <p className="text-sm text-surface-500 text-center py-8">
                    No hay estudios de imagen
                  </p>
                </Card>
              )}

              {activeTab === 'facturacion' && (
                <Card>
                  <h3 className="font-semibold text-surface-900 dark:text-surface-50 mb-4">
                    Historial de Facturación
                  </h3>
                  <p className="text-sm text-surface-500 text-center py-8">
                    No hay facturas registradas
                  </p>
                </Card>
              )}

              {activeTab === 'documentos' && (
                <Card>
                  <h3 className="font-semibold text-surface-900 dark:text-surface-50 mb-4">
                    Documentos
                  </h3>
                  <p className="text-sm text-surface-500 text-center py-8">
                    No hay documentos adjuntos
                  </p>
                </Card>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
