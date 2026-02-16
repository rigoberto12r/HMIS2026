'use client';
import { parseIntSafe, parseFloatSafe } from '@/lib/utils/safe-parse';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { useServices, useCreateService, useUpdateService, useDeleteService, type ServiceCatalog } from '@/hooks/useServices';
import { captureException } from '@/lib/monitoring';

const categoryOptions = [
  { value: '', label: 'Seleccionar categoría' },
  { value: 'consulta', label: 'Consulta' },
  { value: 'laboratorio', label: 'Laboratorio' },
  { value: 'imagenologia', label: 'Imagenología' },
  { value: 'procedimiento', label: 'Procedimiento' },
  { value: 'cirugia', label: 'Cirugía' },
  { value: 'farmacia', label: 'Farmacia' },
  { value: 'hospitalizacion', label: 'Hospitalización' },
  { value: 'otro', label: 'Otro' },
];

const emptyForm = {
  code: '',
  name: '',
  description: '',
  category: '',
  base_price: 0,
  tax_rate: 0.18,
  currency: 'DOP',
  cpt_code: '',
};

export function ServiceCatalogSection() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editService, setEditService] = useState<ServiceCatalog | null>(null);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useServices({ page: 1, page_size: 100 });
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  const services = data?.items || [];

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (svc: ServiceCatalog) => {
    setForm({
      code: svc.code,
      name: svc.name,
      description: svc.description || '',
      category: svc.category,
      base_price: svc.base_price,
      tax_rate: svc.tax_rate,
      currency: svc.currency,
      cpt_code: svc.cpt_code || '',
    });
    setFormError(null);
    setEditService(svc);
  };

  const handleSubmit = async () => {
    if (!form.code || !form.name || !form.category) {
      setFormError('Complete código, nombre y categoría');
      return;
    }

    try {
      if (editService) {
        await updateService.mutateAsync({ id: editService.id, ...form });
        toast.success('Servicio actualizado');
        setEditService(null);
      } else {
        await createService.mutateAsync(form);
        toast.success('Servicio creado exitosamente');
        setShowCreateModal(false);
      }
      setForm(emptyForm);
      setFormError(null);
    } catch (err: any) {
      captureException(err, {
        context: editService ? 'update_service' : 'create_service',
        serviceId: editService?.id,
        serviceCode: form.code,
        category: form.category,
      });
      setFormError(err?.detail || err?.message || 'Error al guardar servicio');
    }
  };

  const handleDelete = async () => {
    if (!deleteServiceId) return;
    try {
      await deleteService.mutateAsync(deleteServiceId);
      toast.success('Servicio eliminado');
      setDeleteServiceId(null);
    } catch (err: any) {
      captureException(err, {
        context: 'delete_service',
        serviceId: deleteServiceId,
      });
      toast.error(err?.detail || err?.message || 'Error al eliminar servicio');
    }
  };

  const isPending = createService.isPending || updateService.isPending;

  const formatPrice = (amount: number, currency: string) =>
    `${currency === 'USD' ? '$' : 'RD$'} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

  const formModal = (
    <Modal
      isOpen={showCreateModal || !!editService}
      onClose={() => { setShowCreateModal(false); setEditService(null); setFormError(null); }}
      title={editService ? 'Editar Servicio' : 'Nuevo Servicio'}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => { setShowCreateModal(false); setEditService(null); }}>Cancelar</Button>
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
        <div className="grid grid-cols-2 gap-4">
          <Input label="Código *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CONS-001" />
          <Select label="Categoría *" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={categoryOptions} />
        </div>
        <Input label="Nombre *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Consulta General" />
        <Input label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid grid-cols-3 gap-4">
          <Input label="Precio Base *" type="number" value={form.base_price.toString()} onChange={(e) => setForm({ ...form, base_price: parseFloatSafe(e.target.value, 0, 'Base Price') })} />
          <Input label="Tasa ITBIS" type="number" value={form.tax_rate.toString()} onChange={(e) => setForm({ ...form, tax_rate: parseFloatSafe(e.target.value, 0, 'Tax Rate') })} placeholder="0.18" />
          <Input label="Código CPT" value={form.cpt_code} onChange={(e) => setForm({ ...form, cpt_code: e.target.value })} placeholder="99213" />
        </div>
      </div>
    </Modal>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-neutral-900">Catálogo de Servicios</h2>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nuevo Servicio
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
                <th className="py-2 px-3 font-medium text-neutral-600">Código</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Nombre</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Categoría</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Precio</th>
                <th className="py-2 px-3 font-medium text-neutral-600">ITBIS</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc: ServiceCatalog) => (
                <tr key={svc.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="py-2 px-3 font-mono text-xs">{svc.code}</td>
                  <td className="py-2 px-3 font-medium">{svc.name}</td>
                  <td className="py-2 px-3 text-neutral-600 capitalize">{svc.category}</td>
                  <td className="py-2 px-3 font-medium">{formatPrice(svc.base_price, svc.currency)}</td>
                  <td className="py-2 px-3 text-neutral-600">{(svc.tax_rate * 100).toFixed(0)}%</td>
                  <td className="py-2 px-3">
                    <div className="flex gap-1">
                      <button onClick={() => handleOpenEdit(svc)} className="p-1 text-neutral-500 hover:text-primary-600 rounded hover:bg-neutral-100" title="Editar">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteServiceId(svc.id)} className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-500">
                    No hay servicios en el catálogo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {formModal}

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteServiceId}
        onClose={() => setDeleteServiceId(null)}
        title="Eliminar Servicio"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteServiceId(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleteService.isPending}>
              {deleteService.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          ¿Está seguro de que desea eliminar este servicio del catálogo?
        </p>
      </Modal>
    </div>
  );
}
