'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DicomViewer } from '@/components/radiology/DicomViewer';
import { ReportForm, type ReportFormData } from '@/components/radiology/ReportForm';
import {
  useRadStudy,
  useStudyReport,
  useCreateRadReport,
  useUpdateRadReport,
  useRadTemplates,
  usePatientRadStudies,
} from '@/hooks/useRadiology';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

function NewReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studyId = searchParams.get('study_id');
  const reportId = searchParams.get('report_id');

  const { data: study, isLoading: studyLoading } = useRadStudy(studyId || '');
  const { data: existingReport } = useStudyReport(studyId || '', {
    enabled: !!studyId && !reportId,
  });
  const { data: patientStudies } = usePatientRadStudies(study?.patient_id || '', {
    enabled: !!study?.patient_id,
  });
  const { data: templatesData } = useRadTemplates({
    modality: study?.modality,
    page_size: 100,
  });

  const createMutation = useCreateRadReport();
  const updateMutation = useUpdateRadReport();

  const [isDirty, setIsDirty] = useState(false);

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  if (!studyId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Missing Study ID</h2>
          <p className="text-gray-600 mb-6">Please select a study to create a report.</p>
          <button
            onClick={() => router.push('/radiology/worklist')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
          >
            Go to Worklist
          </button>
        </div>
      </div>
    );
  }

  if (studyLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg text-gray-600">Loading study...</p>
        </div>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Study Not Found</h2>
          <p className="text-gray-600 mb-6">The requested study could not be found.</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const report = existingReport || undefined;
  const templates = templatesData?.items || [];

  // Filter previous studies for comparison
  const comparisonStudies =
    patientStudies?.items?.filter((s: any) => s.id !== studyId && s.status === 'completed') || [];

  const handleSubmit = async (data: ReportFormData) => {
    try {
      setIsDirty(false);

      if (report) {
        // Update existing report and sign
        await updateMutation.mutateAsync({
          id: report.id,
          data: { ...data, status: 'final' },
        });
        toast.success('Report signed and finalized');
      } else {
        // Create new report
        await createMutation.mutateAsync({
          study_id: studyId,
          ...data,
        });
        toast.success('Report created and signed');
      }

      router.push('/radiology/reports');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save report');
      throw error;
    }
  };

  const handleSaveDraft = async (data: ReportFormData) => {
    try {
      if (report) {
        await updateMutation.mutateAsync({
          id: report.id,
          data: { ...data, status: 'draft' },
        });
      } else {
        await createMutation.mutateAsync({
          study_id: studyId,
          ...data,
        });
      }
      setIsDirty(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save draft');
      throw error;
    }
  };

  const handlePreview = () => {
    // TODO: Generate PDF preview
    toast.info('PDF preview coming soon');
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (isDirty) {
                if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
                  router.back();
                }
              } else {
                router.back();
              }
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>

          <h1 className="text-xl font-bold text-gray-900">
            {report ? 'Edit Report' : 'New Radiology Report'}
          </h1>

          <div className="w-24" />
        </div>
      </div>

      {/* Split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left side - DICOM Viewer (60%) */}
        <div className="flex-[3] border-r border-gray-200">
          <DicomViewer
            studyInstanceUid={study.study_uid}
            pacsUrl={study.pacs_url || process.env.NEXT_PUBLIC_PACS_URL || ''}
            patientName={study.patient_name}
            patientMrn={study.patient_mrn}
            studyDate={study.performed_date || study.scheduled_date}
            modality={study.modality}
            className="h-full"
          />
        </div>

        {/* Right side - Report Form (40%) */}
        <div className="flex-[2] overflow-hidden">
          <ReportForm
            study={study}
            report={report}
            templates={templates}
            comparisonStudies={comparisonStudies}
            onSubmit={handleSubmit}
            onSaveDraft={handleSaveDraft}
            onPreview={handlePreview}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}

export default function NewReportPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        </div>
      }
    >
      <NewReportContent />
    </Suspense>
  );
}
