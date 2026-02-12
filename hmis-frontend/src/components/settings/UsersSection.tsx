'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUsers, useRoles, useCreateUser, useDeleteUser, type User } from '@/hooks/useUsers';

export function UsersSection() {
  const [page] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const { data, isLoading } = useUsers({ page, page_size: 50 });
  const { data: roles } = useRoles();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();

  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    specialty: '',
    department: '',
    role_ids: [] as string[],
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.first_name || !form.last_name) {
      setFormError('Complete todos los campos requeridos');
      return;
    }
    try {
      await createUser.mutateAsync(form);
      toast.success('Usuario creado exitosamente');
      setShowCreateModal(false);
      setForm({ email: '', password: '', first_name: '', last_name: '', phone: '', specialty: '', department: '', role_ids: [] });
      setFormError(null);
    } catch (err: any) {
      setFormError(err?.detail || err?.message || 'Error al crear usuario');
    }
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    try {
      await deleteUser.mutateAsync(deleteUserId);
      toast.success('Usuario eliminado');
      setDeleteUserId(null);
    } catch (err: any) {
      toast.error(err?.detail || err?.message || 'Error al eliminar usuario');
    }
  };

  const users = data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-neutral-900">Usuarios y Roles</h2>
        <Button size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nuevo Usuario
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
                <th className="py-2 px-3 font-medium text-neutral-600">Email</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Rol</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Estado</th>
                <th className="py-2 px-3 font-medium text-neutral-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user: User) => (
                <tr key={user.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="py-2 px-3 font-medium">{user.first_name} {user.last_name}</td>
                  <td className="py-2 px-3 text-neutral-600">{user.email}</td>
                  <td className="py-2 px-3">
                    {user.roles.length > 0 ? (
                      user.roles.map((r) => (
                        <Badge key={r.id} variant="primary" size="sm" className="mr-1">
                          {r.display_name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-neutral-400">Sin rol</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <Badge variant={user.is_active ? 'success' : 'danger'} size="sm">
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => setDeleteUserId(user.id)}
                      className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-neutral-500">
                    No hay usuarios registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setFormError(null); }}
        title="Nuevo Usuario"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createUser.isPending}>
              {createUser.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando...</> : 'Crear Usuario'}
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
            <Input label="Nombre *" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <Input label="Apellido *" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <Input label="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Contraseña *" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Especialidad" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
          </div>
          <Input label="Departamento" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          {roles && roles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Roles</label>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.role_ids.includes(role.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({ ...form, role_ids: [...form.role_ids, role.id] });
                        } else {
                          setForm({ ...form, role_ids: form.role_ids.filter((id) => id !== role.id) });
                        }
                      }}
                    />
                    {role.display_name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        title="Confirmar Eliminación"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleteUser.isPending}>
              {deleteUser.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          ¿Está seguro de que desea desactivar este usuario? El usuario no podrá acceder al sistema.
        </p>
      </Modal>
    </div>
  );
}
