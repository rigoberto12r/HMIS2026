'use client';

import { useEffect, useState } from 'react';
import { Activity, Calendar, User, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PORTAL_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface LabResult {
  id: string;
  order_date: string;
  test_name: string;
  test_code: string | null;
  result_value: string | null;
  unit: string | null;
  reference_range: string | null;
  status: string;
  is_abnormal: boolean;
  provider_name: string;
  report_url: string | null;
}

export default function PortalLabResultsPage() {
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLabResults();
  }, []);

  const fetchLabResults = async () => {
    try {
      const token = localStorage.getItem('portal_access_token');
      const response = await fetch(`${PORTAL_API_URL}/portal/lab-results`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to load lab results');

      const data = await response.json();
      setLabResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Lab Results</h1>
        <p className="text-neutral-600">View your laboratory test results</p>
      </div>

      {/* Lab Results List */}
      {labResults.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
          <Activity className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">No lab results available</h3>
          <p className="text-neutral-500">Your lab test results will appear here when available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {labResults.map((result) => (
            <div
              key={result.id}
              className={`bg-white rounded-xl border p-6 ${
                result.is_abnormal ? 'border-yellow-300 bg-yellow-50/30' : 'border-neutral-200'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    result.is_abnormal ? 'bg-yellow-100' : 'bg-green-100'
                  }`}
                >
                  {result.is_abnormal ? (
                    <AlertTriangle className="w-6 h-6 text-yellow-600" />
                  ) : (
                    <Activity className="w-6 h-6 text-green-600" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-neutral-900">{result.test_name}</h3>
                      {result.test_code && (
                        <p className="text-sm text-neutral-500 font-mono">{result.test_code}</p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        result.status === 'final'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {result.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(result.order_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <User className="w-4 h-4" />
                      <span>Ordered by {result.provider_name}</span>
                    </div>
                  </div>

                  {result.result_value && (
                    <div className="mt-3 p-3 bg-neutral-50 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-neutral-500">Result</p>
                          <p className="font-semibold text-neutral-900">
                            {result.result_value}
                            {result.unit && ` ${result.unit}`}
                          </p>
                        </div>
                        {result.reference_range && (
                          <div className="md:col-span-2">
                            <p className="text-neutral-500">Reference Range</p>
                            <p className="font-medium text-neutral-900">{result.reference_range}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {result.is_abnormal && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                        <p className="text-sm text-yellow-800">
                          This result is outside the normal range. Please consult with your healthcare provider.
                        </p>
                      </div>
                    </div>
                  )}

                  {result.report_url && (
                    <div className="mt-3">
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Download Report
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-1">About Your Lab Results</h3>
        <p className="text-sm text-blue-800">
          Lab results are typically available within 24-72 hours after the test. You will be notified when new
          results are available. If you have questions about your results, please contact your healthcare
          provider.
        </p>
      </div>
    </div>
  );
}
