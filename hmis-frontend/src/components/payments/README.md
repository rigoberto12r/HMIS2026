# Payment Components

React components for Stripe payment processing in HMIS.

## Components Overview

### PaymentModal.tsx
Main orchestrator component that manages the entire payment flow.

**Props:**
- `invoice` - Invoice object to be paid
- `isOpen` - Modal visibility state
- `onClose` - Close handler
- `onSuccess` - Success callback

**Features:**
- Initializes Stripe Elements
- Creates payment intent
- Manages payment flow states
- Handles success/error scenarios
- Loads saved payment methods

**Usage:**
```tsx
<PaymentModal
  invoice={selectedInvoice}
  isOpen={showPaymentModal}
  onClose={() => setShowPaymentModal(false)}
  onSuccess={handlePaymentSuccess}
/>
```

### PaymentForm.tsx
Stripe Elements payment form for card input and submission.

**Props:**
- `amount` - Payment amount
- `currency` - Currency code (USD, DOP, etc.)
- `invoiceId` - Invoice ID being paid
- `onSuccess` - Success callback with payment intent ID
- `onError` - Error callback with error message
- `onCancel` - Cancel callback

**Features:**
- Stripe Elements integration
- Card input with validation
- 3D Secure authentication
- Loading states
- Error display

**Usage:**
```tsx
<Elements stripe={stripePromise} options={elementsOptions}>
  <PaymentForm
    amount={100.00}
    currency="usd"
    invoiceId={invoiceId}
    onSuccess={handleSuccess}
    onError={handleError}
    onCancel={handleCancel}
  />
</Elements>
```

### PaymentMethodSelector.tsx
Display and manage saved payment methods.

**Props:**
- `paymentMethods` - Array of saved payment methods
- `selectedMethodId` - Currently selected method ID
- `onSelect` - Selection handler
- `onDelete` - Delete handler
- `onAddNew` - Add new method handler

**Features:**
- List saved cards
- Card brand icons
- Expiry date display
- Delete confirmation
- Selection highlighting
- Add new card button

**Usage:**
```tsx
<PaymentMethodSelector
  paymentMethods={methods}
  selectedMethodId={selectedId}
  onSelect={setSelectedId}
  onDelete={handleDelete}
  onAddNew={handleAddNew}
/>
```

### PaymentSuccess.tsx
Success confirmation screen after payment.

**Props:**
- `amount` - Payment amount
- `currency` - Currency code
- `invoiceNumber` - Invoice number
- `paymentIntentId` - Stripe payment intent ID
- `receiptUrl` - Optional Stripe receipt URL
- `onClose` - Close handler
- `onDownloadReceipt` - Optional receipt download handler

**Features:**
- Success icon and message
- Payment details display
- Receipt download
- Invoice download
- Return to billing

**Usage:**
```tsx
<PaymentSuccess
  amount={100.00}
  currency="usd"
  invoiceNumber="INV-00001"
  paymentIntentId="pi_xxx"
  receiptUrl="https://stripe.com/receipt"
  onClose={handleClose}
  onDownloadReceipt={handleDownload}
/>
```

### PaymentError.tsx
Error display with retry option.

**Props:**
- `error` - Error message to display
- `onRetry` - Retry handler
- `onCancel` - Cancel handler

**Features:**
- Error icon and message
- Retry button
- Cancel button
- Common issues help
- Troubleshooting tips

**Usage:**
```tsx
<PaymentError
  error="Your card was declined"
  onRetry={handleRetry}
  onCancel={handleCancel}
/>
```

## Payment Flow

```
1. User clicks "Pay Now" on invoice
   ↓
2. PaymentModal opens
   ↓
3. API creates payment intent
   ↓
4. Stripe returns client_secret
   ↓
5. PaymentForm displays (Stripe Elements)
   ↓
6. User enters card details
   ↓
7. User clicks "Pay"
   ↓
8. Stripe processes payment
   ↓
9a. Success → PaymentSuccess screen
9b. Error → PaymentError screen
   ↓
10. Webhook updates invoice status
```

