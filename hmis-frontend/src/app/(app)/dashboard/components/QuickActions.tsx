'use client';

import { Stethoscope, UserPlus, FileSearch, Receipt } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const actions = [
  {
    label: 'Nueva consulta',
    description: 'Agendar cita medica',
    icon: Stethoscope,
    href: '/appointments',
    gradient: 'from-indigo-500 to-violet-500',
  },
  {
    label: 'Nuevo paciente',
    description: 'Registrar paciente',
    icon: UserPlus,
    href: '/patients',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    label: 'Ver resultados',
    description: 'Historia clinica',
    icon: FileSearch,
    href: '/emr',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    label: 'Facturar',
    description: 'Crear factura',
    icon: Receipt,
    href: '/billing',
    gradient: 'from-amber-500 to-orange-500',
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action, i) => {
        const Icon = action.icon;
        return (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.06, duration: 0.4 }}
          >
            <Link href={action.href} className="hos-action-card block group">
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-3 opacity-90 group-hover:opacity-100 transition-opacity`}
              >
                <Icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-white/90 mb-0.5">{action.label}</h3>
              <p className="text-xs text-white/40">{action.description}</p>
              <span className="text-xs text-white/20 group-hover:text-white/40 mt-2 inline-block transition-colors">
                Abrir &rarr;
              </span>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
