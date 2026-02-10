"""
Stripe Payment Gateway Integration for HMIS.
Handles payment processing, refunds, webhooks, and customer management.
PCI DSS compliant implementation using Stripe Elements.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)

# Configure Stripe API key
stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", None)


class StripePaymentService:
    """
    Stripe payment integration service.
    Handles payment intents, customers, payment methods, and webhooks.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self._validate_configuration()

    def _validate_configuration(self):
        """Validate Stripe configuration."""
        if not stripe.api_key:
            logger.warning(
                "Stripe API key not configured. Set STRIPE_SECRET_KEY in environment."
            )
            raise ValueError("Stripe API key not configured")

    async def create_payment_intent(
        self,
        amount: float,
        currency: str,
        invoice_id: uuid.UUID,
        patient_id: uuid.UUID,
        customer_email: str | None = None,
        customer_name: str | None = None,
        payment_method_id: str | None = None,
        save_payment_method: bool = False,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Create a Stripe Payment Intent for online payment.

        Args:
            amount: Amount in base currency (e.g., dollars, not cents)
            currency: ISO currency code (e.g., "usd", "dop")
            invoice_id: HMIS invoice ID
            patient_id: HMIS patient ID
            customer_email: Customer email for Stripe
            customer_name: Customer name
            payment_method_id: Existing payment method ID (optional)
            save_payment_method: Whether to save payment method for future use
            metadata: Additional metadata to attach

        Returns:
            dict with payment intent details including client_secret
        """
        try:
            # Convert amount to cents (Stripe requires smallest currency unit)
            amount_cents = int(amount * 100)

            # Find or create Stripe customer
            customer_id = None
            if customer_email or save_payment_method:
                customer_id = await self._get_or_create_customer(
                    patient_id=patient_id,
                    email=customer_email,
                    name=customer_name,
                )

            # Prepare payment intent data
            intent_data = {
                "amount": amount_cents,
                "currency": currency.lower(),
                "metadata": {
                    "invoice_id": str(invoice_id),
                    "patient_id": str(patient_id),
                    "hmis_system": "true",
                    **(metadata or {}),
                },
                "description": f"HMIS Invoice Payment - {invoice_id}",
            }

            # Add customer if available
            if customer_id:
                intent_data["customer"] = customer_id

            # Add payment method if provided
            if payment_method_id:
                intent_data["payment_method"] = payment_method_id
                intent_data["confirm"] = False  # Will confirm manually

            # Setup future usage if saving payment method
            if save_payment_method:
                intent_data["setup_future_usage"] = "off_session"

            # Enable automatic payment methods
            intent_data["automatic_payment_methods"] = {"enabled": True}

            # Create payment intent
            payment_intent = stripe.PaymentIntent.create(**intent_data)

            logger.info(
                f"Created Stripe Payment Intent {payment_intent.id} for invoice {invoice_id}"
            )

            return {
                "payment_intent_id": payment_intent.id,
                "client_secret": payment_intent.client_secret,
                "amount": amount,
                "currency": currency,
                "status": payment_intent.status,
                "customer_id": customer_id,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe API error: {str(e)}")
            raise ValueError(f"Payment processing error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error creating payment intent: {str(e)}")
            raise

    async def confirm_payment_intent(
        self, payment_intent_id: str, payment_method_id: str | None = None
    ) -> dict[str, Any]:
        """
        Confirm a payment intent.

        Args:
            payment_intent_id: Stripe payment intent ID
            payment_method_id: Payment method to use (optional)

        Returns:
            dict with confirmation status
        """
        try:
            confirm_data = {}
            if payment_method_id:
                confirm_data["payment_method"] = payment_method_id

            payment_intent = stripe.PaymentIntent.confirm(
                payment_intent_id, **confirm_data
            )

            return {
                "payment_intent_id": payment_intent.id,
                "status": payment_intent.status,
                "amount": payment_intent.amount / 100,  # Convert back to dollars
                "currency": payment_intent.currency,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe confirmation error: {str(e)}")
            raise ValueError(f"Payment confirmation error: {str(e)}")

    async def retrieve_payment_intent(self, payment_intent_id: str) -> dict[str, Any]:
        """Retrieve payment intent details."""
        try:
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)

            return {
                "payment_intent_id": payment_intent.id,
                "status": payment_intent.status,
                "amount": payment_intent.amount / 100,
                "currency": payment_intent.currency,
                "customer_id": payment_intent.customer,
                "payment_method": payment_intent.payment_method,
                "metadata": payment_intent.metadata,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe retrieval error: {str(e)}")
            raise ValueError(f"Payment retrieval error: {str(e)}")

    async def cancel_payment_intent(
        self, payment_intent_id: str, reason: str | None = None
    ) -> dict[str, Any]:
        """Cancel a payment intent."""
        try:
            cancel_data = {}
            if reason:
                cancel_data["cancellation_reason"] = reason

            payment_intent = stripe.PaymentIntent.cancel(
                payment_intent_id, **cancel_data
            )

            logger.info(f"Cancelled Stripe Payment Intent {payment_intent_id}")

            return {
                "payment_intent_id": payment_intent.id,
                "status": payment_intent.status,
                "cancelled": True,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe cancellation error: {str(e)}")
            raise ValueError(f"Payment cancellation error: {str(e)}")

    async def create_refund(
        self,
        payment_intent_id: str,
        amount: float | None = None,
        reason: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Create a refund for a successful payment.

        Args:
            payment_intent_id: Stripe payment intent ID
            amount: Amount to refund (None for full refund)
            reason: Refund reason
            metadata: Additional metadata

        Returns:
            dict with refund details
        """
        try:
            refund_data = {"payment_intent": payment_intent_id}

            if amount is not None:
                refund_data["amount"] = int(amount * 100)  # Convert to cents

            if reason:
                refund_data["reason"] = reason

            if metadata:
                refund_data["metadata"] = metadata

            refund = stripe.Refund.create(**refund_data)

            logger.info(
                f"Created Stripe Refund {refund.id} for payment intent {payment_intent_id}"
            )

            return {
                "refund_id": refund.id,
                "payment_intent_id": payment_intent_id,
                "amount": refund.amount / 100,
                "currency": refund.currency,
                "status": refund.status,
                "reason": refund.reason,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe refund error: {str(e)}")
            raise ValueError(f"Refund processing error: {str(e)}")

    async def _get_or_create_customer(
        self, patient_id: uuid.UUID, email: str | None = None, name: str | None = None
    ) -> str:
        """
        Get existing Stripe customer or create new one.

        Args:
            patient_id: HMIS patient ID
            email: Customer email
            name: Customer name

        Returns:
            Stripe customer ID
        """
        try:
            # First, check if customer already exists in our system
            # This would typically be stored in a StripeCustomer model
            # For now, we'll search by metadata
            if email:
                customers = stripe.Customer.list(email=email, limit=1)
                if customers.data:
                    customer = customers.data[0]
                    logger.info(
                        f"Found existing Stripe customer {customer.id} for email {email}"
                    )
                    return customer.id

            # Create new customer
            customer_data = {
                "metadata": {
                    "patient_id": str(patient_id),
                    "hmis_system": "true",
                }
            }

            if email:
                customer_data["email"] = email
            if name:
                customer_data["name"] = name

            customer = stripe.Customer.create(**customer_data)

            logger.info(
                f"Created new Stripe customer {customer.id} for patient {patient_id}"
            )

            return customer.id

        except stripe.error.StripeError as e:
            logger.error(f"Stripe customer error: {str(e)}")
            raise ValueError(f"Customer creation error: {str(e)}")

    async def list_customer_payment_methods(
        self, customer_id: str, type: str = "card"
    ) -> list[dict[str, Any]]:
        """
        List saved payment methods for a customer.

        Args:
            customer_id: Stripe customer ID
            type: Payment method type (card, us_bank_account, etc.)

        Returns:
            list of payment methods
        """
        try:
            payment_methods = stripe.PaymentMethod.list(
                customer=customer_id, type=type
            )

            return [
                {
                    "id": pm.id,
                    "type": pm.type,
                    "card": {
                        "brand": pm.card.brand,
                        "last4": pm.card.last4,
                        "exp_month": pm.card.exp_month,
                        "exp_year": pm.card.exp_year,
                    }
                    if pm.type == "card"
                    else None,
                    "created": datetime.fromtimestamp(pm.created, tz=timezone.utc),
                }
                for pm in payment_methods.data
            ]

        except stripe.error.StripeError as e:
            logger.error(f"Stripe payment methods error: {str(e)}")
            raise ValueError(f"Payment methods retrieval error: {str(e)}")

    async def detach_payment_method(self, payment_method_id: str) -> dict[str, Any]:
        """Detach (remove) a payment method from customer."""
        try:
            payment_method = stripe.PaymentMethod.detach(payment_method_id)

            logger.info(f"Detached payment method {payment_method_id}")

            return {
                "payment_method_id": payment_method.id,
                "detached": True,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe detach error: {str(e)}")
            raise ValueError(f"Payment method removal error: {str(e)}")

    async def handle_webhook_event(
        self, payload: bytes, signature: str
    ) -> dict[str, Any]:
        """
        Handle Stripe webhook events.

        Args:
            payload: Raw webhook payload
            signature: Stripe signature header

        Returns:
            dict with event processing result
        """
        webhook_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", None)
        if not webhook_secret:
            logger.error("Stripe webhook secret not configured")
            raise ValueError("Webhook secret not configured")

        try:
            # Verify webhook signature
            event = stripe.Webhook.construct_event(
                payload, signature, webhook_secret
            )

            logger.info(f"Received Stripe webhook event: {event['type']}")

            # Handle different event types
            event_type = event["type"]
            event_data = event["data"]["object"]

            result = {"event_type": event_type, "processed": False}

            if event_type == "payment_intent.succeeded":
                result.update(await self._handle_payment_succeeded(event_data))
            elif event_type == "payment_intent.payment_failed":
                result.update(await self._handle_payment_failed(event_data))
            elif event_type == "charge.refunded":
                result.update(await self._handle_refund(event_data))
            elif event_type == "payment_method.attached":
                result.update(await self._handle_payment_method_attached(event_data))
            elif event_type == "customer.created":
                result.update(await self._handle_customer_created(event_data))
            else:
                logger.info(f"Unhandled webhook event type: {event_type}")
                result["processed"] = True  # Mark as processed to acknowledge

            return result

        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid webhook signature: {str(e)}")
            raise ValueError("Invalid webhook signature")
        except Exception as e:
            logger.error(f"Webhook processing error: {str(e)}")
            raise

    async def _handle_payment_succeeded(self, payment_intent: dict) -> dict[str, Any]:
        """Handle successful payment webhook."""
        try:
            invoice_id = payment_intent["metadata"].get("invoice_id")
            if not invoice_id:
                logger.warning("Payment succeeded but no invoice_id in metadata")
                return {"processed": False, "reason": "No invoice_id"}

            # Record payment in HMIS billing system
            from app.modules.billing.models import Invoice, Payment
            from app.modules.billing.service import PaymentService
            from app.modules.billing.schemas import PaymentCreate

            # Get invoice
            stmt = select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
            result = await self.db.execute(stmt)
            invoice = result.scalar_one_or_none()

            if not invoice:
                logger.error(f"Invoice {invoice_id} not found for payment")
                return {"processed": False, "reason": "Invoice not found"}

            # Check if payment already recorded
            stmt = select(Payment).where(
                Payment.invoice_id == uuid.UUID(invoice_id),
                Payment.reference_number == payment_intent["id"],
            )
            result = await self.db.execute(stmt)
            existing_payment = result.scalar_one_or_none()

            if existing_payment:
                logger.info(f"Payment already recorded for invoice {invoice_id}")
                return {"processed": True, "reason": "Already recorded"}

            # Record payment
            payment_data = PaymentCreate(
                invoice_id=uuid.UUID(invoice_id),
                amount=payment_intent["amount"] / 100,  # Convert from cents
                payment_method="stripe_card",
                reference_number=payment_intent["id"],
                notes=f"Stripe payment - {payment_intent.get('payment_method')}",
            )

            payment_service = PaymentService(self.db)
            payment = await payment_service.record_payment(payment_data)
            await self.db.commit()

            logger.info(
                f"Recorded Stripe payment {payment.id} for invoice {invoice_id}"
            )

            return {
                "processed": True,
                "payment_id": str(payment.id),
                "invoice_id": invoice_id,
                "amount": float(payment.amount),
            }

        except Exception as e:
            logger.error(f"Error handling payment succeeded: {str(e)}")
            await self.db.rollback()
            return {"processed": False, "error": str(e)}

    async def _handle_payment_failed(self, payment_intent: dict) -> dict[str, Any]:
        """Handle failed payment webhook."""
        invoice_id = payment_intent["metadata"].get("invoice_id")
        logger.warning(
            f"Payment failed for invoice {invoice_id}: {payment_intent.get('last_payment_error', {}).get('message')}"
        )

        # TODO: Send notification to patient about failed payment
        # TODO: Update invoice status if needed

        return {
            "processed": True,
            "invoice_id": invoice_id,
            "reason": payment_intent.get("last_payment_error", {}).get("message"),
        }

    async def _handle_refund(self, charge: dict) -> dict[str, Any]:
        """Handle refund webhook."""
        payment_intent_id = charge.get("payment_intent")
        refund_amount = sum(r["amount"] for r in charge.get("refunds", {}).get("data", [])) / 100

        logger.info(
            f"Refund processed for payment intent {payment_intent_id}: {refund_amount}"
        )

        # TODO: Record refund in HMIS system
        # TODO: Update invoice status

        return {
            "processed": True,
            "payment_intent_id": payment_intent_id,
            "refund_amount": refund_amount,
        }

    async def _handle_payment_method_attached(
        self, payment_method: dict
    ) -> dict[str, Any]:
        """Handle payment method attached webhook."""
        customer_id = payment_method.get("customer")
        logger.info(
            f"Payment method {payment_method['id']} attached to customer {customer_id}"
        )

        return {"processed": True, "customer_id": customer_id}

    async def _handle_customer_created(self, customer: dict) -> dict[str, Any]:
        """Handle customer created webhook."""
        logger.info(f"Stripe customer created: {customer['id']}")

        # TODO: Store customer ID in HMIS system if needed

        return {"processed": True, "customer_id": customer["id"]}

    async def get_payment_receipt(self, payment_intent_id: str) -> dict[str, Any]:
        """
        Get payment receipt data.

        Args:
            payment_intent_id: Stripe payment intent ID

        Returns:
            dict with receipt information
        """
        try:
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)

            # Get charge for receipt URL
            charge_id = None
            receipt_url = None
            if payment_intent.charges and payment_intent.charges.data:
                charge = payment_intent.charges.data[0]
                charge_id = charge.id
                receipt_url = charge.receipt_url

            return {
                "payment_intent_id": payment_intent.id,
                "charge_id": charge_id,
                "receipt_url": receipt_url,
                "amount": payment_intent.amount / 100,
                "currency": payment_intent.currency,
                "status": payment_intent.status,
                "created": datetime.fromtimestamp(
                    payment_intent.created, tz=timezone.utc
                ),
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe receipt error: {str(e)}")
            raise ValueError(f"Receipt retrieval error: {str(e)}")
