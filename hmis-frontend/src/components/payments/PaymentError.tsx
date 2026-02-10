'use client';

/**
 * Payment Error Component
 * Displays error message when payment fails
 */

import { XCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PaymentErrorProps {
  error: string;
  onRetry: () => void;
  onCancel: () => void;
}

export default function PaymentError({
  error,
  onRetry,
  onCancel,
}: PaymentErrorProps) {
  return (
    <Card className="p-8 max-w-md mx-auto">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <XCircle className="w-10 h-10 text-red-600" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Failed
        </h2>

        <p className="text-gray-600 mb-4">
          We were unable to process your payment.
        </p>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>

        <div className="space-y-3">
          <Button onClick={onRetry} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>

          <Button onClick={onCancel} variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
          <h4 className="font-semibold text-sm mb-2">Common Issues:</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Insufficient funds</li>
            <li>• Incorrect card details</li>
            <li>• Card expired or blocked</li>
            <li>• Bank declined the transaction</li>
          </ul>
          <p className="text-xs text-gray-600 mt-2">
            If the problem persists, please contact your bank or try a different payment method.
          </p>
        </div>
      </div>
    </Card>
  );
}
