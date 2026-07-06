import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// FanBasis signs each webhook with HMAC-SHA256 of the raw body using the
// subscription's secret_key (returned when the subscription is created and by
// GET /public-api/webhook-subscriptions). We store that as a SERVER-ONLY env
// var — never NEXT_PUBLIC, so it can never reach the browser / public repo.
const webhookSecret = process.env.FANBASIS_WEBHOOK_SECRET;

export async function POST(request) {
  const body = await request.text();
  const sig = headers().get('x-webhook-signature');

  // Verify signature when the secret is configured. During initial rollout the
  // secret may not be set yet; we accept + log so no real payment is dropped,
  // then lock this down the moment FANBASIS_WEBHOOK_SECRET is in Vercel.
  if (webhookSecret) {
    const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
    const provided = (sig || '').replace(/^sha256=/, '');
    const ok = provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!ok) {
      console.error('FanBasis webhook signature mismatch');
      return new Response('Invalid signature', { status: 400 });
    }
  } else {
    console.warn('FANBASIS_WEBHOOK_SECRET not set — accepting webhook without verification');
  }

  let event;
  try {
    event = JSON.parse(body);
  } catch (err) {
    return new Response(`Bad JSON: ${err.message}`, { status: 400 });
  }

  // FanBasis nests everything under `data` on the real payload (the flat sample
  // in the docs was misleading). Be defensive about both shapes.
  const d = event.data || event;
  const eventType = event.event_type || event.type || '';

  try {
    if (eventType === 'payment.succeeded' || eventType === 'payment.completed') {
      await savePayment(mapPayment(d, eventType, 'succeeded'));
    } else if (eventType === 'payment.refunded' || eventType === 'refund.succeeded') {
      const row = mapPayment(d, eventType, 'refunded');
      row.stripe_payment_id = `fb_refund_${paymentId(d)}`;
      row.amount = -Math.abs(row.amount);
      row.payment_type = 'refund';
      await savePayment(row);
    } else {
      console.log(`Unhandled FanBasis event: ${eventType}`);
    }
  } catch (err) {
    console.error('Error processing FanBasis webhook:', err);
    return new Response(`Processing Error: ${err.message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function paymentId(d) {
  return d.payment_id || d.transaction_id || d.id || '';
}

// Map a FanBasis payload onto our shared payments table columns. Amount is
// stored in dollars: prefer total_price (already dollars), else amount is cents.
function mapPayment(d, eventType, status) {
  const buyer = d.buyer || {};
  let amount = 0;
  if (d.total_price != null) amount = parseFloat(d.total_price) || 0;
  else if (d.amount != null) amount = (parseFloat(d.amount) || 0) / 100;

  const item = d.item || {};
  return {
    processor: 'fanbasis',
    stripe_payment_id: `fb_${paymentId(d)}`,
    stripe_customer_id: buyer.id ? String(buyer.id) : null,
    customer_name: buyer.name || d.customer_name || '',
    customer_email: (buyer.email || d.customer_email || '').toLowerCase().trim(),
    amount,
    currency: (d.currency || 'usd').toUpperCase(),
    payment_type: 'one_time',
    plan_name: item.title || d.plan_name || '',
    status,
    stripe_event: eventType,
    metadata: d.api_metadata || d.metadata || {},
  };
}

// Upsert on stripe_payment_id to avoid duplicates if FanBasis retries delivery.
async function savePayment(payment) {
  const { error } = await supabase
    .from('stripe_payments')
    .upsert(payment, { onConflict: 'stripe_payment_id' });
  if (error) {
    console.error('Supabase insert error (fanbasis):', error);
    throw error;
  }
}
