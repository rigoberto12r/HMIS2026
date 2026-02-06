"use client";

import { useState } from "react";

interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface SOAPNoteEditorProps {
  initialData?: SOAPNote;
  onSave?: (data: SOAPNote) => void;
  onSign?: (data: SOAPNote) => void;
  readOnly?: boolean;
}

const sections = [
  { key: "subjective", label: "S - Subjetivo", placeholder: "Historia referida por el paciente, sintomas, antecedentes relevantes..." },
  { key: "objective", label: "O - Objetivo", placeholder: "Hallazgos del examen fisico, signos vitales, resultados de laboratorio..." },
  { key: "assessment", label: "A - Evaluacion", placeholder: "Diagnosticos (CIE-10), impresion clinica, diagnosticos diferenciales..." },
  { key: "plan", label: "P - Plan", placeholder: "Tratamiento, ordenes medicas, estudios solicitados, seguimiento..." },
];

export default function SOAPNoteEditor({ initialData, onSave, onSign, readOnly = false }: SOAPNoteEditorProps) {
  const [note, setNote] = useState<SOAPNote>(
    initialData || { subjective: "", objective: "", assessment: "", plan: "" }
  );

  const handleChange = (key: string, value: string) => {
    setNote({ ...note, [key]: value });
  };

  return (
    <div className="space-y-4">
      {sections.map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
          <textarea
            value={note[key as keyof SOAPNote]}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={placeholder}
            rows={4}
            readOnly={readOnly}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
          />
        </div>
      ))}

      {!readOnly && (
        <div className="flex gap-2 pt-2">
          <button onClick={() => onSave?.(note)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
            Guardar Borrador
          </button>
          <button onClick={() => onSign?.(note)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Firmar Nota
          </button>
        </div>
      )}
    </div>
  );
}
