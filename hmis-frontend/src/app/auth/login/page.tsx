'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuthStore } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const shouldReduce = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoginError(false);
    try {
      await login({ email, password });
      router.push('/dashboard');
    } catch {
      setLoginError(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated mesh gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(-45deg, #EEF2FF, #F5F3FF, #ECFDF5, #EFF6FF)',
          backgroundSize: '400% 400%',
          animation: shouldReduce ? 'none' : 'meshGradient 8s ease-in-out infinite',
        }}
      />

      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-200 rounded-full opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent-200 rounded-full opacity-20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-200 rounded-full opacity-10 blur-3xl" />
      </div>

      <motion.div
        className="relative w-full max-w-md px-4"
        initial={shouldReduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Login Card */}
        <div className="bg-white/80 dark:bg-surface-100/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-8">
          {/* Brand */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Heart
                className="w-8 h-8 text-white"
                style={{ animation: shouldReduce ? 'none' : 'heartbeat 2s ease-in-out infinite' }}
              />
            </div>
            <h1 className="text-2xl font-bold font-display text-surface-900 dark:text-surface-50">
              HMIS SaaS
            </h1>
            <p className="text-surface-500 mt-1 text-sm">
              Sistema de Gestion Hospitalaria
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <motion.div
                className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm"
                initial={shouldReduce ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
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
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                >
                  Olvide mi contrasena
                </button>
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              variant="gradient"
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Iniciando sesion...' : 'Iniciar Sesion'}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-surface-50 dark:bg-surface-200 rounded-lg border border-surface-100 dark:border-surface-600">
            <p className="text-xs text-surface-500 font-semibold mb-2 uppercase tracking-wider">
              Credenciales de demo
            </p>
            <div className="space-y-1">
              <p className="text-xs text-surface-600 dark:text-surface-400">
                <span className="font-medium">Admin:</span> admin@hmis.app / Admin2026!
              </p>
              <p className="text-xs text-surface-600 dark:text-surface-400">
                <span className="font-medium">Medico:</span> dr.martinez@hmis.app / Demo2026!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-surface-400 mt-6">
          HMIS SaaS v2.0 - Plataforma Cloud-Native para Latinoamerica
        </p>
      </motion.div>
    </div>
  );
}
