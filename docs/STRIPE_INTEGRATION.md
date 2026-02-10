# Stripe Payment Gateway Integration

Complete guide for the Stripe payment gateway integration in the HMIS system.

## Overview

This integration provides secure, PCI-compliant online payment processing for patient invoices using Stripe. It includes:

- Payment intent creation and confirmation
- Saved payment methods
- 3D Secure authentication support
- Webhook handling for payment events
- Refund processing
- Payment history tracking

## Architecture

### Backend Components

#### 1. Stripe Service (`hmis-backend/app/integrations/payments/stripe_service.py`)

Core service handling all Stripe API interactions:

- **Payment Intents**: Create, confirm, retrieve, cancel
- **Customers**: Manage Stripe customers linked to patients
- **Payment Methods**: Save, list, detach payment methods
- **Refunds**: Process full or partial refunds
- **Webhooks**: Handle Stripe event notifications
- **Receipts**: Generate payment receipts

#### 2. Payment Routes (`hmis-backend/app/modules/billing/payment_routes.py`)

API endpoints for payment operations:

- `POST /api/v1/payments/stripe/payment-intents` - Create payment intent
- `POST /api/v1/payments/stripe/payment-intents/{id}/confirm` - Confirm payment
- `GET /api/v1/payments/stripe/payment-intents/{id}` - Get payment status
- `POST /api/v1/payments/stripe/payment-intents/{id}/cancel` - Cancel payment
- `POST /api/v1/payments/stripe/refunds` - Create refund
- `GET /api/v1/payments/stripe/customers/patient/{id}` - Get customer info
- `GET /api/v1/payments/stripe/customers/{id}/payment-methods` - List payment methods
- `DELETE /api/v1/payments/stripe/payment-methods/{id}` - Remove payment method
- `GET /api/v1/payments/stripe/payment-intents/{id}/receipt` - Get receipt
- `POST /api/v1/payments/stripe/webhooks` - Webhook endpoint (no auth required)

#### 3. Database Models

New models added to `hmis-backend/app/modules/billing/models.py`:

- **StripeCustomer**: Links patients to Stripe customers
- **StripePaymentMethod**: Stores saved payment methods
- **StripePaymentIntent**: Tracks payment intents
- **StripeRefund**: Records refunds

### Frontend Components

#### 1. Payment Components (`hmis-frontend/src/components/payments/`)

- **PaymentForm.tsx**: Stripe Elements payment form
- **PaymentMethodSelector.tsx**: Saved payment methods selector
- **PaymentSuccess.tsx**: Success confirmation screen
- **PaymentError.tsx**: Error handling screen
- **PaymentModal.tsx**: Main payment modal orchestrator

#### 2. Integration Points

- **Staff Billing Page**: Added "Pay with Stripe" button on invoices
- **Patient Portal**: Online payment for invoices (ready to implement)

## Setup Instructions

### 1. Backend Configuration

#### Install Dependencies

```bash
cd hmis-backend
pip install stripe>=7.0.0
```

#### Environment Variables

Add to `.env`:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

#### Get Stripe Keys

1. Sign up at https://stripe.com
2. Navigate to Developers > API keys
3. Copy the test keys (use live keys in production)

#### Database Migration

Create and run migration for new Stripe models:

```bash
cd hmis-backend
alembic revision --autogenerate -m "Add Stripe payment models"
alembic upgrade head
```

### 2. Frontend Configuration

#### Install Dependencies

```bash
cd hmis-frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
```

#### Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

### 3. Stripe Dashboard Configuration

#### Enable Payment Methods

1. Go to Stripe Dashboard > Settings > Payment methods
2. Enable desired payment methods:
   - Cards (Visa, Mastercard, Amex, etc.)
   - Digital wallets (optional)
   - Bank debits (optional)

#### Configure Webhooks

1. Go to Developers > Webhooks
2. Click "Add endpoint"
3. Enter webhook URL: `https://your-domain.com/api/v1/payments/stripe/webhooks`
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `payment_method.attached`
   - `customer.created`
5. Copy the webhook signing secret and add to `.env`

#### Test Webhooks Locally

Use Stripe CLI for local testing:

```bash
# Install Stripe CLI
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8000/api/v1/payments/stripe/webhooks
```

## Usage Guide

### For Patients (Portal)

1. Navigate to "My Billing" section
2. View unpaid invoices
3. Click "Pay Now" on an invoice
4. Enter payment details using Stripe Elements
5. Optionally save payment method for future use
6. Complete payment with 3D Secure if required
7. Receive confirmation and receipt

### For Staff (Admin Dashboard)

1. Navigate to Billing module
2. Find invoice to process
3. Click "Pay with Stripe" button (blue credit card icon)
4. Payment modal opens with Stripe Elements
5. Process payment on behalf of patient
6. Payment is automatically recorded in system

