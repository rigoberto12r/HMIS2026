/**
 * Mock data generators for Emergency Department module
 */

import {
  EDVisit,
  TriageAssessment,
  EDTrackBoardItem,
  EDMetrics,
  EDDashboardStats,
  ESILevel,
  ArrivalMode,
  EDStatus,
  DispositionType,
  IsolationPrecaution,
  ESI_DESCRIPTIONS,
} from '@/types/emergency';

/**
 * Generate a mock EDVisit
 */
export function mockEDVisit(overrides: Partial<EDVisit> = {}): EDVisit {
  return {
    id: 'ed-visit-1',
    visit_number: 'ED-2026-001234',
    patient_id: 'patient-1',
    patient_name: 'Juan Pérez',
    patient_age: 45,
    patient_gender: 'M',
    arrival_mode: 'walk_in',
    arrival_time: '2026-02-16T08:00:00Z',
    chief_complaint: 'Chest pain',
    esi_level: 2,
    status: 'triage',
    bed_number: undefined,
    assigned_physician_id: undefined,
    assigned_physician_name: undefined,
    triage_time: '2026-02-16T08:05:00Z',
    doc_time: undefined,
    disposition_time: undefined,
    disposition_type: undefined,
    waiting_time_minutes: 5,
    door_to_doc_minutes: undefined,
    length_of_stay_minutes: undefined,
    created_at: '2026-02-16T08:00:00Z',
    updated_at: '2026-02-16T08:05:00Z',
    ...overrides,
  };
}

/**
 * Generate multiple mock EDVisits
 */
export function mockEDVisits(count: number = 10): EDVisit[] {
  const arrivalModes: ArrivalMode[] = ['walk_in', 'ambulance', 'police', 'helicopter'];
  const statuses: EDStatus[] = ['waiting', 'triage', 'in_treatment', 'disposition', 'admitted', 'discharged'];
  const esiLevels: ESILevel[] = [1, 2, 3, 4, 5];
  const complaints = [
    'Chest pain',
    'Abdominal pain',
    'Shortness of breath',
    'Headache',
    'Motor vehicle accident',
    'Laceration',
    'Fever',
    'Dizziness',
  ];

  return Array.from({ length: count }, (_, i) => {
    const arrivalMode = arrivalModes[i % arrivalModes.length];
    const status = statuses[i % statuses.length];
    const esiLevel = esiLevels[i % esiLevels.length];
    const complaint = complaints[i % complaints.length];
    const hoursAgo = i;
    const arrivalTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

    return mockEDVisit({
      id: `ed-visit-${i + 1}`,
      visit_number: `ED-2026-00${1234 + i}`,
      patient_id: `patient-${i + 1}`,
      patient_name: `Patient ${i + 1}`,
      patient_age: 30 + (i * 5),
      arrival_mode: arrivalMode,
      arrival_time: arrivalTime,
      chief_complaint: complaint,
      esi_level: esiLevel,
      status,
      waiting_time_minutes: 5 + i * 2,
    });
  });
}

/**
 * Generate a mock TriageAssessment
 */
export function mockTriageAssessment(overrides: Partial<TriageAssessment> = {}): TriageAssessment {
  return {
    id: 'triage-1',
    visit_id: 'ed-visit-1',
    esi_level: 2,
    temperature: 37.2,
    heart_rate: 95,
    respiratory_rate: 18,
    blood_pressure_systolic: 145,
    blood_pressure_diastolic: 90,
    oxygen_saturation: 98,
    pain_score: 7,
    mechanism_of_injury: undefined,
    allergies: ['Penicillin'],
    current_medications: ['Aspirin', 'Lisinopril'],
    medical_history: ['Hypertension', 'Hyperlipidemia'],
    pregnancy_status: false,
    isolation_precautions: undefined,
    notes: 'Patient reports chest pain radiating to left arm, started 1 hour ago',
    triaged_at: '2026-02-16T08:05:00Z',
    triaged_by_id: 'nurse-1',
    triaged_by_name: 'Nurse Rodriguez',
    created_at: '2026-02-16T08:05:00Z',
    ...overrides,
  };
}

/**
 * Generate a mock EDTrackBoardItem
 */
export function mockEDTrackBoardItem(overrides: Partial<EDTrackBoardItem> = {}): EDTrackBoardItem {
  return {
    visit_id: 'ed-visit-1',
    visit_number: 'ED-2026-001234',
    bed_number: 'ED-05',
    patient_name: 'Juan Pérez',
    patient_age: 45,
    chief_complaint: 'Chest pain',
    esi_level: 2,
    status: 'in_treatment',
    arrival_time: '2026-02-16T08:00:00Z',
    waiting_time_minutes: 15,
    door_to_doc_minutes: 20,
    assigned_physician: 'Dr. García',
    notes: 'Cardiac workup in progress',
    ...overrides,
  };
}

/**
 * Generate multiple mock EDTrackBoardItems
 */
