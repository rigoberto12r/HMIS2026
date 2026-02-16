/**
 * Mock data generators for Radiology module
 */

import {
  RadOrder,
  RadStudy,
  RadReport,
  RadTemplate,
  RadDashboardStats,
  PaginatedRadOrders,
  PaginatedRadStudies,
  PaginatedRadReports,
  RadModalityType,
  RadPriority,
  RadOrderStatus,
  RadStudyStatus,
  RadReportStatus,
} from '@/types/radiology';

/**
 * Generate a mock RadOrder
 */
export function mockRadOrder(overrides: Partial<RadOrder> = {}): RadOrder {
  return {
    id: 'rad-order-1',
    order_number: 'RAD-2026-001234',
    patient_id: 'patient-1',
    patient_name: 'Juan Pérez',
    patient_mrn: 'MRN-001234',
    encounter_id: 'encounter-1',
    modality: 'CR',
    body_part: 'Chest',
    study_description: 'Chest X-Ray PA and Lateral',
    clinical_indication: 'Rule out pneumonia',
    ordering_physician_id: 'physician-1',
    ordering_physician_name: 'Dr. María García',
    priority: 'routine',
    status: 'pending',
    scheduled_date: '2026-02-17',
    scheduled_time: '10:00',
    ordered_at: '2026-02-16T08:00:00Z',
    completed_at: undefined,
    cancelled_at: undefined,
    created_at: '2026-02-16T08:00:00Z',
    updated_at: '2026-02-16T08:00:00Z',
    ...overrides,
  };
}

/**
 * Generate multiple mock RadOrders
 */
export function mockRadOrders(count: number = 5): RadOrder[] {
  const modalities: RadModalityType[] = ['CR', 'CT', 'MR', 'US', 'XA'];
  const statuses: RadOrderStatus[] = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'];
  const priorities: RadPriority[] = ['routine', 'urgent', 'stat'];
  const bodyParts = ['Chest', 'Abdomen', 'Head', 'Spine', 'Extremity'];

  return Array.from({ length: count }, (_, i) => {
    const modality = modalities[i % modalities.length];
    const status = statuses[i % statuses.length];
    const priority = priorities[i % priorities.length];
    const bodyPart = bodyParts[i % bodyParts.length];

    return mockRadOrder({
      id: `rad-order-${i + 1}`,
      order_number: `RAD-2026-00${1234 + i}`,
      patient_id: `patient-${i + 1}`,
      patient_name: `Patient ${i + 1}`,
      patient_mrn: `MRN-00${1234 + i}`,
      modality,
      body_part: bodyPart,
      study_description: `${bodyPart} ${modality} Study`,
      status,
      priority,
    });
  });
}

/**
 * Generate a mock RadStudy
 */
export function mockRadStudy(overrides: Partial<RadStudy> = {}): RadStudy {
  return {
    id: 'study-1',
    order_id: 'rad-order-1',
    accession_number: 'ACC-RAD-2026-001234',
    study_uid: '1.2.840.113619.2.55.3.604688119.868.1234567890.1',
    modality: 'CR',
    study_description: 'Chest X-Ray PA and Lateral',
    patient_id: 'patient-1',
    patient_name: 'Juan Pérez',
    patient_mrn: 'MRN-001234',
    scheduled_date: '2026-02-17',
    performed_date: '2026-02-17',
    performed_by_id: 'tech-1',
    performed_by_name: 'Tech Rodriguez',
    protocol_used: 'Standard Chest Protocol',
    series_count: 2,
    images_count: 4,
    pacs_url: 'http://pacs.example.com/viewer?study=1.2.840...',
    status: 'completed',
    notes: undefined,
    created_at: '2026-02-17T10:00:00Z',
    updated_at: '2026-02-17T10:30:00Z',
    ...overrides,
  };
}

/**
 * Generate multiple mock RadStudies
 */
export function mockRadStudies(count: number = 5): RadStudy[] {
  const modalities: RadModalityType[] = ['CR', 'CT', 'MR', 'US', 'XA'];
  const statuses: RadStudyStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled'];

  return Array.from({ length: count }, (_, i) => {
    const modality = modalities[i % modalities.length];
    const status = statuses[i % statuses.length];

    return mockRadStudy({
      id: `study-${i + 1}`,
      order_id: `rad-order-${i + 1}`,
      accession_number: `ACC-RAD-2026-00${1234 + i}`,
      study_uid: `1.2.840.113619.2.55.3.604688119.868.${1234567890 + i}.1`,
      modality,
      status,
      patient_id: `patient-${i + 1}`,
      patient_name: `Patient ${i + 1}`,
      patient_mrn: `MRN-00${1234 + i}`,
    });
  });
}

/**
 * Generate a mock RadReport
 */
export function mockRadReport(overrides: Partial<RadReport> = {}): RadReport {
  return {
    id: 'report-1',
    study_id: 'study-1',
    report_number: 'REP-2026-001234',
    radiologist_id: 'radiologist-1',
    radiologist_name: 'Dr. Carlos Mendez',
    template_id: undefined,
    findings: 'The lungs are clear. No focal consolidation, pleural effusion, or pneumothorax. The cardiac silhouette is normal in size. No mediastinal widening.',
    impression: 'Normal chest radiograph. No acute cardiopulmonary findings.',
    recommendations: 'Follow up as clinically indicated.',
    comparison_text: 'Compared to prior study from 2025-06-15.',
    status: 'final',
    dictated_at: '2026-02-17T11:00:00Z',
    transcribed_at: '2026-02-17T11:05:00Z',
    signed_at: '2026-02-17T11:10:00Z',
    signed_by_id: 'radiologist-1',
    signed_by_name: 'Dr. Carlos Mendez',
    created_at: '2026-02-17T11:00:00Z',
    updated_at: '2026-02-17T11:10:00Z',
    ...overrides,
  };
}

