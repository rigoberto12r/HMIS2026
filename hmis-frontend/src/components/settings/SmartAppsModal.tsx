/**
 * SmartAppsModal Component
 * Admin UI for managing SMART on FHIR OAuth2 application registrations.
 */

'use client';

import { useState } from 'react';
import { Trash2, Copy, CheckCircle2, AlertTriangle, Plus, Key } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  useSmartClients,
  useRegisterSmartClient,
  useDeleteSmartClient,
  type RegisterClientResponse,
} from '@/hooks/useSmartApps';

interface SmartAppsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SmartAppsModal({ isOpen, onClose }: SmartAppsModalProps) {
  const { data: clients = [], isLoading } = useSmartClients();
  const registerMutation = useRegisterSmartClient();
  const deleteMutation = useDeleteSmartClient();

  // Register form state
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formRedirectUri, setFormRedirectUri] = useState('');
  const [formScope, setFormScope] = useState('patient/Patient.read');
  const [formType, setFormType] = useState<'confidential' | 'public'>('confidential');

  // Success state - shows secret one time
  const [createdClient, setCreatedClient] = useState<RegisterClientResponse | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Delete confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const resetForm = () => {
    setFormName('');
    setFormRedirectUri('');
    setFormScope('patient/Patient.read');
    setFormType('confidential');
    setShowForm(false);
    setCreatedClient(null);
  };

  const handleRegister = async () => {
    if (!formName.trim() || !formRedirectUri.trim()) return;
    try {
      const result = await registerMutation.mutateAsync({
        client_name: formName.trim(),
        redirect_uris: [formRedirectUri.trim()],
        scope: formScope.trim(),
        client_type: formType,
      });
      setCreatedClient(result);
      setShowForm(false);
    } catch {
      // Error handled by React Query
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setConfirmDeleteId(null);
    } catch {
      // Error handled by React Query
    }
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { resetForm(); onClose(); }}
      title="Aplicaciones SMART on FHIR"
      description="Registra y administra aplicaciones externas autorizadas via OAuth2."
      size="lg"
    >
      <div className="space-y-4">
        {/* Created client secret (one-time display) */}
        {createdClient && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" />
              <p className="font-semibold text-sm">Aplicacion registrada exitosamente</p>
            </div>
            <p className="text-xs text-green-600">
              Guarde el client_secret ahora. No se mostrara de nuevo.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-white rounded p-2">
                <span className="text-xs text-neutral-500 w-20 flex-shrink-0">Client ID:</span>
                <code className="text-xs text-neutral-900 flex-1 truncate">{createdClient.client_id}</code>
                <button
                  onClick={() => handleCopy(createdClient.client_id, 'id')}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  {copiedField === 'id' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2 bg-white rounded p-2">
                <span className="text-xs text-neutral-500 w-20 flex-shrink-0">Secret:</span>
                <code className="text-xs text-neutral-900 flex-1 truncate">{createdClient.client_secret}</code>
                <button
                  onClick={() => handleCopy(createdClient.client_secret, 'secret')}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  {copiedField === 'secret' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCreatedClient(null)}>
              Entendido
            </Button>
          </div>
        )}

        {/* Register form (inline toggle) */}
        {!createdClient && (
          <>
            {showForm ? (
              <Card variant="bordered" padding="md">
                <div className="space-y-3">
                  <Input
                    label="Nombre de la aplicacion"
                    placeholder="Mi App SMART"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                  <Input
                    label="Redirect URI"
                    placeholder="https://miapp.com/callback"
                    required
                    value={formRedirectUri}
                    onChange={(e) => setFormRedirectUri(e.target.value)}
                  />
                  <Input
                    label="Scopes"
                    placeholder="patient/Patient.read patient/Observation.read"
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                  />
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Tipo de cliente</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="client_type"
                          checked={formType === 'confidential'}
                          onChange={() => setFormType('confidential')}
                          className="accent-primary-500"
                        />
                        Confidential
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="client_type"
                          checked={formType === 'public'}
                          onChange={() => setFormType('public')}
                          className="accent-primary-500"
                        />
                        Public
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={handleRegister}
                      isLoading={registerMutation.isPending}
                      disabled={!formName.trim() || !formRedirectUri.trim()}
                      leftIcon={<Key className="w-4 h-4" />}
                    >
                      Registrar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                      Cancelar
                    </Button>
                  </div>
                  {registerMutation.isError && (
                    <div className="flex items-center gap-2 text-red-600 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Error al registrar la aplicacion
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowForm(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Registrar nueva aplicacion
              </Button>
            )}
          </>
        )}

        {/* Client list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-8">
            <Key className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No hay aplicaciones registradas.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clients.map((client) => (
              <div
                key={client.id}
                className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-100"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-900 truncate">{client.client_name}</p>
                    <Badge variant={client.is_active ? 'success' : 'default'} size="sm">
                      {client.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Badge variant="info" size="sm">{client.client_type}</Badge>
                  </div>
                  <p className="text-xs text-neutral-400 font-mono truncate mt-0.5">
                    {client.client_id}
                  </p>
                  {client.scope && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {client.scope.split(' ').filter(Boolean).map((s) => (
                        <Badge key={s} variant="outline" size="sm">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                {confirmDeleteId === client.id ? (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(client.id)}
                      isLoading={deleteMutation.isPending}
                    >
                      Confirmar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                      No
                    </Button>
                  </div>
                ) : (
                  <button
                    className="text-neutral-400 hover:text-red-500 flex-shrink-0 p-1"
                    onClick={() => setConfirmDeleteId(client.id)}
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
