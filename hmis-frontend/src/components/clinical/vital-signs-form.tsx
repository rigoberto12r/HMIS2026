"use client";

import { useState } from "react";

interface VitalSigns {
  temperature: string;
  heartRate: string;
  bpSystolic: string;
  bpDiastolic: string;
  respiratoryRate: string;
  oxygenSaturation: string;
  weight: string;
  height: string;
  painScale: string;
  glucose: string;
}

interface VitalSignsFormProps {
  onSubmit?: (data: VitalSigns) => void;
}

const fields = [
  { key: "temperature", label: "Temperatura", unit: "°C", placeholder: "36.5" },
  { key: "heartRate", label: "Frec. Cardiaca", unit: "bpm", placeholder: "72" },
  { key: "bpSystolic", label: "PA Sistolica", unit: "mmHg", placeholder: "120" },
  { key: "bpDiastolic", label: "PA Diastolica", unit: "mmHg", placeholder: "80" },
  { key: "respiratoryRate", label: "Frec. Respiratoria", unit: "rpm", placeholder: "16" },
  { key: "oxygenSaturation", label: "SpO2", unit: "%", placeholder: "98" },
  { key: "weight", label: "Peso", unit: "kg", placeholder: "75" },
  { key: "height", label: "Talla", unit: "cm", placeholder: "170" },
  { key: "painScale", label: "Dolor (EVA)", unit: "0-10", placeholder: "0" },
  { key: "glucose", label: "Glicemia", unit: "mg/dL", placeholder: "90" },
];

export default function VitalSignsForm({ onSubmit }: VitalSignsFormProps) {
  const [vitals, setVitals] = useState<VitalSigns>({
    temperature: "", heartRate: "", bpSystolic: "", bpDiastolic: "",
    respiratoryRate: "", oxygenSaturation: "", weight: "", height: "",
    painScale: "", glucose: "",
  });

  const handleChange = (key: string, value: string) => {
    setVitals({ ...vitals, [key]: value });
  };

  return (
    <div>
      <h3 className="font-semibold text-sm mb-3">Registro de Signos Vitales</h3>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(({ key, label, unit, placeholder }) => (
          <div key={key}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <div className="flex">
              <input
                type="number"
                step="any"
                value={vitals[key as keyof VitalSigns]}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={placeholder}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-l-lg text-sm focus:ring-1 focus:ring-blue-500"
              />
              <span className="px-2 py-1.5 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-xs text-gray-500 flex items-center">
                {unit}
              </span>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => onSubmit?.(vitals)} className="mt-4 w-full bg-teal-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-teal-700">
        Registrar Signos Vitales
      </button>
    </div>
  );
}