### Payment Methods

Saved payment methods:

1. During payment, check "Save for future use"
2. Payment method is tokenized and stored securely
3. Next time, select saved method instead of entering details
4. Manage saved methods in profile settings

### Refunds

Staff can process refunds:

1. Navigate to invoice with successful payment
2. Click "Refund" option
3. Select full or partial refund
4. Enter reason for refund
5. Refund is processed through Stripe
6. Invoice status updated automatically

## Security & Compliance

### PCI DSS Compliance

- Payment card data never touches our servers
- Stripe Elements handles all sensitive data
- Tokenization ensures secure storage
- PCI SAQ-A compliance level

### 3D Secure (SCA)

- Automatic 3D Secure 2 authentication
- Handled transparently by Stripe
- Meets Strong Customer Authentication requirements
- Reduces fraud and chargebacks

### Data Protection

- Payment methods stored as tokens only
- No card numbers in database
- Stripe customer IDs linked to patients
- Encrypted communication (HTTPS/TLS)

## Testing

### Test Cards

Use these test cards in development:

**Successful Payment:**
- Card: 4242 4242 4242 4242
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

**3D Secure Required:**
- Card: 4000 0027 6000 3184

**Insufficient Funds:**
- Card: 4000 0000 0000 9995

**Card Declined:**
- Card: 4000 0000 0000 0002

More test cards: https://stripe.com/docs/testing

### Testing Webhooks

1. Use Stripe CLI to trigger test events:

```bash
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded
```

2. Monitor webhook logs in Stripe Dashboard

## Error Handling

### Common Errors

**Payment Failed:**
- Insufficient funds
- Card declined by bank
- Incorrect card details
- Expired card

**Authentication Failed:**
- 3D Secure challenge failed
- Customer cancelled authentication

**API Errors:**
- Invalid API key
- Rate limit exceeded
- Network timeout

### Error Messages

User-friendly error messages are displayed:
- "Insufficient funds" → "Your card has insufficient funds"
- "card_declined" → "Your card was declined by your bank"
- "expired_card" → "Your card has expired"

## Monitoring & Analytics

### Stripe Dashboard

Monitor payments in real-time:
- Payment volume and trends
- Success/failure rates
- Average transaction value
- Dispute and refund rates

### HMIS Analytics

Track payment metrics:
- Online payment adoption
- Average payment time
- Payment method preferences
- Failed payment reasons

## Production Checklist

Before going live:

- [ ] Replace test keys with live keys
- [ ] Configure live webhook endpoint
- [ ] Test in production-like environment
- [ ] Verify webhook signature validation
- [ ] Set up monitoring and alerting
- [ ] Review Stripe account settings
- [ ] Enable required payment methods
- [ ] Test payment flow end-to-end
- [ ] Verify receipt generation
- [ ] Test refund processing
- [ ] Check invoice status updates
- [ ] Review security settings
- [ ] Test with multiple currencies (if applicable)
- [ ] Verify accounting integration
- [ ] Train staff on payment processing

## Troubleshooting

### Webhooks Not Received

1. Check webhook endpoint is accessible
2. Verify webhook secret is correct
3. Check firewall allows Stripe IPs
4. Review webhook logs in Stripe Dashboard

### Payments Not Recorded

1. Check webhook handler is processing events
2. Verify database connection
3. Check logs for errors
4. Ensure invoice ID in metadata

### Payment Methods Not Saving

1. Verify `save_payment_method` flag is set
2. Check customer is created properly
3. Review payment intent setup_future_usage

### 3D Secure Issues

1. Ensure `return_url` is set correctly
2. Check browser allows popups
3. Test with different cards
4. Review Stripe logs for details

## API Examples

### Create Payment Intent

```bash
curl -X POST http://localhost:8000/api/v1/payments/stripe/payment-intents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_id": "uuid-here",
    "patient_id": "uuid-here",
    "amount": 100.00,
    "currency": "usd",
    "customer_email": "patient@example.com",
    "save_payment_method": true
  }'
```

### Create Refund

```bash
curl -X POST http://localhost:8000/api/v1/payments/stripe/refunds \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_intent_id": "pi_xxx",
    "amount": 50.00,
    "reason": "Customer requested refund"
  }'
```

## Support & Resources

- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
- Test Mode: https://stripe.com/docs/testing
- API Reference: https://stripe.com/docs/api

## Changelog

### Version 1.0.0 (2026-02-07)

- Initial Stripe integration
- Payment intent creation and confirmation
- Saved payment methods
- Webhook handling
- Refund processing
- Frontend payment components
- Staff and patient portal integration
