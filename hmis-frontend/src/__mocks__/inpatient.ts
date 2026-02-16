/**
 * Mock data generators for Inpatient (ADT) module
 */

import {
  Bed,
  Admission,
  Transfer,
  Discharge,
  CensusSnapshot,
  CensusRealtime,
  BedAvailability,
  BedStatus,
  BedType,
  AdmissionType,
  AdmissionStatus,
  DischargeType,
  DischargeDisposition,
} from '@/types/inpatient';

/**
 * Generate a mock Bed
 */
export function mockBed(overrides: Partial<Bed> = {}): Bed {
  return {
    id: 'bed-1',
    bed_number: 'ICU-101',
    unit: 'ICU',
    floor: 2,
    room: '201',
    type: 'icu',
    status: 'available',
    features: ['Ventilator', 'Cardiac Monitor'],
    gender_restriction: null,
    current_patient_id: undefined,
    current_patient_name: undefined,
    current_admission_id: undefined,
    admission_date: undefined,
    days_occupied: undefined,
    last_cleaned_at: '2026-02-16T07:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-16T07:00:00Z',
    ...overrides,
  };
}

/**
 * Generate multiple mock Beds
 */
export function mockBeds(count: number = 10): Bed[] {
  const units = ['ICU', 'Medical', 'Surgical', 'Pediatric', 'Maternity'];
  const types: BedType[] = ['icu', 'standard', 'semi_private', 'private', 'pediatric'];
  const statuses: BedStatus[] = ['available', 'occupied', 'cleaning', 'maintenance', 'reserved'];

  return Array.from({ length: count }, (_, i) => {
    const unit = units[i % units.length];
    const type = types[i % types.length];
    const status = statuses[i % statuses.length];
    const floor = Math.floor(i / 5) + 2;
    const room = `${floor}0${(i % 5) + 1}`;

    return mockBed({
      id: `bed-${i + 1}`,
      bed_number: `${unit}-${room}`,
      unit,
      floor,
      room,
      type,
      status,
    });
  });
}

/**
 * Generate an occupied bed
 */
export function mockOccupiedBed(): Bed {
  return mockBed({
    status: 'occupied',
    current_patient_id: 'patient-1',
    current_patient_name: 'Juan Pérez',
    current_admission_id: 'admission-1',
    admission_date: '2026-02-14',
    days_occupied: 2,
  });
}

/**
 * Generate a mock Admission
 */
export function mockAdmission(overrides: Partial<Admission> = {}): Admission {
  return {
    id: 'admission-1',
    patient_id: 'patient-1',
    patient_name: 'Juan Pérez',
    patient_age: 45,
    patient_gender: 'M',
    bed_id: 'bed-1',
    bed_number: 'ICU-101',
    unit: 'ICU',
    admission_number: 'ADM-2026-001234',
    admission_type: 'emergency',
    admission_date: '2026-02-14T18:30:00Z',
    expected_discharge_date: '2026-02-20',
    admitting_diagnosis: 'Acute Myocardial Infarction',
    chief_complaint: 'Chest pain',
    admitting_physician_id: 'physician-1',
    admitting_physician_name: 'Dr. María García',
    attending_physician_id: 'physician-2',
    attending_physician_name: 'Dr. Carlos Mendez',
    status: 'active',
    days_stayed: 2,
    notes: 'Patient stable, monitoring cardiac enzymes',
    created_at: '2026-02-14T18:30:00Z',
    updated_at: '2026-02-16T08:00:00Z',
    ...overrides,
  };
}

/**
 * Generate multiple mock Admissions
 */
export function mockAdmissions(count: number = 5): Admission[] {
  const types: AdmissionType[] = ['emergency', 'elective', 'transfer', 'observation'];
  const statuses: AdmissionStatus[] = ['active', 'transferred', 'discharged', 'cancelled'];
  const units = ['ICU', 'Medical', 'Surgical', 'Pediatric', 'Maternity'];

  return Array.from({ length: count }, (_, i) => {
    const admissionType = types[i % types.length];
    const status = statuses[i % statuses.length];
    const unit = units[i % units.length];

    return mockAdmission({
      id: `admission-${i + 1}`,
      patient_id: `patient-${i + 1}`,
      patient_name: `Patient ${i + 1}`,
      admission_number: `ADM-2026-00${1234 + i}`,
      bed_id: `bed-${i + 1}`,
      bed_number: `${unit}-${200 + i}`,
      unit,
      admission_type: admissionType,
      status,
      days_stayed: i + 1,
    });
  });
}

/**
 * Generate a mock Transfer
 */
export function mockTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: 'transfer-1',
    admission_id: 'admission-1',
    from_bed_id: 'bed-1',
    from_bed_number: 'ICU-101',
    to_bed_id: 'bed-2',
    to_bed_number: 'Medical-201',
    transfer_date: '2026-02-16T14:00:00Z',
    reason: 'Patient stable, downgrade from ICU',
    notes: 'Transferred to step-down unit',
    transferred_by_id: 'nurse-1',
    transferred_by_name: 'Nurse Rodriguez',
    created_at: '2026-02-16T14:00:00Z',
    ...overrides,
  };
}

