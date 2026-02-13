'use client';

import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Activity } from 'lucide-react';

interface TopDiagnosesChartProps {
  data?: Array<{ name: string; value: number; color: string }>;
}

// Mock data - top 5 diagnoses
function generateMockDiagnosesData() {
  return [
    { name: 'Hipertension', value: 35, color: '#6366F1' },
    { name: 'Diabetes tipo 2', value: 28, color: '#10B981' },
    { name: 'Infeccion respiratoria', value: 18, color: '#F59E0B' },
    { name: 'Gastritis', value: 12, color: '#EF4444' },
    { name: 'Otros', value: 7, color: '#8B5CF6' },
  ];
}

export function TopDiagnosesChart({ data }: TopDiagnosesChartProps) {
  const chartData = data || generateMockDiagnosesData();
  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      className="hos-card"
    >
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-violet-400" />
        <h2 className="text-base font-semibold text-white">Top Diagnosticos</h2>
      </div>
      <p className="text-xs text-white/40 mb-4">Distribucion de casos este mes</p>

      <div className="h-[300px] flex items-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0];
                const value = typeof data.value === 'number' ? data.value : 0;
                const pct = ((value / total) * 100).toFixed(1);
                return (
                  <div className="hos-tooltip">
                    <p className="text-xs text-white/50 mb-1">{data.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white">{value}</span>
                      <span className="text-xs text-white/40">casos ({pct}%)</span>
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="space-y-2 mt-4">
        {chartData.map((item, i) => {
          const pct = ((item.value / total) * 100).toFixed(0);
          return (
            <div key={i} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-white/70">{item.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">{item.value}</span>
                <span className="text-xs text-white/40 w-10 text-right">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
