# Stripe Integration - Quick Start Guide

Get up and running with Stripe payments in 15 minutes.

## Prerequisites

- HMIS backend running
- HMIS frontend running
- Stripe account (sign up at https://stripe.com)

## Step 1: Get Stripe Keys (2 minutes)

1. Log in to Stripe Dashboard: https://dashboard.stripe.com
2. Go to **Developers > API keys**
3. Copy your test keys:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

## Step 2: Backend Setup (5 minutes)

### 1. Install Stripe Package

```bash
cd hmis-backend
pip install stripe>=7.0.0
```

### 2. Add Environment Variables

Edit `hmis-backend/.env`:

```env
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET  # We'll set this later
```

### 3. Run Database Migration

```bash
cd hmis-backend
alembic upgrade head
```

This creates the Stripe tables:
- `stripe_customers`
- `stripe_payment_methods`
- `stripe_payment_intents`
- `stripe_refunds`

### 4. Restart Backend

```bash
uvicorn app.main:app --reload
```

## Step 3: Frontend Setup (3 minutes)

### 1. Install Stripe Packages

```bash
cd hmis-frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 2. Add Environment Variable

Create or edit `hmis-frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
```

### 3. Restart Frontend

```bash
npm run dev
```

## Step 4: Test Payment (5 minutes)

### 1. Create Test Invoice

1. Log in to HMIS staff portal
2. Go to **Billing** module
3. Create a test invoice for a patient
4. Save the invoice

### 2. Process Test Payment

1. Find the invoice in the list
2. Click the **blue credit card icon** (Pay with Stripe)
3. Payment modal opens
4. Use test card: **4242 4242 4242 4242**
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
   - ZIP: Any 5 digits (e.g., 12345)
5. Click **Pay**
6. Success! Invoice is marked as paid

### 3. Verify in Stripe Dashboard

1. Go to Stripe Dashboard > **Payments**
2. You should see the test payment
3. Status: **Succeeded**

## Step 5: Setup Webhooks (Optional, 5 minutes)

Webhooks automatically update invoice status when payments complete.

### For Local Development

Use Stripe CLI:

```bash
# Install Stripe CLI (one-time)
# Download from: https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8000/api/v1/payments/stripe/webhooks
```

Copy the webhook signing secret and add to `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### For Production

1. Go to Stripe Dashboard > **Developers > Webhooks**
2. Click **Add endpoint**
3. Enter URL: `https://your-domain.com/api/v1/payments/stripe/webhooks`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Copy webhook signing secret to `.env`

## Test Cards Reference

### Successful Payment
```
Card: 4242 4242 4242 4242
Any future expiry, any CVC, any ZIP
```

### 3D Secure Authentication Required
```
Card: 4000 0027 6000 3184
Complete authentication popup
```

### Payment Declined
```
Card: 4000 0000 0000 0002
Simulates card declined by bank
```

### Insufficient Funds
```
Card: 4000 0000 0000 9995
Simulates insufficient funds
```

More test cards: https://stripe.com/docs/testing

## Troubleshooting

### "Stripe API key not configured"
- Check `.env` file has `STRIPE_SECRET_KEY`
- Restart backend after adding key
- Verify key starts with `sk_test_`

### Payment modal doesn't open
- Check browser console for errors
- Verify `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set
- Make sure it starts with `pk_test_`
- Restart frontend after adding key

### Payment succeeds but invoice not updated
- Set up webhooks (see Step 5)
- Check backend logs for webhook errors
- Verify webhook secret is correct

### Frontend can't connect to backend
- Verify backend is running on http://localhost:8000
- Check `NEXT_PUBLIC_API_URL` in frontend `.env.local`
- Check CORS settings in backend

## What's Next?

### Enable More Payment Features

1. **Saved Payment Methods**: Already enabled! Customers can save cards for future payments
2. **Refunds**: Use the refund button in billing module
3. **Payment History**: View in invoice details
4. **Receipts**: Download from Stripe or generate PDF

### Go Live Checklist

When ready for production:

1. Switch to live Stripe keys (starts with `pk_live_` and `sk_live_`)
2. Configure production webhook endpoint
3. Test thoroughly in production
4. Enable desired payment methods in Stripe Dashboard
5. Review security settings
6. Set up monitoring and alerts

## Support

- Full documentation: See `STRIPE_INTEGRATION.md`
- Stripe docs: https://stripe.com/docs
- Stripe support: https://support.stripe.com

## Features Included

✅ Payment processing with Stripe Elements
✅ Saved payment methods
✅ 3D Secure authentication
✅ Webhook integration
✅ Refund processing
✅ Payment receipts
✅ Customer management
✅ PCI DSS compliant
✅ Multi-currency support
✅ Automatic invoice updates
✅ Payment history tracking

**You're all set! Start processing payments securely with Stripe.**
