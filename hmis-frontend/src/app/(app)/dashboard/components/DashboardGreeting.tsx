'use client';

import { useAuthStore } from '@/lib/auth';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos dias';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function getFormattedDate(): string {
  return new Intl.DateTimeFormat('es-DO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

export function DashboardGreeting() {
  const user = useAuthStore((s) => s.user);
  const greeting = getGreeting();
  const date = getFormattedDate();

  return (
    <div>
      <h1 className="text-2xl font-bold font-display text-surface-900 dark:text-surface-50">
        {greeting},{' '}
        <span className="gradient-text">
          {user?.first_name ? `Dr. ${user.first_name}` : 'Doctor'}
        </span>
      </h1>
      <p className="text-sm text-surface-500 mt-1 capitalize">{date}</p>
    </div>
  );
}
