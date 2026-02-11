'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Save, Eye, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────

interface QueryFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'between';
  value: any;
}

interface QuerySort {
  field: string;
  direction: 'asc' | 'desc';
}

interface QueryConfig {
  data_source: 'patients' | 'appointments' | 'billing' | 'pharmacy' | 'emr';
  fields: string[];
  filters: QueryFilter[];
  group_by: string[];
  sort: QuerySort[];
  limit: number | null;
}

interface Props {
  onSave?: () => void;
}

// ─── Component ──────────────────────────────────────────

export function ReportBuilder({ onSave }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [reportType, setReportType] = useState<'clinical' | 'financial' | 'operational'>('clinical');
  const [queryConfig, setQueryConfig] = useState<QueryConfig>({
    data_source: 'patients',
    fields: [],
    filters: [],
    group_by: [],
    sort: [],
    limit: 1000,
  });
  const [saving, setSaving] = useState(false);

  // Field options based on data source
  const fieldOptions: Record<string, string[]> = {
    patients: [
      'mrn',
      'first_name',
      'last_name',
      'birth_date',
      'gender',
      'blood_type',
      'phone',
      'email',
      'status',
      'created_at',
    ],
    appointments: [
      'appointment_type',
      'scheduled_start',
      'scheduled_end',
      'status',
      'reason',
      'source',
      'created_at',
    ],
    billing: [
      'invoice_number',
      'grand_total',
      'status',
      'due_date',
      'paid_date',
      'currency',
      'created_at',
    ],
    pharmacy: ['medication_name', 'dosage', 'quantity', 'status', 'prescribed_date'],
    emr: ['encounter_type', 'status', 'chief_complaint', 'disposition', 'start_datetime'],
  };

  const operatorOptions = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'gt', label: 'Greater Than' },
    { value: 'gte', label: 'Greater Than or Equal' },
    { value: 'lt', label: 'Less Than' },
    { value: 'lte', label: 'Less Than or Equal' },
    { value: 'in', label: 'In List' },
    { value: 'between', label: 'Between' },
  ];

  const addFilter = () => {
    setQueryConfig({
      ...queryConfig,
      filters: [
        ...queryConfig.filters,
        { field: '', operator: 'equals', value: '' },
      ],
    });
  };

  const updateFilter = (index: number, updates: Partial<QueryFilter>) => {
    const newFilters = [...queryConfig.filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    setQueryConfig({ ...queryConfig, filters: newFilters });
  };

  const removeFilter = (index: number) => {
    setQueryConfig({
      ...queryConfig,
      filters: queryConfig.filters.filter((_, i) => i !== index),
    });
  };

  const addSort = () => {
    setQueryConfig({
      ...queryConfig,
      sort: [...queryConfig.sort, { field: '', direction: 'asc' }],
    });
  };

  const updateSort = (index: number, updates: Partial<QuerySort>) => {
    const newSort = [...queryConfig.sort];
    newSort[index] = { ...newSort[index], ...updates };
    setQueryConfig({ ...queryConfig, sort: newSort });
  };

  const removeSort = (index: number) => {
    setQueryConfig({
      ...queryConfig,
      sort: queryConfig.sort.filter((_, i) => i !== index),
    });
  };

  const toggleField = (field: string) => {
    if (queryConfig.fields.includes(field)) {
      setQueryConfig({
        ...queryConfig,
        fields: queryConfig.fields.filter((f) => f !== field),
      });
    } else {
      setQueryConfig({
        ...queryConfig,
        fields: [...queryConfig.fields, field],
      });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a report name');
      return;
    }

    setSaving(true);
    try {
      await api.post('/reports/definitions', {
        name,
        description,
        report_type: reportType,
        query_config: queryConfig,
        is_public: false,
        is_template: false,
        tags: [],
      });

      if (onSave) {
        onSave();
      }
    } catch (error: any) {
      console.error('Failed to save report:', error);
      alert(error.response?.data?.detail || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Info */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Report Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Report Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Report"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this report shows..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Report Type
            </label>
            <Select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              options={[
                { value: 'clinical', label: 'Clinical' },
                { value: 'financial', label: 'Financial' },
                { value: 'operational', label: 'Operational' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Data Source */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Data Source</h3>
        <Select
          value={queryConfig.data_source}
          onChange={(e) =>
            setQueryConfig({ ...queryConfig, data_source: e.target.value as any })
          }
          options={[
            { value: 'patients', label: 'Patients' },
            { value: 'appointments', label: 'Appointments' },
            { value: 'billing', label: 'Billing / Invoices' },
            { value: 'pharmacy', label: 'Pharmacy / Prescriptions' },
            { value: 'emr', label: 'EMR / Encounters' },
          ]}
        />
      </Card>

      {/* Fields Selection */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Select Fields</h3>
        <div className="flex flex-wrap gap-2">
          {fieldOptions[queryConfig.data_source].map((field) => (
            <button
              key={field}
              onClick={() => toggleField(field)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                queryConfig.fields.includes(field)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {field.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        {queryConfig.fields.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Select at least one field to include in the report
          </p>
        )}
      </Card>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Filters</h3>
          <Button size="sm" onClick={addFilter}>
            <Plus className="h-4 w-4 mr-1" />
            Add Filter
          </Button>
        </div>

        {queryConfig.filters.length === 0 ? (
          <p className="text-sm text-gray-500">No filters applied</p>
        ) : (
          <div className="space-y-3">
            {queryConfig.filters.map((filter, index) => (
              <div key={index} className="flex gap-2 items-start">
                <Select
                  value={filter.field}
                  onChange={(e) => updateFilter(index, { field: e.target.value })}
                  options={[
                    { value: '', label: 'Select field...' },
                    ...fieldOptions[queryConfig.data_source].map((f) => ({
                      value: f,
                      label: f.replace(/_/g, ' '),
                    })),
                  ]}
                  className="flex-1"
                />
                <Select
                  value={filter.operator}
                  onChange={(e) => updateFilter(index, { operator: e.target.value as any })}
                  options={operatorOptions}
                  className="flex-1"
                />
                <Input
                  value={filter.value}
                  onChange={(e) => updateFilter(index, { value: e.target.value })}
                  placeholder="Value"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => removeFilter(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Sorting */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Sorting</h3>
          <Button size="sm" onClick={addSort}>
            <Plus className="h-4 w-4 mr-1" />
            Add Sort
          </Button>
        </div>

        {queryConfig.sort.length === 0 ? (
          <p className="text-sm text-gray-500">No sorting applied</p>
        ) : (
          <div className="space-y-3">
            {queryConfig.sort.map((sort, index) => (
              <div key={index} className="flex gap-2 items-start">
                <Select
                  value={sort.field}
                  onChange={(e) => updateSort(index, { field: e.target.value })}
                  options={[
                    { value: '', label: 'Select field...' },
                    ...fieldOptions[queryConfig.data_source].map((f) => ({
                      value: f,
                      label: f.replace(/_/g, ' '),
                    })),
                  ]}
                  className="flex-1"
                />
                <Select
                  value={sort.direction}
                  onChange={(e) => updateSort(index, { direction: e.target.value as any })}
                  options={[
                    { value: 'asc', label: 'Ascending' },
                    { value: 'desc', label: 'Descending' },
                  ]}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => removeSort(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Limit */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Result Limit</h3>
        <Input
          type="number"
          value={queryConfig.limit || ''}
          onChange={(e) =>
            setQueryConfig({
              ...queryConfig,
              limit: e.target.value ? parseInt(e.target.value) : null,
            })
          }
          placeholder="Leave empty for no limit"
        />
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? (
            'Saving...'
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Report
            </>
          )}
        </Button>
        <Button variant="outline" className="flex-1">
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
      </div>
    </div>
  );
}
