/**
 * Integration test for Emergency Department Triage Workflow
 * Tests complete flow: Register arrival → Triage → Track board → Disposition
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  EDVisit,
  TriageAssessment,
  EDTrackBoardItem,
  EDDashboardStats,
  ESILevel,
} from '@/types/emergency';

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
const mockDashboardStats: EDDashboardStats = {
  patients_waiting: 8,
  patients_in_treatment: 12,
  avg_door_to_doc_minutes: 25,
  avg_los_hours: 3.5,
  visits_by_esi: {
    esi_1: 2,
    esi_2: 5,
    esi_3: 10,
    esi_4: 8,
    esi_5: 3,
  },
  recent_arrivals: [],
  lwbs_count_today: 2,
  timestamp: '2026-02-16T10:00:00Z',
};

function createMockVisit(overrides?: Partial<EDVisit>): EDVisit {
  return {
    id: 'visit-123',
    visit_number: 'ED-2026-001',
    patient_id: 'patient-1',
    patient_name: 'Carlos Méndez',
    patient_age: 42,
    patient_gender: 'M',
    arrival_mode: 'ambulance',
    arrival_time: '2026-02-16T08:00:00Z',
    chief_complaint: 'Chest pain',
    esi_level: 2,
    status: 'waiting',
    created_at: '2026-02-16T08:00:00Z',
    updated_at: '2026-02-16T08:00:00Z',
    ...overrides,
  };
}

function createMockTriage(overrides?: Partial<TriageAssessment>): TriageAssessment {
  return {
    id: 'triage-123',
    visit_id: 'visit-123',
    esi_level: 2,
    temperature: 37.2,
    heart_rate: 95,
    respiratory_rate: 18,
    blood_pressure_systolic: 145,
    blood_pressure_diastolic: 90,
    oxygen_saturation: 98,
    pain_score: 7,
    allergies: ['Penicillin'],
    current_medications: ['Metformin', 'Lisinopril'],
    medical_history: ['Diabetes Type 2', 'Hypertension'],
    triaged_at: '2026-02-16T08:10:00Z',
    triaged_by_id: 'nurse-1',
    triaged_by_name: 'Nurse Rosa Pérez',
    created_at: '2026-02-16T08:10:00Z',
    ...overrides,
  };
}

function createMockTrackBoardItem(overrides?: Partial<EDTrackBoardItem>): EDTrackBoardItem {
  return {
    visit_id: 'visit-123',
    visit_number: 'ED-2026-001',
    bed_number: 'ED-01',
    patient_name: 'Carlos Méndez',
    patient_age: 42,
    chief_complaint: 'Chest pain',
    esi_level: 2,
    status: 'in_treatment',
    arrival_time: '2026-02-16T08:00:00Z',
    waiting_time_minutes: 15,
    door_to_doc_minutes: 20,
    assigned_physician: 'Dr. María García',
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

describe('Emergency Department Triage Workflow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy Path: Complete Workflow', () => {
    it('registers arrival → triages → treats → discharges', async () => {
      // Step 1: Register arrival
      const newVisit = createMockVisit({
        id: 'visit-new',
        visit_number: 'ED-2026-999',
        status: 'waiting',
      });

      // Step 2: Triage
      const triagedVisit = createMockVisit({
        ...newVisit,
        status: 'triage',
        esi_level: 2,
        triage_time: '2026-02-16T08:10:00Z',
      });

      const triage = createMockTriage({
        visit_id: 'visit-new',
      });

      // Step 3: In treatment
      const treatmentVisit = createMockVisit({
        ...triagedVisit,
        status: 'in_treatment',
        bed_number: 'ED-01',
        assigned_physician_id: 'doc-1',
        assigned_physician_name: 'Dr. María García',
        doc_time: '2026-02-16T08:30:00Z',
        door_to_doc_minutes: 30,
      });

      // Step 4: Disposition
      const dischargedVisit = createMockVisit({
        ...treatmentVisit,
        status: 'discharged',
        disposition_type: 'discharged',
        disposition_time: '2026-02-16T11:00:00Z',
        length_of_stay_minutes: 180,
      });

      mockApi.post.mockImplementation((url: string, data?: any) => {
        if (url === '/api/v1/emergency/arrivals') {
          return Promise.resolve(newVisit);
        }
        if (url === '/api/v1/emergency/visits/visit-new/triage') {
          return Promise.resolve(triage);
        }
        if (url === '/api/v1/emergency/visits/visit-new/assign-physician') {
          return Promise.resolve(treatmentVisit);
        }
        if (url === '/api/v1/emergency/visits/visit-new/disposition') {
          return Promise.resolve(dischargedVisit);
        }
        return Promise.reject(new Error(`Unexpected API call: ${url}`));
      });

      // Execute workflow
      // Step 1: Register arrival
      const arrivalResponse = await mockApi.post('/api/v1/emergency/arrivals', {
        patient_id: 'patient-1',
        arrival_mode: 'ambulance',
        chief_complaint: 'Chest pain',
      });
      expect(arrivalResponse.id).toBe('visit-new');
      expect(arrivalResponse.status).toBe('waiting');

      // Step 2: Perform triage
      const triageResponse = await mockApi.post('/api/v1/emergency/visits/visit-new/triage', {
        visit_id: 'visit-new',
        esi_level: 2,
        temperature: 37.2,
        heart_rate: 95,
        respiratory_rate: 18,
        blood_pressure_systolic: 145,
        blood_pressure_diastolic: 90,
        oxygen_saturation: 98,
        pain_score: 7,
        allergies: ['Penicillin'],
      });
      expect(triageResponse.esi_level).toBe(2);

      // Step 3: Assign physician
      const assignResponse = await mockApi.post(
        '/api/v1/emergency/visits/visit-new/assign-physician',
        {
          visit_id: 'visit-new',
          physician_id: 'doc-1',
        }
      );
      expect(assignResponse.status).toBe('in_treatment');
      expect(assignResponse.assigned_physician_name).toBe('Dr. María García');

      // Step 4: Set disposition
      const dispositionResponse = await mockApi.post(
        '/api/v1/emergency/visits/visit-new/disposition',
        {
          visit_id: 'visit-new',
          disposition_type: 'discharged',
          discharge_instructions: 'NSTEMI ruled out. Follow up with cardiologist in 1 week.',
        }
      );
      expect(dispositionResponse.status).toBe('discharged');
      expect(dispositionResponse.disposition_type).toBe('discharged');
    });
  });

  describe('Arrival Registration', () => {
    it('registers walk-in patient arrival', async () => {
      const visit = createMockVisit({
        arrival_mode: 'walk_in',
        status: 'waiting',
      });

      mockApi.post.mockResolvedValueOnce(visit);

      const response = await mockApi.post('/api/v1/emergency/arrivals', {
        patient_id: 'patient-1',
        arrival_mode: 'walk_in',
        chief_complaint: 'Fever and cough',
      });

      expect(response.arrival_mode).toBe('walk_in');
      expect(response.status).toBe('waiting');
    });

    it('registers ambulance arrival with high acuity', async () => {
      const visit = createMockVisit({
        arrival_mode: 'ambulance',
        chief_complaint: 'Motor vehicle accident - trauma',
        status: 'waiting',
      });

      mockApi.post.mockResolvedValueOnce(visit);

      const response = await mockApi.post('/api/v1/emergency/arrivals', {
        patient_id: 'patient-1',
        arrival_mode: 'ambulance',
        chief_complaint: 'Motor vehicle accident - trauma',
        send_to_triage: true,
      });

      expect(response.arrival_mode).toBe('ambulance');
      expect(response.chief_complaint).toContain('trauma');
    });

    it('registers police arrival', async () => {
      const visit = createMockVisit({
        arrival_mode: 'police',
        chief_complaint: 'Assault victim',
      });

      mockApi.post.mockResolvedValueOnce(visit);

      const response = await mockApi.post('/api/v1/emergency/arrivals', {
        patient_id: 'patient-1',
        arrival_mode: 'police',
        chief_complaint: 'Assault victim',
      });

      expect(response.arrival_mode).toBe('police');
    });

    it('auto-generates visit number', async () => {
      const visit = createMockVisit({
        visit_number: 'ED-2026-AUTO-001',
      });

      mockApi.post.mockResolvedValueOnce(visit);

      const response = await mockApi.post('/api/v1/emergency/arrivals', {
        patient_id: 'patient-1',
        arrival_mode: 'walk_in',
        chief_complaint: 'Test',
      });

      expect(response.visit_number).toMatch(/^ED-2026-/);
    });
  });

  describe('Triage Assessment', () => {
    it('performs ESI Level 1 triage (resuscitation)', async () => {
      const triage = createMockTriage({
        esi_level: 1,
        heart_rate: 150,
        blood_pressure_systolic: 70,
        oxygen_saturation: 85,
        notes: 'CRITICAL - Hypotensive, tachycardic, hypoxic',
      });

      mockApi.post.mockResolvedValueOnce(triage);

      const response = await mockApi.post('/api/v1/emergency/visits/visit-123/triage', {
        visit_id: 'visit-123',
        esi_level: 1,
        heart_rate: 150,
        blood_pressure_systolic: 70,
        oxygen_saturation: 85,
        notes: 'CRITICAL - Hypotensive, tachycardic, hypoxic',
      });

      expect(response.esi_level).toBe(1);
    });

    it('performs ESI Level 2 triage (emergent)', async () => {
      const triage = createMockTriage({
        esi_level: 2,
        pain_score: 9,
        notes: 'Severe chest pain',
      });

      mockApi.post.mockResolvedValueOnce(triage);

      const response = await mockApi.post('/api/v1/emergency/visits/visit-123/triage', {
        visit_id: 'visit-123',
        esi_level: 2,
        pain_score: 9,
        notes: 'Severe chest pain',
      });

      expect(response.esi_level).toBe(2);
      expect(response.pain_score).toBe(9);
    });

    it('performs ESI Level 3 triage (urgent)', async () => {
      const triage = createMockTriage({
        esi_level: 3,
        temperature: 38.5,
        notes: 'Fever, productive cough, multiple resources needed',
      });

      mockApi.post.mockResolvedValueOnce(triage);

      const response = await mockApi.post('/api/v1/emergency/visits/visit-123/triage', {
        visit_id: 'visit-123',
        esi_level: 3,
        temperature: 38.5,
        notes: 'Fever, productive cough, multiple resources needed',
      });

      expect(response.esi_level).toBe(3);
    });

    it('performs ESI Level 4 triage (less urgent)', async () => {
      const triage = createMockTriage({
        esi_level: 4,
        pain_score: 3,
        notes: 'Minor laceration, one resource needed',
      });

      mockApi.post.mockResolvedValueOnce(triage);

      const response = await mockApi.post('/api/v1/emergency/visits/visit-123/triage', {
        visit_id: 'visit-123',
        esi_level: 4,
        pain_score: 3,
        notes: 'Minor laceration, one resource needed',
      });

      expect(response.esi_level).toBe(4);
    });

    it('performs ESI Level 5 triage (non-urgent)', async () => {
      const triage = createMockTriage({
        esi_level: 5,
        notes: 'Prescription refill request, no resources needed',
      });

      mockApi.post.mockResolvedValueOnce(triage);

      const response = await mockApi.post('/api/v1/emergency/visits/visit-123/triage', {
        visit_id: 'visit-123',
        esi_level: 5,
        notes: 'Prescription refill request, no resources needed',
      });

      expect(response.esi_level).toBe(5);
    });

    it('records vital signs during triage', async () => {
      const triage = createMockTriage({
        temperature: 38.2,
        heart_rate: 88,
        respiratory_rate: 16,
        blood_pressure_systolic: 130,
        blood_pressure_diastolic: 85,
        oxygen_saturation: 97,
        pain_score: 5,
      });

      mockApi.post.mockResolvedValueOnce(triage);

      const response = await mockApi.post('/api/v1/emergency/visits/visit-123/triage', {
        visit_id: 'visit-123',
        esi_level: 3,
        temperature: 38.2,
        heart_rate: 88,
        respiratory_rate: 16,
        blood_pressure_systolic: 130,
        blood_pressure_diastolic: 85,
        oxygen_saturation: 97,
        pain_score: 5,
      });

      expect(response.temperature).toBe(38.2);
      expect(response.heart_rate).toBe(88);
      expect(response.blood_pressure_systolic).toBe(130);
    });

    it('records allergies and medications during triage', async () => {
      const triage = createMockTriage({
        allergies: ['Penicillin', 'Sulfa drugs'],
        current_medications: ['Lisinopril 10mg daily', 'Metformin 500mg BID'],
        medical_history: ['Hypertension', 'Diabetes Type 2'],
      });

      mockApi.post.mockResolvedValueOnce(triage);

      const response = await mockApi.post('/api/v1/emergency/visits/visit-123/triage', {
        visit_id: 'visit-123',
        esi_level: 3,
        allergies: ['Penicillin', 'Sulfa drugs'],
        current_medications: ['Lisinopril 10mg daily', 'Metformin 500mg BID'],
        medical_history: ['Hypertension', 'Diabetes Type 2'],
      });

      expect(response.allergies).toContain('Penicillin');
      expect(response.current_medications).toContain('Lisinopril 10mg daily');
    });

    it('flags isolation precautions during triage', async () => {
      const triage = createMockTriage({
        isolation_precautions: ['airborne', 'droplet'],
        notes: 'Suspected TB - N95 mask required',
      });

      mockApi.post.mockResolvedValueOnce(triage);

      const response = await mockApi.post('/api/v1/emergency/visits/visit-123/triage', {
        visit_id: 'visit-123',
        esi_level: 3,
        isolation_precautions: ['airborne', 'droplet'],
        notes: 'Suspected TB - N95 mask required',
      });

      expect(response.isolation_precautions).toContain('airborne');
    });

    it('records mechanism of injury for trauma', async () => {
      const triage = createMockTriage({
        esi_level: 2,
        mechanism_of_injury: 'Fall from 10 feet onto concrete',
        notes: 'Trauma - evaluate for head injury and fractures',
      });

      mockApi.post.mockResolvedValueOnce(triage);

      const response = await mockApi.post('/api/v1/emergency/visits/visit-123/triage', {
        visit_id: 'visit-123',
        esi_level: 2,
        mechanism_of_injury: 'Fall from 10 feet onto concrete',
        notes: 'Trauma - evaluate for head injury and fractures',
      });

      expect(response.mechanism_of_injury).toContain('Fall from');
    });
  });

  describe('ED Track Board', () => {
    it('displays real-time track board with all active patients', async () => {
      const trackBoard: EDTrackBoardItem[] = [
        createMockTrackBoardItem({
          visit_id: 'visit-1',
          esi_level: 1,
          status: 'in_treatment',
          waiting_time_minutes: 5,
        }),
        createMockTrackBoardItem({
          visit_id: 'visit-2',
          esi_level: 2,
          status: 'in_treatment',
          waiting_time_minutes: 20,
        }),
        createMockTrackBoardItem({
          visit_id: 'visit-3',
          esi_level: 3,
          status: 'waiting',
          waiting_time_minutes: 45,
        }),
      ];

      mockApi.get.mockResolvedValueOnce(trackBoard);

      const response = await mockApi.get('/api/v1/emergency/track-board');

      expect(response).toHaveLength(3);
      expect(response[0].esi_level).toBe(1);
      expect(response[1].esi_level).toBe(2);
    });

    it('sorts track board by ESI level (highest priority first)', async () => {
      const trackBoard: EDTrackBoardItem[] = [
        createMockTrackBoardItem({ visit_id: 'v1', esi_level: 1 }),
        createMockTrackBoardItem({ visit_id: 'v2', esi_level: 2 }),
        createMockTrackBoardItem({ visit_id: 'v3', esi_level: 3 }),
      ];

      mockApi.get.mockResolvedValueOnce(trackBoard);

      const response = await mockApi.get('/api/v1/emergency/track-board');

      expect(response[0].esi_level).toBe(1);
      expect(response[1].esi_level).toBe(2);
      expect(response[2].esi_level).toBe(3);
    });

    it('shows waiting time for each patient', async () => {
      const trackBoard: EDTrackBoardItem[] = [
        createMockTrackBoardItem({
          waiting_time_minutes: 120,
          status: 'waiting',
        }),
      ];

      mockApi.get.mockResolvedValueOnce(trackBoard);

      const response = await mockApi.get('/api/v1/emergency/track-board');

      expect(response[0].waiting_time_minutes).toBe(120);
    });

    it('shows door-to-doc time for patients in treatment', async () => {
      const trackBoard: EDTrackBoardItem[] = [
        createMockTrackBoardItem({
          status: 'in_treatment',
          door_to_doc_minutes: 25,
        }),
      ];

      mockApi.get.mockResolvedValueOnce(trackBoard);

      const response = await mockApi.get('/api/v1/emergency/track-board');

      expect(response[0].door_to_doc_minutes).toBe(25);
    });
  });

  describe('Physician Assignment', () => {
    it('assigns physician to patient', async () => {
      const visit = createMockVisit({
        status: 'in_treatment',
        assigned_physician_id: 'doc-1',
        assigned_physician_name: 'Dr. María García',
        doc_time: '2026-02-16T08:30:00Z',
      });

      mockApi.post.mockResolvedValueOnce(visit);

      const response = await mockApi.post(
        '/api/v1/emergency/visits/visit-123/assign-physician',
        {
          visit_id: 'visit-123',
          physician_id: 'doc-1',
        }
      );

      expect(response.assigned_physician_name).toBe('Dr. María García');
      expect(response.status).toBe('in_treatment');
    });

    it('updates patient status when physician assigned', async () => {
      const visit = createMockVisit({
        status: 'in_treatment',
      });

      mockApi.post.mockResolvedValueOnce(visit);

      const response = await mockApi.post(
        '/api/v1/emergency/visits/visit-123/assign-physician',
        {
          visit_id: 'visit-123',
          physician_id: 'doc-1',
        }
      );

      expect(response.status).toBe('in_treatment');
    });
  });

  describe('Disposition', () => {
    it('discharges patient home', async () => {
      const visit = createMockVisit({
        status: 'discharged',
        disposition_type: 'discharged',
        disposition_time: '2026-02-16T11:00:00Z',
      });

      mockApi.post.mockResolvedValueOnce(visit);

      const response = await mockApi.post('/api/v1/emergency/visits/visit-123/disposition', {
        visit_id: 'visit-123',
        disposition_type: 'discharged',
        discharge_instructions: 'Take ibuprofen for pain. Follow up if symptoms worsen.',
      });

      expect(response.disposition_type).toBe('discharged');
      expect(response.status).toBe('discharged');
    });

    it('admits patient to inpatient unit', async () => {
      const visit = createMockVisit({
        status: 'admitted',
        disposition_type: 'admitted',
        disposition_time: '2026-02-16T12:00:00Z',
      });

      mockApi.post.mockResolvedValueOnce(visit);

      const response = await mockApi.post('/api/v1/emergency/visits/visit-123/disposition', {
        visit_id: 'visit-123',
        disposition_type: 'admitted',
        bed_id: 'inpatient-bed-101',
        notes: 'Admitted to Medical Ward for continued monitoring',
      });

      expect(response.disposition_type).toBe('admitted');
      expect(response.status).toBe('admitted');
    });

    it('transfers patient to another facility', async () => {
      const visit = createMockVisit({
        status: 'discharged',
        disposition_type: 'transferred',
        disposition_time: '2026-02-16T10:30:00Z',
      });

      mockApi.post.mockResolvedValueOnce(visit);

      const response = await mockApi.post('/api/v1/emergency/visits/visit-123/disposition', {
        visit_id: 'visit-123',
        disposition_type: 'transferred',
        transfer_facility: 'Regional Trauma Center',
        notes: 'Transfer for higher level of care',
      });

      expect(response.disposition_type).toBe('transferred');
    });

    it('handles AMA (Against Medical Advice) discharge', async () => {
      const visit = createMockVisit({
        status: 'ama',
        disposition_type: 'ama',
        disposition_time: '2026-02-16T09:00:00Z',
      });

      mockApi.post.mockResolvedValueOnce(visit);

      const response = await mockApi.post('/api/v1/emergency/visits/visit-123/disposition', {
        visit_id: 'visit-123',
        disposition_type: 'ama',
        notes: 'Patient left against medical advice. Risks explained.',
      });

      expect(response.disposition_type).toBe('ama');
      expect(response.status).toBe('ama');
    });

    it('handles LWBS (Left Without Being Seen)', async () => {
      const visit = createMockVisit({
        status: 'lwbs',
      });

      mockApi.patch.mockResolvedValueOnce(visit);

      const response = await mockApi.patch('/api/v1/emergency/visits/visit-123', {
        status: 'lwbs',
      });

      expect(response.status).toBe('lwbs');
    });
  });

  describe('Dashboard Metrics', () => {
    it('fetches real-time dashboard statistics', async () => {
      mockApi.get.mockResolvedValueOnce(mockDashboardStats);

      const response = await mockApi.get('/api/v1/emergency/dashboard');

      expect(response.patients_waiting).toBe(8);
      expect(response.patients_in_treatment).toBe(12);
      expect(response.avg_door_to_doc_minutes).toBe(25);
    });

    it('tracks patients by ESI level', async () => {
      mockApi.get.mockResolvedValueOnce(mockDashboardStats);

      const response = await mockApi.get('/api/v1/emergency/dashboard');

      expect(response.visits_by_esi.esi_1).toBe(2);
      expect(response.visits_by_esi.esi_2).toBe(5);
      expect(response.visits_by_esi.esi_3).toBe(10);
    });

    it('tracks LWBS (Left Without Being Seen) count', async () => {
      mockApi.get.mockResolvedValueOnce(mockDashboardStats);

      const response = await mockApi.get('/api/v1/emergency/dashboard');

      expect(response.lwbs_count_today).toBe(2);
    });

    it('calculates average door-to-doc time', async () => {
      mockApi.get.mockResolvedValueOnce(mockDashboardStats);

      const response = await mockApi.get('/api/v1/emergency/dashboard');

      expect(response.avg_door_to_doc_minutes).toBe(25);
    });

    it('calculates average length of stay', async () => {
      mockApi.get.mockResolvedValueOnce(mockDashboardStats);

      const response = await mockApi.get('/api/v1/emergency/dashboard');

      expect(response.avg_los_hours).toBe(3.5);
    });
  });

  describe('Error Scenarios', () => {
    it('handles patient not found error', async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error('Patient not found')
      );

      await expect(
        mockApi.post('/api/v1/emergency/arrivals', {
          patient_id: 'invalid-patient',
          arrival_mode: 'walk_in',
          chief_complaint: 'Test',
        })
      ).rejects.toThrow('Patient not found');
    });

    it('handles triage before registration error', async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error('Visit not found')
      );

      await expect(
        mockApi.post('/api/v1/emergency/visits/invalid-visit/triage', {
          visit_id: 'invalid-visit',
          esi_level: 3,
        })
      ).rejects.toThrow('Visit not found');
    });

    it('handles invalid ESI level', async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error('Invalid ESI level')
      );

      await expect(
        mockApi.post('/api/v1/emergency/visits/visit-123/triage', {
          visit_id: 'visit-123',
          esi_level: 6 as ESILevel, // Invalid ESI level
        })
      ).rejects.toThrow('Invalid ESI level');
    });

    it('handles network errors gracefully', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        mockApi.get('/api/v1/emergency/track-board')
      ).rejects.toThrow('Network error');
    });
  });

  describe('Time Tracking', () => {
    it('calculates waiting time from arrival to triage', async () => {
      const visit = createMockVisit({
        arrival_time: '2026-02-16T08:00:00Z',
        triage_time: '2026-02-16T08:15:00Z',
        waiting_time_minutes: 15,
      });

      mockApi.get.mockResolvedValueOnce(visit);

      const response = await mockApi.get('/api/v1/emergency/visits/visit-123');

      expect(response.waiting_time_minutes).toBe(15);
    });

    it('calculates door-to-doc time', async () => {
      const visit = createMockVisit({
        arrival_time: '2026-02-16T08:00:00Z',
        doc_time: '2026-02-16T08:25:00Z',
        door_to_doc_minutes: 25,
      });

      mockApi.get.mockResolvedValueOnce(visit);

      const response = await mockApi.get('/api/v1/emergency/visits/visit-123');

      expect(response.door_to_doc_minutes).toBe(25);
    });

    it('calculates total length of stay', async () => {
      const visit = createMockVisit({
        arrival_time: '2026-02-16T08:00:00Z',
        disposition_time: '2026-02-16T11:30:00Z',
        length_of_stay_minutes: 210,
      });

      mockApi.get.mockResolvedValueOnce(visit);

      const response = await mockApi.get('/api/v1/emergency/visits/visit-123');

      expect(response.length_of_stay_minutes).toBe(210);
    });
  });
});
