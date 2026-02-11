"""
Stripe Payment Gateway Routes for HMIS.
Handles online payments, payment methods, refunds, and webhooks.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user, require_permissions
from app.modules.auth.models import User
from app.modules.billing.models import Invoice, StripeCustomer, StripePaymentIntent
from app.modules.billing.schemas import (
    StripeCustomerResponse,
    StripePaymentConfirm,
    StripePaymentIntentCreate,
    StripePaymentIntentResponse,
    StripePaymentIntentStatus,
    StripePaymentMethodResponse,
    StripeReceiptResponse,
    StripeRefundCreate,
    StripeRefundResponse,
    StripeWebhookEvent,
)
from app.integrations.payments.stripe_service import StripePaymentService

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================
# Payment Intents
# =============================================


@router.post(
    "/stripe/payment-intents",
    response_model=StripePaymentIntentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_payment_intent(
    data: StripePaymentIntentCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a Stripe Payment Intent for invoice payment.
    Returns client_secret for frontend Stripe Elements integration.
    """
    try:
        # Verify invoice exists and is unpaid
        stmt = select(Invoice).where(
            Invoice.id == data.invoice_id, Invoice.is_active == True
        )
        result = await db.execute(stmt)
        invoice = result.scalar_one_or_none()

        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        if invoice.status == "paid":
            raise HTTPException(status_code=400, detail="Invoice already paid")

        # Verify amount matches invoice total
        if abs(float(invoice.grand_total) - data.amount) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Payment amount ({data.amount}) does not match invoice total ({invoice.grand_total})",
            )

        # Create payment intent
        stripe_service = StripePaymentService(db)
        intent_data = await stripe_service.create_payment_intent(
            amount=data.amount,
            currency=data.currency,
            invoice_id=data.invoice_id,
            patient_id=data.patient_id,
            customer_email=data.customer_email,
            customer_name=data.customer_name,
            payment_method_id=data.payment_method_id,
            save_payment_method=data.save_payment_method,
            metadata=data.metadata,
        )

        # Store payment intent in database
        payment_intent_record = StripePaymentIntent(
            invoice_id=data.invoice_id,
            patient_id=data.patient_id,
            stripe_payment_intent_id=intent_data["payment_intent_id"],
            stripe_customer_id=intent_data.get("customer_id"),
            amount=data.amount,
            currency=data.currency,
            status=intent_data["status"],
            client_secret=intent_data["client_secret"],
            created_by=current_user.id,
        )
        db.add(payment_intent_record)
        await db.commit()

        logger.info(
            f"Created payment intent {intent_data['payment_intent_id']} for invoice {data.invoice_id}"
        )

        return StripePaymentIntentResponse(**intent_data)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating payment intent: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create payment intent")


