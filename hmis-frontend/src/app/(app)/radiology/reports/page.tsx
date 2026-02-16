'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  useRadReports,
  useSignRadReport,
  useAmendRadReport,
} from '@/hooks/useRadiology';
import { ReportViewerModal } from '@/components/radiology/ReportViewerModal';
import {
  FileText,
  Edit,
  CheckCircle,
  FileEdit,
  Printer,
  Filter,
  Search,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { RadReport, RadReportStatus } from '@/types/radiology';

type TabType = 'unsigned' | 'my-reports' | 'all-reports';

export default function RadiologyReportsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('unsigned');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RadReportStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedReport, setSelectedReport] = useState<RadReport | null>(null);
  const [showViewerModal, setShowViewerModal] = useState(false);

  const signMutation = useSignRadReport();
  const amendMutation = useAmendRadReport();

  // Build filters based on active tab
  const getFilters = () => {
    const baseFilters: any = {
      page,
      page_size: 20,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    };

    if (statusFilter) {
      baseFilters.status = statusFilter;
    }

    switch (activeTab) {
      case 'unsigned':
        return { ...baseFilters, status: 'draft' };
      case 'my-reports':
        // TODO: Add current user filter
        return baseFilters;
      case 'all-reports':
        return baseFilters;
      default:
        return baseFilters;
    }
  };

  const { data, isLoading, error } = useRadReports(getFilters());

  const reports = data?.items || [];
  const totalPages = data?.total_pages || 1;

  const getStatusBadge = (status: RadReportStatus) => {
    const badges: Record<RadReportStatus, { color: string; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
      draft: { color: 'bg-gray-100 text-gray-700', label: 'Draft' },
      preliminary: { color: 'bg-blue-100 text-blue-700', label: 'Preliminary' },
      final: { color: 'bg-green-100 text-green-700', label: 'Final' },
      corrected: { color: 'bg-amber-100 text-amber-700', label: 'Corrected' },
      cancelled: { color: 'bg-red-100 text-red-700', label: 'Cancelled' },
    };

    const badge = badges[status] || badges.draft;

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const handleViewReport = (report: RadReport) => {
    setSelectedReport(report);
    setShowViewerModal(true);
  };

  const handleEditReport = (report: RadReport) => {
    router.push(`/radiology/reports/new?study_id=${report.study_id}&report_id=${report.id}`);
  };

  const handleSignReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to sign this report? This action cannot be undone.')) {
      return;
    }

    try {
      await signMutation.mutateAsync(reportId);
      toast.success('Report signed successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign report');
    }
  };

  const handleAmendReport = async (reportId: string) => {
    const reason = prompt('Please provide a reason for amending this report:');
    if (!reason) return;

    try {
      await amendMutation.mutateAsync({ reportId, amendment: reason });
      toast.success('Report amendment created');
      router.push(`/radiology/reports/new?report_id=${reportId}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to amend report');
    }
  };

  const handlePrintReport = (report: RadReport) => {
    // TODO: Generate and print PDF
    toast.info('PDF printing coming soon');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Radiology Reports</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => {
              setActiveTab('unsigned');
              setPage(1);
            }}
            className={`pb-3 px-2 font-medium transition-colors border-b-2 ${
              activeTab === 'unsigned'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Unsigned Reports
          </button>
          <button
            onClick={() => {
              setActiveTab('my-reports');
              setPage(1);
            }}
            className={`pb-3 px-2 font-medium transition-colors border-b-2 ${
              activeTab === 'my-reports'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            My Reports
          </button>
          <button
            onClick={() => {
              setActiveTab('all-reports');
              setPage(1);
            }}
            className={`pb-3 px-2 font-medium transition-colors border-b-2 ${
              activeTab === 'all-reports'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            All Reports
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient name, MRN, or accession number..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Date range */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="From"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="To"
          />

          {/* Status filter (only for All Reports tab) */}
          {activeTab === 'all-reports' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RadReportStatus | '')}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="preliminary">Preliminary</option>
              <option value="final">Final</option>
              <option value="corrected">Corrected</option>
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading reports...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <p className="text-gray-600">Failed to load reports</p>
            </div>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
              <p className="text-gray-600">
                {activeTab === 'unsigned'
                  ? 'All reports have been signed!'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Study Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Study
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Radiologist
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleViewReport(report)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.created_at ? format(new Date(report.created_at), 'PP') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {/* TODO: Fetch patient info from study */}
                      Patient Name
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {/* TODO: Fetch study description */}
                      Study Description
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.radiologist_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(report.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(report.created_at), 'PP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {(report.status === 'draft' || report.status === 'preliminary') && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditReport(report);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSignReport(report.id);
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="Sign"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {report.status === 'final' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAmendReport(report.id);
                            }}
                            className="text-amber-600 hover:text-amber-900"
                            title="Amend"
                          >
                            <FileEdit className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintReport(report);
                          }}
                          className="text-gray-600 hover:text-gray-900"
                          title="Print PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && reports.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Showing page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Viewer Modal */}
      {selectedReport && (
        <ReportViewerModal
          report={selectedReport}
          isOpen={showViewerModal}
          onClose={() => {
            setShowViewerModal(false);
            setSelectedReport(null);
          }}
          onPrint={() => handlePrintReport(selectedReport)}
        />
      )}
    </div>
  );
}