/**
 * Generate multiple mock RadReports
 */
export function mockRadReports(count: number = 5): RadReport[] {
  const statuses: RadReportStatus[] = ['pending', 'draft', 'preliminary', 'final', 'corrected'];

  return Array.from({ length: count }, (_, i) => {
    const status = statuses[i % statuses.length];

    return mockRadReport({
      id: `report-${i + 1}`,
      study_id: `study-${i + 1}`,
      report_number: `REP-2026-00${1234 + i}`,
      status,
      signed_at: status === 'final' ? '2026-02-17T11:10:00Z' : undefined,
    });
  });
}

/**
 * Generate a mock RadTemplate
 */
export function mockRadTemplate(overrides: Partial<RadTemplate> = {}): RadTemplate {
  return {
    id: 'template-1',
    name: 'Chest X-Ray Template',
    description: 'Standard template for chest radiograph reporting',
    modality: 'CR',
    body_part: 'Chest',
    template_text: `CLINICAL INDICATION: {{INDICATION}}

COMPARISON: {{COMPARISON}}

FINDINGS:
Lungs: {{LUNGS}}
Heart: {{HEART}}
Mediastinum: {{MEDIASTINUM}}
Pleura: {{PLEURA}}
Bones: {{BONES}}

IMPRESSION:
{{IMPRESSION}}

RECOMMENDATIONS:
{{RECOMMENDATIONS}}`,
    placeholders: ['INDICATION', 'COMPARISON', 'LUNGS', 'HEART', 'MEDIASTINUM', 'PLEURA', 'BONES', 'IMPRESSION', 'RECOMMENDATIONS'],
    is_active: true,
    created_by_id: 'radiologist-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Generate multiple mock RadTemplates
 */
export function mockRadTemplates(count: number = 3): RadTemplate[] {
  return [
    mockRadTemplate({
      id: 'template-1',
      name: 'Chest X-Ray Template',
      modality: 'CR',
      body_part: 'Chest',
    }),
    mockRadTemplate({
      id: 'template-2',
      name: 'CT Head Template',
      modality: 'CT',
      body_part: 'Head',
      template_text: 'CLINICAL INDICATION: {{INDICATION}}\n\nFINDINGS:\n{{FINDINGS}}\n\nIMPRESSION:\n{{IMPRESSION}}',
    }),
    mockRadTemplate({
      id: 'template-3',
      name: 'Abdominal Ultrasound Template',
      modality: 'US',
      body_part: 'Abdomen',
      template_text: 'INDICATION: {{INDICATION}}\n\nFINDINGS:\nLiver: {{LIVER}}\nGallbladder: {{GALLBLADDER}}\nKidneys: {{KIDNEYS}}\n\nIMPRESSION:\n{{IMPRESSION}}',
    }),
  ].slice(0, count);
}

/**
 * Generate mock RadDashboardStats
 */
export function mockRadDashboardStats(
  overrides: Partial<RadDashboardStats> = {}
): RadDashboardStats {
  return {
    pending_orders: 8,
    studies_today: 32,
    unsigned_reports: 5,
    stat_urgent: 2,
    completed_today: 28,
    avg_report_time: 1.5,
    orders_by_modality: {
      CR: 12,
      CT: 8,
      MR: 4,
      US: 6,
      XA: 2,
    },
    orders_by_status: {
      pending: 8,
      scheduled: 10,
      in_progress: 6,
      completed: 28,
    },
    ...overrides,
  };
}

/**
 * Generate paginated RadOrders response
 */
export function mockPaginatedRadOrders(
  page: number = 1,
  pageSize: number = 20,
  total: number = 50
): PaginatedRadOrders {
  const items = mockRadOrders(Math.min(pageSize, total - (page - 1) * pageSize));

  return {
    items,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  };
}

/**
 * Generate paginated RadStudies response
 */
export function mockPaginatedRadStudies(
  page: number = 1,
  pageSize: number = 20,
  total: number = 50
): PaginatedRadStudies {
  const items = mockRadStudies(Math.min(pageSize, total - (page - 1) * pageSize));

  return {
    items,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  };
}

/**
 * Generate paginated RadReports response
 */
export function mockPaginatedRadReports(
  page: number = 1,
  pageSize: number = 20,
  total: number = 50
): PaginatedRadReports {
  const items = mockRadReports(Math.min(pageSize, total - (page - 1) * pageSize));

  return {
    items,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  };
}

/**
 * Create a STAT priority order
 */
export function mockStatRadOrder(): RadOrder {
  return mockRadOrder({
    priority: 'stat',
    modality: 'CT',
    body_part: 'Head',
    study_description: 'CT Head Non-Contrast',
    clinical_indication: 'STAT - Rule out intracranial hemorrhage',
  });
}

/**
 * Create an unsigned report
 */
export function mockUnsignedRadReport(): RadReport {
  return mockRadReport({
    status: 'draft',
    signed_at: undefined,
    signed_by_id: undefined,
    signed_by_name: undefined,
  });
}
