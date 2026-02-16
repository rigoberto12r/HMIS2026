'use client';

import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
// @ts-ignore - Optional rich text editor dependencies
import { useEditor, EditorContent } from '@tiptap/react';
// @ts-ignore - Optional rich text editor dependencies
import StarterKit from '@tiptap/starter-kit';
import {
  Save,
  FileText,
  CheckCircle,
  Mic,
  MicOff,
  Loader2,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import type { RadReport, RadStudy, RadTemplate } from '@/types/radiology';

export interface ReportFormData {
  template_id?: string;
  comparison_studies?: string[];
  comparison_text?: string;
  findings: string;
  impression: string;
  recommendations?: string;
}

export interface ReportFormProps {
  study: RadStudy;
  report?: RadReport;
  templates: RadTemplate[];
  comparisonStudies?: RadStudy[];
  onSubmit: (data: ReportFormData) => Promise<void>;
  onSaveDraft: (data: ReportFormData) => Promise<void>;
  onPreview?: () => void;
  isSubmitting?: boolean;
}

export function ReportForm({
  study,
  report,
  templates,
  comparisonStudies = [],
  onSubmit,
  onSaveDraft,
  onPreview,
  isSubmitting = false,
}: ReportFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ReportFormData>({
    defaultValues: {
      template_id: report?.template_id || '',
      comparison_studies: [],
      comparison_text: report?.comparison_text || '',
      findings: report?.findings || '',
      impression: report?.impression || '',
      recommendations: report?.recommendations || '',
    },
  });

  // Rich text editor for findings
  const findingsEditor = useEditor({
    extensions: [StarterKit],
    content: report?.findings || '',
    // @ts-ignore - Optional TipTap dependency
    onUpdate: ({ editor }) => {
      setValue('findings', editor.getHTML());
      scheduleAutoSave();
    },
  });

  // Rich text editor for impression
  const impressionEditor = useEditor({
    extensions: [StarterKit],
    content: report?.impression || '',
    // @ts-ignore - Optional TipTap dependency
    onUpdate: ({ editor }) => {
      setValue('impression', editor.getHTML());
      scheduleAutoSave();
    },
  });

  // Auto-save every 2 minutes
  const scheduleAutoSave = () => {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    const timeout = setTimeout(() => {
      const data = {
        template_id: selectedTemplate || undefined,
        findings: findingsEditor?.getHTML() || '',
        impression: impressionEditor?.getHTML() || '',
        comparison_text: watch('comparison_text'),
        recommendations: watch('recommendations'),
      };

      onSaveDraft(data).then(() => {
        setLastSaved(new Date());
        toast.success('Draft auto-saved');
      });
    }, 120000); // 2 minutes

    setAutoSaveTimeout(timeout);
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [autoSaveTimeout]);

  // Apply template
  const applyTemplate = () => {
    const template = templates.find((t) => t.id === selectedTemplate);
    if (!template) {
      toast.error('Template not found');
      return;
    }

    let text = template.template_text;

    // Replace placeholders
    text = text
      .replace(/\{patient_name\}/g, study.patient_name || 'Unknown')
      .replace(/\{study_date\}/g, study.performed_date || study.scheduled_date || 'Unknown')
      .replace(/\{modality\}/g, study.modality)
      .replace(/\{body_part\}/g, study.study_description || '');

    // Split into findings and impression sections
    const findingsMatch = text.match(/FINDINGS:([\s\S]*?)(?:IMPRESSION:|$)/i);
    const impressionMatch = text.match(/IMPRESSION:([\s\S]*?)$/i);

    if (findingsMatch) {
      findingsEditor?.commands.setContent(findingsMatch[1].trim());
    }
    if (impressionMatch) {
      impressionEditor?.commands.setContent(impressionMatch[1].trim());
    }

    toast.success('Template applied');
  };

  // Voice dictation (Web Speech API)
  const toggleDictation = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      toast.info('Dictation stopped');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      toast.success('Dictation started');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        // Append to findings editor
        const currentContent = findingsEditor?.getHTML() || '';
        findingsEditor?.commands.setContent(currentContent + ' ' + finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      toast.error('Dictation error: ' + event.error);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handleFormSubmit = async (data: ReportFormData) => {
    const formData = {
      ...data,
      template_id: selectedTemplate || undefined,
      findings: findingsEditor?.getHTML() || '',
      impression: impressionEditor?.getHTML() || '',
    };

    await onSubmit(formData);
  };

  const handleSaveDraft = async () => {
    const data = {
      template_id: selectedTemplate || undefined,
      findings: findingsEditor?.getHTML() || '',
      impression: impressionEditor?.getHTML() || '',
      comparison_text: watch('comparison_text'),
      recommendations: watch('recommendations'),
    };

    await onSaveDraft(data);
    setLastSaved(new Date());
    toast.success('Draft saved');
  };

  // Filter templates by modality
  const filteredTemplates = templates.filter(
    (t) => !t.modality || t.modality === study.modality
  );

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <h2 className="text-xl font-bold text-gray-900">Radiology Report</h2>
        <div className="mt-2 text-sm text-gray-600 space-y-1">
          <div>
            <span className="font-medium">Patient:</span> {study.patient_name} ({study.patient_mrn})
          </div>
          <div>
            <span className="font-medium">Study:</span> {study.study_description} - {study.modality}
          </div>
          <div>
            <span className="font-medium">Date:</span> {study.performed_date || study.scheduled_date}
          </div>
        </div>
        {lastSaved && (
          <div className="mt-2 text-xs text-gray-500">
            Last saved: {lastSaved.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Template selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Report Template
          </label>
          <div className="flex gap-2">
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select a template...</option>
              {filteredTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} {template.body_part && `- ${template.body_part}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyTemplate}
              disabled={!selectedTemplate}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        </div>

        {/* Comparison studies */}
        {comparisonStudies.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comparison Studies
            </label>
            <div className="space-y-2">
              {comparisonStudies.map((compStudy) => (
                <label key={compStudy.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={compStudy.id}
                    {...register('comparison_studies')}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">
                    {compStudy.study_description} - {compStudy.performed_date}
                  </span>
                </label>
              ))}
            </div>
            <textarea
              {...register('comparison_text')}
              placeholder="Comparison notes..."
              rows={2}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        {/* Findings */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Findings <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={toggleDictation}
              className={`flex items-center gap-1 px-3 py-1 text-xs rounded ${
                isRecording
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-3 h-3" />
                  Stop Dictation
                </>
              ) : (
                <>
                  <Mic className="w-3 h-3" />
                  Voice Dictation
                </>
              )}
            </button>
          </div>
          <div className="border border-gray-300 rounded-md min-h-[200px] prose prose-sm max-w-none p-3">
            <EditorContent editor={findingsEditor} />
          </div>
          {errors.findings && (
            <p className="mt-1 text-sm text-red-600">{errors.findings.message}</p>
          )}
        </div>

        {/* Impression */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Impression / Conclusion <span className="text-red-500">*</span>
          </label>
          <div className="border border-gray-300 rounded-md min-h-[150px] prose prose-sm max-w-none p-3">
            <EditorContent editor={impressionEditor} />
          </div>
          {errors.impression && (
            <p className="mt-1 text-sm text-red-600">{errors.impression.message}</p>
          )}
        </div>

        {/* Recommendations */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recommendations
          </label>
          <textarea
            {...register('recommendations')}
            placeholder="Follow-up recommendations..."
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <Save className="w-4 h-4" />
          Save Draft
        </button>

        <div className="flex items-center gap-3">
          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Eye className="w-4 h-4" />
              Preview PDF
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Sign & Finalize
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
