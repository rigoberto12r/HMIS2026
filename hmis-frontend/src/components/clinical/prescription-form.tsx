'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Pill,
  Trash2,
  AlertTriangle,
  Send,
  Search,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface PrescriptionItem {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: string;
  instructions: string;
  substitutionAllowed: boolean;
}

// ─── Configuration ──────────────────────────────────────

const routes = [
  { value: 'oral', label: 'Oral' },
  { value: 'iv', label: 'Intravenosa (IV)' },
  { value: 'im', label: 'Intramuscular (IM)' },
  { value: 'sc', label: 'Subcutanea (SC)' },
  { value: 'topica', label: 'Topica' },
  { value: 'inhalatoria', label: 'Inhalatoria' },
  { value: 'rectal', label: 'Rectal' },
  { value: 'oftalmica', label: 'Oftalmica' },
  { value: 'otica', label: 'Otica' },
  { value: 'nasal', label: 'Nasal' },
  { value: 'sublingual', label: 'Sublingual' },
];

const frequencies = [
  { value: 'c/6h', label: 'Cada 6 horas (c/6h)' },
  { value: 'c/8h', label: 'Cada 8 horas (c/8h)' },
  { value: 'c/12h', label: 'Cada 12 horas (c/12h)' },
  { value: 'c/24h', label: 'Cada 24 horas (c/24h)' },
  { value: 'bid', label: '2 veces al dia (BID)' },
  { value: 'tid', label: '3 veces al dia (TID)' },
  { value: 'qid', label: '4 veces al dia (QID)' },
  { value: 'prn', label: 'Segun necesidad (PRN)' },
  { value: 'stat', label: 'Dosis unica (STAT)' },
  { value: 'hs', label: 'Al acostarse (HS)' },
  { value: 'ac', label: 'Antes de comer (AC)' },
  { value: 'pc', label: 'Despues de comer (PC)' },
];

function createEmptyItem(): PrescriptionItem {
  return {
    id: Math.random().toString(36).slice(2),
    medication: '',
    dosage: '',
    frequency: '',
    route: 'oral',
    duration: '',
    quantity: '',
    instructions: '',
    substitutionAllowed: true,
  };
}

// ─── Component ──────────────────────────────────────────

interface PrescriptionFormProps {
  onSubmit?: (items: PrescriptionItem[]) => void;
}

export function PrescriptionForm({ onSubmit }: PrescriptionFormProps) {
  const [items, setItems] = useState<PrescriptionItem[]>([createEmptyItem()]);

  function updateItem(id: string, field: keyof PrescriptionItem, value: string | boolean) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, createEmptyItem()]);
  }

  function removeItem(id: string) {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-4">
      {/* Existing prescriptions */}
      <Card>
        <CardHeader
          title="Prescripciones Activas"
          subtitle="Medicamentos ya prescritos en este encuentro"
        />
        <div className="space-y-2">
          {[
            { med: 'Losartan 100mg', dose: '1 tableta c/24h via oral', days: 'Continuo', qty: 30 },
            { med: 'Hidroclorotiazida 25mg', dose: '1 tableta c/24h via oral', days: 'Continuo', qty: 30 },
          ].map((rx, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <Pill className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800">{rx.med}</p>
                <p className="text-xs text-green-600">
                  {rx.dose} | {rx.days} | Cant: {rx.qty}
                </p>
              </div>
              <Badge variant="success" size="sm">Activa</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* New prescription form */}
      <Card>
        <CardHeader
          title="Nueva Prescripcion"
          subtitle="Agregue los medicamentos a prescribir"
          action={
            <Button
              size="sm"
              leftIcon={<Send className="w-4 h-4" />}
              onClick={() => onSubmit?.(items)}
            >
              Enviar a Farmacia
            </Button>
          }
        />

        {/* Alert */}
        <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-red-50 rounded-lg border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-700 font-medium">
            Alerta: Paciente alergica a Penicilina. Verificar interacciones.
          </span>
        </div>

        <div className="space-y-6">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="p-4 border border-neutral-200 rounded-lg bg-neutral-50/50"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-neutral-700">
                  Medicamento {index + 1}
                </h4>
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <Input
                  label="Medicamento"
                  value={item.medication}
                  onChange={(e) => updateItem(item.id, 'medication', e.target.value)}
                  placeholder="Buscar medicamento por nombre o codigo..."
                  leftIcon={<Search className="w-4 h-4" />}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Dosis"
                    value={item.dosage}
                    onChange={(e) => updateItem(item.id, 'dosage', e.target.value)}
                    placeholder="Ej: 500mg, 10mL, 2 tabletas"
                    required
                  />
                  <Select
                    label="Frecuencia"
                    value={item.frequency}
                    onChange={(e) => updateItem(item.id, 'frequency', e.target.value)}
                    options={frequencies}
                    placeholder="Seleccionar frecuencia"
                    required
                  />
                  <Select
                    label="Via de Administracion"
                    value={item.route}
                    onChange={(e) => updateItem(item.id, 'route', e.target.value)}
                    options={routes}
                    required
                  />
                  <Input
                    label="Duracion (dias)"
                    type="number"
                    value={item.duration}
                    onChange={(e) => updateItem(item.id, 'duration', e.target.value)}
                    placeholder="7"
                    required
                  />
                </div>

                <Input
                  label="Cantidad a Dispensar"
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                  placeholder="21"
                  required
                />

                <Textarea
                  label="Instrucciones para el Paciente"
                  value={item.instructions}
                  onChange={(e) => updateItem(item.id, 'instructions', e.target.value)}
                  placeholder="Tomar con alimentos, evitar alcohol, almacenar en lugar fresco..."
                />

                <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.substitutionAllowed}
                    onChange={(e) =>
                      updateItem(item.id, 'substitutionAllowed', e.target.checked)
                    }
                    className="rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-neutral-700">Permite sustitucion por generico</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Add another medication */}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={addItem}
        >
          Agregar Otro Medicamento
        </Button>
      </Card>
    </div>
  );
}
