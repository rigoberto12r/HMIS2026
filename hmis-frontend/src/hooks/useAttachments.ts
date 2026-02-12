import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface Attachment {
  id: string;
  encounter_id: string;
  file_key: string;
  file_name: string;
  file_type: string;
  file_size: number;
  description: string | null;
  category: string;
  uploaded_by: string;
  created_at: string;
}

function getHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('hmis_access_token') : null;
  const tenant = typeof window !== 'undefined' ? localStorage.getItem('hmis_tenant_id') || 'demo' : 'demo';
  const headers: Record<string, string> = { 'X-Tenant-ID': tenant };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function useAttachments(encounterId: string | undefined) {
  return useQuery({
    queryKey: ['attachments', encounterId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE_URL}/emr/encounters/${encounterId}/attachments`,
        { headers: { ...getHeaders(), Accept: 'application/json' } },
      );
      if (!res.ok) throw new Error('Error al cargar adjuntos');
      return res.json() as Promise<Attachment[]>;
    },
    enabled: !!encounterId,
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      encounterId,
      file,
      description,
      category,
    }: {
      encounterId: string;
      file: File;
      description?: string;
      category?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);

      const params = new URLSearchParams();
      if (description) params.set('description', description);
      if (category) params.set('category', category);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(
        `${API_BASE_URL}/emr/encounters/${encounterId}/attachments${qs}`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: formData,
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al subir archivo');
      }
      return res.json() as Promise<Attachment>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', variables.encounterId] });
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attachmentId, encounterId }: { attachmentId: string; encounterId: string }) => {
      const res = await fetch(`${API_BASE_URL}/emr/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { ...getHeaders(), Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Error al eliminar archivo');
      return encounterId;
    },
    onSuccess: (encounterId) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', encounterId] });
    },
  });
}

export function getDownloadUrl(attachmentId: string): string {
  return `${API_BASE_URL}/emr/attachments/${attachmentId}/download`;
}
