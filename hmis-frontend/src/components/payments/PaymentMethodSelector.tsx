'use client';

/**
 * Payment Method Selector Component
 * Displays saved payment methods and allows selection or adding new ones
 */

import { useState } from 'react';
import { CreditCard, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  created: string;
}

interface PaymentMethodSelectorProps {
  paymentMethods: PaymentMethod[];
  selectedMethodId?: string;
  onSelect: (methodId: string) => void;
  onDelete: (methodId: string) => void;
  onAddNew: () => void;
}

export default function PaymentMethodSelector({
  paymentMethods,
  selectedMethodId,
  onSelect,
  onDelete,
  onAddNew,
}: PaymentMethodSelectorProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (methodId: string) => {
    if (confirm('Are you sure you want to remove this payment method?')) {
      setDeletingId(methodId);
      try {
        await onDelete(methodId);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const getBrandIcon = (brand: string) => {
    const brandLower = brand.toLowerCase();
    if (brandLower.includes('visa')) return '💳';
    if (brandLower.includes('mastercard')) return '💳';
    if (brandLower.includes('amex')) return '💳';
    return '💳';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Saved Payment Methods</h3>
        <Button onClick={onAddNew} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add New Card
        </Button>
      </div>

      {paymentMethods.length === 0 ? (
        <Card className="p-6 text-center">
          <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600 mb-4">No saved payment methods</p>
          <Button onClick={onAddNew} variant="outline">
            Add Payment Method
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <Card
              key={method.id}
              className={`p-4 cursor-pointer transition-all ${
                selectedMethodId === method.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'hover:border-gray-400'
              }`}
              onClick={() => onSelect(method.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {method.card ? getBrandIcon(method.card.brand) : '💳'}
                  </div>
                  <div>
                    {method.card && (
                      <>
                        <div className="font-medium capitalize">
                          {method.card.brand} •••• {method.card.last4}
                        </div>
                        <div className="text-sm text-gray-600">
                          Expires {method.card.exp_month}/{method.card.exp_year}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(method.id);
                  }}
                  disabled={deletingId === method.id}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>

              {selectedMethodId === method.id && (
                <div className="mt-2 text-sm text-blue-600 font-medium">
                  Selected for payment
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
