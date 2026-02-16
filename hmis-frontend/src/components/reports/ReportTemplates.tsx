'use client';
import { parseIntSafe } from '@/lib/utils/safe-parse';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Activity,
  TrendingUp,
  DollarSign,
  FileText,
  Calendar,
  Download,
  Play,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────

interface ReportTemplate {
  name: string;
  display_name: string;
  description: string;
  category: 'clinical' | 'financial' | 'operational';
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    label: string;
    default?: any;
  }>;
}

interface ReportTemplatesData {
  clinical: ReportTemplate[];
  financial: ReportTemplate[];
  operational: ReportTemplate[];
}

interface Props {
  onExecutionComplete?: (executionId: string) => void;
}

// ─── Component ──────────────────────────────────────────

export function ReportTemplates({ onExecutionComplete }: Props) {
  const [templates, setTemplates] = useState<ReportTemplatesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [executing, setExecuting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'excel' | 'pdf'>('json');

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      setLoading(true);
      try {
        const data = await api.get<ReportTemplatesData>('/reports/templates');
        if (!cancelled) {
          setTemplates(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load templates:', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.get<ReportTemplatesData>('/reports/templates');
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunTemplate = async () => {
    if (!selectedTemplate) return;

    setExecuting(true);
    try {
      const data = await api.post<{ execution_id?: string; file_path?: string }>('/reports/templates/execute', {
        template_name: selectedTemplate.name,
        parameters,
        export_format: exportFormat,
      });

      if (onExecutionComplete && data.execution_id) {
        onExecutionComplete(data.execution_id);
      }

      // Download file if not JSON
      if (exportFormat !== 'json' && data.file_path) {
        // Trigger download
        window.open(`/api/v1/reports/executions/${data.execution_id}/download`, '_blank');
      }

      setSelectedTemplate(null);
      setParameters({});
    } catch (error: any) {
      console.error('Failed to execute report:', error);
      toast.error(error.response?.data?.detail || 'Failed to execute report');
    } finally {
      setExecuting(false);
    }
  };

  const getIconForCategory = (category: string) => {
    switch (category) {
      case 'clinical':
        return Activity;
      case 'financial':
        return DollarSign;
      case 'operational':
        return TrendingUp;
      default:
        return FileText;
    }
  };

  const getColorForCategory = (category: string) => {
    switch (category) {
      case 'clinical':
        return 'text-green-600 bg-green-100';
      case 'financial':
        return 'text-yellow-600 bg-yellow-100';
      case 'operational':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const renderTemplateCard = (template: ReportTemplate) => {
    const Icon = getIconForCategory(template.category);
    const colorClass = getColorForCategory(template.category);

    return (
      <Card
        key={template.name}
        className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => {
          setSelectedTemplate(template);
          // Set default parameters
          const defaults: Record<string, any> = {};
          template.parameters.forEach((param) => {
            if (param.default !== undefined) {
              defaults[param.name] = param.default;
            }
          });
          setParameters(defaults);
        }}
      >
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${colorClass}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{template.display_name}</h3>
              <Badge variant={template.category === 'clinical' ? 'success' : template.category === 'financial' ? 'warning' : 'info'}>
                {template.category}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-4">{template.description}</p>
            <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedTemplate(template); }}>
              <Play className="h-4 w-4 mr-2" />
              Run Report
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!templates) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Failed to load report templates</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Clinical Reports */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Activity className="h-6 w-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900">Clinical Reports</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.clinical.map(renderTemplateCard)}
        </div>
      </div>

      {/* Financial Reports */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="h-6 w-6 text-yellow-600" />
          <h2 className="text-xl font-semibold text-gray-900">Financial Reports</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.financial.map(renderTemplateCard)}
        </div>
      </div>

      {/* Operational Reports */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Operational Reports</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.operational.map(renderTemplateCard)}
        </div>
      </div>

      {/* Parameter Modal */}
      {selectedTemplate && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedTemplate(null)}
          title={`Run ${selectedTemplate.display_name}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{selectedTemplate.description}</p>

            {/* Parameters */}
            {selectedTemplate.parameters.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Parameters</h4>
                {selectedTemplate.parameters.map((param) => (
                  <div key={param.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {param.label}
                      {param.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {param.type === 'date' ? (
                      <Input
                        type="date"
                        value={parameters[param.name] || ''}
                        onChange={(e) =>
                          setParameters({ ...parameters, [param.name]: e.target.value })
                        }
                      />
                    ) : param.type === 'number' ? (
                      <Input
                        type="number"
                        value={parameters[param.name] || param.default || ''}
                        onChange={(e) =>
                          setParameters({ ...parameters, [param.name]: parseIntSafe(e.target.value, 0, param.name) })
                        }
                      />
                    ) : (
                      <Input
                        type="text"
                        value={parameters[param.name] || ''}
                        onChange={(e) =>
                          setParameters({ ...parameters, [param.name]: e.target.value })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Export Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Export Format
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as any)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="json">View in Browser (JSON)</option>
                <option value="csv">Download as CSV</option>
                <option value="excel">Download as Excel</option>
                <option value="pdf">Download as PDF</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleRunTemplate}
                disabled={executing}
                className="flex-1"
              >
                {executing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Report
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedTemplate(null)}
                disabled={executing}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
