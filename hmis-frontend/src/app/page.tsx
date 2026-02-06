'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="text-center">
        <div className="animate-pulse-subtle">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary-500 flex items-center justify-center">
            <span className="text-white font-bold text-lg">H</span>
          </div>
          <p className="text-sm text-neutral-500">Cargando HMIS...</p>
        </div>
      </div>
    </div>
  );
}
