'use client';

/**
 * Stripe Payment Form Component
 * Uses Stripe Elements for PCI-compliant payment processing
 */

import { useState, useEffect } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PaymentFormProps {
  amount: number;
  currency: string;
  invoiceId: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export default function PaymentForm({
  amount,
  currency,
  invoiceId,
  onSuccess,
  onError,
  onCancel,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Confirm payment
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/billing/payment-success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || 'Payment failed');
        onError(error.message || 'Payment failed');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      } else if (paymentIntent && paymentIntent.status === 'requires_action') {
        // Handle 3D Secure or other actions
        setErrorMessage('Additional authentication required');
      } else {
        setErrorMessage('Payment processing, please wait...');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setErrorMessage(message);
      onError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Payment Details</h3>
          <p className="text-sm text-gray-600 mb-4">
            Amount: {currency.toUpperCase()} {amount.toFixed(2)}
          </p>
        </div>

        <div className="mb-6">
          <PaymentElement />
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={!stripe || isProcessing}
            className="flex-1"
          >
            {isProcessing ? 'Processing...' : `Pay ${currency.toUpperCase()} ${amount.toFixed(2)}`}
          </Button>
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            disabled={isProcessing}
          >
            Cancel
          </Button>
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          Secured by Stripe. Your payment information is encrypted and secure.
        </div>
      </form>
    </Card>
  );
}
