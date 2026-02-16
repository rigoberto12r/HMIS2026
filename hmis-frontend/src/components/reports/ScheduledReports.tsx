'use client';
import { parseIntSafe } from '@/lib/utils/safe-parse';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Clock, Mail, Play, Edit, Trash2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────

interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  report_type: string;
}

interface ScheduledReport {
  id: string;
  report_definition_id: string;
  schedule_type: 'daily' | 'weekly' | 'monthly';
  schedule_config: {
    day_of_week?: number;
    day_of_month?: number;
    hour: number;
    minute: number;
  } | null;
  recipients: string[];
  last_run: string | null;
  next_run: string | null;
  last_status: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  reportDefinitions: ReportDefinition[];
}

// ─── Component ──────────────────────────────────────────

export function ScheduledReports({ reportDefinitions }: Props) {
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledReport | null>(null);

  // Form state
  const [reportDefinitionId, setReportDefinitionId] = useState('');
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [recipients, setRecipients] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadScheduledReports = async () => {
      setLoading(true);
      try {
        const data = await api.get<ScheduledReport[]>('/reports/scheduled');
        if (!cancelled) {
          setScheduledReports(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load scheduled reports:', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadScheduledReports();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadScheduledReports = async () => {
    setLoading(true);
    try {
      const data = await api.get<ScheduledReport[]>('/reports/scheduled');
      setScheduledReports(data);
    } catch (error) {
      console.error('Failed to load scheduled reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSchedule(null);
    setReportDefinitionId('');
    setScheduleType('daily');
    setHour(9);
    setMinute(0);
    setDayOfWeek(1);
    setDayOfMonth(1);
    setRecipients('');
    setShowModal(true);
  };

  const handleEdit = (schedule: ScheduledReport) => {
    setEditingSchedule(schedule);
    setReportDefinitionId(schedule.report_definition_id);
    setScheduleType(schedule.schedule_type);
    setHour(schedule.schedule_config?.hour || 9);
    setMinute(schedule.schedule_config?.minute || 0);
    setDayOfWeek(schedule.schedule_config?.day_of_week || 1);
    setDayOfMonth(schedule.schedule_config?.day_of_month || 1);
    setRecipients(schedule.recipients.join(', '));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!reportDefinitionId) {
      toast.warning('Please select a report');
      return;
    }

    if (!recipients.trim()) {
      toast.warning('Please enter at least one email recipient');
      return;
    }

    const recipientList = recipients
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    if (recipientList.length === 0) {
      toast.warning('Please enter valid email addresses');
      return;
    }

    setSaving(true);
    try {
      const scheduleConfig: any = { hour, minute };

      if (scheduleType === 'weekly') {
        scheduleConfig.day_of_week = dayOfWeek;
      } else if (scheduleType === 'monthly') {
        scheduleConfig.day_of_month = dayOfMonth;
      }

      const payload = {
        report_definition_id: reportDefinitionId,
        schedule_type: scheduleType,
        schedule_config: scheduleConfig,
        recipients: recipientList,
        execution_params: {},
      };

      if (editingSchedule) {
        await api.put(`/reports/scheduled/${editingSchedule.id}`, payload);
      } else {
        await api.post('/reports/schedule', payload);
      }

      setShowModal(false);
      loadScheduledReports();
    } catch (error: any) {
      console.error('Failed to save scheduled report:', error);
      toast.error(error.response?.data?.detail || 'Failed to save scheduled report');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (scheduleId: string, isActive: boolean) => {
    try {
      await api.put(`/reports/scheduled/${scheduleId}`, { is_active: isActive });
      loadScheduledReports();
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (scheduleId: string) => {
    setConfirmDeleteId(scheduleId);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await api.delete(`/reports/scheduled/${confirmDeleteId}`);
      loadScheduledReports();
      toast.success('Scheduled report deleted');
    } catch (error) {
      console.error('Failed to delete scheduled report:', error);
      toast.error('Failed to delete scheduled report');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const getReportName = (reportDefId: string) => {
    const report = reportDefinitions.find((r) => r.id === reportDefId);
    return report?.name || 'Unknown Report';
  };

  const getScheduleDescription = (schedule: ScheduledReport) => {
    const time = `${String(schedule.schedule_config?.hour || 9).padStart(2, '0')}:${String(
      schedule.schedule_config?.minute || 0
    ).padStart(2, '0')}`;

    if (schedule.schedule_type === 'daily') {
      return `Daily at ${time}`;
    } else if (schedule.schedule_type === 'weekly') {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const day = days[schedule.schedule_config?.day_of_week || 0];
      return `Weekly on ${day} at ${time}`;
    } else {
      const dayNum = schedule.schedule_config?.day_of_month || 1;
      return `Monthly on day ${dayNum} at ${time}`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Scheduled Reports</h2>
          <p className="text-sm text-gray-600 mt-1">
            Automatically run and email reports on a schedule
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Schedule Report
        </Button>
      </div>

      {scheduledReports.length === 0 ? (
        <Card className="p-12 text-center">
          <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No scheduled reports</h3>
          <p className="text-gray-600 mb-6">
            Schedule reports to be automatically generated and emailed
          </p>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Your First Report
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {scheduledReports.map((schedule) => (
            <Card key={schedule.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {getReportName(schedule.report_definition_id)}
                    </h3>
                    <Badge variant={schedule.is_active ? 'success' : 'default'}>
                      {schedule.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {schedule.last_status && (
                      <Badge
                        variant={
                          schedule.last_status === 'success' ? 'success' : 'danger'
                        }
                      >
                        Last: {schedule.last_status}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{getScheduleDescription(schedule)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>{schedule.recipients.length} recipient(s)</span>
                    </div>
                    {schedule.next_run && (
                      <div className="text-xs text-gray-500">
                        Next run: {new Date(schedule.next_run).toLocaleString()}
                      </div>
                    )}
                    {schedule.last_run && (
                      <div className="text-xs text-gray-500">
                        Last run: {new Date(schedule.last_run).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={schedule.is_active}
                    onChange={(checked) => handleToggleActive(schedule.id, checked)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(schedule)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(schedule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmDeleteId(null)}
          title="Confirm Deletion"
        >
          <p className="text-sm text-gray-600 mb-6">
            Are you sure you want to delete this scheduled report? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
              Delete
            </Button>
          </div>
        </Modal>
      )}

      {/* Schedule Modal */}
      {showModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowModal(false)}
          title={editingSchedule ? 'Edit Scheduled Report' : 'Schedule Report'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Report <span className="text-red-500">*</span>
              </label>
              <Select
                value={reportDefinitionId}
                onChange={(e) => setReportDefinitionId(e.target.value)}
                options={[
                  { value: '', label: 'Select a report...' },
                  ...reportDefinitions.map((r) => ({
                    value: r.id,
                    label: r.name,
                  })),
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Schedule Type
              </label>
              <Select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as any)}
                options={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' },
                ]}
              />
            </div>

            {scheduleType === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Week
                </label>
                <Select
                  value={String(dayOfWeek)}
                  onChange={(e) => setDayOfWeek(parseIntSafe(e.target.value, 0, 'Day of Week'))}
                  options={[
                    { value: '0', label: 'Monday' },
                    { value: '1', label: 'Tuesday' },
                    { value: '2', label: 'Wednesday' },
                    { value: '3', label: 'Thursday' },
                    { value: '4', label: 'Friday' },
                    { value: '5', label: 'Saturday' },
                    { value: '6', label: 'Sunday' },
                  ]}
                />
              </div>
            )}

            {scheduleType === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Month
                </label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(parseIntSafe(e.target.value, 1, 'Day of Month'))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hour (24h)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={hour}
                  onChange={(e) => setHour(parseIntSafe(e.target.value, 0, 'Hour'))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minute
                </label>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={minute}
                  onChange={(e) => setMinute(parseIntSafe(e.target.value, 0, 'Minute'))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Recipients <span className="text-red-500">*</span>
              </label>
              <textarea
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="email1@example.com, email2@example.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter email addresses separated by commas
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>Save Schedule</>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
