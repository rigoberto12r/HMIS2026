'use client';

import { useState, useEffect } from 'react';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useFiscalConfig, useSaveFiscalConfig, useValidateRNC } from '@/hooks/useFiscalConfig';

const countryOptions = [
  { value: 'DO', label: 'República Dominicana' },
  { value: 'MX', label: 'México' },
  { value: 'CO', label: 'Colombia' },
  { value: 'PA', label: 'Panamá' },
];

const regimeOptions = [
  { value: '', label: 'Seleccionar régimen' },
  { value: 'normal', label: 'Normal' },
  { value: 'simplificado', label: 'Régimen Simplificado de Tributación (RST)' },
  { value: 'zona_franca', label: 'Zona Franca' },
];

export function FiscalConfigSection() {
  const { data: configs, isLoading } = useFiscalConfig();
  const saveFiscal = useSaveFiscalConfig();
  const validateRNC = useValidateRNC();

  const [form, setForm] = useState({
    country_code: 'DO',
    tax_id: '',
    fiscal_regime: '',
    business_name: '',
    business_address: '',
    sequence_prefix: 'B',
    default_tax_rate: 0.18,
    tax_name: 'ITBIS',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [rncValid, setRncValid] = useState<boolean | null>(null);

  // Load existing config
  useEffect(() => {
    if (configs && configs.length > 0) {
      const cfg = configs[0];
      setForm({
        country_code: cfg.country_code || 'DO',
        tax_id: cfg.tax_id || '',
        fiscal_regime: cfg.fiscal_regime || '',
        business_name: cfg.business_name || '',
        business_address: '',
        sequence_prefix: 'B',
        default_tax_rate: cfg.default_tax_rate ?? 0.18,
        tax_name: cfg.tax_name || 'ITBIS',
      });
    }
  }, [configs]);

  const handleValidateRNC = async () => {
    if (!form.tax_id) return;
    try {
      const result = await validateRNC.mutateAsync({
        tax_id: form.tax_id,
        country_code: form.country_code,
      });
      setRncValid(result.valid);
    } catch {
      setRncValid(false);
    }
  };

  const handleSave = async () => {
    if (!form.tax_id || !form.business_name) {
      setFormError('RNC/NIT y nombre comercial son requeridos');
      return;
    }

    try {
      await saveFiscal.mutateAsync(form);
      toast.success('Configuración fiscal guardada');
      setFormError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      toast.error(err?.detail || err?.message || 'Error al guardar configuración fiscal');
      setFormError(err?.detail || err?.message || 'Error al guardar configuración fiscal');
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-neutral-900">Configuración Fiscal</h2>
        {saved && (
          <div className="flex items-center gap-1 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" /> Guardado
          </div>
        )}
      </div>

      {formError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{formError}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="País"
            value={form.country_code}
            onChange={(e) => setForm({ ...form, country_code: e.target.value })}
            options={countryOptions}
          />
          <Select
            label="Régimen Fiscal"
            value={form.fiscal_regime}
            onChange={(e) => setForm({ ...form, fiscal_regime: e.target.value })}
            options={regimeOptions}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input
              label="RNC / NIT *"
              value={form.tax_id}
              onChange={(e) => { setForm({ ...form, tax_id: e.target.value }); setRncValid(null); }}
              placeholder="000-00000-0"
            />
            <div className="flex items-center gap-2 mt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidateRNC}
                disabled={validateRNC.isPending || !form.tax_id}
              >
                {validateRNC.isPending ? 'Validando...' : 'Validar RNC'}
              </Button>
              {rncValid === true && <span className="text-green-600 text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Válido</span>}
              {rncValid === false && <span className="text-red-600 text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Inválido</span>}
            </div>
          </div>
          <Input
            label="Nombre Comercial *"
            value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            placeholder="Hospital General"
          />
        </div>

        <Input
          label="Dirección Fiscal"
          value={form.business_address}
          onChange={(e) => setForm({ ...form, business_address: e.target.value })}
          placeholder="Dirección fiscal de la empresa"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Prefijo NCF"
            value={form.sequence_prefix}
            onChange={(e) => setForm({ ...form, sequence_prefix: e.target.value })}
            placeholder="B"
          />
          <Input
            label="Tasa de Impuesto"
            type="number"
            value={form.default_tax_rate.toString()}
            onChange={(e) => setForm({ ...form, default_tax_rate: parseFloat(e.target.value) || 0 })}
            placeholder="0.18"
          />
          <Input
            label="Nombre del Impuesto"
            value={form.tax_name}
            onChange={(e) => setForm({ ...form, tax_name: e.target.value })}
            placeholder="ITBIS"
          />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            <strong>Nota:</strong> Los cambios en la configuración fiscal afectan la generación de NCF,
            reportes DGII (607/608/609) y cálculos de impuestos.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saveFiscal.isPending}>
            {saveFiscal.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Guardar Configuración</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
