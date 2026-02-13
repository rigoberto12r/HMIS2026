'use client';

import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { DarkChartTooltip } from './DarkChartTooltip';
import { TrendingUp, Calendar } from 'lucide-react';

interface RevenueChartProps {
  data?: Array<{ date: string; ingresos: number; gastos: number }>;
}

// Mock data for last 7 days
function generateMockRevenueData() {
  const days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  return days.map((day, i) => ({
    date: day,
    ingresos: Math.floor(25000 + Math.random() * 15000),
    gastos: Math.floor(15000 + Math.random() * 8000),
  }));
}

export function RevenueChart({ data }: RevenueChartProps) {
  const chartData = data || generateMockRevenueData();
  const totalIngresos = chartData.reduce((sum, d) => sum + d.ingresos, 0);
  const totalGastos = chartData.reduce((sum, d) => sum + d.gastos, 0);
  const margen = totalIngresos - totalGastos;
  const margenPct = ((margen / totalIngresos) * 100).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.4 }}
      className="hos-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white mb-1">Ingresos vs Gastos</h2>
          <p className="text-xs text-white/40">Ultimos 7 dias</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-white/40 mb-0.5">Margen</p>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">{margenPct}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="ingresosGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gastosGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="hos-tooltip">
                    <p className="text-xs text-white/50 mb-2">{label}</p>
                    {payload.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between gap-4 mb-1">
                        <span className="text-xs" style={{ color: entry.color }}>
                          {entry.name}:
                        </span>
                        <span className="text-sm font-semibold text-white">
                          RD$ {entry.value?.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
              iconType="circle"
              formatter={(value) => <span className="text-white/60">{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="ingresos"
              name="Ingresos"
              stroke="#10B981"
              strokeWidth={3}
              fill="url(#ingresosGradient)"
              dot={{ fill: '#10B981', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="gastos"
              name="Gastos"
              stroke="#F59E0B"
              strokeWidth={3}
              fill="url(#gastosGradient)"
              dot={{ fill: '#F59E0B', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
