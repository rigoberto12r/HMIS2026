'use client';

import { useEffect, useState } from 'react';
import { FileText, Activity, Thermometer, Heart, User, Calendar } from 'lucide-react';

interface Encounter {
  id: string;
  encounter_type: string;
  start_datetime: string;
  provider_name: string;
  chief_complaint: string | null;
  diagnoses_count: number;
  has_vitals: boolean;
  has_prescriptions: boolean;
}

interface Diagnosis {
  id: string;
  encounter_date: string;
  provider_name: string;
  icd10_code: string | null;
  icd10_description: string;
  diagnosis_type: string;
  status: string;
}

interface VitalSigns {
  id: string;
  encounter_date: string;
  temperature_c: number | null;
  heart_rate_bpm: number | null;
  respiratory_rate_bpm: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  oxygen_saturation_pct: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
}

export default function PortalMedicalRecordsPage() {
  const [activeTab, setActiveTab] = useState<'encounters' | 'diagnoses' | 'vitals'>('encounters');
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [vitals, setVitals] = useState<VitalSigns[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('portal_access_token');
      let url = '';

      if (activeTab === 'encounters') {
        url = 'http://localhost:8000/api/v1/portal/medical-records/encounters';
      } else if (activeTab === 'diagnoses') {
        url = 'http://localhost:8000/api/v1/portal/medical-records/diagnoses';
      } else {
        url = 'http://localhost:8000/api/v1/portal/medical-records/vitals';
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to load data');

      const data = await response.json();

      if (activeTab === 'encounters') setEncounters(data);
      else if (activeTab === 'diagnoses') setDiagnoses(data);
      else setVitals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Medical Records</h1>
        <p className="text-neutral-600">View your complete medical history</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('encounters')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'encounters'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Visits
        </button>
        <button
          onClick={() => setActiveTab('diagnoses')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'diagnoses'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Diagnoses
        </button>
        <button
          onClick={() => setActiveTab('vitals')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'vitals'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Vital Signs
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Encounters */}
          {activeTab === 'encounters' && (
            <div className="space-y-4">
              {encounters.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
                  <FileText className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-500">No medical visits found</p>
                </div>
              ) : (
                encounters.map((enc) => (
                  <div key={enc.id} className="bg-white rounded-xl border border-neutral-200 p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-neutral-900 capitalize">
                              {enc.encounter_type} Visit
                            </h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(enc.start_datetime).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                {enc.provider_name}
                              </span>
                            </div>
                          </div>
                        </div>
                        {enc.chief_complaint && (
                          <p className="text-sm text-neutral-700 mb-2">
                            <span className="font-medium">Complaint:</span> {enc.chief_complaint}
                          </p>
                        )}
                        <div className="flex gap-4 text-xs text-neutral-500">
                          <span>{enc.diagnoses_count} diagnosis</span>
                          {enc.has_vitals && <span>Vitals recorded</span>}
                          {enc.has_prescriptions && <span>Prescriptions issued</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Diagnoses */}
          {activeTab === 'diagnoses' && (
            <div className="space-y-4">
              {diagnoses.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
                  <Activity className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-500">No diagnoses found</p>
                </div>
              ) : (
                diagnoses.map((diag) => (
                  <div key={diag.id} className="bg-white rounded-xl border border-neutral-200 p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Activity className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-neutral-900">{diag.icd10_description}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
                          <span>{new Date(diag.encounter_date).toLocaleDateString()}</span>
                          <span>{diag.provider_name}</span>
                          {diag.icd10_code && <span className="font-mono">{diag.icd10_code}</span>}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <span className="px-2 py-1 bg-neutral-100 text-neutral-700 rounded text-xs font-medium capitalize">
                            {diag.diagnosis_type}
                          </span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium capitalize">
                            {diag.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Vitals */}
          {activeTab === 'vitals' && (
            <div className="space-y-4">
              {vitals.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
                  <Thermometer className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-500">No vital signs recorded</p>
                </div>
              ) : (
                vitals.map((vital) => (
                  <div key={vital.id} className="bg-white rounded-xl border border-neutral-200 p-6">
                    <div className="mb-3">
                      <p className="text-sm text-neutral-500">
                        {new Date(vital.encounter_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {vital.temperature_c && (
                        <div className="flex items-center gap-2">
                          <Thermometer className="w-5 h-5 text-red-500" />
                          <div>
                            <p className="text-xs text-neutral-500">Temperature</p>
                            <p className="font-semibold text-neutral-900">{vital.temperature_c}°C</p>
                          </div>
                        </div>
                      )}
                      {vital.heart_rate_bpm && (
                        <div className="flex items-center gap-2">
                          <Heart className="w-5 h-5 text-red-500" />
                          <div>
                            <p className="text-xs text-neutral-500">Heart Rate</p>
                            <p className="font-semibold text-neutral-900">{vital.heart_rate_bpm} bpm</p>
                          </div>
                        </div>
                      )}
                      {vital.systolic_bp && vital.diastolic_bp && (
                        <div className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-blue-500" />
                          <div>
                            <p className="text-xs text-neutral-500">Blood Pressure</p>
                            <p className="font-semibold text-neutral-900">
                              {vital.systolic_bp}/{vital.diastolic_bp}
                            </p>
                          </div>
                        </div>
                      )}
                      {vital.oxygen_saturation_pct && (
                        <div className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-cyan-500" />
                          <div>
                            <p className="text-xs text-neutral-500">SpO2</p>
                            <p className="font-semibold text-neutral-900">{vital.oxygen_saturation_pct}%</p>
                          </div>
                        </div>
                      )}
                      {vital.weight_kg && (
                        <div className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-green-500" />
                          <div>
                            <p className="text-xs text-neutral-500">Weight</p>
                            <p className="font-semibold text-neutral-900">{vital.weight_kg} kg</p>
                          </div>
                        </div>
                      )}
                      {vital.height_cm && (
                        <div className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-purple-500" />
                          <div>
                            <p className="text-xs text-neutral-500">Height</p>
                            <p className="font-semibold text-neutral-900">{vital.height_cm} cm</p>
                          </div>
                        </div>
                      )}
                      {vital.bmi && (
                        <div className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-orange-500" />
                          <div>
                            <p className="text-xs text-neutral-500">BMI</p>
                            <p className="font-semibold text-neutral-900">{vital.bmi.toFixed(1)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
