'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useClinicalTemplates,
  useCreateClinicalTemplate,
  useUpdateClinicalTemplate,
  useDeleteClinicalTemplate,
  type ClinicalTemplate,
} from '@/hooks/useClinicalTemplates';

const specialtyOptions = [
  { value: '', label: 'Todas las especialidades' },
  { value: 'medicina-general', label: 'Medicina General' },
  { value: 'pediatria', label: 'Pediatría' },
  { value: 'ginecologia', label: 'Ginecología' },
  { value: 'cardiologia', label: 'Cardiología' },
  { value: 'ortopedia', label: 'Ortopedia' },
  { value: 'dermatologia', label: 'Dermatología' },
  { value: 'neurologia', label: 'Neurología' },
  { value: 'oftalmologia', label: 'Oftalmología' },
];

const typeOptions = [
  { value: '', label: 'Todos los tipos' },
  { value: 'soap', label: 'SOAP' },
  { value: 'procedure', label: 'Procedimiento' },
  { value: 'discharge', label: 'Alta' },
  { value: 'admission', label: 'Admisión' },
];

const emptyForm = {
  name: '',
  specialty_code: '',
  template_type: 'soap',
  schema_json: '{}',
  is_default: false,
};

export function ClinicalTemplatesSection() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<ClinicalTemplate | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterSpecialty, setFilterSpecialty] = useState('');
  const [filterType, setFilterType] = useState('');

  const { data: templates, isLoading } = useClinicalTemplates({
    specialty_code: filterSpecialty || undefined,
    template_type: filterType || undefined,
  });
  const createTemplate = useCreateClinicalTemplate();
  const updateTemplate = useUpdateClinicalTemplate();
  const deleteTemplate = useDeleteClinicalTemplate();

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (tpl: ClinicalTemplate) => {
    setForm({
      name: tpl.name,
      specialty_code: tpl.specialty_code || '',
      template_type: tpl.template_type,
      schema_json: JSON.stringify(tpl.schema_json, null, 2),
      is_default: tpl.is_default,
    });
    setFormError(null);
    setEditTemplate(tpl);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.template_type) {
      setFormError('Complete nombre y tipo de plantilla');
      return;
    }

    let schemaJson: Record<string, unknown>;
    try {
      schemaJson = JSON.parse(form.schema_json);
    } catch {
      setFormError('El JSON del esquema no es válido');
      return;
    }

    const payload = {
      name: form.name,
      specialty_code: form.specialty_code || undefined,
      template_type: form.template_type,
      schema_json: schemaJson,
      is_default: form.is_default,
    };

    try {
      if (editTemplate) {
        await updateTemplate.mutateAsync({ id: editTemplate.id, ...payload });
        toast.success('Plantilla actualizada');
        setEditTemplate(null);
      } else {
        await createTemplate.mutateAsync(payload);
        toast.success('Plantilla creada exitosamente');
        setShowCreateModal(false);
      }
      setForm(emptyForm);
      setFormError(null);
    } catch (err: any) {
      setFormError(err?.detail || err?.message || 'Error al guardar plantilla');
    }
  };

  const handleDelete = async () => {
    if (!deleteTemplateId) return;
    try {
      await deleteTemplate.mutateAsync(deleteTemplateId);
      toast.success('Plantilla eliminada');
      setDeleteTemplateId(null);
    } catch (err: any) {
      toast.error(err?.detail || err?.message || 'Error al eliminar plantilla');
    }
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  const formModal = (
    <Modal
      isOpen={showCreateModal || !!editTemplate}
      onClose={() => { setShowCreateModal(false); setEditTemplate(null); setFormError(null); }}
      title={editTemplate ? 'Editar Plantilla' : 'Nueva Plantilla Clínica'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => { setShowCreateModal(false); setEditTemplate(null); }}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</> : 'Guardar'}
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
        <Input label="Nombre *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Consulta General SOAP" />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Especialidad" value={form.specialty_code} onChange={(e) => setForm({ ...form, specialty_code: e.target.value })} options={specialtyOptions} />
          <Select label="Tipo *" value={form.template_type} onChange={(e) => setForm({ ...form, template_type: e.target.value })} options={typeOptions.filter(o => o.value !== '')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Esquema JSON *</label>
          <textarea
            value={form.schema_json}
            onChange={(e) => setForm({ ...form, schema_json: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            placeholder='{"sections": [{"name": "subjective", "fields": [...]}]}'
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
            className="text-primary-600"
          />
          <span className="text-sm">Plantilla por defecto para esta especialidad</span>
        </label>
      </div>
    </Modal>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex gap-3">
          <Select value={filterSpecialty} onChange={(e) => setFilterSpecialty(e.target.value)} options={specialtyOptions} />
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} options={typeOptions} />
        </div>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nueva Plantilla
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-400" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left">
                <th className="py-2 px-3 font-medium text-neutral-600">Nombre</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Especialidad</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Tipo</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Version</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Default</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(templates || []).map((tpl) => (
                <tr key={tpl.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="py-2 px-3 font-medium">{tpl.name}</td>
                  <td className="py-2 px-3 text-neutral-600 capitalize">{tpl.specialty_code || '—'}</td>
                  <td className="py-2 px-3 text-neutral-600 uppercase text-xs font-mono">{tpl.template_type}</td>
                  <td className="py-2 px-3 text-neutral-600">v{tpl.version}</td>
                  <td className="py-2 px-3">{tpl.is_default ? <span className="text-green-600 text-xs font-medium">Sí</span> : '—'}</td>
                  <td className="py-2 px-3">
                    <div className="flex gap-1">
                      <button onClick={() => handleOpenEdit(tpl)} className="p-1 text-neutral-500 hover:text-primary-600 rounded hover:bg-neutral-100" title="Editar">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTemplateId(tpl.id)} className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!templates || templates.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-500">
                    No hay plantillas clínicas configuradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {formModal}

      <Modal
        isOpen={!!deleteTemplateId}
        onClose={() => setDeleteTemplateId(null)}
        title="Eliminar Plantilla"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTemplateId(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleteTemplate.isPending}>
              {deleteTemplate.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          ¿Está seguro de que desea eliminar esta plantilla clínica?
        </p>
      </Modal>
    </div>
  );
}
