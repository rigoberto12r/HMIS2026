/**
 * Types for Pharmacy Module
 */

export interface Product {
  id: string;
  code: string;
  name: string;
  generic_name: string | null;
  category: string;
  presentation: string | null;
  concentration: string | null;
  unit: string;
  requires_prescription: boolean;
  is_controlled: boolean;
  min_stock: number;
  max_stock: number;
  reorder_point: number;
  is_active: boolean;
  created_at: string;
}

export interface Prescription {
  id: string;
  patient_id: string;
  doctor_id: string;
  encounter_id: string | null;
  product_id: string;
  dosage: string;
  frequency: string;
  duration_days: number | null;
  quantity: number;
  status: string;
  allergy_alerts: unknown;
  patient_name: string | null;
  product_name: string | null;
  created_at: string;
}

export interface Lot {
  id: string;
  lot_number: string;
  expiration_date: string;
  quantity_available: number;
  product_id: string;
  product_name?: string;
}

export interface InventoryAlert {
  id: string;
  product_name: string;
  current_stock: number;
  reorder_point: number;
  unit: string;
  alert_type: string; // 'low_stock' | 'expiring'
  detail: string;
}

export interface PharmacyStats {
  total_products: number;
  pending_prescriptions: number;
  low_stock_alerts: number;
  expiring_soon_count: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
