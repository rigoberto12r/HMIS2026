/**
 * Inpatient Module Types
 * ADT (Admission, Discharge, Transfer) and Bed Management
 */

export type BedStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'reserved';
export type BedType = 'standard' | 'semi_private' | 'private' | 'icu' | 'isolation' | 'pediatric' | 'maternity';
export type AdmissionType = 'emergency' | 'elective' | 'transfer' | 'observation';
export type AdmissionStatus = 'active' | 'transferred' | 'discharged' | 'cancelled';
export type DischargeType = 'home' | 'home_health' | 'snf' | 'deceased' | 'ama' | 'transfer_external';
export type DischargeDisposition = 'improved' | 'stable' | 'worse' | 'deceased';

export interface Bed {
  id: string;
  bed_number: string;
  unit: string;
  floor?: number;
  room?: string;
  type: BedType;
  status: BedStatus;
  features?: string[];
  gender_restriction?: 'male' | 'female' | null;
  current_patient_id?: string;
  current_patient_name?: string;
  current_admission_id?: string;
  admission_date?: string;
  days_occupied?: number;
  last_cleaned_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Admission {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_age?: number;
  patient_gender?: string;
  bed_id: string;
  bed_number: string;
  unit: string;
  admission_number: string;
  admission_type: AdmissionType;
  admission_date: string;
  expected_discharge_date?: string;
  admitting_diagnosis: string;
  chief_complaint?: string;
  admitting_physician_id: string;
  admitting_physician_name: string;
  attending_physician_id: string;
  attending_physician_name: string;
  status: AdmissionStatus;
  days_stayed?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Transfer {
  id: string;
  admission_id: string;
  from_bed_id: string;
  from_bed_number: string;
  to_bed_id: string;
  to_bed_number: string;
  transfer_date: string;
  reason: string;
  notes?: string;
  transferred_by_id: string;
  transferred_by_name: string;
  created_at: string;
}

export interface Discharge {
  id: string;
  admission_id: string;
  discharge_date: string;
  discharge_type: DischargeType;
  discharge_diagnosis: string;
  discharge_disposition: DischargeDisposition;
  discharge_summary: string;
  medications_prescribed?: string[];
  follow_up_instructions?: string;
  follow_up_date?: string;
  discharged_by_id: string;
  discharged_by_name: string;
  created_at: string;
}

export interface CensusSnapshot {
  unit: string;
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  cleaning_beds: number;
  maintenance_beds: number;
  occupancy_rate: number;
  average_los: number; // Length of Stay in days
}

export interface CensusRealtime {
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  admissions_today: number;
  discharges_today: number;
  transfers_today: number;
  average_los: number;
  occupancy_rate: number;
  by_unit: CensusSnapshot[];
  recent_admissions: Admission[];
  timestamp: string;
}

export interface BedAvailability {
  bed_id: string;
  bed_number: string;
  unit: string;
  floor?: number;
  room?: string;
  type: BedType;
  features?: string[];
  score?: number; // For auto-assign best bed algorithm
}

export interface CreateAdmissionRequest {
  patient_id: string;
  bed_id: string;
  admission_type: AdmissionType;
  admitting_diagnosis: string;
  chief_complaint?: string;
  expected_discharge_date?: string;
  admitting_physician_id: string;
  attending_physician_id: string;
  notes?: string;
}

export interface TransferPatientRequest {
  admission_id: string;
  to_bed_id: string;
  reason: string;
  notes?: string;
}

export interface DischargePatientRequest {
  admission_id: string;
  discharge_type: DischargeType;
  discharge_diagnosis: string;
  discharge_disposition: DischargeDisposition;
  discharge_summary: string;
  medications_prescribed?: string[];
  follow_up_instructions?: string;
  follow_up_date?: string;
}

export interface UpdateBedStatusRequest {
  bed_id: string;
  status: BedStatus;
  notes?: string;
}

export interface AdmissionsQueryParams extends Record<string, string | number | boolean | null | undefined | string[]> {
  status?: AdmissionStatus;
  unit?: string;
  physician_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
  search?: string;
}

export interface BedsQueryParams extends Record<string, string | number | boolean | null | undefined> {
  unit?: string;
  status?: BedStatus;
  type?: BedType;
  floor?: number;
  available_only?: boolean;
}

export interface AvailableBedsParams extends Record<string, string | number | boolean | null | undefined | string[]> {
  unit?: string;
  type?: BedType;
  gender?: 'male' | 'female';
  features?: string[];
}