## State Management

The `PaymentModal` manages these states:

- `payment-form` - Show payment form
- `success` - Payment succeeded
- `error` - Payment failed

Transitions:
- Initial → `payment-form`
- Payment success → `success`
- Payment error → `error`
- Retry → back to `payment-form`

## Integration Example

### Basic Integration

```tsx
import PaymentModal from '@/components/payments/PaymentModal';

function BillingPage() {
  const [showPayment, setShowPayment] = useState(false);
  const [invoice, setInvoice] = useState(null);

  const handlePay = (inv) => {
    setInvoice(inv);
    setShowPayment(true);
  };

  return (
    <>
      {invoices.map(inv => (
        <button onClick={() => handlePay(inv)}>
          Pay Now
        </button>
      ))}

      {invoice && (
        <PaymentModal
          invoice={invoice}
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            alert('Payment successful!');
            refreshInvoices();
          }}
        />
      )}
    </>
  );
}
```

### With Saved Payment Methods

```tsx
import { useEffect, useState } from 'react';
import PaymentModal from '@/components/payments/PaymentModal';
import PaymentMethodSelector from '@/components/payments/PaymentMethodSelector';

function PatientBilling() {
  const [methods, setMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);

  useEffect(() => {
    // Load saved payment methods
    fetch('/api/v1/payments/stripe/customers/patient/xxx')
      .then(r => r.json())
      .then(data => setMethods(data.payment_methods));
  }, []);

  return (
    <div>
      <PaymentMethodSelector
        paymentMethods={methods}
        selectedMethodId={selectedMethod}
        onSelect={setSelectedMethod}
        onDelete={handleDelete}
        onAddNew={() => setShowPayment(true)}
      />

      <PaymentModal
        invoice={invoice}
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
```

## Styling

Components use Tailwind CSS classes and follow HMIS design system:

- Colors: Primary blue (#3b82f6)
- Success: Green (#10b981)
- Error: Red (#ef4444)
- Card borders: Gray (#e5e7eb)
- Rounded corners: 8px
- Shadows: Subtle elevations

## Security

- Card data never touches our servers
- Stripe Elements handles all sensitive data
- PCI DSS SAQ-A compliance
- HTTPS required
- Webhook signature verification

## Testing

Use Stripe test cards:

**Success:**
```
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
```

**3D Secure:**
```
Card: 4000 0027 6000 3184
Complete auth popup
```

**Declined:**
```
Card: 4000 0000 0000 0002
```

More: https://stripe.com/docs/testing

## Environment Variables

Required in `.env.local`:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## API Integration

Components call these endpoints:

- `POST /api/v1/payments/stripe/payment-intents` - Create intent
- `GET /api/v1/payments/stripe/customers/patient/{id}` - Get customer
- `GET /api/v1/payments/stripe/customers/{id}/payment-methods` - List methods
- `DELETE /api/v1/payments/stripe/payment-methods/{id}` - Remove method

## Error Handling

Common errors handled:

- `card_declined` - Card declined by bank
- `insufficient_funds` - Insufficient funds
- `expired_card` - Card expired
- `incorrect_cvc` - Wrong CVC code
- `processing_error` - Processing error
- `authentication_required` - 3DS required

All errors show user-friendly messages.

## Accessibility

Components include:

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Focus management
- Screen reader support
- Color contrast compliance

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires JavaScript enabled.

## Dependencies

```json
{
  "@stripe/stripe-js": "^2.4.0",
  "@stripe/react-stripe-js": "^2.4.0",
  "lucide-react": "^0.309.0"
}
```

## Contributing

When modifying payment components:

1. Test with multiple test cards
2. Test 3D Secure flow
3. Test error scenarios
4. Verify PCI compliance maintained
5. Update this README if needed
6. Test in multiple browsers

## Support

- Stripe Docs: https://stripe.com/docs
- Stripe Elements: https://stripe.com/docs/stripe-js
- HMIS Docs: See `/docs/STRIPE_INTEGRATION.md`
