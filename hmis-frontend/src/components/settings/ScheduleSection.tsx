'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Plus, Trash2, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useProviders } from '@/hooks/useProviders';
import {
  useScheduleTemplates,
  useCreateScheduleTemplate,
  useDeleteScheduleTemplate,
  useScheduleBlocks,
  useCreateScheduleBlock,
  useDeleteScheduleBlock,
} from '@/hooks/useSchedules';

const dayNames: Record<number, string> = {
  0: 'Lunes', 1: 'Martes', 2: 'Miércoles', 3: 'Jueves',
  4: 'Viernes', 5: 'Sábado', 6: 'Domingo',
};

const dayOptions = Object.entries(dayNames).map(([value, label]) => ({ value, label }));

const reasonOptions = [
  { value: 'vacation', label: 'Vacaciones' },
  { value: 'meeting', label: 'Reunión' },
  { value: 'surgery', label: 'Cirugía' },
  { value: 'personal', label: 'Personal' },
];

type Tab = 'templates' | 'blocks';

export function ScheduleSection() {
  const [activeTab, setActiveTab] = useState<Tab>('templates');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [templateForm, setTemplateForm] = useState({
    provider_id: '',
    day_of_week: '0',
    start_time: '08:00',
    end_time: '17:00',
    slot_duration_min: '30',
    max_overbooking: '0',
  });

  const [blockForm, setBlockForm] = useState({
    provider_id: '',
    start_datetime: '',
    end_datetime: '',
    reason: 'vacation',
    description: '',
  });

  const { data: providersData } = useProviders({ page_size: 100 });
  const providers = providersData?.items || [];
  const providerOptions = [
    { value: '', label: 'Seleccionar proveedor' },
    ...providers.map((p) => ({ value: p.id, label: `Dr. ${p.first_name} ${p.last_name}` })),
  ];

  const { data: templates, isLoading: loadingTemplates } = useScheduleTemplates();
  const createTemplate = useCreateScheduleTemplate();
  const deleteTemplate = useDeleteScheduleTemplate();

  const { data: blocks, isLoading: loadingBlocks } = useScheduleBlocks();
  const createBlock = useCreateScheduleBlock();
  const deleteBlock = useDeleteScheduleBlock();

  const getProviderName = (providerId: string) => {
    const p = providers.find((pr) => pr.id === providerId);
    return p ? `Dr. ${p.first_name} ${p.last_name}` : providerId.slice(0, 8);
  };

  const handleCreateTemplate = async () => {
    if (!templateForm.provider_id) {
      setFormError('Seleccione un proveedor');
      return;
    }
    try {
      await createTemplate.mutateAsync({
        provider_id: templateForm.provider_id,
        day_of_week: parseInt(templateForm.day_of_week),
        start_time: templateForm.start_time,
        end_time: templateForm.end_time,
        slot_duration_min: parseInt(templateForm.slot_duration_min) || 30,
        max_overbooking: parseInt(templateForm.max_overbooking) || 0,
      });
      toast.success('Horario creado exitosamente');
      setShowTemplateModal(false);
      setFormError(null);
    } catch (err: any) {
      setFormError(err?.detail || err?.message || 'Error al crear horario');
    }
  };

  const handleCreateBlock = async () => {
    if (!blockForm.provider_id || !blockForm.start_datetime || !blockForm.end_datetime) {
      setFormError('Complete proveedor, fecha inicio y fecha fin');
      return;
    }
    try {
      await createBlock.mutateAsync({
        provider_id: blockForm.provider_id,
        start_datetime: blockForm.start_datetime,
        end_datetime: blockForm.end_datetime,
        reason: blockForm.reason,
        description: blockForm.description || undefined,
      });
      toast.success('Bloqueo creado exitosamente');
      setShowBlockModal(false);
      setFormError(null);
    } catch (err: any) {
      setFormError(err?.detail || err?.message || 'Error al crear bloqueo');
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;
    try {
      await deleteTemplate.mutateAsync(deleteTemplateId);
      toast.success('Horario eliminado');
      setDeleteTemplateId(null);
    } catch (err: any) {
      toast.error(err?.detail || err?.message || 'Error al eliminar horario');
    }
  };

  const handleDeleteBlock = async () => {
    if (!deleteBlockId) return;
    try {
      await deleteBlock.mutateAsync(deleteBlockId);
      toast.success('Bloqueo eliminado');
      setDeleteBlockId(null);
    } catch (err: any) {
      toast.error(err?.detail || err?.message || 'Error al eliminar bloqueo');
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'templates' ? 'border-primary-500 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-1" /> Horarios Semanales
        </button>
        <button
          onClick={() => setActiveTab('blocks')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'blocks' ? 'border-primary-500 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-1" /> Bloqueos de Agenda
        </button>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setShowTemplateModal(true); setFormError(null); }}>
              <Plus className="w-4 h-4 mr-1" /> Nuevo Horario
            </Button>
          </div>
          {loadingTemplates ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-400" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left">
                    <th className="py-2 px-3 font-medium text-neutral-600">Proveedor</th>
                    <th className="py-2 px-3 font-medium text-neutral-600">Día</th>
                    <th className="py-2 px-3 font-medium text-neutral-600">Hora Inicio</th>
                    <th className="py-2 px-3 font-medium text-neutral-600">Hora Fin</th>
                    <th className="py-2 px-3 font-medium text-neutral-600">Slot (min)</th>
                    <th className="py-2 px-3 font-medium text-neutral-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(templates || []).map((t) => (
                    <tr key={t.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="py-2 px-3 font-medium">{getProviderName(t.provider_id)}</td>
                      <td className="py-2 px-3">{dayNames[t.day_of_week] || t.day_of_week}</td>
                      <td className="py-2 px-3 font-mono text-xs">{t.start_time}</td>
                      <td className="py-2 px-3 font-mono text-xs">{t.end_time}</td>
                      <td className="py-2 px-3">{t.slot_duration_min} min</td>
                      <td className="py-2 px-3">
                        <button onClick={() => setDeleteTemplateId(t.id)} className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!templates || templates.length === 0) && (
                    <tr><td colSpan={6} className="py-8 text-center text-neutral-500">No hay horarios configurados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Blocks Tab */}
      {activeTab === 'blocks' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setShowBlockModal(true); setFormError(null); }}>
              <Plus className="w-4 h-4 mr-1" /> Nuevo Bloqueo
            </Button>
          </div>
          {loadingBlocks ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-400" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left">
                    <th className="py-2 px-3 font-medium text-neutral-600">Proveedor</th>
                    <th className="py-2 px-3 font-medium text-neutral-600">Desde</th>
                    <th className="py-2 px-3 font-medium text-neutral-600">Hasta</th>
                    <th className="py-2 px-3 font-medium text-neutral-600">Razón</th>
                    <th className="py-2 px-3 font-medium text-neutral-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(blocks || []).map((b) => (
                    <tr key={b.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="py-2 px-3 font-medium">{getProviderName(b.provider_id)}</td>
                      <td className="py-2 px-3 text-xs">{new Date(b.start_datetime).toLocaleString('es-DO')}</td>
                      <td className="py-2 px-3 text-xs">{new Date(b.end_datetime).toLocaleString('es-DO')}</td>
                      <td className="py-2 px-3 capitalize">{b.reason}</td>
                      <td className="py-2 px-3">
                        <button onClick={() => setDeleteBlockId(b.id)} className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!blocks || blocks.length === 0) && (
                    <tr><td colSpan={5} className="py-8 text-center text-neutral-500">No hay bloqueos de agenda</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Template Modal */}
      <Modal
        isOpen={showTemplateModal}
        onClose={() => { setShowTemplateModal(false); setFormError(null); }}
        title="Nuevo Horario Semanal"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowTemplateModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateTemplate} disabled={createTemplate.isPending}>
              {createTemplate.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando...</> : 'Crear Horario'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{formError}</p>
            </div>
          )}
          <Select label="Proveedor *" value={templateForm.provider_id} onChange={(e) => setTemplateForm({ ...templateForm, provider_id: e.target.value })} options={providerOptions} />
          <Select label="Día de la Semana *" value={templateForm.day_of_week} onChange={(e) => setTemplateForm({ ...templateForm, day_of_week: e.target.value })} options={dayOptions} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Hora Inicio *" type="time" value={templateForm.start_time} onChange={(e) => setTemplateForm({ ...templateForm, start_time: e.target.value })} />
            <Input label="Hora Fin *" type="time" value={templateForm.end_time} onChange={(e) => setTemplateForm({ ...templateForm, end_time: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Duración del Slot (min)" type="number" value={templateForm.slot_duration_min} onChange={(e) => setTemplateForm({ ...templateForm, slot_duration_min: e.target.value })} />
            <Input label="Max Sobreturno" type="number" value={templateForm.max_overbooking} onChange={(e) => setTemplateForm({ ...templateForm, max_overbooking: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Create Block Modal */}
      <Modal
        isOpen={showBlockModal}
        onClose={() => { setShowBlockModal(false); setFormError(null); }}
        title="Nuevo Bloqueo de Agenda"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowBlockModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateBlock} disabled={createBlock.isPending}>
              {createBlock.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando...</> : 'Crear Bloqueo'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{formError}</p>
            </div>
          )}
          <Select label="Proveedor *" value={blockForm.provider_id} onChange={(e) => setBlockForm({ ...blockForm, provider_id: e.target.value })} options={providerOptions} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Desde *" type="datetime-local" value={blockForm.start_datetime} onChange={(e) => setBlockForm({ ...blockForm, start_datetime: e.target.value })} />
            <Input label="Hasta *" type="datetime-local" value={blockForm.end_datetime} onChange={(e) => setBlockForm({ ...blockForm, end_datetime: e.target.value })} />
          </div>
          <Select label="Razón *" value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} options={reasonOptions} />
          <Input label="Descripción" value={blockForm.description} onChange={(e) => setBlockForm({ ...blockForm, description: e.target.value })} placeholder="Detalles adicionales..." />
        </div>
      </Modal>

      {/* Delete Confirmations */}
      <Modal isOpen={!!deleteTemplateId} onClose={() => setDeleteTemplateId(null)} title="Eliminar Horario" size="sm"
        footer={<><Button variant="outline" onClick={() => setDeleteTemplateId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDeleteTemplate} disabled={deleteTemplate.isPending}>{deleteTemplate.isPending ? 'Eliminando...' : 'Eliminar'}</Button></>}>
        <p className="text-sm text-neutral-600">¿Está seguro de que desea eliminar este horario?</p>
      </Modal>

      <Modal isOpen={!!deleteBlockId} onClose={() => setDeleteBlockId(null)} title="Eliminar Bloqueo" size="sm"
        footer={<><Button variant="outline" onClick={() => setDeleteBlockId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDeleteBlock} disabled={deleteBlock.isPending}>{deleteBlock.isPending ? 'Eliminando...' : 'Eliminar'}</Button></>}>
        <p className="text-sm text-neutral-600">¿Está seguro de que desea eliminar este bloqueo de agenda?</p>
      </Modal>
    </div>
  );
}
