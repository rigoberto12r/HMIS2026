'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login({ email, password });
      router.push('/dashboard');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-100 rounded-full opacity-30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-100 rounded-full opacity-30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-4">
        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-neutral-100 p-8">
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl mb-4 shadow-lg shadow-primary-200">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900">HMIS SaaS</h1>
            <p className="text-neutral-500 mt-1 text-sm">
              Sistema de Gestion Hospitalaria
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Correo electronico"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="usuario@hospital.com"
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
            />

            <div>
              <Input
                label="Contrasena"
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Ingrese su contrasena"
                leftIcon={<Lock className="w-4 h-4" />}
                autoComplete="current-password"
              />
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Olvide mi contrasena
                </button>
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Iniciando sesion...' : 'Iniciar Sesion'}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-neutral-50 rounded-lg border border-neutral-100">
            <p className="text-xs text-neutral-500 font-semibold mb-2 uppercase tracking-wider">
              Credenciales de demo
            </p>
            <div className="space-y-1">
              <p className="text-xs text-neutral-600">
                <span className="font-medium">Admin:</span> admin@hmis.app / Admin2026!
              </p>
              <p className="text-xs text-neutral-600">
                <span className="font-medium">Medico:</span> dr.martinez@hmis.app / Demo2026!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-neutral-400 mt-6">
          HMIS SaaS v1.0 - Plataforma Cloud-Native para Latinoamerica
        </p>
      </div>
    </div>
  );
}
