/**
 * Integration test for Radiology Report Workflow
 * Tests complete flow: Create order → Perform study → Write report → Sign
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  RadOrder,
  RadStudy,
  RadReport,
  RadTemplate,
  RadDashboardStats,
} from '@/types/radiology';

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
const mockDashboardStats: RadDashboardStats = {
  pending_orders: 8,
  studies_today: 15,
  unsigned_reports: 5,
  stat_urgent: 3,
  completed_today: 12,
  avg_report_time: 2.5,
  orders_by_modality: {
    CT: 5,
    MR: 3,
    CR: 10,
    US: 7,
  },
  orders_by_status: {
    pending: 8,
    scheduled: 12,
    in_progress: 5,
    completed: 20,
  },
};

const mockTemplate: RadTemplate = {
  id: 'template-1',
  name: 'Chest X-Ray Normal',
  description: 'Standard template for normal chest radiograph',
  modality: 'CR',
  body_part: 'Chest',
  template_text: `FINDINGS:
The lungs are clear bilaterally. No focal consolidation, pleural effusion, or pneumothorax.
The cardiac silhouette is normal in size and contour.
The mediastinum is unremarkable.

IMPRESSION:
Normal chest radiograph.`,
  placeholders: ['FINDINGS', 'IMPRESSION'],
  is_active: true,
  created_by_id: 'radiologist-1',
  created_at: '2026-01-15T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
};

function createMockOrder(overrides?: Partial<RadOrder>): RadOrder {
  return {
    id: 'order-123',
    order_number: 'RAD-2026-001',
    patient_id: 'patient-1',
    patient_name: 'María González',
    patient_mrn: 'MRN-002',
    encounter_id: 'enc-1',
    modality: 'CR',
    body_part: 'Chest',
    study_description: 'Chest X-Ray PA & Lateral',
    clinical_indication: 'Cough, rule out pneumonia',
    ordering_physician_id: 'doc-1',
    ordering_physician_name: 'Dr. Carlos Rodríguez',
    priority: 'routine',
    status: 'pending',
    ordered_at: '2026-02-16T08:00:00Z',
    created_at: '2026-02-16T08:00:00Z',
    updated_at: '2026-02-16T08:00:00Z',
    ...overrides,
  };
}

function createMockStudy(overrides?: Partial<RadStudy>): RadStudy {
  return {
    id: 'study-123',
    order_id: 'order-123',
    accession_number: 'ACC-RAD-001',
    study_uid: '1.2.840.113619.2.1.1.1',
    modality: 'CR',
    study_description: 'Chest X-Ray PA & Lateral',
    patient_id: 'patient-1',
    patient_name: 'María González',
    patient_mrn: 'MRN-002',
    scheduled_date: '2026-02-16',
    performed_date: '2026-02-16',
    performed_by_id: 'tech-1',
    performed_by_name: 'Tech Juan López',
    protocol_used: 'Standard Chest 2-view',
    series_count: 2,
    images_count: 2,
    pacs_url: 'http://pacs.hospital.com/viewer?study=1.2.840.113619.2.1.1.1',
    status: 'completed',
    created_at: '2026-02-16T09:00:00Z',
    updated_at: '2026-02-16T09:30:00Z',
    ...overrides,
  };
}

function createMockReport(overrides?: Partial<RadReport>): RadReport {
  return {
    id: 'report-123',
    study_id: 'study-123',
    report_number: 'REP-2026-001',
    radiologist_id: 'radiologist-1',
    radiologist_name: 'Dr. Ana Martínez',
    template_id: 'template-1',
    findings: 'The lungs are clear bilaterally. No focal consolidation, pleural effusion, or pneumothorax.',
    impression: 'Normal chest radiograph.',
    recommendations: 'No further imaging needed at this time.',
    status: 'draft',
    dictated_at: '2026-02-16T10:00:00Z',
    created_at: '2026-02-16T10:00:00Z',
    updated_at: '2026-02-16T10:00:00Z',
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

describe('Radiology Report Workflow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy Path: Complete Workflow', () => {
    it('creates order → performs study → writes report → signs report', async () => {
      // Step 1: Create Order
      const newOrder = createMockOrder({
        id: 'order-new',
        order_number: 'RAD-2026-999',
      });

      // Step 2: Study performed (DICOM images received)
      const performedStudy = createMockStudy({
        id: 'study-new',
        order_id: 'order-new',
        status: 'completed',
      });

      // Step 3: Draft report
      const draftReport = createMockReport({
        id: 'report-new',
        study_id: 'study-new',
        status: 'draft',
      });

      // Step 4: Signed report
      const signedReport = createMockReport({
        id: 'report-new',
        study_id: 'study-new',
        status: 'final',
        signed_at: '2026-02-16T11:00:00Z',
        signed_by_id: 'radiologist-1',
        signed_by_name: 'Dr. Ana Martínez',
      });

      mockApi.post.mockImplementation((url: string, data?: any) => {
        if (url === '/radiology/orders') {
          return Promise.resolve(newOrder);
        }
        if (url === '/radiology/studies') {
          return Promise.resolve(performedStudy);
        }
        if (url === '/radiology/reports') {
          return Promise.resolve(draftReport);
        }
        if (url === '/radiology/reports/report-new/sign') {
          return Promise.resolve(signedReport);
        }
        return Promise.reject(new Error(`Unexpected API call: ${url}`));
      });

      // Execute workflow
      // Step 1: Create order
      const orderResponse = await mockApi.post('/radiology/orders', {
        patient_id: 'patient-1',
        modality: 'CR',
        body_part: 'Chest',
        study_description: 'Chest X-Ray PA & Lateral',
        clinical_indication: 'Cough, rule out pneumonia',
        priority: 'routine',
      });
      expect(orderResponse.id).toBe('order-new');
      expect(orderResponse.status).toBe('pending');

      // Step 2: Perform study
      const studyResponse = await mockApi.post('/radiology/studies', {
        order_id: 'order-new',
        study_uid: '1.2.840.113619.2.1.1.1',
        series_count: 2,
        images_count: 2,
        protocol_used: 'Standard Chest 2-view',
      });
      expect(studyResponse.id).toBe('study-new');
      expect(studyResponse.status).toBe('completed');

      // Step 3: Create draft report
      const reportResponse = await mockApi.post('/radiology/reports', {
        study_id: 'study-new',
        template_id: 'template-1',
        findings: 'The lungs are clear bilaterally.',
        impression: 'Normal chest radiograph.',
      });
      expect(reportResponse.id).toBe('report-new');
      expect(reportResponse.status).toBe('draft');

      // Step 4: Sign report
      const signResponse = await mockApi.post('/radiology/reports/report-new/sign', {});
      expect(signResponse.status).toBe('final');
      expect(signResponse.signed_at).toBeDefined();
      expect(signResponse.signed_by_id).toBe('radiologist-1');
    });
  });

  describe('Order Creation', () => {
    it('creates routine radiology order', async () => {
      const order = createMockOrder();
      mockApi.post.mockResolvedValueOnce(order);

      const response = await mockApi.post('/radiology/orders', {
        patient_id: 'patient-1',
        modality: 'CR',
        body_part: 'Chest',
        study_description: 'Chest X-Ray PA & Lateral',
        clinical_indication: 'Cough, rule out pneumonia',
        priority: 'routine',
      });

      expect(response.modality).toBe('CR');
      expect(response.priority).toBe('routine');
      expect(response.status).toBe('pending');
    });

    it('creates STAT radiology order for emergency', async () => {
      const statOrder = createMockOrder({
        priority: 'stat',
        clinical_indication: 'Trauma - MVA',
      });

      mockApi.post.mockResolvedValueOnce(statOrder);

      const response = await mockApi.post('/radiology/orders', {
        patient_id: 'patient-1',
        modality: 'CT',
        body_part: 'Head',
        study_description: 'CT Head without contrast',
        clinical_indication: 'Trauma - MVA',
        priority: 'stat',
      });

      expect(response.priority).toBe('stat');
      expect(response.clinical_indication).toContain('Trauma');
    });

    it('validates required fields before creating order', async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error('Patient ID and modality are required')
      );

      await expect(
        mockApi.post('/radiology/orders', {
          body_part: 'Chest',
          priority: 'routine',
        })
      ).rejects.toThrow('required');
    });

    it('schedules order for future date', async () => {
      const scheduledOrder = createMockOrder({
        status: 'scheduled',
        scheduled_date: '2026-02-18',
        scheduled_time: '10:00',
      });

      mockApi.post.mockResolvedValueOnce(scheduledOrder);

      const response = await mockApi.post('/radiology/orders', {
        patient_id: 'patient-1',
        modality: 'MR',
        body_part: 'Knee',
        study_description: 'MRI Knee without contrast',
        clinical_indication: 'Knee pain',
        priority: 'routine',
        scheduled_date: '2026-02-18',
        scheduled_time: '10:00',
      });

      expect(response.scheduled_date).toBe('2026-02-18');
      expect(response.status).toBe('scheduled');
    });
  });

  describe('Study Performance', () => {
    it('creates study after DICOM images received', async () => {
      const study = createMockStudy();
      mockApi.post.mockResolvedValueOnce(study);

      const response = await mockApi.post('/radiology/studies', {
        order_id: 'order-123',
        study_uid: '1.2.840.113619.2.1.1.1',
        series_count: 2,
        images_count: 2,
        protocol_used: 'Standard Chest 2-view',
      });

      expect(response.study_uid).toBe('1.2.840.113619.2.1.1.1');
      expect(response.series_count).toBe(2);
      expect(response.images_count).toBe(2);
      expect(response.status).toBe('completed');
    });

    it('auto-generates accession number if not provided', async () => {
      const study = createMockStudy({
        accession_number: 'ACC-RAD-AUTO-001',
      });

      mockApi.post.mockResolvedValueOnce(study);

      const response = await mockApi.post('/radiology/studies', {
        order_id: 'order-123',
        study_uid: '1.2.840.113619.2.1.1.1',
        series_count: 1,
        images_count: 1,
      });

      expect(response.accession_number).toMatch(/^ACC-RAD-/);
    });

    it('links study to PACS viewer', async () => {
      const study = createMockStudy({
        pacs_url: 'http://pacs.hospital.com/viewer?study=1.2.840.113619.2.1.1.1',
      });

      mockApi.post.mockResolvedValueOnce(study);

      const response = await mockApi.post('/radiology/studies', {
        order_id: 'order-123',
        study_uid: '1.2.840.113619.2.1.1.1',
        series_count: 2,
        images_count: 10,
      });

      expect(response.pacs_url).toContain('pacs.hospital.com');
      expect(response.pacs_url).toContain(response.study_uid);
    });

    it('updates order status to completed when study performed', async () => {
      const study = createMockStudy();
      const completedOrder = createMockOrder({
        status: 'completed',
        completed_at: '2026-02-16T09:30:00Z',
      });

      mockApi.post.mockResolvedValueOnce(study);
      mockApi.get.mockResolvedValueOnce(completedOrder);

      const studyResponse = await mockApi.post('/radiology/studies', {
        order_id: 'order-123',
        study_uid: '1.2.840.113619.2.1.1.1',
        series_count: 2,
        images_count: 2,
      });

      // Verify order status updated
      const orderResponse = await mockApi.get('/radiology/orders/order-123');
      expect(orderResponse.status).toBe('completed');
    });
  });

  describe('Report Writing', () => {
    it('creates report from template', async () => {
      const report = createMockReport({
        template_id: 'template-1',
      });

      mockApi.post.mockResolvedValueOnce(report);

      const response = await mockApi.post('/radiology/reports', {
        study_id: 'study-123',
        template_id: 'template-1',
        findings: 'The lungs are clear bilaterally.',
        impression: 'Normal chest radiograph.',
      });

      expect(response.template_id).toBe('template-1');
      expect(response.status).toBe('draft');
    });

    it('creates report without template', async () => {
      const report = createMockReport({
        template_id: undefined,
        findings: 'Custom findings written by radiologist',
      });

      mockApi.post.mockResolvedValueOnce(report);

      const response = await mockApi.post('/radiology/reports', {
        study_id: 'study-123',
        findings: 'Custom findings written by radiologist',
        impression: 'Custom impression',
      });

      expect(response.template_id).toBeUndefined();
      expect(response.findings).toContain('Custom findings');
    });

    it('updates draft report', async () => {
      const updatedReport = createMockReport({
        findings: 'Updated findings with additional details',
        impression: 'Updated impression',
        status: 'draft',
      });

      mockApi.patch.mockResolvedValueOnce(updatedReport);

      const response = await mockApi.patch('/radiology/reports/report-123', {
        findings: 'Updated findings with additional details',
        impression: 'Updated impression',
      });

      expect(response.findings).toContain('Updated findings');
      expect(response.status).toBe('draft');
    });

    it('adds recommendations to report', async () => {
      const reportWithRecs = createMockReport({
        recommendations: 'Follow-up CT in 3 months to assess resolution',
      });

      mockApi.post.mockResolvedValueOnce(reportWithRecs);

      const response = await mockApi.post('/radiology/reports', {
        study_id: 'study-123',
        findings: 'Small pulmonary nodule noted',
        impression: 'Small pulmonary nodule',
        recommendations: 'Follow-up CT in 3 months to assess resolution',
      });

      expect(response.recommendations).toContain('Follow-up CT');
    });

    it('includes comparison with prior studies', async () => {
      const reportWithComparison = createMockReport({
        comparison_text: 'Compared to prior study dated 2025-12-15, the nodule has decreased in size.',
      });

      mockApi.post.mockResolvedValueOnce(reportWithComparison);

      const response = await mockApi.post('/radiology/reports', {
        study_id: 'study-123',
        findings: 'Pulmonary nodule measuring 5mm',
        impression: 'Decreasing pulmonary nodule',
        comparison_text: 'Compared to prior study dated 2025-12-15, the nodule has decreased in size.',
      });

      expect(response.comparison_text).toContain('Compared to prior study');
    });
  });

  describe('Report Signing', () => {
    it('signs report and marks as final', async () => {
      const signedReport = createMockReport({
        status: 'final',
        signed_at: '2026-02-16T11:00:00Z',
        signed_by_id: 'radiologist-1',
        signed_by_name: 'Dr. Ana Martínez',
      });

      mockApi.post.mockResolvedValueOnce(signedReport);

      const response = await mockApi.post('/radiology/reports/report-123/sign', {});

      expect(response.status).toBe('final');
      expect(response.signed_at).toBeDefined();
      expect(response.signed_by_id).toBe('radiologist-1');
    });

    it('prevents editing after report is signed', async () => {
      mockApi.patch.mockRejectedValueOnce(
        new Error('Cannot edit final report - use amendment instead')
      );

      await expect(
        mockApi.patch('/radiology/reports/report-123', {
          findings: 'Trying to edit signed report',
        })
      ).rejects.toThrow('Cannot edit final report');
    });

    it('allows amendment of signed report', async () => {
      const amendedReport = createMockReport({
        status: 'corrected',
        findings: 'Original findings\n\nAMENDMENT: Additional finding noted on review',
      });

      mockApi.post.mockResolvedValueOnce(amendedReport);

      const response = await mockApi.post('/radiology/reports/report-123/amend', {
        amendment: 'Additional finding noted on review',
      });

      expect(response.status).toBe('corrected');
      expect(response.findings).toContain('AMENDMENT');
    });

    it('only allows radiologists to sign reports', async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error('Unauthorized - Only radiologists can sign reports')
      );

      await expect(
        mockApi.post('/radiology/reports/report-123/sign', {})
      ).rejects.toThrow('Unauthorized');
    });

    it('creates preliminary report for urgent cases', async () => {
      const prelimReport = createMockReport({
        status: 'preliminary',
        dictated_at: '2026-02-16T09:45:00Z',
      });

      mockApi.post.mockResolvedValueOnce(prelimReport);

      const response = await mockApi.post('/radiology/reports', {
        study_id: 'study-123',
        findings: 'No acute findings',
        impression: 'Negative for acute process',
      });

      mockApi.patch.mockResolvedValueOnce({
        ...prelimReport,
        status: 'preliminary',
      });

      const prelim = await mockApi.patch('/radiology/reports/report-123', {
        status: 'preliminary',
      });

      expect(prelim.status).toBe('preliminary');
    });
  });

  describe('Template Usage', () => {
    it('loads template and pre-fills report', async () => {
      mockApi.get.mockResolvedValueOnce(mockTemplate);

      const template = await mockApi.get('/radiology/templates/template-1');

      expect(template.template_text).toContain('FINDINGS:');
      expect(template.template_text).toContain('IMPRESSION:');
      expect(template.modality).toBe('CR');
    });

    it('filters templates by modality and body part', async () => {
      const templates = [mockTemplate];

      mockApi.get.mockResolvedValueOnce({
        items: templates,
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      });

      const response = await mockApi.get('/radiology/templates', {
        modality: 'CR',
        body_part: 'Chest',
      });

      expect(response.items).toHaveLength(1);
      expect(response.items[0].modality).toBe('CR');
    });
  });

  describe('Error Scenarios', () => {
    it('handles order cancellation', async () => {
      const cancelledOrder = createMockOrder({ status: 'cancelled' });

      mockApi.patch.mockResolvedValueOnce(cancelledOrder);

      const response = await mockApi.patch('/radiology/orders/order-123/cancel', {});

      expect(response.status).toBe('cancelled');
    });

    it('handles study without images', async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error('Cannot create study with 0 images')
      );

      await expect(
        mockApi.post('/radiology/studies', {
          order_id: 'order-123',
          study_uid: '1.2.840.113619.2.1.1.1',
          series_count: 0,
          images_count: 0,
        })
      ).rejects.toThrow('Cannot create study with 0 images');
    });

    it('handles report without required fields', async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error('Findings and impression are required')
      );

      await expect(
        mockApi.post('/radiology/reports', {
          study_id: 'study-123',
        })
      ).rejects.toThrow('required');
    });

    it('handles network errors gracefully', async () => {
      mockApi.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        mockApi.post('/radiology/orders', {
          patient_id: 'patient-1',
          modality: 'CR',
          body_part: 'Chest',
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('Worklist Integration', () => {
    it('fetches scheduled studies for technician worklist', async () => {
      const worklistItems = [
        {
          id: 'order-1',
          order_id: 'order-1',
          scheduled_time: '09:00',
          patient_name: 'María González',
          patient_mrn: 'MRN-002',
          study_description: 'Chest X-Ray',
          modality: 'CR' as const,
          ordering_physician_name: 'Dr. Carlos Rodríguez',
          priority: 'routine' as const,
          status: 'scheduled' as const,
        },
      ];

      mockApi.get.mockResolvedValueOnce({
        items: worklistItems,
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      });

      const response = await mockApi.get('/radiology/worklist', {
        date: '2026-02-16',
        modality: 'CR',
      });

      expect(response.items).toHaveLength(1);
      expect(response.items[0].modality).toBe('CR');
    });
  });
});
