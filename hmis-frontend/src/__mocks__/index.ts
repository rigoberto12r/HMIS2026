/**
 * Centralized exports for all mock data generators
 *
 * Import all your mock data from this single file:
 * import { mockLabOrder, mockRadStudy, mockBed } from '@/__mocks__';
 */

// Laboratory mocks
export {
  mockLabTest,
  mockLabTests,
  mockLabOrderTest,
  mockLabSpecimen,
  mockLabOrder,
  mockLabOrders,
  mockLabDashboardStats,
  mockPaginatedLabOrders,
  mockPaginatedLabTests,
  mockCriticalLabOrder,
  mockHemolyzedSpecimenOrder,
} from './laboratory';

// Radiology mocks
export {
  mockRadOrder,
  mockRadOrders,
  mockRadStudy,
  mockRadStudies,
  mockRadReport,
  mockRadReports,
  mockRadTemplate,
  mockRadTemplates,
  mockRadDashboardStats,
  mockPaginatedRadOrders,
  mockPaginatedRadStudies,
  mockPaginatedRadReports,
  mockStatRadOrder,
  mockUnsignedRadReport,
} from './radiology';

// Inpatient mocks
export {
  mockBed,
  mockBeds,
  mockOccupiedBed,
  mockAdmission,
  mockAdmissions,
  mockTransfer,
  mockDischarge,
  mockCensusSnapshot,
  mockCensusRealtime,
  mockBedAvailability,
  mockLongStayAdmission,
  mockHomeHealthDischarge,
  mockAMADischarge,
} from './inpatient';

// Emergency mocks
export {
  mockEDVisit,
  mockEDVisits,
  mockTriageAssessment,
  mockEDTrackBoardItem,
  mockEDTrackBoard,
  mockEDMetrics,
  mockEDDashboardStats,
  mockCriticalEDVisit,
  mockCriticalTriageAssessment,
  mockLWBSVisit,
  mockIsolationTriageAssessment,
  mockTraumaVisit,
  mockTraumaTriageAssessment,
  mockPediatricVisit,
} from './emergency';
