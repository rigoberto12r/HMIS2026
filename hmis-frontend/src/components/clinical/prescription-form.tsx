"use client";

import { useState } from "react";

interface PrescriptionFormProps {
  patientId?: string;
  onSubmit?: (data: any) => void;
}

export default function PrescriptionForm({ patientId, onSubmit }: PrescriptionFormProps) {
  const [form, setForm] = useState({
    medication: "",
    dosage: "",
    frequency: "",
    route: "oral",
    duration: "",
    quantity: "",
    instructions: "",
    substitutionAllowed: true,
  });

  const routes = ["oral", "IV", "IM", "subcutanea", "topica", "inhalatoria", "rectal", "oftalmica"];
  const frequencies = ["c/6h", "c/8h", "c/12h", "c/24h", "BID", "TID", "QID", "PRN", "stat"];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Nueva Prescripcion</h3>

      <div>
        <label className="block text-sm text-gray-700 mb-1">Medicamento</label>
        <input type="text" value={form.medication} onChange={(e) => setForm({ ...form, medication: e.target.value })}
          placeholder="Buscar medicamento..." className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Dosis</label>
          <input type="text" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })}
            placeholder="500mg" className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Frecuencia</label>
          <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm">
            <option value="">Seleccionar...</option>
            {frequencies.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Via</label>
          <select value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm">
            {routes.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Duracion (dias)</label>
          <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}
            placeholder="7" className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-700 mb-1">Cantidad a dispensar</label>
        <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          placeholder="21" className="w-full px-3 py-2 border rounded-lg text-sm" />
      </div>

      <div>
        <label className="block text-sm text-gray-700 mb-1">Instrucciones</label>
        <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          placeholder="Tomar con alimentos, evitar alcohol..." rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.substitutionAllowed}
          onChange={(e) => setForm({ ...form, substitutionAllowed: e.target.checked })} className="rounded" />
        Permite sustitucion por generico
      </label>

      <button onClick={() => onSubmit?.(form)} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
        Crear Prescripcion
      </button>
    </div>
  );
}
