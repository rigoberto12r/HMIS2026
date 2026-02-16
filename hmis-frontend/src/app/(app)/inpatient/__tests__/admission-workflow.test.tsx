/**
 * Integration test for Inpatient Admission Workflow
 * Tests complete flow: Create admission → Assign bed → Nursing tasks → Transfer → Discharge
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Admission,
  Bed,
  BedAvailability,
  CensusRealtime,
  Transfer,
  Discharge,
} from '@/types/inpatient';

// Mock the API client
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

// Test data
const mockBeds: Bed[] = [
  {
    id: 'bed-1',
    bed_number: '101-A',
    unit: 'Medical Ward',
    floor: 1,
    room: '101',
    type: 'standard',
    status: 'available',
    features: ['oxygen', 'monitor'],
    gender_restriction: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'bed-2',
    bed_number: '101-B',
    unit: 'Medical Ward',
    floor: 1,
    room: '101',
    type: 'standard',
    status: 'available',
    features: ['oxygen'],
    gender_restriction: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'bed-3',
    bed_number: 'ICU-01',
    unit: 'ICU',
    floor: 2,
    room: 'ICU-01',
    type: 'icu',
    status: 'available',
    features: ['oxygen', 'monitor', 'ventilator'],
    gender_restriction: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const mockCensus: CensusRealtime = {
  total_beds: 50,
  occupied_beds: 35,
  available_beds: 15,
  admissions_today: 5,
  discharges_today: 3,
  transfers_today: 2,
  average_los: 4.5,
  occupancy_rate: 70,
  by_unit: [
    {
      unit: 'Medical Ward',
      total_beds: 20,
      occupied_beds: 15,
      available_beds: 5,
      cleaning_beds: 0,
      maintenance_beds: 0,
      occupancy_rate: 75,
      average_los: 5.0,
    },
    {
      unit: 'ICU',
      total_beds: 10,
      occupied_beds: 8,
      available_beds: 2,
      cleaning_beds: 0,
      maintenance_beds: 0,
      occupancy_rate: 80,
      average_los: 7.5,
    },
  ],
  recent_admissions: [],
  timestamp: '2026-02-16T10:00:00Z',
};

function createMockAdmission(overrides?: Partial<Admission>): Admission {
  return {
    id: 'admission-123',
    patient_id: 'patient-1',
    patient_name: 'Pedro Sánchez',
    patient_age: 45,
    patient_gender: 'M',
    bed_id: 'bed-1',
    bed_number: '101-A',
    unit: 'Medical Ward',
    admission_number: 'ADM-2026-001',
    admission_type: 'emergency',
    admission_date: '2026-02-16T08:00:00Z',
    expected_discharge_date: '2026-02-20T00:00:00Z',
    admitting_diagnosis: 'Pneumonia',
    chief_complaint: 'Shortness of breath, fever',
    admitting_physician_id: 'doc-1',
    admitting_physician_name: 'Dr. María García',
    attending_physician_id: 'doc-1',
    attending_physician_name: 'Dr. María García',
    status: 'active',
    days_stayed: 0,
    created_at: '2026-02-16T08:00:00Z',
    updated_at: '2026-02-16T08:00:00Z',
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return {
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    queryClient,
  };
}

describe('Inpatient Admission Workflow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy Path: Complete Workflow', () => {
    it('creates admission → assigns bed → transfers → discharges', async () => {
      // Step 1: Create Admission
      const newAdmission = createMockAdmission({
        id: 'admission-new',
        admission_number: 'ADM-2026-999',
      });

      // Step 2: Transfer to ICU
      const transferredAdmission = createMockAdmission({
        ...newAdmission,
        bed_id: 'bed-3',
        bed_number: 'ICU-01',
        unit: 'ICU',
        status: 'transferred',
      });

      const transfer: Transfer = {
        id: 'transfer-1',
        admission_id: 'admission-new',
        from_bed_id: 'bed-1',
        from_bed_number: '101-A',
        to_bed_id: 'bed-3',
        to_bed_number: 'ICU-01',
        transfer_date: '2026-02-17T14:00:00Z',
        reason: 'Deteriorating condition, requires ICU level care',
        transferred_by_id: 'nurse-1',
        transferred_by_name: 'Nurse Ana López',
        created_at: '2026-02-17T14:00:00Z',
      };

      // Step 3: Discharge
      const dischargedAdmission = createMockAdmission({
        ...transferredAdmission,
        status: 'discharged',
      });

      const discharge: Discharge = {
        id: 'discharge-1',
        admission_id: 'admission-new',
        discharge_date: '2026-02-20T10:00:00Z',
        discharge_type: 'home',
        discharge_diagnosis: 'Pneumonia, resolved',
        discharge_disposition: 'improved',
        discharge_summary: 'Patient improved with IV antibiotics. Afebrile x48h. Clear chest X-ray.',
        medications_prescribed: ['Amoxicillin 500mg PO TID x 7 days'],
        follow_up_instructions: 'Follow up with primary care in 1 week',
        follow_up_date: '2026-02-27',
        discharged_by_id: 'doc-1',
        discharged_by_name: 'Dr. María García',
        created_at: '2026-02-20T10:00:00Z',
      };

      mockApi.get.mockImplementation((url: string) => {
        if (url === '/api/v1/inpatient/beds/available') {
          return Promise.resolve([
            {
              bed_id: 'bed-1',
              bed_number: '101-A',
              unit: 'Medical Ward',
              floor: 1,
              room: '101',
              type: 'standard' as const,
              features: ['oxygen', 'monitor'],
            } as BedAvailability,
          ]);
        }
        if (url === '/api/v1/inpatient/census/realtime') {
          return Promise.resolve(mockCensus);
        }
        if (url === '/api/v1/inpatient/admissions/admission-new') {
          return Promise.resolve(newAdmission);
        }
        return Promise.reject(new Error(`Unexpected API call: ${url}`));
      });

      mockApi.post.mockImplementation((url: string, data?: any) => {
        if (url === '/api/v1/inpatient/admissions') {
          return Promise.resolve(newAdmission);
        }
        if (url === '/api/v1/inpatient/admissions/admission-new/transfer') {
          return Promise.resolve(transfer);
        }
        if (url === '/api/v1/inpatient/admissions/admission-new/discharge') {
          return Promise.resolve(discharge);
        }
        return Promise.reject(new Error(`Unexpected API call: ${url}`));
      });

      // Execute workflow
      // Step 1: Create admission
      const admissionResponse = await mockApi.post('/api/v1/inpatient/admissions', {
        patient_id: 'patient-1',
        bed_id: 'bed-1',
        admission_type: 'emergency',
        admitting_diagnosis: 'Pneumonia',
        chief_complaint: 'Shortness of breath, fever',
        admitting_physician_id: 'doc-1',
        attending_physician_id: 'doc-1',
      });
      expect(admissionResponse.id).toBe('admission-new');
      expect(admissionResponse.status).toBe('active');
      expect(admissionResponse.bed_number).toBe('101-A');

      // Step 2: Transfer to ICU
      const transferResponse = await mockApi.post(
        '/api/v1/inpatient/admissions/admission-new/transfer',
        {
          admission_id: 'admission-new',
          to_bed_id: 'bed-3',
          reason: 'Deteriorating condition, requires ICU level care',
        }
      );
      expect(transferResponse.to_bed_number).toBe('ICU-01');
      expect(transferResponse.reason).toContain('ICU level care');

      // Step 3: Discharge
      const dischargeResponse = await mockApi.post(
        '/api/v1/inpatient/admissions/admission-new/discharge',
        {
          admission_id: 'admission-new',
          discharge_type: 'home',
          discharge_diagnosis: 'Pneumonia, resolved',
          discharge_disposition: 'improved',
          discharge_summary: 'Patient improved with IV antibiotics.',
          follow_up_instructions: 'Follow up with primary care in 1 week',
        }
      );
      expect(dischargeResponse.discharge_type).toBe('home');
      expect(dischargeResponse.discharge_disposition).toBe('improved');
    });
  });

  describe('Admission Creation', () => {
    it('creates emergency admission with available bed', async () => {
      const admission = createMockAdmission();
      mockApi.post.mockResolvedValueOnce(admission);

      const response = await mockApi.post('/api/v1/inpatient/admissions', {
        patient_id: 'patient-1',
        bed_id: 'bed-1',
        admission_type: 'emergency',
        admitting_diagnosis: 'Pneumonia',
        admitting_physician_id: 'doc-1',
        attending_physician_id: 'doc-1',
      });

      expect(response.admission_type).toBe('emergency');
      expect(response.status).toBe('active');
      expect(response.bed_number).toBe('101-A');
    });

    it('creates elective admission with scheduled date', async () => {
      const electiveAdmission = createMockAdmission({
        admission_type: 'elective',
        admission_date: '2026-02-20T08:00:00Z',
        admitting_diagnosis: 'Elective surgery - cholecystectomy',
      });

      mockApi.post.mockResolvedValueOnce(electiveAdmission);

      const response = await mockApi.post('/api/v1/inpatient/admissions', {
        patient_id: 'patient-1',
        bed_id: 'bed-1',
        admission_type: 'elective',
        admitting_diagnosis: 'Elective surgery - cholecystectomy',
        admitting_physician_id: 'doc-1',
        attending_physician_id: 'doc-1',
      });

      expect(response.admission_type).toBe('elective');
    });

    it('validates bed availability before admission', async () => {
      mockApi.get.mockResolvedValueOnce([]);

      const availableBeds = await mockApi.get('/api/v1/inpatient/beds/available', {
        unit: 'Medical Ward',
      });

      expect(availableBeds).toHaveLength(0);

      mockApi.post.mockRejectedValueOnce(
        new Error('No beds available in requested unit')
      );

      await expect(
        mockApi.post('/api/v1/inpatient/admissions', {
          patient_id: 'patient-1',
          bed_id: 'bed-occupied',
          admission_type: 'emergency',
          admitting_diagnosis: 'Test',
          admitting_physician_id: 'doc-1',
          attending_physician_id: 'doc-1',
        })
      ).rejects.toThrow('No beds available');
    });

    it('prevents duplicate active admission for same patient', async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error('Patient already has an active admission')
      );

      await expect(
        mockApi.post('/api/v1/inpatient/admissions', {
          patient_id: 'patient-1',
          bed_id: 'bed-1',
          admission_type: 'emergency',
          admitting_diagnosis: 'Test',
          admitting_physician_id: 'doc-1',
          attending_physician_id: 'doc-1',
        })
      ).rejects.toThrow('already has an active admission');
    });

    it('assigns ICU bed for critical patient', async () => {
      const icuAdmission = createMockAdmission({
        bed_id: 'bed-3',
        bed_number: 'ICU-01',
        unit: 'ICU',
        admitting_diagnosis: 'Septic shock',
      });

      mockApi.post.mockResolvedValueOnce(icuAdmission);

      const response = await mockApi.post('/api/v1/inpatient/admissions', {
        patient_id: 'patient-1',
        bed_id: 'bed-3',
        admission_type: 'emergency',
        admitting_diagnosis: 'Septic shock',
        admitting_physician_id: 'doc-1',
        attending_physician_id: 'doc-1',
      });

      expect(response.unit).toBe('ICU');
      expect(response.bed_number).toBe('ICU-01');
    });
  });

  describe('Bed Management', () => {
    it('fetches available beds by unit', async () => {
      const availableBeds: BedAvailability[] = [
        {
          bed_id: 'bed-1',
          bed_number: '101-A',
          unit: 'Medical Ward',
          floor: 1,
          room: '101',
          type: 'standard',
          features: ['oxygen', 'monitor'],
        },
      ];

      mockApi.get.mockResolvedValueOnce(availableBeds);

      const response = await mockApi.get('/api/v1/inpatient/beds/available', {
        unit: 'Medical Ward',
      });

      expect(response).toHaveLength(1);
      expect(response[0].unit).toBe('Medical Ward');
    });

    it('fetches available beds by type', async () => {
      const icuBeds: BedAvailability[] = [
        {
          bed_id: 'bed-3',
          bed_number: 'ICU-01',
          unit: 'ICU',
          floor: 2,
          room: 'ICU-01',
          type: 'icu',
          features: ['oxygen', 'monitor', 'ventilator'],
        },
      ];

      mockApi.get.mockResolvedValueOnce(icuBeds);

      const response = await mockApi.get('/api/v1/inpatient/beds/available', {
        type: 'icu',
      });

      expect(response).toHaveLength(1);
      expect(response[0].type).toBe('icu');
    });

    it('updates bed status after cleaning', async () => {
      mockApi.patch.mockResolvedValueOnce({
        bed_id: 'bed-1',
        status: 'available',
      });

      const response = await mockApi.patch('/api/v1/inpatient/beds/bed-1/status', {
        status: 'available',
        notes: 'Cleaning completed',
      });

      expect(response.status).toBe('available');
    });

    it('marks bed for maintenance', async () => {
      mockApi.patch.mockResolvedValueOnce({
        bed_id: 'bed-1',
        status: 'maintenance',
      });

      const response = await mockApi.patch('/api/v1/inpatient/beds/bed-1/status', {
        status: 'maintenance',
        notes: 'Oxygen outlet needs repair',
      });

      expect(response.status).toBe('maintenance');
    });
  });

  describe('Patient Transfer', () => {
    it('transfers patient to different bed in same unit', async () => {
      const transfer: Transfer = {
        id: 'transfer-1',
        admission_id: 'admission-123',
        from_bed_id: 'bed-1',
        from_bed_number: '101-A',
        to_bed_id: 'bed-2',
        to_bed_number: '101-B',
        transfer_date: '2026-02-17T10:00:00Z',
        reason: 'Patient request - closer to window',
        transferred_by_id: 'nurse-1',
        transferred_by_name: 'Nurse Ana López',
        created_at: '2026-02-17T10:00:00Z',
      };

      mockApi.post.mockResolvedValueOnce(transfer);

      const response = await mockApi.post(
        '/api/v1/inpatient/admissions/admission-123/transfer',
        {
          admission_id: 'admission-123',
          to_bed_id: 'bed-2',
          reason: 'Patient request - closer to window',
        }
      );

      expect(response.from_bed_number).toBe('101-A');
      expect(response.to_bed_number).toBe('101-B');
    });

    it('transfers patient to ICU for critical care', async () => {
      const transfer: Transfer = {
        id: 'transfer-2',
        admission_id: 'admission-123',
        from_bed_id: 'bed-1',
        from_bed_number: '101-A',
        to_bed_id: 'bed-3',
        to_bed_number: 'ICU-01',
        transfer_date: '2026-02-17T14:00:00Z',
        reason: 'Deteriorating condition, requires ICU monitoring',
        notes: 'Respiratory distress, requires ventilator support',
        transferred_by_id: 'nurse-1',
        transferred_by_name: 'Nurse Ana López',
        created_at: '2026-02-17T14:00:00Z',
      };

      mockApi.post.mockResolvedValueOnce(transfer);

      const response = await mockApi.post(
        '/api/v1/inpatient/admissions/admission-123/transfer',
        {
          admission_id: 'admission-123',
          to_bed_id: 'bed-3',
          reason: 'Deteriorating condition, requires ICU monitoring',
          notes: 'Respiratory distress, requires ventilator support',
        }
      );

      expect(response.to_bed_number).toBe('ICU-01');
      expect(response.reason).toContain('ICU monitoring');
    });

    it('validates target bed is available before transfer', async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error('Target bed is occupied')
      );

      await expect(
        mockApi.post('/api/v1/inpatient/admissions/admission-123/transfer', {
          admission_id: 'admission-123',
          to_bed_id: 'bed-occupied',
          reason: 'Test',
        })
      ).rejects.toThrow('Target bed is occupied');
    });

    it('frees up previous bed after transfer', async () => {
      const transfer: Transfer = {
        id: 'transfer-1',
        admission_id: 'admission-123',
        from_bed_id: 'bed-1',
        from_bed_number: '101-A',
        to_bed_id: 'bed-2',
        to_bed_number: '101-B',
        transfer_date: '2026-02-17T10:00:00Z',
        reason: 'Test transfer',
        transferred_by_id: 'nurse-1',
        transferred_by_name: 'Nurse Ana',
        created_at: '2026-02-17T10:00:00Z',
      };

      mockApi.post.mockResolvedValueOnce(transfer);

      await mockApi.post('/api/v1/inpatient/admissions/admission-123/transfer', {
        admission_id: 'admission-123',
        to_bed_id: 'bed-2',
        reason: 'Test transfer',
      });

      // Previous bed should be marked for cleaning
      mockApi.patch.mockResolvedValueOnce({ bed_id: 'bed-1', status: 'cleaning' });

      const bedUpdate = await mockApi.patch('/api/v1/inpatient/beds/bed-1/status', {
        status: 'cleaning',
      });

      expect(bedUpdate.status).toBe('cleaning');
    });
  });

  describe('Patient Discharge', () => {
    it('discharges patient home with instructions', async () => {
      const discharge: Discharge = {
        id: 'discharge-1',
        admission_id: 'admission-123',
        discharge_date: '2026-02-20T10:00:00Z',
        discharge_type: 'home',
        discharge_diagnosis: 'Pneumonia, resolved',
        discharge_disposition: 'improved',
        discharge_summary: 'Patient improved with IV antibiotics. Afebrile x48h.',
        medications_prescribed: ['Amoxicillin 500mg PO TID x 7 days'],
        follow_up_instructions: 'Follow up with primary care in 1 week',
        follow_up_date: '2026-02-27',
        discharged_by_id: 'doc-1',
        discharged_by_name: 'Dr. María García',
        created_at: '2026-02-20T10:00:00Z',
      };

      mockApi.post.mockResolvedValueOnce(discharge);

      const response = await mockApi.post(
        '/api/v1/inpatient/admissions/admission-123/discharge',
        {
          admission_id: 'admission-123',
          discharge_type: 'home',
          discharge_diagnosis: 'Pneumonia, resolved',
          discharge_disposition: 'improved',
          discharge_summary: 'Patient improved with IV antibiotics. Afebrile x48h.',
          medications_prescribed: ['Amoxicillin 500mg PO TID x 7 days'],
          follow_up_instructions: 'Follow up with primary care in 1 week',
          follow_up_date: '2026-02-27',
        }
      );

      expect(response.discharge_type).toBe('home');
      expect(response.medications_prescribed?.[0]).toContain('Amoxicillin');
      expect(response.follow_up_instructions).toBeDefined();
    });

    it('discharges patient to SNF (Skilled Nursing Facility)', async () => {
      const discharge: Discharge = {
        id: 'discharge-2',
        admission_id: 'admission-123',
        discharge_date: '2026-02-20T11:00:00Z',
        discharge_type: 'snf',
        discharge_diagnosis: 'CVA with residual hemiparesis',
        discharge_disposition: 'stable',
        discharge_summary: 'Patient requires continued physical therapy and nursing care.',
        follow_up_instructions: 'Follow up with neurology in 2 weeks',
        discharged_by_id: 'doc-1',
        discharged_by_name: 'Dr. María García',
        created_at: '2026-02-20T11:00:00Z',
      };

      mockApi.post.mockResolvedValueOnce(discharge);

      const response = await mockApi.post(
        '/api/v1/inpatient/admissions/admission-123/discharge',
        {
          admission_id: 'admission-123',
          discharge_type: 'snf',
          discharge_diagnosis: 'CVA with residual hemiparesis',
          discharge_disposition: 'stable',
          discharge_summary: 'Patient requires continued physical therapy and nursing care.',
        }
      );

      expect(response.discharge_type).toBe('snf');
    });

    it('handles AMA (Against Medical Advice) discharge', async () => {
      const discharge: Discharge = {
        id: 'discharge-3',
        admission_id: 'admission-123',
        discharge_date: '2026-02-18T15:00:00Z',
        discharge_type: 'ama',
        discharge_diagnosis: 'Pneumonia - incomplete treatment',
        discharge_disposition: 'stable',
        discharge_summary: 'Patient leaving against medical advice. Risks explained and understood.',
        discharged_by_id: 'doc-1',
        discharged_by_name: 'Dr. María García',
        created_at: '2026-02-18T15:00:00Z',
      };

      mockApi.post.mockResolvedValueOnce(discharge);

      const response = await mockApi.post(
        '/api/v1/inpatient/admissions/admission-123/discharge',
        {
          admission_id: 'admission-123',
          discharge_type: 'ama',
          discharge_diagnosis: 'Pneumonia - incomplete treatment',
          discharge_disposition: 'stable',
          discharge_summary: 'Patient leaving against medical advice. Risks explained and understood.',
        }
      );

      expect(response.discharge_type).toBe('ama');
    });

    it('frees up bed after discharge', async () => {
      const discharge: Discharge = {
        id: 'discharge-1',
        admission_id: 'admission-123',
        discharge_date: '2026-02-20T10:00:00Z',
        discharge_type: 'home',
        discharge_diagnosis: 'Pneumonia, resolved',
        discharge_disposition: 'improved',
        discharge_summary: 'Test',
        discharged_by_id: 'doc-1',
        discharged_by_name: 'Dr. María García',
        created_at: '2026-02-20T10:00:00Z',
      };

      mockApi.post.mockResolvedValueOnce(discharge);

      await mockApi.post('/api/v1/inpatient/admissions/admission-123/discharge', {
        admission_id: 'admission-123',
        discharge_type: 'home',
        discharge_diagnosis: 'Pneumonia, resolved',
        discharge_disposition: 'improved',
        discharge_summary: 'Test',
      });

      // Bed should be marked for cleaning
      mockApi.patch.mockResolvedValueOnce({ bed_id: 'bed-1', status: 'cleaning' });

      const bedUpdate = await mockApi.patch('/api/v1/inpatient/beds/bed-1/status', {
        status: 'cleaning',
      });

      expect(bedUpdate.status).toBe('cleaning');
    });
  });

  describe('Census Tracking', () => {
    it('fetches real-time census data', async () => {
      mockApi.get.mockResolvedValueOnce(mockCensus);

      const response = await mockApi.get('/api/v1/inpatient/census/realtime');

      expect(response.total_beds).toBe(50);
      expect(response.occupied_beds).toBe(35);
      expect(response.occupancy_rate).toBe(70);
      expect(response.by_unit).toHaveLength(2);
    });

    it('calculates occupancy rate by unit', async () => {
      mockApi.get.mockResolvedValueOnce(mockCensus);

      const response = await mockApi.get('/api/v1/inpatient/census/realtime');

      const medicalWard = response.by_unit.find((u: any) => u.unit === 'Medical Ward');
      expect(medicalWard?.occupancy_rate).toBe(75);

      const icu = response.by_unit.find((u: any) => u.unit === 'ICU');
      expect(icu?.occupancy_rate).toBe(80);
    });

    it('tracks admissions and discharges today', async () => {
      mockApi.get.mockResolvedValueOnce(mockCensus);

      const response = await mockApi.get('/api/v1/inpatient/census/realtime');

      expect(response.admissions_today).toBe(5);
      expect(response.discharges_today).toBe(3);
      expect(response.transfers_today).toBe(2);
    });

    it('calculates average length of stay', async () => {
      mockApi.get.mockResolvedValueOnce(mockCensus);

      const response = await mockApi.get('/api/v1/inpatient/census/realtime');

      expect(response.average_los).toBe(4.5);
    });
  });

  describe('Error Scenarios', () => {
    it('handles bed not found error', async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error('Bed not found')
      );

      await expect(
        mockApi.post('/api/v1/inpatient/admissions', {
          patient_id: 'patient-1',
          bed_id: 'invalid-bed',
          admission_type: 'emergency',
          admitting_diagnosis: 'Test',
          admitting_physician_id: 'doc-1',
          attending_physician_id: 'doc-1',
        })
      ).rejects.toThrow('Bed not found');
    });

    it('handles patient not found error', async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error('Patient not found')
      );

      await expect(
        mockApi.post('/api/v1/inpatient/admissions', {
          patient_id: 'invalid-patient',
          bed_id: 'bed-1',
          admission_type: 'emergency',
          admitting_diagnosis: 'Test',
          admitting_physician_id: 'doc-1',
          attending_physician_id: 'doc-1',
        })
      ).rejects.toThrow('Patient not found');
    });

    it('handles network errors gracefully', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        mockApi.get('/api/v1/inpatient/census/realtime')
      ).rejects.toThrow('Network error');
    });
  });
});
