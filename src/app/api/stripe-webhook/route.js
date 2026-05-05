import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request) {
  const body = await request.text();
  const sig = headers().get('stripe-signature');

  let event;

  // Verify webhook signature
  try {
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } else {
      // Fallback for development — parse without verification
      event = JSON.parse(body);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      // One-time payments via Checkout
      // NOTE: For subscription mode, we skip this event entirely — the first
      // payment is captured by `invoice.payment_succeeded` (with
      // billing_reason === 'subscription_create' marking it as the first).
      // Recording both events caused duplicate rows since the IDs differ
      // (cs_live_... vs pi_...) so upsert can't dedupe them.
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription') {
          // Subscriptions are handled by invoice.payment_succeeded
          break;
        }
        if (session.payment_status === 'paid') {
          await savePayment({
            stripe_payment_id: session.payment_intent || session.id,
            stripe_customer_id: session.customer,
            customer_name: session.customer_details?.name || '',
            customer_email: session.customer_details?.email || '',
            amount: (session.amount_total || 0) / 100,
            currency: (session.currency || 'usd').toUpperCase(),
            payment_type: 'one_time',
            plan_name: await getProductName(session),
            status: 'succeeded',
            stripe_event: event.type,
            metadata: session.metadata || {},
          });
        }
        break;
      }

      // Recurring subscription payments
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        // Skip the first invoice if we already captured it via checkout.session.completed
        // Only skip if it's the first invoice of a new subscription
        const isFirstInvoice = invoice.billing_reason === 'subscription_create';
        
        await savePayment({
          stripe_payment_id: invoice.payment_intent || invoice.id,
          stripe_customer_id: invoice.customer,
          customer_name: invoice.customer_name || '',
          customer_email: invoice.customer_email || '',
          amount: (invoice.amount_paid || 0) / 100,
          currency: (invoice.currency || 'usd').toUpperCase(),
          payment_type: 'recurring',
          plan_name: invoice.lines?.data?.[0]?.description || '',
          status: 'succeeded',
          stripe_event: event.type,
          is_first_payment: isFirstInvoice,
          metadata: invoice.metadata || {},
        });
        break;
      }

      // Direct charges (if not using Checkout)
      case 'charge.succeeded': {
        const charge = event.data.object;
        // Only process if not already captured by checkout or invoice events
        if (!charge.invoice) {
          await savePayment({
            stripe_payment_id: charge.payment_intent || charge.id,
            stripe_customer_id: charge.customer,
            customer_name: charge.billing_details?.name || '',
            customer_email: charge.billing_details?.email || '',
            amount: (charge.amount || 0) / 100,
            currency: (charge.currency || 'usd').toUpperCase(),
            payment_type: 'one_time',
            plan_name: charge.description || '',
            status: 'succeeded',
            stripe_event: event.type,
            metadata: charge.metadata || {},
          });
        }
        break;
      }

      // Payment failures
      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object;
        await savePayment({
          stripe_payment_id: failedInvoice.payment_intent || failedInvoice.id,
          stripe_customer_id: failedInvoice.customer,
          customer_name: failedInvoice.customer_name || '',
          customer_email: failedInvoice.customer_email || '',
          amount: (failedInvoice.amount_due || 0) / 100,
          currency: (failedInvoice.currency || 'usd').toUpperCase(),
          payment_type: 'recurring',
          plan_name: failedInvoice.lines?.data?.[0]?.description || '',
          status: 'failed',
          stripe_event: event.type,
          metadata: failedInvoice.metadata || {},
        });
        break;
      }

      // Refunds
      case 'charge.refunded': {
        const refund = event.data.object;
        await savePayment({
          stripe_payment_id: `refund_${refund.id}`,
          stripe_customer_id: refund.customer,
          customer_name: refund.billing_details?.name || '',
          customer_email: refund.billing_details?.email || '',
          amount: -((refund.amount_refunded || 0) / 100),
          currency: (refund.currency || 'usd').toUpperCase(),
          payment_type: 'refund',
          plan_name: 'Refund',
          status: 'refunded',
          stripe_event: event.type,
          metadata: refund.metadata || {},
        });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('Error processing webhook:', err);
    return new Response(`Processing Error: ${err.message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Save payment to Supabase — upsert to avoid duplicates
async function savePayment(payment) {
  const { error } = await supabase
    .from('stripe_payments')
    .upsert(payment, { onConflict: 'stripe_payment_id' });

  if (error) {
    console.error('Supabase insert error:', error);
    throw error;
  }
}

// Try to get the product/plan name from a checkout session
async function getProductName(session) {
  try {
    if (session.line_items) {
      return session.line_items.data?.[0]?.description || '';
    }
    // Fetch line items if not expanded
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    return lineItems.data?.[0]?.description || '';
  } catch {
    return '';
  }
}
