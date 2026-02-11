'use client';

import { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, User, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Appointment {
  id: string;
  provider_name: string;
  provider_specialty: string | null;
  appointment_type: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  reason: string | null;
  location_name: string | null;
  can_cancel: boolean;
}

export default function PortalAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, [showPast]);

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('portal_access_token');
      const response = await fetch(
        `http://localhost:8000/api/v1/portal/appointments?include_past=${showPast}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to load appointments');

      const data = await response.json();
      setAppointments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async (appointmentId: string) => {
    if (!cancelReason.trim()) {
      alert('Please provide a cancellation reason');
      return;
    }

    try {
      const token = localStorage.getItem('portal_access_token');
      const response = await fetch(
        `http://localhost:8000/api/v1/portal/appointments/${appointmentId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cancellation_reason: cancelReason }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail);
      }

      setCancellingId(null);
      setCancelReason('');
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel appointment');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-green-100 text-green-700',
      completed: 'bg-blue-100 text-blue-700',
      cancelled: 'bg-red-100 text-red-700',
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
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">My Appointments</h1>
        <p className="text-neutral-600">View and manage your medical appointments</p>
      </div>

      {/* Toggle */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setShowPast(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !showPast ? 'bg-blue-600 text-white' : 'bg-white text-neutral-600 border border-neutral-200'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setShowPast(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showPast ? 'bg-blue-600 text-white' : 'bg-white text-neutral-600 border border-neutral-200'
          }`}
        >
          All Appointments
        </button>
      </div>

      {/* Appointments List */}
      {appointments.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
          <Calendar className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">No appointments found</h3>
          <p className="text-neutral-500 mb-4">
            {showPast ? 'You have no past appointments' : 'You have no upcoming appointments'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => (
            <div key={appt.id} className="bg-white rounded-xl border border-neutral-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-xl bg-blue-100 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-xs text-blue-600 font-medium">
                      {new Date(appt.scheduled_start).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-xl font-bold text-blue-600">
                      {new Date(appt.scheduled_start).getDate()}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-neutral-900">{appt.provider_name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(appt.status)}`}>
                        {appt.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-neutral-600">
                      {appt.provider_specialty && (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>{appt.provider_specialty}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>
                          {new Date(appt.scheduled_start).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}{' '}
                          -{' '}
                          {new Date(appt.scheduled_end).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {appt.location_name && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{appt.location_name}</span>
                        </div>
                      )}
                      {appt.reason && (
                        <p className="mt-2 text-neutral-700">
                          <span className="font-medium">Reason:</span> {appt.reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {appt.can_cancel && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCancellingId(appt.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel Modal */}
      {cancellingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Cancel Appointment</h3>
              <button onClick={() => setCancellingId(null)} className="p-1 hover:bg-neutral-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  Appointments can only be cancelled if they are more than 24 hours away.
                </p>
              </div>

              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Cancellation Reason
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="form-input w-full"
                placeholder="Please provide a reason for cancellation..."
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCancellingId(null)} className="flex-1">
                Keep Appointment
              </Button>
              <Button
                onClick={() => handleCancel(cancellingId)}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Cancel Appointment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
