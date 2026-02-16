'use client';
import { parseIntSafe, parseFloatSafe } from '@/lib/utils/safe-parse';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateInvoice } from '@/hooks/useInvoices';
import { api } from '@/lib/api';
import { captureException } from '@/lib/monitoring';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PatientOption {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
}

const fiscalTypeOptions = [
  { value: '', label: 'Seleccionar tipo fiscal' },
  { value: 'consumidor_final', label: 'Consumidor Final (02)' },
  { value: 'credito_fiscal', label: 'Crédito Fiscal (01)' },
  { value: 'regimenes_especiales', label: 'Regímenes Especiales (14)' },
  { value: 'gubernamental', label: 'Gubernamental (15)' },
];

const currencyOptions = [
  { value: 'DOP', label: 'DOP (Peso Dominicano)' },
  { value: 'USD', label: 'USD (Dólar)' },
];

interface InvoiceFormData {
  patient_id: string;
  customer_name: string;
  customer_tax_id: string;
  customer_address: string;
  due_date: string;
  currency: string;
  country_code: string;
  fiscal_type: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
}

const emptyItem = { description: '', quantity: 1, unit_price: 0 };

const emptyForm: InvoiceFormData = {
  patient_id: '',
  customer_name: '',
  customer_tax_id: '',
  customer_address: '',
  due_date: '',
  currency: 'DOP',
  country_code: 'DO',
  fiscal_type: 'consumidor_final',
  items: [{ ...emptyItem }],
};

export function CreateInvoiceModal({ isOpen, onClose }: CreateInvoiceModalProps) {
  const [formData, setFormData] = useState<InvoiceFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedPatientName, setSelectedPatientName] = useState('');

  const createInvoice = useCreateInvoice();

  const handleChange = (field: keyof InvoiceFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
  };

  const handleSearchPatients = async (query: string) => {
    setPatientSearch(query);
    if (query.length < 2) {
      setPatients([]);
      return;
    }
    setSearchingPatients(true);
    try {
      const res = await api.get<{ items: PatientOption[] }>('/patients/search', { query, page_size: 5 });
      setPatients(res.items || []);
    } catch {
      setPatients([]);
    } finally {
      setSearchingPatients(false);
    }
  };

  const handleSelectPatient = (patient: PatientOption) => {
    setFormData((prev) => ({
      ...prev,
      patient_id: patient.id,
      customer_name: `${patient.first_name} ${patient.last_name}`,
      customer_tax_id: patient.document_number || '',
    }));
    setSelectedPatientName(`${patient.first_name} ${patient.last_name}`);
    setPatients([]);
    setPatientSearch('');
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...emptyItem }],
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const subtotal = formData.items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const handleSubmit = async () => {
    if (!formData.patient_id) {
      setFormError('Debe seleccionar un paciente');
      return;
    }
    if (formData.items.some((item) => !item.description || item.unit_price <= 0)) {
      setFormError('Todos los items deben tener descripción y precio válido');
      return;
    }

    try {
      await createInvoice.mutateAsync(formData as any);
      toast.success('Factura creada exitosamente');
      setFormData(emptyForm);
      setSelectedPatientName('');
      setFormError(null);
      onClose();
    } catch (err: any) {
      captureException(err, {
        context: 'create_invoice',
        patientId: formData.patient_id,
        itemsCount: formData.items.length,
        fiscalType: formData.fiscal_type,
      });

      const message = err?.detail || err?.message || 'Error al crear factura';
      toast.error(message);
      setFormError(message);
    }
  };

  const handleClose = () => {
    setFormData(emptyForm);
    setSelectedPatientName('');
    setFormError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nueva Factura"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={createInvoice.isPending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={createInvoice.isPending}>
            {createInvoice.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              'Crear Factura'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{formError}</p>
          </div>
        )}

        {/* Patient Search */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Paciente *</h3>
          {selectedPatientName ? (
            <div className="flex items-center gap-2">
              <span className="px-3 py-2 bg-primary-50 text-primary-700 rounded-md text-sm font-medium">
                {selectedPatientName}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPatientName('');
                  setFormData((prev) => ({ ...prev, patient_id: '', customer_name: '', customer_tax_id: '' }));
                }}
              >
                Cambiar
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => handleSearchPatients(e.target.value)}
                  placeholder="Buscar paciente por nombre o cédula..."
                  className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {patients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPatient(p)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-primary-50 flex justify-between"
                    >
                      <span>{p.first_name} {p.last_name}</span>
                      <span className="text-neutral-400">{p.document_number}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchingPatients && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-md p-3 text-sm text-neutral-500 text-center">
                  Buscando...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Customer Details */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Datos del Cliente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre / Razón Social"
              value={formData.customer_name}
              onChange={(e) => handleChange('customer_name', e.target.value)}
              placeholder="Se completa al seleccionar paciente"
            />
            <Input
              label="RNC / Cédula"
              value={formData.customer_tax_id}
              onChange={(e) => handleChange('customer_tax_id', e.target.value)}
              placeholder="001-1234567-8"
            />
            <Input
              label="Dirección"
              value={formData.customer_address}
              onChange={(e) => handleChange('customer_address', e.target.value)}
              placeholder="Dirección del cliente"
            />
            <Input
              label="Fecha de Vencimiento"
              type="date"
              value={formData.due_date}
              onChange={(e) => handleChange('due_date', e.target.value)}
            />
          </div>
        </div>

        {/* Fiscal Info */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Información Fiscal</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Tipo de Comprobante"
              value={formData.fiscal_type}
              onChange={(e) => handleChange('fiscal_type', e.target.value)}
              options={fiscalTypeOptions}
            />
            <Select
              label="Moneda"
              value={formData.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              options={currencyOptions}
            />
          </div>
        </div>

        {/* Line Items */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-neutral-700">Servicios / Productos</h3>
            <Button variant="outline" size="sm" onClick={addItem}>
              + Agregar línea
            </Button>
          </div>
          <div className="space-y-3">
            {formData.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6">
                  <Input
                    label={idx === 0 ? 'Descripción *' : undefined}
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    placeholder="Consulta médica, análisis, etc."
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label={idx === 0 ? 'Cant.' : undefined}
                    type="number"
                    value={item.quantity.toString()}
                    onChange={(e) => handleItemChange(idx, 'quantity', parseIntSafe(e.target.value, 1, 'Quantity'))}
                    min="1"
                    step="1"
                    title="Cantidad debe ser al menos 1"
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    label={idx === 0 ? 'Precio Unit.' : undefined}
                    type="number"
                    value={item.unit_price.toString()}
                    onChange={(e) => handleItemChange(idx, 'unit_price', parseFloatSafe(e.target.value, 0, 'Unit Price'))}
                    min="0"
                    step="0.01"
                    title="Precio debe ser un número positivo"
                  />
                </div>
                <div className="col-span-1">
                  {formData.items.length > 1 && (
                    <button
                      onClick={() => removeItem(idx)}
                      className="p-2 text-red-500 hover:text-red-700"
                      title="Eliminar"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-right text-sm font-semibold text-neutral-700">
            Subtotal: RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
