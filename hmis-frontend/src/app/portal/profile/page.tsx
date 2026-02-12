'use client';

import { useEffect, useState } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const PORTAL_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface PatientProfile {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  second_last_name: string | null;
  full_name: string;
  birth_date: string;
  age: number;
  gender: string;
  blood_type: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string;
  photo_url: string | null;
}

export default function PortalProfilePage() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    mobile_phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state_province: '',
    postal_code: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('portal_access_token');
      const response = await fetch(`${PORTAL_API_URL}/portal/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to load profile');

      const data = await response.json();
      setProfile(data);
      setFormData({
        email: data.email || '',
        phone: data.phone || '',
        mobile_phone: data.mobile_phone || '',
        address_line1: data.address_line1 || '',
        address_line2: data.address_line2 || '',
        city: data.city || '',
        state_province: data.state_province || '',
        postal_code: data.postal_code || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccess(false);

    try {
      const token = localStorage.getItem('portal_access_token');
      const response = await fetch(`${PORTAL_API_URL}/portal/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to update profile');

      const data = await response.json();
      setProfile(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-neutral-500">Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">My Profile</h1>
        <p className="text-neutral-600">Manage your personal information and preferences</p>
      </div>

      {/* Profile Header */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl p-6 text-white mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-3xl font-bold">
            {profile.first_name[0]}
            {profile.last_name[0]}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{profile.full_name}</h2>
            <p className="text-blue-100">MRN: {profile.mrn}</p>
            <div className="flex gap-4 mt-2 text-sm text-blue-100">
              <span>Age: {profile.age}</span>
              <span>Gender: {profile.gender}</span>
              {profile.blood_type && <span>Blood Type: {profile.blood_type}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Personal Information (Read-only) */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-500 mb-1">Full Name</label>
            <p className="text-neutral-900">{profile.full_name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-500 mb-1">Date of Birth</label>
            <p className="text-neutral-900">{new Date(profile.birth_date).toLocaleDateString()}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-500 mb-1">Gender</label>
            <p className="text-neutral-900">{profile.gender}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-500 mb-1">Medical Record Number</label>
            <p className="text-neutral-900 font-mono">{profile.mrn}</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Personal information cannot be changed online. Contact the office to update your name, date of
            birth, or other identification details.
          </p>
        </div>
      </div>

      {/* Contact Information (Editable) */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Contact Information</h3>

          <div className="space-y-4">
            <Input
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              leftIcon={<Mail className="w-4 h-4" />}
              placeholder="your.email@example.com"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                leftIcon={<Phone className="w-4 h-4" />}
                placeholder="(123) 456-7890"
              />
              <Input
                label="Mobile Phone"
                name="mobile_phone"
                type="tel"
                value={formData.mobile_phone}
                onChange={handleChange}
                leftIcon={<Phone className="w-4 h-4" />}
                placeholder="(123) 456-7890"
              />
            </div>
          </div>
        </div>

        {/* Address Information (Editable) */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Address</h3>

          <div className="space-y-4">
            <Input
              label="Address Line 1"
              name="address_line1"
              value={formData.address_line1}
              onChange={handleChange}
              leftIcon={<MapPin className="w-4 h-4" />}
              placeholder="Street address"
            />

            <Input
              label="Address Line 2 (Optional)"
              name="address_line2"
              value={formData.address_line2}
              onChange={handleChange}
              placeholder="Apartment, suite, etc."
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="City"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
              />
              <Input
                label="State/Province"
                name="state_province"
                value={formData.state_province}
                onChange={handleChange}
                placeholder="State"
              />
              <Input
                label="Postal Code"
                name="postal_code"
                value={formData.postal_code}
                onChange={handleChange}
                placeholder="12345"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between">
          <div>
            {success && (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-5 h-5" />
                <span className="font-medium">Profile updated successfully</span>
              </div>
            )}
          </div>
          <Button type="submit" isLoading={isSaving} size="lg">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
