'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Printer, Share2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────

interface ReportExecution {
  id: string;
  report_definition_id: string | null;
  executed_at: string;
  status: string;
  row_count: number;
  execution_time_ms: number;
  file_format: string | null;
  error_message: string | null;
}

interface ReportResult {
  execution: ReportExecution;
  data: any[] | null;
  columns: string[] | null;
}

interface Props {
  executionId: string;
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────

export function ReportViewer({ executionId, onClose }: Props) {
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const loadExecutionResult = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ReportResult>(`/reports/executions/${executionId}`);
      setResult(data);

      // Initialize visible columns
      if (data.columns) {
        setVisibleColumns(new Set(data.columns));
      }
    } catch (error) {
      console.error('Failed to load execution result:', error);
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    loadExecutionResult();
  }, [loadExecutionResult]);

  const handleDownload = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      window.open(`/api/v1/reports/executions/${executionId}/download`, '_blank');
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleColumn = (column: string) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(column)) {
      newVisible.delete(column);
    } else {
      newVisible.add(column);
    }
    setVisibleColumns(newVisible);
  };

  const filterData = (data: any[]) => {
    if (!searchQuery) return data;

    return data.filter((row) => {
      return Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  };

  if (loading) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Loading Report">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Modal>
    );
  }

  if (!result) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Error">
        <div className="text-center py-12">
          <p className="text-gray-600">Failed to load report execution</p>
        </div>
      </Modal>
    );
  }

  const { execution, data, columns } = result;

  // Prepare table columns
  const tableColumns: Column<any>[] = (columns || [])
    .filter((col) => visibleColumns.has(col))
    .map((col) => ({
      key: col,
      header: col.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      render: (row: any) => {
        const value = row[col];
        if (value === null || value === undefined) return '-';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      },
    }));

  const filteredData = data ? filterData(data) : [];

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Report Results"
      size="full"
    >
      <div className="space-y-4">
        {/* Execution Info */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <Badge
                variant={
                  execution.status === 'completed'
                    ? 'success'
                    : execution.status === 'failed'
                    ? 'danger'
                    : 'default'
                }
              >
                {execution.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600">Executed At</p>
              <p className="font-medium">{new Date(execution.executed_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Row Count</p>
              <p className="font-medium">{execution.row_count?.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Execution Time</p>
              <p className="font-medium">{execution.execution_time_ms}ms</p>
            </div>
          </div>

          {execution.error_message && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{execution.error_message}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => handleDownload('csv')}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleDownload('excel')}>
            <Download className="h-4 w-4 mr-1" />
            Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleDownload('pdf')}>
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
        </div>

        {/* Column Visibility */}
        {columns && columns.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Column Visibility ({visibleColumns.size}/{columns.length})
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {columns.map((col) => (
                  <button
                    key={col}
                    onClick={() => toggleColumn(col)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      visibleColumns.has(col)
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {visibleColumns.has(col) ? <Eye className="h-3 w-3 inline mr-1" /> : <EyeOff className="h-3 w-3 inline mr-1" />}
                    {col.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search in results..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Data Table */}
        {execution.status === 'completed' && data && data.length > 0 ? (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <DataTable
              data={filteredData}
              columns={tableColumns}
              keyExtractor={(row: any) => row.id ?? String(Math.random())}
              pageSize={50}
            />
          </div>
        ) : execution.status === 'completed' && (!data || data.length === 0) ? (
          <div className="text-center py-12 border border-gray-200 rounded-lg">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-600">No data returned by this report</p>
          </div>
        ) : null}

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
