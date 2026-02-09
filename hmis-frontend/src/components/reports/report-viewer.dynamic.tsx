/**
 * Dynamically imported Report Viewer
 *
 * Code-splits the report viewer component which includes heavy dependencies
 * like recharts for data visualization.
 */

'use client';

import dynamic from 'next/dynamic';
import React from 'react';

function ReportViewerSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-1/3"></div>
      <div className="grid grid-cols-3 gap-4">
        <div className="h-24 bg-gray-200 rounded"></div>
        <div className="h-24 bg-gray-200 rounded"></div>
        <div className="h-24 bg-gray-200 rounded"></div>
      </div>
      <div className="h-64 bg-gray-200 rounded"></div>
      <div className="h-96 bg-gray-200 rounded"></div>
    </div>
  );
}

export const ReportViewerDynamic = dynamic(
  () => import('../reports/report-viewer').then((mod) => mod.default),
  {
    loading: () => <ReportViewerSkeleton />,
    ssr: false,
  }
);

export default ReportViewerDynamic;
