'use client';

/**
 * Payment Modal Component
 * Main modal for handling invoice payments with Stripe
 */

import { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { X } from 'lucide-react';
import PaymentForm from './PaymentForm';
import PaymentMethodSelector from './PaymentMethodSelector';
import PaymentSuccess from './PaymentSuccess';
import PaymentError from './PaymentError';

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

interface Invoice {
  id: string;
  invoice_number: string;
  grand_total: number;
  currency: string;
  patient_id: string;
  customer_email?: string;
  customer_name?: string;
}

interface PaymentModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type PaymentStep = 'method-selection' | 'payment-form' | 'success' | 'error';

export default function PaymentModal({
  invoice,
  isOpen,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>('payment-form');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savedMethods, setSavedMethods] = useState<any[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  // Fetch saved payment methods
  useEffect(() => {
    if (isOpen) {
      fetchSavedPaymentMethods();
    }
  }, [isOpen, invoice.patient_id]);

  const fetchSavedPaymentMethods = async () => {
    try {
      const response = await fetch(
        `/api/v1/payments/stripe/customers/patient/${invoice.patient_id}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data?.payment_methods) {
          setSavedMethods(data.payment_methods);
        }
      }
    } catch (err) {
      console.error('Error fetching payment methods:', err);
    }
  };

  // Create payment intent
  useEffect(() => {
    if (isOpen && !clientSecret) {
      createPaymentIntent();
    }
  }, [isOpen]);

  const createPaymentIntent = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/payments/stripe/payment-intents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          invoice_id: invoice.id,
          patient_id: invoice.patient_id,
          amount: invoice.grand_total,
          currency: invoice.currency.toLowerCase(),
          customer_email: invoice.customer_email,
          customer_name: invoice.customer_name,
          save_payment_method: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const data = await response.json();
      setClientSecret(data.client_secret);
      setPaymentIntentId(data.payment_intent_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize payment');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = (intentId: string) => {
    setPaymentIntentId(intentId);
    setStep('success');
    onSuccess();
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
    setStep('error');
  };

  const handleRetry = () => {
    setError(null);
    setClientSecret(null);
    setStep('payment-form');
    createPaymentIntent();
  };

  const handleDeletePaymentMethod = async (methodId: string) => {
    try {
      const response = await fetch(
        `/api/v1/payments/stripe/payment-methods/${methodId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        setSavedMethods(methods => methods.filter(m => m.id !== methodId));
      }
    } catch (err) {
      console.error('Error deleting payment method:', err);
    }
  };

  if (!isOpen) return null;

  const elementsOptions: StripeElementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#3b82f6',
      },
    },
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Pay Invoice</h2>
            <p className="text-sm text-gray-600">
              Invoice #{invoice.invoice_number} - {invoice.currency.toUpperCase()}{' '}
              {invoice.grand_total.toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Initializing payment...</p>
            </div>
          )}

          {step === 'payment-form' && clientSecret && (
            <Elements stripe={stripePromise} options={elementsOptions}>
              <PaymentForm
                amount={invoice.grand_total}
                currency={invoice.currency}
                invoiceId={invoice.id}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onCancel={onClose}
              />
            </Elements>
          )}

          {step === 'success' && paymentIntentId && (
            <PaymentSuccess
              amount={invoice.grand_total}
              currency={invoice.currency}
              invoiceNumber={invoice.invoice_number}
              paymentIntentId={paymentIntentId}
              onClose={onClose}
              onDownloadReceipt={async () => {
                window.open(
                  `/api/v1/billing/invoices/${invoice.id}/pdf`,
                  '_blank'
                );
              }}
            />
          )}

          {step === 'error' && error && (
            <PaymentError
              error={error}
              onRetry={handleRetry}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
