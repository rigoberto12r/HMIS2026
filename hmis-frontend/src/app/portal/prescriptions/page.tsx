'use client';

import { useEffect, useState, useCallback } from 'react';
import { Pill, Calendar, User, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PORTAL_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface Prescription {
  id: string;
  encounter_date: string;
  provider_name: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions: string | null;
  status: string;
  refills_remaining: number;
  can_request_refill: boolean;
}

export default function PortalPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);
  const [refillRequestId, setRefillRequestId] = useState<string | null>(null);
  const [refillNotes, setRefillNotes] = useState('');

  const fetchPrescriptions = useCallback(async () => {
    const controller = new AbortController();
    setIsLoading(true);

    try {
      const token = localStorage.getItem('portal_access_token');
      const response = await fetch(
        `${PORTAL_API_URL}/portal/prescriptions?active_only=${activeOnly}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }
      );

      if (!response.ok) throw new Error('Failed to load prescriptions');

      const data = await response.json();
      setPrescriptions(data);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error(err);
      }
    } finally {
      setIsLoading(false);
    }

    return controller;
  }, [activeOnly]);

  useEffect(() => {
    const controller = fetchPrescriptions();

    return () => {
      controller.then((ctrl) => ctrl.abort());
    };
  }, [fetchPrescriptions]);

  const handleRequestRefill = async () => {
    if (!refillRequestId) return;

    try {
      const token = localStorage.getItem('portal_access_token');
      const response = await fetch(`${PORTAL_API_URL}/portal/prescriptions/refill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prescription_id: refillRequestId,
          notes: refillNotes,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail);
      }

      toast.success('Refill request submitted successfully');
      setRefillRequestId(null);
      setRefillNotes('');
      fetchPrescriptions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to request refill');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      completed: 'bg-blue-100 text-blue-700',
      discontinued: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-neutral-100 text-neutral-700';
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
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">My Prescriptions</h1>
        <p className="text-neutral-600">View and manage your medication prescriptions</p>
      </div>

      {/* Toggle */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setActiveOnly(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeOnly ? 'bg-blue-600 text-white' : 'bg-white text-neutral-600 border border-neutral-200'
          }`}
        >
          Active Prescriptions
        </button>
        <button
          onClick={() => setActiveOnly(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !activeOnly ? 'bg-blue-600 text-white' : 'bg-white text-neutral-600 border border-neutral-200'
          }`}
        >
          All Prescriptions
        </button>
      </div>

      {/* Prescriptions List */}
      {prescriptions.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
          <Pill className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">No prescriptions found</h3>
          <p className="text-neutral-500">
            {activeOnly ? 'You have no active prescriptions' : 'You have no prescriptions on record'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => (
            <div key={rx.id} className="bg-white rounded-xl border border-neutral-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Pill className="w-6 h-6 text-purple-600" />
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-neutral-900 text-lg">{rx.medication_name}</h3>
                      <p className="text-sm text-neutral-600 mt-1">
                        {rx.dosage} • {rx.frequency}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(rx.status)}`}>
                      {rx.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm">
                    <div className="flex items-center gap-2 text-neutral-600">
                      <User className="w-4 h-4" />
                      <span>Prescribed by {rx.provider_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-600">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(rx.encounter_date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="mt-3 p-3 bg-neutral-50 rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-neutral-500">Duration</p>
                        <p className="font-medium text-neutral-900">{rx.duration_days} days</p>
                      </div>
                      <div>
                        <p className="text-neutral-500">Refills Remaining</p>
                        <p className="font-medium text-neutral-900">{rx.refills_remaining}</p>
                      </div>
                      {rx.instructions && (
                        <div className="col-span-2 md:col-span-1">
                          <p className="text-neutral-500">Instructions</p>
                          <p className="font-medium text-neutral-900">{rx.instructions}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {rx.can_request_refill && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        onClick={() => setRefillRequestId(rx.id)}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Request Refill
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refill Request Modal */}
      {refillRequestId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Request Prescription Refill</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={refillNotes}
                onChange={(e) => setRefillNotes(e.target.value)}
                rows={3}
                className="form-input w-full"
                placeholder="Any additional information for your provider..."
              />
              <p className="text-xs text-neutral-500 mt-1">
                Your refill request will be reviewed by your healthcare provider.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setRefillRequestId(null)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleRequestRefill} className="flex-1 bg-purple-600 hover:bg-purple-700">
                <Check className="w-4 h-4 mr-2" />
                Submit Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
