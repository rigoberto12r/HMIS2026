'use client';

import { useState } from 'react';
import { Download, Trash2, FileText, Image, File, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useAttachments, useDeleteAttachment, getDownloadUrl, type Attachment } from '@/hooks/useAttachments';

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  lab_result: 'Lab',
  imaging: 'Imagen',
  consent: 'Consentimiento',
  referral: 'Referencia',
};

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return Image;
  if (fileType === 'application/pdf') return FileText;
  return File;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AttachmentListProps {
  encounterId: string;
  readOnly?: boolean;
}

export function AttachmentList({ encounterId, readOnly }: AttachmentListProps) {
  const { data: attachments = [], isLoading } = useAttachments(encounterId);
  const deleteMutation = useDeleteAttachment();
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);

  const handleDownload = (attachment: Attachment) => {
    // Open presigned URL in new tab (redirect endpoint)
    const token = localStorage.getItem('hmis_access_token');
    const tenant = localStorage.getItem('hmis_tenant_id') || 'demo';
    const url = getDownloadUrl(attachment.id);

    // Use fetch to get the redirect URL with auth headers
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-ID': tenant,
      },
      redirect: 'follow',
    })
      .then((res) => {
        if (res.ok) return res.blob();
        throw new Error('Error al descargar');
      })
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = attachment.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      })
      .catch(() => {
        // Fallback: open directly
        window.open(url, '_blank');
      });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({
        attachmentId: deleteTarget.id,
        encounterId,
      });
      setDeleteTarget(null);
    } catch {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-6">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-neutral-400" />
        <p className="text-xs text-neutral-400 mt-1">Cargando adjuntos...</p>
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay archivos adjuntos</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {attachments.map((att) => {
          const Icon = getFileIcon(att.file_type);
          return (
            <div
              key={att.id}
              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center">
                <Icon className="w-4 h-4 text-neutral-500" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{att.file_name}</p>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span>{formatSize(att.file_size)}</span>
                  <span className="text-neutral-300">|</span>
                  <span className="px-1.5 py-0.5 bg-neutral-100 rounded text-[10px] font-medium">
                    {CATEGORY_LABELS[att.category] || att.category}
                  </span>
                  <span className="text-neutral-300">|</span>
                  <span>{formatDate(att.created_at)}</span>
                </div>
                {att.description && (
                  <p className="text-xs text-neutral-500 mt-0.5 truncate">{att.description}</p>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDownload(att)}
                  className="p-1.5 text-neutral-500 hover:text-primary-600 rounded hover:bg-neutral-100"
                  title="Descargar"
                >
                  <Download className="w-4 h-4" />
                </button>
                {!readOnly && (
                  <button
                    onClick={() => setDeleteTarget(att)}
                    className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-red-50"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar Archivo"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          ¿Está seguro de que desea eliminar <strong>{deleteTarget?.file_name}</strong>?
          Esta acción no se puede deshacer.
        </p>
      </Modal>
    </>
  );
}
