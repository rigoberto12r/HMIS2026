'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Plus,
  Clock,
  History,
  BarChart3,
  DollarSign,
  Activity,
  TrendingUp,
  Users,
  Calendar,
  Download,
  Play
} from 'lucide-react';
import { ReportTemplates } from '@/components/reports/ReportTemplates';
import { ReportBuilder } from '@/components/reports/ReportBuilder';
import { ScheduledReports } from '@/components/reports/ScheduledReports';
import { ReportViewer } from '@/components/reports/ReportViewer';
import { api } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────

interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  report_type: 'clinical' | 'financial' | 'operational';
  category: string;
  is_template: boolean;
  created_at: string;
}

interface ReportExecution {
  id: string;
  report_definition_id: string;
  executed_at: string;
  status: string;
  row_count: number;
  execution_time_ms: number;
  file_format: string | null;
}

type TabType = 'templates' | 'library' | 'builder' | 'scheduled' | 'history';

// ─── Main Component ─────────────────────────────────────

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('templates');
  const [reportDefinitions, setReportDefinitions] = useState<ReportDefinition[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<ReportExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const data = await api.get<ReportDefinition[]>('/reports/definitions');
        if (!cancelled) {
          setReportDefinitions(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load report definitions:', error);
        }
      }

      try {
        // This would need a backend endpoint to list executions
        // For now, we'll leave it empty
        if (!cancelled) {
          setRecentExecutions([]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load executions:', error);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadReportDefinitions = async () => {
    try {
      const data = await api.get<ReportDefinition[]>('/reports/definitions');
      setReportDefinitions(data);
    } catch (error) {
      console.error('Failed to load report definitions:', error);
    }
  };

  const loadRecentExecutions = async () => {
    try {
      // This would need a backend endpoint to list executions
      // For now, we'll leave it empty
      setRecentExecutions([]);
    } catch (error) {
      console.error('Failed to load executions:', error);
    }
  };

  const handleExecutionComplete = (executionId: string) => {
    setSelectedExecution(executionId);
    loadRecentExecutions();
  };

  const tabs = [
    { id: 'templates' as TabType, label: 'Report Templates', icon: FileText },
    { id: 'library' as TabType, label: 'Report Library', icon: BarChart3 },
    { id: 'builder' as TabType, label: 'Create Report', icon: Plus },
    { id: 'scheduled' as TabType, label: 'Scheduled Reports', icon: Clock },
    { id: 'history' as TabType, label: 'History', icon: History },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Custom Reports</h1>
        <p className="text-gray-600">
          Generate insights from clinical, financial, and operational data
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Reports</p>
              <p className="text-2xl font-bold text-gray-900">{reportDefinitions.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Scheduled</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Recent Runs</p>
              <p className="text-2xl font-bold text-gray-900">{recentExecutions.length}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Time</p>
              <p className="text-2xl font-bold text-gray-900">1.2s</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <Activity className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === 'templates' && (
          <ReportTemplates onExecutionComplete={handleExecutionComplete} />
        )}

        {activeTab === 'library' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Saved Reports</h2>
              <Button onClick={() => setActiveTab('builder')}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Report
              </Button>
            </div>

            {reportDefinitions.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No saved reports</h3>
                <p className="text-gray-600 mb-6">
                  Create your first custom report to see it here
                </p>
                <Button onClick={() => setActiveTab('builder')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Report
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportDefinitions.map((report) => (
                  <Card key={report.id} className="p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{report.name}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {report.description}
                        </p>
                      </div>
                      <Badge
                        variant={
                          report.report_type === 'clinical'
                            ? 'success'
                            : report.report_type === 'financial'
                            ? 'warning'
                            : 'info'
                        }
                      >
                        {report.report_type}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1">
                        <Play className="h-4 w-4 mr-1" />
                        Run
                      </Button>
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'builder' && (
          <ReportBuilder
            onSave={() => {
              loadReportDefinitions();
              setActiveTab('library');
            }}
          />
        )}

        {activeTab === 'scheduled' && (
          <ScheduledReports reportDefinitions={reportDefinitions} />
        )}

        {activeTab === 'history' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Execution History</h2>

            {recentExecutions.length === 0 ? (
              <Card className="p-12 text-center">
                <History className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No execution history</h3>
                <p className="text-gray-600">
                  Run a report to see execution history here
                </p>
              </Card>
            ) : (
              <Card>
                <div className="divide-y divide-gray-200">
                  {recentExecutions.map((execution) => (
                    <div key={execution.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
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
                            <span className="text-sm text-gray-600">
                              {new Date(execution.executed_at).toLocaleString()}
                            </span>
                            <span className="text-sm text-gray-500">
                              {execution.row_count} rows in {execution.execution_time_ms}ms
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedExecution(execution.id)}
                          >
                            View
                          </Button>
                          {execution.file_format && (
                            <Button size="sm" variant="outline">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Report Viewer Modal */}
      {selectedExecution && (
        <ReportViewer
          executionId={selectedExecution}
          onClose={() => setSelectedExecution(null)}
        />
      )}
    </div>
  );
}
