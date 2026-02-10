/**
 * Types for EMR Encounter Detail Page
 */

export interface Encounter {
  id: string;
  patient_id: string;
  doctor_id: string;
  encounter_type: string;
  status: string;
  reason: string | null;
  disposition: string | null;
  patient_name: string | null;
  doctor_name: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SOAPNote {
  id: string;
  encounter_id: string;
  note_type: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  signed: boolean;
  signed_at: string | null;
  created_at: string;
}

export interface VitalSigns {
  id: string;
  encounter_id: string;
  patient_id: string;
  heart_rate: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  temperature: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  recorded_at: string;
}

export interface Diagnosis {
  id: string;
  encounter_id: string;
  patient_id: string;
  icd10_code: string;
  description: string;
  diagnosis_type: string;
  created_at: string;
}

export interface Allergy {
  id: string;
  patient_id: string;
  allergen: string;
  reaction: string;
  severity: string;
  created_at: string;
}

export interface SOAPFormData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface VitalsFormData {
  heart_rate: string;
  blood_pressure_systolic: string;
  blood_pressure_diastolic: string;
  temperature: string;
  respiratory_rate: string;
  oxygen_saturation: string;
  weight_kg: string;
  height_cm: string;
}

export interface DiagnosisFormData {
  icd10_code: string;
  description: string;
  diagnosis_type: string;
}
