/**
 * Dynamically imported SOAP Note Editor
 *
 * This wrapper uses Next.js dynamic imports to code-split the heavy SOAP editor
 * component, reducing initial bundle size by ~50KB.
 *
 * The editor is only loaded when needed, improving Time to Interactive (TTI).
 */

'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Loading skeleton while component loads
function SOAPEditorSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      <div className="space-y-3">
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
      <div className="flex gap-2">
        <div className="h-10 bg-gray-200 rounded w-24"></div>
        <div className="h-10 bg-gray-200 rounded w-24"></div>
      </div>
    </div>
  );
}

// Dynamic import with loading state
export const SOAPNoteEditorDynamic = dynamic(
  () => import('./soap-note-editor').then((mod) => mod.SOAPNoteEditor),
  {
    loading: () => <SOAPEditorSkeleton />,
    ssr: false, // Client-side only rendering
  }
);

export default SOAPNoteEditorDynamic;
