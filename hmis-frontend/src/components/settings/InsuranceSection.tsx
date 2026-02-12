'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useInsurers,
  useCreateInsurer,
  useUpdateInsurer,
  useDeleteInsurer,
  type InsurerContract,
} from '@/hooks/useInsurers';

const statusOptions = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'expired', label: 'Expirado' },
];

const emptyForm = {
  insurer_name: '',
  insurer_code: '',
  contract_number: '',
  effective_date: '',
  expiration_date: '',
  status: 'active',
};

const statusBadge: Record<string, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  inactive: 'warning',
  expired: 'danger',
};

export function InsuranceSection() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editInsurer, setEditInsurer] = useState<InsurerContract | null>(null);
  const [deleteInsurerId, setDeleteInsurerId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useInsurers({ page: 1, page_size: 100 });
  const createInsurer = useCreateInsurer();
  const updateInsurer = useUpdateInsurer();
  const deleteInsurer = useDeleteInsurer();

  const insurers = data?.items || [];

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (ins: InsurerContract) => {
    setForm({
      insurer_name: ins.insurer_name,
      insurer_code: ins.insurer_code,
      contract_number: ins.contract_number,
      effective_date: ins.effective_date,
      expiration_date: ins.expiration_date || '',
      status: ins.status,
    });
    setFormError(null);
    setEditInsurer(ins);
  };

  const handleSubmit = async () => {
    if (!form.insurer_name || !form.insurer_code || !form.contract_number || !form.effective_date) {
      setFormError('Complete nombre, código, número de contrato y fecha de vigencia');
      return;
    }

    const payload = {
      insurer_name: form.insurer_name,
      insurer_code: form.insurer_code,
      contract_number: form.contract_number,
      effective_date: form.effective_date,
      expiration_date: form.expiration_date || undefined,
      status: form.status,
    };

    try {
      if (editInsurer) {
        await updateInsurer.mutateAsync({ id: editInsurer.id, ...payload });
        toast.success('Aseguradora actualizada');
        setEditInsurer(null);
      } else {
        await createInsurer.mutateAsync(payload);
        toast.success('Aseguradora creada exitosamente');
        setShowCreateModal(false);
      }
      setForm(emptyForm);
      setFormError(null);
    } catch (err: any) {
      setFormError(err?.detail || err?.message || 'Error al guardar aseguradora');
    }
  };

  const handleDelete = async () => {
    if (!deleteInsurerId) return;
    try {
      await deleteInsurer.mutateAsync(deleteInsurerId);
      toast.success('Aseguradora eliminada');
      setDeleteInsurerId(null);
    } catch (err: any) {
      toast.error(err?.detail || err?.message || 'Error al eliminar aseguradora');
    }
  };

  const isPending = createInsurer.isPending || updateInsurer.isPending;

  const formModal = (
    <Modal
      isOpen={showCreateModal || !!editInsurer}
      onClose={() => { setShowCreateModal(false); setEditInsurer(null); setFormError(null); }}
      title={editInsurer ? 'Editar Aseguradora' : 'Nueva Aseguradora'}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => { setShowCreateModal(false); setEditInsurer(null); }}>Cancelar</Button>
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
          <Input label="Nombre de Aseguradora *" value={form.insurer_name} onChange={(e) => setForm({ ...form, insurer_name: e.target.value })} placeholder="ARS Humano" />
          <Input label="Código *" value={form.insurer_code} onChange={(e) => setForm({ ...form, insurer_code: e.target.value })} placeholder="ARS-001" />
        </div>
        <Input label="Número de Contrato *" value={form.contract_number} onChange={(e) => setForm({ ...form, contract_number: e.target.value })} placeholder="CONT-2026-001" />
        <div className="grid grid-cols-3 gap-4">
          <Input label="Vigencia Desde *" type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
          <Input label="Vigencia Hasta" type="date" value={form.expiration_date} onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} />
          <Select label="Estado" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={statusOptions} />
        </div>
      </div>
    </Modal>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-neutral-900">Contratos con Aseguradoras</h2>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nueva Aseguradora
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
                <th className="py-2 px-3 font-medium text-neutral-600">Aseguradora</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Código</th>
                <th className="py-2 px-3 font-medium text-neutral-600">No. Contrato</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Vigencia</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Estado</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {insurers.map((ins) => (
                <tr key={ins.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="py-2 px-3 font-medium">{ins.insurer_name}</td>
                  <td className="py-2 px-3 font-mono text-xs">{ins.insurer_code}</td>
                  <td className="py-2 px-3 text-neutral-600">{ins.contract_number}</td>
                  <td className="py-2 px-3 text-neutral-600 text-xs">
                    {new Date(ins.effective_date).toLocaleDateString('es-DO')}
                    {ins.expiration_date && ` — ${new Date(ins.expiration_date).toLocaleDateString('es-DO')}`}
                  </td>
                  <td className="py-2 px-3">
                    <Badge variant={statusBadge[ins.status] || 'primary'}>{ins.status}</Badge>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex gap-1">
                      <button onClick={() => handleOpenEdit(ins)} className="p-1 text-neutral-500 hover:text-primary-600 rounded hover:bg-neutral-100" title="Editar">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteInsurerId(ins.id)} className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {insurers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-500">
                    No hay aseguradoras registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {formModal}

      <Modal
        isOpen={!!deleteInsurerId}
        onClose={() => setDeleteInsurerId(null)}
        title="Eliminar Aseguradora"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteInsurerId(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleteInsurer.isPending}>
              {deleteInsurer.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          ¿Está seguro de que desea eliminar este contrato de aseguradora?
        </p>
      </Modal>
    </div>
  );
}
