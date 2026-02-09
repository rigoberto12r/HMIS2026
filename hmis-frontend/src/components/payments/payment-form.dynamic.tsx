/**
 * Dynamically imported Payment Form
 *
 * Code-splits the Stripe payment form to reduce bundle size.
 * Stripe libraries are heavy (~100KB) and only needed when processing payments.
 */

'use client';

import dynamic from 'next/dynamic';
import React from 'react';

function PaymentFormSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/4"></div>
      <div className="h-12 bg-gray-200 rounded"></div>
      <div className="h-12 bg-gray-200 rounded"></div>
      <div className="h-12 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded w-full"></div>
    </div>
  );
}

export const PaymentFormDynamic = dynamic(
  () => import('./payment-form').then((mod) => mod.default),
  {
    loading: () => <PaymentFormSkeleton />,
    ssr: false,
  }
);

export default PaymentFormDynamic;