/**
 * Generate a mock Discharge
 */
export function mockDischarge(overrides: Partial<Discharge> = {}): Discharge {
  return {
    id: 'discharge-1',
    admission_id: 'admission-1',
    discharge_date: '2026-02-20T10:00:00Z',
    discharge_type: 'home',
    discharge_diagnosis: 'Acute Myocardial Infarction, resolved',
    discharge_disposition: 'improved',
    discharge_summary: 'Patient responded well to treatment. Cardiac enzymes trending down. EKG shows improvement. Discharged in stable condition.',
    medications_prescribed: [
      'Aspirin 81mg daily',
      'Atorvastatin 40mg daily',
      'Metoprolol 25mg BID',
      'Lisinopril 10mg daily',
    ],
    follow_up_instructions: 'Follow up with cardiologist in 1 week. Continue medications as prescribed. Return to ED if chest pain recurs.',
    follow_up_date: '2026-02-27',
    discharged_by_id: 'physician-2',
    discharged_by_name: 'Dr. Carlos Mendez',
    created_at: '2026-02-20T10:00:00Z',
    ...overrides,
  };
}

/**
 * Generate a mock CensusSnapshot for a unit
 */
export function mockCensusSnapshot(overrides: Partial<CensusSnapshot> = {}): CensusSnapshot {
  return {
    unit: 'ICU',
    total_beds: 10,
    occupied_beds: 8,
    available_beds: 2,
    cleaning_beds: 0,
    maintenance_beds: 0,
    occupancy_rate: 80,
    average_los: 4.5,
    ...overrides,
  };
}

/**
 * Generate mock CensusRealtime
 */
export function mockCensusRealtime(overrides: Partial<CensusRealtime> = {}): CensusRealtime {
  return {
    total_beds: 100,
    occupied_beds: 75,
    available_beds: 20,
    admissions_today: 12,
    discharges_today: 8,
    transfers_today: 5,
    average_los: 5.2,
    occupancy_rate: 75,
    by_unit: [
      mockCensusSnapshot({ unit: 'ICU', total_beds: 10, occupied_beds: 8, available_beds: 2 }),
      mockCensusSnapshot({ unit: 'Medical', total_beds: 30, occupied_beds: 24, available_beds: 6 }),
      mockCensusSnapshot({ unit: 'Surgical', total_beds: 25, occupied_beds: 18, available_beds: 7 }),
      mockCensusSnapshot({ unit: 'Pediatric', total_beds: 20, occupied_beds: 15, available_beds: 5 }),
      mockCensusSnapshot({ unit: 'Maternity', total_beds: 15, occupied_beds: 10, available_beds: 5 }),
    ],
    recent_admissions: mockAdmissions(3),
    timestamp: '2026-02-16T08:00:00Z',
    ...overrides,
  };
}

/**
 * Generate mock BedAvailability items
 */
export function mockBedAvailability(count: number = 5): BedAvailability[] {
  const units = ['ICU', 'Medical', 'Surgical', 'Pediatric'];
  const types: BedType[] = ['icu', 'standard', 'semi_private', 'private'];

  return Array.from({ length: count }, (_, i) => {
    const unit = units[i % units.length];
    const type = types[i % types.length];
    const floor = Math.floor(i / 5) + 2;
    const room = `${floor}0${(i % 5) + 1}`;

    return {
      bed_id: `bed-${i + 1}`,
      bed_number: `${unit}-${room}`,
      unit,
      floor,
      room,
      type,
      features: ['Oxygen', 'Call Button'],
      score: 85 - i * 5, // Higher score = better match
    };
  });
}

/**
 * Create an admission with a long length of stay
 */
export function mockLongStayAdmission(): Admission {
  return mockAdmission({
    admission_date: '2026-01-15T10:00:00Z',
    days_stayed: 32,
    status: 'active',
    expected_discharge_date: '2026-03-01',
  });
}

/**
 * Create a discharge with home health services
 */
export function mockHomeHealthDischarge(): Discharge {
  return mockDischarge({
    discharge_type: 'home_health',
    discharge_disposition: 'stable',
    follow_up_instructions: 'Home health nurse will visit 3x/week for wound care. Follow up with surgeon in 2 weeks.',
  });
}

/**
 * Create an AMA (Against Medical Advice) discharge
 */
export function mockAMADischarge(): Discharge {
  return mockDischarge({
    discharge_type: 'ama',
    discharge_disposition: 'stable',
    discharge_summary: 'Patient left against medical advice despite counseling about risks. Patient signed AMA form.',
    follow_up_instructions: 'Encouraged to return if symptoms worsen.',
  });
}
