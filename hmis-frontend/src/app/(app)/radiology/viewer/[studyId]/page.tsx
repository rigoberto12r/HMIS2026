'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DicomViewer } from '@/components/radiology/DicomViewer';
import { ViewerToolbar } from '@/components/radiology/ViewerToolbar';
import { SeriesBrowser, type SeriesInfo } from '@/components/radiology/SeriesBrowser';
import { useRadStudy, usePatientRadStudies } from '@/hooks/useRadiology';
import {
  ZoomIn,
  ZoomOut,
  Grid,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ViewerPage() {
  const params = useParams();
  const router = useRouter();
  const studyId = params.studyId as string;

  const [currentSeriesIndex, setCurrentSeriesIndex] = useState(0);
  const [activeTool, setActiveTool] = useState('pan');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportMode, setViewportMode] = useState<'single' | '2x2'>('single');
  const [comparisonStudyId, setComparisonStudyId] = useState<string | null>(null);

  const { data: study, isLoading, error } = useRadStudy(studyId);
  const { data: patientStudies } = usePatientRadStudies(study?.patient_id || '', {
    enabled: !!study?.patient_id,
  });

  // Transform study data to series format for SeriesBrowser
  const seriesData: SeriesInfo[] = study
    ? [
        {
          seriesInstanceUid: study.study_uid,
          seriesNumber: 1,
          seriesDescription: study.study_description,
          modality: study.modality,
          imageCount: study.images_count,
        },
      ]
    : [];

  // Handle fullscreen toggle
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        toast.error('Failed to enter fullscreen');
        console.error(err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Handle F11 key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading study...</p>
        </div>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Failed to Load Study</h2>
          <p className="text-gray-400 mb-6">
            {error?.message || 'The requested study could not be found.'}
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Filter previous studies for comparison
  const previousStudies =
    patientStudies?.items?.filter((s: any) => s.id !== studyId && s.status === 'completed') || [];

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Top navigation bar */}
      {!isFullscreen && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-300 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Worklist</span>
            </button>

            <div className="text-white text-center">
              <h1 className="text-lg font-bold">{study.study_description}</h1>
              <p className="text-sm text-gray-400">
                {study.patient_name} - MRN: {study.patient_mrn}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Viewport mode toggle */}
              <button
                onClick={() => setViewportMode(viewportMode === 'single' ? '2x2' : 'single')}
                className={`p-2 rounded ${
                  viewportMode === '2x2'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title="Toggle viewport layout"
              >
                <Grid className="w-5 h-5" />
              </button>

              <button
                onClick={() => router.push(`/radiology/reports/new?study_id=${studyId}`)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
              >
                Create Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <ViewerToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onPan={() => setActiveTool('pan')}
        onRotate={() => {}}
        onFlipH={() => {}}
        onFlipV={() => {}}
        onWindowLevel={() => setActiveTool('window-level')}
        onReset={() => {}}
        onFullscreen={toggleFullscreen}
        onMeasureLength={() => setActiveTool('measure-length')}
        onMeasureAngle={() => setActiveTool('measure-angle')}
        onAnnotate={() => setActiveTool('annotate')}
        onHelp={() => {}}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Series browser */}
        {!isFullscreen && (
          <div className="w-64 border-r border-gray-700 flex-shrink-0 overflow-hidden">
            <SeriesBrowser
              series={seriesData}
              currentSeriesIndex={currentSeriesIndex}
              onSeriesSelect={setCurrentSeriesIndex}
              patientName={study.patient_name}
              patientMrn={study.patient_mrn}
              studyDate={study.performed_date || study.scheduled_date}
              studyDescription={study.study_description}
            />
          </div>
        )}

        {/* Main viewport(s) */}
        <div className="flex-1 overflow-hidden">
          {viewportMode === 'single' ? (
            /* Single viewport */
            <DicomViewer
              studyInstanceUid={study.study_uid}
              pacsUrl={study.pacs_url || process.env.NEXT_PUBLIC_PACS_URL || ''}
              patientName={study.patient_name}
              patientMrn={study.patient_mrn}
              studyDate={study.performed_date || study.scheduled_date}
              modality={study.modality}
              onSeriesChange={setCurrentSeriesIndex}
              className="h-full"
            />
          ) : (
            /* 2x2 grid viewport */
            <div className="h-full grid grid-cols-2 grid-rows-2 gap-1">
              <DicomViewer
                studyInstanceUid={study.study_uid}
                pacsUrl={study.pacs_url || process.env.NEXT_PUBLIC_PACS_URL || ''}
                patientName={study.patient_name}
                patientMrn={study.patient_mrn}
                studyDate={study.performed_date}
                modality={study.modality}
                className="h-full"
              />
              <DicomViewer
                studyInstanceUid={study.study_uid}
                pacsUrl={study.pacs_url || process.env.NEXT_PUBLIC_PACS_URL || ''}
                patientName={study.patient_name}
                patientMrn={study.patient_mrn}
                studyDate={study.performed_date}
                modality={study.modality}
                className="h-full"
              />
              <DicomViewer
                studyInstanceUid={study.study_uid}
                pacsUrl={study.pacs_url || process.env.NEXT_PUBLIC_PACS_URL || ''}
                patientName={study.patient_name}
                patientMrn={study.patient_mrn}
                studyDate={study.performed_date}
                modality={study.modality}
                className="h-full"
              />
              <DicomViewer
                studyInstanceUid={study.study_uid}
                pacsUrl={study.pacs_url || process.env.NEXT_PUBLIC_PACS_URL || ''}
                patientName={study.patient_name}
                patientMrn={study.patient_mrn}
                studyDate={study.performed_date}
                modality={study.modality}
                className="h-full"
              />
            </div>
          )}
        </div>

        {/* Right panel - Tools & Info */}
        {!isFullscreen && (
          <div className="w-80 border-l border-gray-700 flex-shrink-0 bg-gray-800 overflow-y-auto">
            <div className="p-4 space-y-6">
              {/* Study Metadata */}
              <div>
                <h3 className="text-white font-semibold mb-3">Study Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Accession:</span>
                    <span className="text-gray-200 font-mono">{study.accession_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Study UID:</span>
                    <span className="text-gray-200 font-mono text-xs truncate max-w-[180px]">
                      {study.study_uid}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Series:</span>
                    <span className="text-gray-200">{study.series_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Images:</span>
                    <span className="text-gray-200">{study.images_count}</span>
                  </div>
                  {study.protocol_used && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Protocol:</span>
                      <span className="text-gray-200">{study.protocol_used}</span>
                    </div>
                  )}
                  {study.performed_by_name && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Technologist:</span>
                      <span className="text-gray-200">{study.performed_by_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Comparison Studies */}
              {previousStudies.length > 0 && (
                <div>
                  <h3 className="text-white font-semibold mb-3">Previous Studies</h3>
                  <div className="space-y-2">
                    {previousStudies.slice(0, 5).map((prevStudy: any) => (
                      <button
                        key={prevStudy.id}
                        onClick={() => setComparisonStudyId(prevStudy.id)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          comparisonStudyId === prevStudy.id
                            ? 'bg-blue-600'
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        <div className="text-sm text-white font-medium truncate">
                          {prevStudy.study_description}
                        </div>
                        <div className="text-xs text-gray-300 mt-1">
                          {prevStudy.performed_date}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Study Notes */}
              {study.notes && (
                <div>
                  <h3 className="text-white font-semibold mb-3">Notes</h3>
                  <div className="text-sm text-gray-300 bg-gray-700 rounded-lg p-3">
                    {study.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