@router.post("/stripe/payment-intents/{payment_intent_id}/confirm")
async def confirm_payment_intent(
    payment_intent_id: str,
    data: StripePaymentConfirm,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually confirm a payment intent.
    Typically handled by Stripe Elements on frontend.
    """
    try:
        stripe_service = StripePaymentService(db)
        result = await stripe_service.confirm_payment_intent(
            payment_intent_id=payment_intent_id,
            payment_method_id=data.payment_method_id,
        )

        # Update database record
        stmt = select(StripePaymentIntent).where(
            StripePaymentIntent.stripe_payment_intent_id == payment_intent_id
        )
        db_result = await db.execute(stmt)
        record = db_result.scalar_one_or_none()

        if record:
            record.status = result["status"]
            await db.commit()

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/stripe/payment-intents/{payment_intent_id}",
    response_model=StripePaymentIntentStatus,
)
async def get_payment_intent_status(
    payment_intent_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get payment intent status and details."""
    try:
        stripe_service = StripePaymentService(db)
        result = await stripe_service.retrieve_payment_intent(payment_intent_id)

        return StripePaymentIntentStatus(**result)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/stripe/payment-intents/{payment_intent_id}/cancel")
async def cancel_payment_intent(
    payment_intent_id: str,
    current_user: User = Depends(require_permissions("billing:write")),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a payment intent."""
    try:
        stripe_service = StripePaymentService(db)
        result = await stripe_service.cancel_payment_intent(
            payment_intent_id=payment_intent_id, reason="requested_by_customer"
        )

        # Update database record
        stmt = select(StripePaymentIntent).where(
            StripePaymentIntent.stripe_payment_intent_id == payment_intent_id
        )
        db_result = await db.execute(stmt)
        record = db_result.scalar_one_or_none()

        if record:
            record.status = "canceled"
            await db.commit()

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================
# Refunds
# =============================================


@router.post("/stripe/refunds", response_model=StripeRefundResponse)
async def create_refund(
    data: StripeRefundCreate,
    current_user: User = Depends(require_permissions("billing:write")),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a refund for a successful payment.
    Can be full or partial refund.
    """
    try:
        stripe_service = StripePaymentService(db)
        result = await stripe_service.create_refund(
            payment_intent_id=data.payment_intent_id,
            amount=data.amount,
            reason=data.reason,
            metadata=data.metadata,
        )

        # TODO: Record refund in database and update invoice status

        logger.info(
            f"Created refund {result['refund_id']} for payment {data.payment_intent_id}"
        )

        return StripeRefundResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================
# Customer & Payment Methods
# =============================================


@router.get(
    "/stripe/customers/patient/{patient_id}",
    response_model=StripeCustomerResponse | None,
)
async def get_customer_by_patient(
    patient_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get Stripe customer info for a patient."""
    try:
        # Get customer from database
        stmt = select(StripeCustomer).where(
            StripeCustomer.patient_id == patient_id, StripeCustomer.is_active == True
        )
        result = await db.execute(stmt)
        customer = result.scalar_one_or_none()

        if not customer:
            return None

        # Get payment methods from Stripe
        stripe_service = StripePaymentService(db)
        payment_methods = await stripe_service.list_customer_payment_methods(
            customer.stripe_customer_id
        )

        return StripeCustomerResponse(
            patient_id=customer.patient_id,
            stripe_customer_id=customer.stripe_customer_id,
            email=customer.email,
            name=customer.name,
            default_payment_method=customer.default_payment_method,
            payment_methods=[
                StripePaymentMethodResponse(**pm) for pm in payment_methods
            ],
        )

    except Exception as e:
        logger.error(f"Error getting customer: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve customer")


@router.get(
    "/stripe/customers/{customer_id}/payment-methods",
    response_model=list[StripePaymentMethodResponse],
)
async def list_payment_methods(
    customer_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List saved payment methods for a customer."""
    try:
        stripe_service = StripePaymentService(db)
        payment_methods = await stripe_service.list_customer_payment_methods(
            customer_id
        )

        return [StripePaymentMethodResponse(**pm) for pm in payment_methods]

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/stripe/payment-methods/{payment_method_id}")
async def detach_payment_method(
    payment_method_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a saved payment method."""
    try:
        stripe_service = StripePaymentService(db)
        result = await stripe_service.detach_payment_method(payment_method_id)

        return {"message": "Payment method removed successfully", **result}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================
# Receipts
# =============================================


@router.get(
    "/stripe/payment-intents/{payment_intent_id}/receipt",
    response_model=StripeReceiptResponse,
)
async def get_payment_receipt(
    payment_intent_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get payment receipt with Stripe receipt URL."""
    try:
        stripe_service = StripePaymentService(db)
        result = await stripe_service.get_payment_receipt(payment_intent_id)

        return StripeReceiptResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# =============================================
# Webhooks
# =============================================


@router.post("/stripe/webhooks", response_model=StripeWebhookEvent)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Stripe webhook endpoint.
    Handles payment lifecycle events: succeeded, failed, refunded, etc.

    IMPORTANT: This endpoint should be publicly accessible (no auth).
    Configure this URL in Stripe Dashboard: https://dashboard.stripe.com/webhooks
    """
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    try:
        # Get raw body
        payload = await request.body()

        # Process webhook
        stripe_service = StripePaymentService(db)
        result = await stripe_service.handle_webhook_event(payload, stripe_signature)

        logger.info(f"Processed Stripe webhook: {result['event_type']}")

        return StripeWebhookEvent(**result)

    except ValueError as e:
        logger.error(f"Webhook validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")