export function mockEDTrackBoard(count: number = 8): EDTrackBoardItem[] {
  const visits = mockEDVisits(count);

  return visits.map((visit, i) => ({
    visit_id: visit.id,
    visit_number: visit.visit_number,
    bed_number: visit.status === 'waiting' || visit.status === 'triage' ? undefined : `ED-${String(i + 1).padStart(2, '0')}`,
    patient_name: visit.patient_name,
    patient_age: visit.patient_age,
    chief_complaint: visit.chief_complaint,
    esi_level: visit.esi_level!,
    status: visit.status,
    arrival_time: visit.arrival_time,
    waiting_time_minutes: visit.waiting_time_minutes!,
    door_to_doc_minutes: visit.door_to_doc_minutes,
    assigned_physician: visit.assigned_physician_name,
    notes: undefined,
  }));
}

/**
 * Generate mock EDMetrics
 */
export function mockEDMetrics(overrides: Partial<EDMetrics> = {}): EDMetrics {
  return {
    date: '2026-02-16',
    total_visits: 85,
    visits_by_esi: {
      esi_1: 2,
      esi_2: 12,
      esi_3: 35,
      esi_4: 28,
      esi_5: 8,
    },
    avg_door_to_doc_minutes: 35,
    avg_los_minutes: 185,
    lwbs_count: 4,
    lwbs_rate: 4.7,
    admission_count: 18,
    admission_rate: 21.2,
    discharge_count: 60,
    transfer_count: 2,
    ama_count: 1,
    deceased_count: 0,
    ...overrides,
  };
}

/**
 * Generate mock EDDashboardStats
 */
export function mockEDDashboardStats(overrides: Partial<EDDashboardStats> = {}): EDDashboardStats {
  return {
    patients_waiting: 8,
    patients_in_treatment: 15,
    avg_door_to_doc_minutes: 32,
    avg_los_hours: 3.2,
    visits_by_esi: {
      esi_1: 0,
      esi_2: 3,
      esi_3: 12,
      esi_4: 6,
      esi_5: 2,
    },
    recent_arrivals: mockEDVisits(5),
    lwbs_count_today: 2,
    timestamp: '2026-02-16T08:00:00Z',
    ...overrides,
  };
}

/**
 * Create a critical ESI Level 1 visit
 */
export function mockCriticalEDVisit(): EDVisit {
  return mockEDVisit({
    esi_level: 1,
    arrival_mode: 'ambulance',
    chief_complaint: 'Cardiac arrest - CPR in progress',
    status: 'in_treatment',
    bed_number: 'ED-RESUS',
    assigned_physician_id: 'physician-1',
    assigned_physician_name: 'Dr. García',
    triage_time: '2026-02-16T08:01:00Z',
    doc_time: '2026-02-16T08:02:00Z',
    door_to_doc_minutes: 2,
  });
}

/**
 * Create a triage assessment for ESI Level 1
 */
export function mockCriticalTriageAssessment(): TriageAssessment {
  return mockTriageAssessment({
    esi_level: 1,
    temperature: undefined,
    heart_rate: 0,
    respiratory_rate: 0,
    blood_pressure_systolic: undefined,
    blood_pressure_diastolic: undefined,
    oxygen_saturation: undefined,
    pain_score: undefined,
    notes: 'Unresponsive, CPR in progress, EMS report: collapse at home',
  });
}

/**
 * Create an LWBS (Left Without Being Seen) visit
 */
export function mockLWBSVisit(): EDVisit {
  return mockEDVisit({
    esi_level: 4,
    status: 'lwbs',
    chief_complaint: 'Minor laceration',
    waiting_time_minutes: 120,
    disposition_time: '2026-02-16T10:00:00Z',
    disposition_type: 'lwbs',
  });
}

/**
 * Create an isolation precaution triage
 */
export function mockIsolationTriageAssessment(): TriageAssessment {
  return mockTriageAssessment({
    esi_level: 3,
    temperature: 38.9,
    isolation_precautions: ['droplet', 'contact'],
    notes: 'Productive cough, fever, possible pneumonia - placed in isolation room',
  });
}

/**
 * Create a trauma visit
 */
export function mockTraumaVisit(): EDVisit {
  return mockEDVisit({
    esi_level: 2,
    arrival_mode: 'ambulance',
    chief_complaint: 'Motor vehicle accident - multiple trauma',
    status: 'in_treatment',
    bed_number: 'ED-TRAUMA-1',
    assigned_physician_id: 'physician-1',
    assigned_physician_name: 'Dr. Mendez',
  });
}

/**
 * Create a trauma triage assessment
 */
export function mockTraumaTriageAssessment(): TriageAssessment {
  return mockTriageAssessment({
    esi_level: 2,
    temperature: 36.8,
    heart_rate: 110,
    respiratory_rate: 24,
    blood_pressure_systolic: 90,
    blood_pressure_diastolic: 60,
    oxygen_saturation: 94,
    pain_score: 9,
    mechanism_of_injury: 'MVA - T-bone collision, driver side impact, restrained',
    notes: 'GCS 14, left chest wall tenderness, abdominal pain, hemodynamically borderline',
  });
}

/**
 * Create a pediatric visit
 */
export function mockPediatricVisit(): EDVisit {
  return mockEDVisit({
    patient_age: 8,
    esi_level: 3,
    chief_complaint: 'Fever and vomiting',
    status: 'in_treatment',
  });
}
