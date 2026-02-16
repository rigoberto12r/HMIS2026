'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

// DICOM types
interface DicomImage {
  imageId: string;
  width: number;
  height: number;
  windowCenter?: number;
  windowWidth?: number;
}

interface ViewportState {
  scale: number;
  translation: { x: number; y: number };
  rotation: number;
  hflip: boolean;
  vflip: boolean;
  invert: boolean;
  windowCenter: number;
  windowWidth: number;
}

interface SeriesInfo {
  seriesInstanceUid: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: string;
  imageIds: string[];
}

export interface DicomViewerProps {
  studyInstanceUid: string;
  pacsUrl: string;
  patientName?: string;
  patientMrn?: string;
  studyDate?: string;
  modality?: string;
  onSeriesChange?: (seriesIndex: number) => void;
  className?: string;
}

export function DicomViewer({
  studyInstanceUid,
  pacsUrl,
  patientName,
  patientMrn,
  studyDate,
  modality,
  onSeriesChange,
  className = '',
}: DicomViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentSeriesIndex, setCurrentSeriesIndex] = useState(0);
  const [series, setSeries] = useState<SeriesInfo[]>([]);
  const [viewport, setViewport] = useState<ViewportState>({
    scale: 1,
    translation: { x: 0, y: 0 },
    rotation: 0,
    hflip: false,
    vflip: false,
    invert: false,
    windowCenter: 40,
    windowWidth: 400,
  });
  const [activeTool, setActiveTool] = useState<string>('pan');
  const [showHelp, setShowHelp] = useState(false);

  // Initialize Cornerstone (browser-only)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cornerstone: any;
    let cornerstoneWADOImageLoader: any;
    let dicomParser: any;

    const initCornerstone = async () => {
      try {
        // Dynamic imports for browser-only libraries (optional dependencies)
        // @ts-ignore - Optional DICOM viewing dependencies
        cornerstone = (await import('cornerstone-core')).default;
        // @ts-ignore - Optional DICOM viewing dependencies
        cornerstoneWADOImageLoader = (await import('cornerstone-wado-image-loader')).default;
        // @ts-ignore - Optional DICOM viewing dependencies
        dicomParser = (await import('dicom-parser')).default;

        // Configure WADO Image Loader
        cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
        cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

        cornerstoneWADOImageLoader.configure({
          beforeSend: function (xhr: XMLHttpRequest) {
            // Add authentication headers if needed
            const token = localStorage.getItem('hmis_access_token');
            if (token) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
          },
        });

        // Enable the canvas element for Cornerstone
        if (canvasRef.current) {
          cornerstone.enable(canvasRef.current);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize Cornerstone:', err);
        setError('Failed to initialize DICOM viewer. Please ensure all dependencies are loaded.');
        setIsLoading(false);
      }
    };

    initCornerstone();

    return () => {
      if (canvasRef.current && cornerstone) {
        try {
          cornerstone.disable(canvasRef.current);
        } catch (err) {
          console.error('Error disabling cornerstone:', err);
        }
      }
    };
  }, []);

  // Load study images
  useEffect(() => {
    if (isLoading || !studyInstanceUid || typeof window === 'undefined') return;

    const controller = new AbortController();
    let cancelled = false;

    const loadStudy = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch study metadata from PACS
        const response = await fetch(
          `${pacsUrl}/studies/${studyInstanceUid}/series`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('hmis_access_token')}`,
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch study metadata');
        }

        const seriesData = await response.json();

        if (cancelled) return;

        // Transform series data
        const transformedSeries: SeriesInfo[] = seriesData.map((s: any) => ({
          seriesInstanceUid: s.series_uid,
          seriesNumber: s.series_number || 0,
          seriesDescription: s.series_description || 'Unknown Series',
          modality: s.modality || modality || 'OT',
          imageIds: s.image_uids.map(
            (imageUid: string) =>
              `wadouri:${pacsUrl}/studies/${studyInstanceUid}/series/${s.series_uid}/instances/${imageUid}`
          ),
        }));

        if (!cancelled) {
          setSeries(transformedSeries);

          // Load first image of first series
          if (transformedSeries.length > 0 && transformedSeries[0].imageIds.length > 0) {
            await loadImage(transformedSeries[0].imageIds[0]);
          }

          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled && err instanceof Error && err.name !== 'AbortError') {
          console.error('Error loading study:', err);
          setError('Failed to load study. Please check PACS connection.');
          setIsLoading(false);
        }
      }
    };

    loadStudy();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [studyInstanceUid, pacsUrl, modality]);

  // Load specific image
  const loadImage = async (imageId: string) => {
    if (!canvasRef.current || typeof window === 'undefined') return;

    try {
      // @ts-ignore - Optional DICOM viewing dependencies
      const cornerstone = (await import('cornerstone-core')).default;
      const image = await cornerstone.loadImage(imageId);

      cornerstone.displayImage(canvasRef.current, image);

      // Set initial viewport from image metadata
      const defaultViewport = cornerstone.getDefaultViewportForImage(canvasRef.current, image);
      setViewport((prev) => ({
        ...prev,
        windowCenter: defaultViewport.voi.windowCenter || prev.windowCenter,
        windowWidth: defaultViewport.voi.windowWidth || prev.windowWidth,
      }));
    } catch (err) {
      console.error('Error loading image:', err);
      toast.error('Failed to load DICOM image');
    }
  };

  // Navigate images
  const navigateImage = useCallback(
    (delta: number) => {
      if (series.length === 0 || !series[currentSeriesIndex]) return;

      const currentSeries = series[currentSeriesIndex];
      const newIndex = Math.max(
        0,
        Math.min(currentImageIndex + delta, currentSeries.imageIds.length - 1)
      );

      if (newIndex !== currentImageIndex) {
        setCurrentImageIndex(newIndex);
        loadImage(currentSeries.imageIds[newIndex]);
      }
    },
    [series, currentSeriesIndex, currentImageIndex]
  );

  // Change series
  const changeSeries = useCallback(
    (seriesIndex: number) => {
      if (seriesIndex < 0 || seriesIndex >= series.length) return;

      setCurrentSeriesIndex(seriesIndex);
      setCurrentImageIndex(0);

      if (series[seriesIndex].imageIds.length > 0) {
        loadImage(series[seriesIndex].imageIds[0]);
      }

      onSeriesChange?.(seriesIndex);
    },
    [series, onSeriesChange]
  );

  // Apply viewport transformations
  const applyViewport = useCallback(async () => {
    if (!canvasRef.current || typeof window === 'undefined') return;

    try {
      // @ts-ignore - Optional DICOM viewing dependencies
      const cornerstone = (await import('cornerstone-core')).default;
      const currentViewport = cornerstone.getViewport(canvasRef.current);

      cornerstone.setViewport(canvasRef.current, {
        ...currentViewport,
        scale: viewport.scale,
        translation: viewport.translation,
        rotation: viewport.rotation,
        hflip: viewport.hflip,
        vflip: viewport.vflip,
        invert: viewport.invert,
        voi: {
          windowCenter: viewport.windowCenter,
          windowWidth: viewport.windowWidth,
        },
      });
    } catch (err) {
      console.error('Error applying viewport:', err);
    }
  }, [viewport]);

  useEffect(() => {
    let cancelled = false;

    if (!cancelled) {
      applyViewport();
    }

    return () => {
      cancelled = true;
    };
  }, [viewport, applyViewport]);

  // Tool handlers
  const handleZoom = (delta: number) => {
    setViewport((prev) => ({
      ...prev,
      scale: Math.max(0.1, Math.min(10, prev.scale + delta * 0.1)),
    }));
  };

  const handlePan = (deltaX: number, deltaY: number) => {
    setViewport((prev) => ({
      ...prev,
      translation: {
        x: prev.translation.x + deltaX,
        y: prev.translation.y + deltaY,
      },
    }));
  };

  const handleWindowLevel = (deltaW: number, deltaC: number) => {
    setViewport((prev) => ({
      ...prev,
      windowWidth: Math.max(1, prev.windowWidth + deltaW),
      windowCenter: prev.windowCenter + deltaC,
    }));
  };

  const handleRotate = (degrees: number) => {
    setViewport((prev) => ({
      ...prev,
      rotation: (prev.rotation + degrees) % 360,
    }));
  };

  const handleFlip = (axis: 'h' | 'v') => {
    setViewport((prev) => ({
      ...prev,
      hflip: axis === 'h' ? !prev.hflip : prev.hflip,
      vflip: axis === 'v' ? !prev.vflip : prev.vflip,
    }));
  };

  const handleInvert = () => {
    setViewport((prev) => ({ ...prev, invert: !prev.invert }));
  };

  const handleReset = () => {
    setViewport({
      scale: 1,
      translation: { x: 0, y: 0 },
      rotation: 0,
      hflip: false,
      vflip: false,
      invert: false,
      windowCenter: 40,
      windowWidth: 400,
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'arrowup':
          e.preventDefault();
          navigateImage(e.shiftKey ? -10 : -1);
          break;
        case 'arrowdown':
          e.preventDefault();
          navigateImage(e.shiftKey ? 10 : 1);
          break;
        case 'r':
          e.preventDefault();
          handleRotate(90);
          break;
        case 'h':
          e.preventDefault();
          handleFlip('h');
          break;
        case 'v':
          e.preventDefault();
          handleFlip('v');
          break;
        case 'i':
          e.preventDefault();
          handleInvert();
          break;
        case 'escape':
          e.preventDefault();
          handleReset();
          break;
        case '?':
          e.preventDefault();
          setShowHelp((prev) => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateImage]);

  // Mouse interactions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let dragButton = -1;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragButton = e.button;
      lastX = e.clientX;
      lastY = e.clientY;
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;

      if (dragButton === 1) {
        // Middle button - Pan
        handlePan(deltaX, deltaY);
      } else if (dragButton === 2) {
        // Right button - Window/Level
        handleWindowLevel(deltaX, deltaY);
      }

      lastX = e.clientX;
      lastY = e.clientY;
      e.preventDefault();
    };

    const handleMouseUp = () => {
      isDragging = false;
      dragButton = -1;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.shiftKey) {
        // Scroll through images
        navigateImage(e.deltaY > 0 ? 1 : -1);
      } else {
        // Zoom
        handleZoom(e.deltaY > 0 ? -1 : 1);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [navigateImage]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 text-white ${className}`}>
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">Error Loading Study</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const currentSeries = series[currentSeriesIndex];
  const totalImages = currentSeries?.imageIds.length || 0;

  return (
    <div ref={containerRef} className={`relative bg-black ${className}`}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
          <div className="text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Loading study...</p>
          </div>
        </div>
      )}

      {/* Overlays */}
      {!isLoading && !error && (
        <>
          {/* Top-left: Patient info */}
          <div className="absolute top-2 left-2 text-white text-sm font-mono bg-black bg-opacity-50 px-2 py-1 rounded">
            <div>{patientName || 'Unknown Patient'}</div>
            <div>MRN: {patientMrn || 'N/A'}</div>
          </div>

          {/* Top-right: Study info */}
          <div className="absolute top-2 right-2 text-white text-sm font-mono bg-black bg-opacity-50 px-2 py-1 rounded text-right">
            <div>{studyDate || 'Unknown Date'}</div>
            <div>{currentSeries?.modality || modality || 'N/A'}</div>
          </div>

          {/* Bottom-left: Series info */}
          <div className="absolute bottom-2 left-2 text-white text-sm font-mono bg-black bg-opacity-50 px-2 py-1 rounded">
            <div>{currentSeries?.seriesDescription || 'Unknown Series'}</div>
            <div>
              Image {currentImageIndex + 1} / {totalImages}
            </div>
          </div>

          {/* Bottom-right: Viewport info */}
          <div className="absolute bottom-2 right-2 text-white text-sm font-mono bg-black bg-opacity-50 px-2 py-1 rounded text-right">
            <div>W: {Math.round(viewport.windowWidth)} C: {Math.round(viewport.windowCenter)}</div>
            <div>Zoom: {(viewport.scale * 100).toFixed(0)}%</div>
          </div>

          {/* Help overlay */}
          {showHelp && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 p-8">
              <div className="bg-gray-800 text-white rounded-lg p-6 max-w-md">
                <h3 className="text-xl font-bold mb-4">Keyboard Shortcuts</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-mono">↑/↓</span>
                    <span>Scroll images</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono">Shift + ↑/↓</span>
                    <span>Scroll 10 images</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono">Mouse Wheel</span>
                    <span>Zoom</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono">Shift + Wheel</span>
                    <span>Scroll images</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono">Middle Drag</span>
                    <span>Pan</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono">Right Drag</span>
                    <span>Window/Level</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono">R</span>
                    <span>Rotate 90°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono">H / V</span>
                    <span>Flip Horizontal/Vertical</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono">I</span>
                    <span>Invert</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono">Esc</span>
                    <span>Reset viewport</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono">?</span>
                    <span>Toggle help</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
