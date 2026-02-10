'use client';

/**
 * Payment Success Component
 * Displays success message after successful payment
 */

import { CheckCircle, Download, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PaymentSuccessProps {
  amount: number;
  currency: string;
  invoiceNumber: string;
  paymentIntentId: string;
  receiptUrl?: string;
  onClose: () => void;
  onDownloadReceipt?: () => void;
}

export default function PaymentSuccess({
  amount,
  currency,
  invoiceNumber,
  paymentIntentId,
  receiptUrl,
  onClose,
  onDownloadReceipt,
}: PaymentSuccessProps) {
  return (
    <Card className="p-8 max-w-md mx-auto">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Successful!
        </h2>

        <p className="text-gray-600 mb-6">
          Your payment has been processed successfully.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Amount Paid:</span>
            <span className="font-semibold">
              {currency.toUpperCase()} {amount.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Invoice Number:</span>
            <span className="font-medium">{invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Payment ID:</span>
            <span className="font-mono text-xs">{paymentIntentId}</span>
          </div>
        </div>

        <div className="space-y-3">
          {receiptUrl && (
            <Button
              onClick={() => window.open(receiptUrl, '_blank')}
              variant="outline"
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Receipt
            </Button>
          )}

          {onDownloadReceipt && (
            <Button
              onClick={onDownloadReceipt}
              variant="outline"
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Invoice
            </Button>
          )}

          <Button onClick={onClose} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Billing
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          A confirmation email has been sent to your registered email address.
        </p>
      </div>
    </Card>
  );
}
