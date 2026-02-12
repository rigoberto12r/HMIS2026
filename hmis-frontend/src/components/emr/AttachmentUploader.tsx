'use client';

import { useState, useRef } from 'react';
import { Upload, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { useUploadAttachment } from '@/hooks/useAttachments';

const categoryOptions = [
  { value: 'general', label: 'General' },
  { value: 'lab_result', label: 'Resultado de Laboratorio' },
  { value: 'imaging', label: 'Imagen Diagnóstica' },
  { value: 'consent', label: 'Consentimiento' },
  { value: 'referral', label: 'Referencia' },
];

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

interface AttachmentUploaderProps {
  encounterId: string;
  disabled?: boolean;
}

export function AttachmentUploader({ encounterId, disabled }: AttachmentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [error, setError] = useState<string | null>(null);

  const upload = useUploadAttachment();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Tipo de archivo no permitido. Use PDF, imágenes, o documentos Word.');
      return;
    }

    if (file.size > MAX_SIZE) {
      setError('El archivo excede el tamaño máximo de 10 MB.');
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setError(null);

    try {
      await upload.mutateAsync({
        encounterId,
        file: selectedFile,
        description: description || undefined,
        category,
      });
      // Reset form
      setSelectedFile(null);
      setDescription('');
      setCategory('general');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir archivo');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
      <h4 className="text-sm font-medium text-neutral-700">Subir Archivo</h4>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Archivo *</label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.doc,.docx"
            disabled={disabled || upload.isPending}
            className="block w-full text-xs text-neutral-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 disabled:opacity-50"
          />
          {selectedFile && (
            <p className="text-xs text-neutral-500 mt-1">
              {selectedFile.name} ({formatSize(selectedFile.size)})
            </p>
          )}
        </div>
        <Select
          label="Categoría"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={categoryOptions}
        />
      </div>

      <Input
        label="Descripción (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Ej: Resultado de hemograma completo"
      />

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleUpload}
          disabled={!selectedFile || disabled || upload.isPending}
        >
          {upload.isPending ? (
            <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Subiendo...</>
          ) : (
            <><Upload className="w-4 h-4 mr-1" /> Subir Archivo</>
          )}
        </Button>
      </div>
    </div>
  );
}
