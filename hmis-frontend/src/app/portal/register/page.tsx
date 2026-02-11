'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Lock, Mail, AlertCircle, User, CreditCard, Calendar, Phone } from 'lucide-react';

export default function PortalRegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    second_last_name: '',
    document_type: 'cedula',
    document_number: '',
    birth_date: '',
    gender: 'M',
    phone: '',
    mobile_phone: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const { confirmPassword, ...registerData } = formData;

      const response = await fetch('http://localhost:8000/api/v1/portal/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Registration failed');
      }

      const data = await response.json();

      // Store tokens and patient info
      localStorage.setItem('portal_access_token', data.access_token);
      localStorage.setItem('portal_refresh_token', data.refresh_token);
      localStorage.setItem('patient_id', data.patient_id);
      localStorage.setItem('patient_name', data.full_name);

      setSuccess(true);
      setTimeout(() => {
        router.push('/portal/dashboard');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <div className="relative w-full max-w-md px-4">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-100 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Welcome!</h2>
            <p className="text-neutral-600">Your account has been created successfully.</p>
            <p className="text-sm text-neutral-500 mt-2">Redirecting to dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 py-12">
      <div className="relative w-full max-w-2xl px-4">
        {/* Register Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-neutral-100 p-8">
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-4 shadow-lg">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900">Create Patient Account</h1>
            <p className="text-neutral-500 mt-1 text-sm">Register to access your health information</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Personal Information */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  placeholder="John"
                  leftIcon={<User className="w-4 h-4" />}
                />
                <Input
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  placeholder="Doe"
                />
                <Input
                  label="Second Last Name (Optional)"
                  name="second_last_name"
                  value={formData.second_last_name}
                  onChange={handleChange}
                  placeholder="Smith"
                />
                <Input
                  label="Birth Date"
                  name="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={handleChange}
                  required
                  leftIcon={<Calendar className="w-4 h-4" />}
                />
              </div>
            </div>

            {/* Identification */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Identification</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-neutral-700">Document Type</label>
                  <select
                    name="document_type"
                    value={formData.document_type}
                    onChange={handleChange}
                    className="form-input w-full"
                    required
                  >
                    <option value="cedula">Cedula</option>
                    <option value="pasaporte">Passport</option>
                    <option value="licencia">Driver's License</option>
                  </select>
                </div>
                <Input
                  label="Document Number"
                  name="document_number"
                  value={formData.document_number}
                  onChange={handleChange}
                  required
                  placeholder="123-4567890-1"
                  leftIcon={<CreditCard className="w-4 h-4" />}
                />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-neutral-700">Gender</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="form-input w-full"
                    required
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="your.email@example.com"
                  leftIcon={<Mail className="w-4 h-4" />}
                  autoComplete="email"
                />
                <Input
                  label="Phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(123) 456-7890"
                  leftIcon={<Phone className="w-4 h-4" />}
                />
                <Input
                  label="Mobile Phone"
                  name="mobile_phone"
                  type="tel"
                  value={formData.mobile_phone}
                  onChange={handleChange}
                  placeholder="(123) 456-7890"
                  leftIcon={<Phone className="w-4 h-4" />}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Account Security</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  leftIcon={<Lock className="w-4 h-4" />}
                  autoComplete="new-password"
                />
                <Input
                  label="Confirm Password"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={8}
                  placeholder="Re-enter password"
                  leftIcon={<Lock className="w-4 h-4" />}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <Button type="submit" isLoading={isLoading} className="w-full" size="lg">
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          {/* Login link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-600">
              Already have an account?{' '}
              <Link href="/portal/login" className="font-semibold text-blue-600 hover:text-blue-700">
                Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-neutral-400">Your information is secure and HIPAA-compliant</p>
        </div>
      </div>
    </div>
  );
}
