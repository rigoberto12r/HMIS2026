'use client';

interface DarkChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

export function DarkChartTooltip({ active, payload, label }: DarkChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="hos-tooltip">
      <p className="text-xs text-white/50 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-semibold text-white">
          {entry.value} {entry.value === 1 ? 'consulta' : 'consultas'}
        </p>
      ))}
    </div>
  );
}
