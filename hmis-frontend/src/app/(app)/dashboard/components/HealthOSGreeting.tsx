'use client';

import { useAuthStore } from '@/lib/auth';
import { motion } from 'framer-motion';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Buenos dias';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getCurrentDate() {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  return date.toLocaleDateString('es-DO', options);
}

export function HealthOSGreeting() {
  const user = useAuthStore((s) => s.user);
  const name = user?.first_name ? `Dr. ${user.first_name}` : 'Doctor';
  const greeting = getGreeting();
  const dateStr = getCurrentDate();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {greeting}, {name}
          </h1>
          <p className="text-sm text-white/40 mt-1">
            {dateStr} &middot; Resumen operativo en tiempo real
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-white/50 font-medium">Sistema activo</span>
        </div>
      </div>
    </motion.div>
  );
}
