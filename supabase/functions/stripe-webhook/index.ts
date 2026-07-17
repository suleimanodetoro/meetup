// supabase/functions/stripe-webhook/index.ts
//
// Webhook endpoint that Stripe calls whenever a web (Stripe Checkout)
// purchase changes state. Mirrors Stripe's state into
// public.user_subscriptions — the SAME table the RevenueCat webhook writes —
// so web purchases unlock the exact same entitlements the mobile app grants
// via RevenueCat, gated off a single Postgres row through the existing
// useSubscription hook + realtime subscription.
//
// This is the sibling of revenuecat-webhook/index.ts and deliberately mirrors
// its conventions: service_role client (bypasses RLS to write rows on behalf
// of arbitrary users), text/timestamptz column shapes, fail-closed auth, and
// 200/4xx/5xx response semantics (5xx makes Stripe retry, 2xx acks).
//
// Configuration (Stripe dashboard -> Developers -> Webhooks):
//
//   URL:    https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//   Events: checkout.session.completed
//           checkout.session.async_payment_succeeded
//           checkout.session.async_payment_failed
//           customer.subscription.created
//           customer.subscription.updated
//           customer.subscription.deleted
//           charge.refunded
//
// The site creates Checkout Sessions with:
//   client_reference_id = <supabase user uuid>
//   metadata            = { supabase_uid, entitlement: 'premium' | 'founder' }
//   subscription_data.metadata = { supabase_uid, entitlement: 'premium' }  (sub mode)
// Premium = recurring subscription. Founder = one-time `mode: 'payment'`
// lifetime purchase.
//
// See ./README.md for the deploy + secrets checklist.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
// Optional: only used to satisfy the Stripe SDK constructor (which refuses an
// empty api key) and for any future expanded-object API lookups. Signature
// verification does NOT need it — it uses STRIPE_WEBHOOK_SECRET only. We make
// no outbound Stripe API calls in this handler, so an unset key is fine.
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// `?target=deno` gives us a fetch-based build; createFetchHttpClient avoids the
// Node http shim. We never call the API here, but the client is required to
// reach `stripe.webhooks.constructEventAsync`. The api key placeholder is only
// hit on outbound calls, which this function never makes.
const stripe = new Stripe(STRIPE_SECRET_KEY ?? 'sk_unset_signature_verification_only', {
  httpClient: Stripe.createFetchHttpClient(),
});

// SubtleCrypto-backed provider. The synchronous constructEvent uses Node's
// crypto and throws in the edge runtime; constructEventAsync + this provider is
// the supported path on Deno.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

type SubRow = {
  subscription_type: string | null;
  entitlement_id: string | null;
  original_transaction_id: string | null;
  expires_at: string | null;
  started_at: string | null;
};

const nowIso = () => new Date().toISOString();

async function getRow(userId: string): Promise<SubRow | null> {
  const { data, error } = await admin
    .from('user_subscriptions')
    .select('subscription_type, entitlement_id, original_transaction_id, expires_at, started_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as SubRow | null;
}

/** Founder is a lifetime entitlement; a premium event must never clobber it. */
function isFounderRow(row: SubRow | null): boolean {
  return row?.subscription_type === 'founder' || row?.entitlement_id === 'founder';
}

/**
 * Best-effort persistence of the Stripe customer id so the site's billing
 * portal flow can map supabase_uid -> customer. Entitlement logic NEVER depends
 * on this. The column is added by
 * 20260705000000_add_stripe_customer_id_to_user_subscriptions.sql; if that
 * migration hasn't been applied the write fails harmlessly and is ignored.
 */
async function storeStripeCustomerId(userId: string, customerId: string | null) {
  if (!customerId) return;
  try {
    const { error } = await admin
      .from('user_subscriptions')
      .update({ stripe_customer_id: customerId })
      .eq('user_id', userId);
    if (error) {
      console.warn(
        '[stripe-webhook] could not store stripe_customer_id (safe to ignore until the migration is applied):',
        error.message
      );
    }
  } catch (err) {
    console.warn('[stripe-webhook] stripe_customer_id write threw (ignored):', err);
  }
}

/** Grant the founder lifetime entitlement. Founder always wins over premium. */
async function grantFounder(
  userId: string,
  paymentIntentId: string | null,
  startedAtIso: string | null,
  founderYear: number,
  customerId: string | null
) {
  const patch: Record<string, unknown> = {
    user_id: userId,
    subscription_type: 'founder',
    entitlement_id: 'founder',
    provider: 'stripe',
    original_transaction_id: paymentIntentId,
    expires_at: null, // lifetime
    updated_at: nowIso(),
  };
  if (startedAtIso) patch.started_at = startedAtIso;

  const { error } = await admin
    .from('user_subscriptions')
    .upsert(patch, { onConflict: 'user_id' });
  if (error) throw error;

  const { error: profileError } = await admin
    .from('profiles')
    .update({ is_founder: true, founder_year: founderYear, updated_at: nowIso() })
    .eq('id', userId);
  if (profileError) throw profileError;

  await storeStripeCustomerId(userId, customerId);
}

/**
 * Grant / renew the premium entitlement for an active|trialing|past_due
 * subscription. Guards:
 *   - never downgrade an existing founder-lifetime row,
 *   - never regress expires_at for the same subscription (out-of-order events).
 */
async function grantPremium(
  userId: string,
  subscriptionId: string,
  periodEndIso: string | null,
  startedAtIso: string | null,
  customerId: string | null
) {
  const row = await getRow(userId);
  if (isFounderRow(row)) {
    // Founder supersedes premium — leave the lifetime row untouched.
    await storeStripeCustomerId(userId, customerId);
    return;
  }

  // Out-of-order protection: if a stale "active" event for this same
  // subscription arrives with an earlier period end than what we already
  // recorded, keep the later expiry so entitlement never shrinks spuriously.
  let expiresAt = periodEndIso;
  if (
    row?.entitlement_id === 'premium' &&
    row.original_transaction_id === subscriptionId &&
    row.expires_at &&
    periodEndIso &&
    new Date(row.expires_at) > new Date(periodEndIso)
  ) {
    expiresAt = row.expires_at;
  }

  const patch: Record<string, unknown> = {
    user_id: userId,
    subscription_type: 'premium',
    entitlement_id: 'premium',
    provider: 'stripe',
    original_transaction_id: subscriptionId,
    expires_at: expiresAt,
    updated_at: nowIso(),
  };
  // Only stamp started_at when the subscription is first created and the row
  // doesn't already carry a meaningful start; otherwise leave the existing one.
  if (startedAtIso) patch.started_at = startedAtIso;

  const { error } = await admin
    .from('user_subscriptions')
    .upsert(patch, { onConflict: 'user_id' });
  if (error) throw error;

  await storeStripeCustomerId(userId, customerId);
}

/**
 * Expire premium (cancel / unpaid / deleted). Guards:
 *   - never clobber a founder-lifetime row,
 *   - never let an OLD subscription's expiry event kill a NEWER active row
 *     (compare original_transaction_id).
 */
async function expirePremium(userId: string, subscriptionId: string | null) {
  const row = await getRow(userId);
  if (!row) return;
  if (isFounderRow(row)) return; // founder is lifetime; ignore premium expiry
  if (row.entitlement_id !== 'premium') return; // already free / nothing to do
  if (
    subscriptionId &&
    row.original_transaction_id &&
    row.original_transaction_id !== subscriptionId
  ) {
    // The active row belongs to a different (newer) subscription than the one
    // this expiry event is about — out of order / superseded. Leave it.
    console.log('[stripe-webhook] skipping expiry for superseded subscription', subscriptionId);
    return;
  }

  const { error } = await admin
    .from('user_subscriptions')
    .update({
      subscription_type: 'free',
      entitlement_id: null,
      expires_at: null,
      original_transaction_id: null,
      provider: null,
      updated_at: nowIso(),
    })
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Revoke the entitlement created by a specific Stripe transaction (refund /
 * async payment failure). Unlike expirePremium this is allowed to clear a
 * founder row, because it is explicitly targeted at the exact transaction that
 * granted it (matched by original_transaction_id), i.e. the founder purchase
 * itself was refunded.
 */
async function revokeByTransaction(userId: string, wasFounder: boolean) {
  const { error } = await admin
    .from('user_subscriptions')
    .update({
      subscription_type: 'free',
      entitlement_id: null,
      expires_at: null,
      original_transaction_id: null,
      provider: null,
      updated_at: nowIso(),
    })
    .eq('user_id', userId);
  if (error) throw error;

  if (wasFounder) {
    const { error: profileError } = await admin
      .from('profiles')
      .update({ is_founder: false, founder_year: null, updated_at: nowIso() })
      .eq('id', userId);
    if (profileError) throw profileError;
  }
}

/** Find the subscription row whose transaction id matches a Stripe id. */
async function findRowByTransaction(transactionId: string) {
  const { data, error } = await admin
    .from('user_subscriptions')
    .select('user_id, subscription_type, entitlement_id')
    .eq('original_transaction_id', transactionId)
    .maybeSingle();
  if (error) throw error;
  return data as
    | { user_id: string; subscription_type: string | null; entitlement_id: string | null }
    | null;
}

const asId = (v: string | { id: string } | null | undefined): string | null =>
  typeof v === 'string' ? v : v?.id ?? null;

/**
 * current_period_end moved from the subscription onto the subscription item in
 * the 2025-03-31 "basil" API version. Read whichever the event carries.
 */
function getPeriodEndUnix(sub: Stripe.Subscription): number | null {
  const anySub = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  if (typeof anySub.current_period_end === 'number') return anySub.current_period_end;
  const item = anySub.items?.data?.[0];
  if (item && typeof item.current_period_end === 'number') return item.current_period_end;
  return null;
}

const unixToIso = (secs: number | null | undefined): string | null =>
  typeof secs === 'number' ? new Date(secs * 1000).toISOString() : null;

async function handleSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.supabase_uid ?? null;
  if (!userId) {
    console.warn('[stripe-webhook] subscription has no supabase_uid metadata:', sub.id);
    return;
  }
  const customerId = asId(sub.customer as string | { id: string });
  const periodEndIso = unixToIso(getPeriodEndUnix(sub));
  if (periodEndIso === null) {
    console.warn('[stripe-webhook] no current_period_end on subscription:', sub.id, sub.status);
  }
  const startedAtIso =
    unixToIso((sub as unknown as { start_date?: number }).start_date) ?? unixToIso(sub.created);

  const entitledStatuses = ['active', 'trialing', 'past_due'];
  const expireStatuses = ['canceled', 'unpaid', 'incomplete_expired'];

  if (entitledStatuses.includes(sub.status)) {
    // active/trialing entitled; past_due stays entitled until period end (the
    // hook's own `expires_at > now` check locks them out when it lapses).
    await grantPremium(userId, sub.id, periodEndIso, startedAtIso, customerId);
  } else if (expireStatuses.includes(sub.status)) {
    await expirePremium(userId, sub.id);
  } else {
    // 'incomplete' (first payment not settled) / 'paused': don't grant, but
    // don't clobber an existing row either. Still persist the customer link.
    console.log('[stripe-webhook] subscription status not actioned:', sub.status, sub.id);
    await storeStripeCustomerId(userId, customerId);
  }
}

serve(async (req) => {
  // Fail closed: without the signing secret we cannot verify authenticity, so
  // refuse everything (mirrors revenuecat-webhook's unset-auth 503).
  if (!STRIPE_WEBHOOK_SECRET) {
    return new Response('webhook not configured', { status: 503 });
  }
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('missing stripe-signature', { status: 400 });
  }

  // Raw body required for HMAC verification — do not JSON.parse before this.
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', (err as Error).message);
    return new Response('invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_uid ?? session.client_reference_id ?? null;
        const entitlement = session.metadata?.entitlement;
        const customerId = asId(session.customer as string | { id: string } | null);

        if (!userId) {
          console.warn('[stripe-webhook] checkout session missing supabase uid:', session.id);
          break;
        }

        if (session.mode === 'payment' && entitlement === 'founder') {
          // One-time founder lifetime purchase. Only grant once the payment
          // has actually settled; async (delayed) methods land via
          // async_payment_succeeded above.
          if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
            console.log('[stripe-webhook] founder session not yet paid, waiting:', session.id);
            break;
          }
          const paymentIntentId = asId(session.payment_intent as string | { id: string } | null);
          const createdIso = unixToIso(session.created);
          const founderYear = session.created
            ? new Date(session.created * 1000).getUTCFullYear()
            : new Date().getUTCFullYear();
          await grantFounder(userId, paymentIntentId, createdIso, founderYear, customerId);
        } else if (session.mode === 'subscription') {
          // Premium recurring: entitlement is driven by the
          // customer.subscription.* events (which carry the durable metadata).
          // Here we just persist the customer link for the portal flow.
          await storeStripeCustomerId(userId, customerId);
        } else {
          console.log('[stripe-webhook] unhandled checkout session shape:', session.mode, entitlement);
        }
        break;
      }

      case 'checkout.session.async_payment_failed': {
        // Delayed payment never settled. Revoke only if we can tie it to the
        // exact transaction we granted (payment_intent match); otherwise there
        // is nothing to undo (we only grant on settled payment).
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentIntentId = asId(session.payment_intent as string | { id: string } | null);
        if (paymentIntentId) {
          const row = await findRowByTransaction(paymentIntentId);
          if (row) {
            const wasFounder =
              row.subscription_type === 'founder' || row.entitlement_id === 'founder';
            await revokeByTransaction(row.user_id, wasFounder);
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await handleSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_uid ?? null;
        if (userId) {
          await expirePremium(userId, sub.id);
        } else {
          console.warn('[stripe-webhook] deleted subscription has no supabase_uid:', sub.id);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        // Only a FULL refund revokes; partial refunds leave entitlement intact.
        const fullyRefunded =
          charge.refunded === true && (charge.amount_refunded ?? 0) >= (charge.amount ?? 0);
        if (!fullyRefunded) {
          console.log('[stripe-webhook] partial refund, entitlement kept:', charge.id);
          break;
        }
        // Founder one-time purchases store payment_intent in
        // original_transaction_id, so a refunded charge maps straight to the row.
        const paymentIntentId = asId(charge.payment_intent as string | { id: string } | null);
        const row = paymentIntentId ? await findRowByTransaction(paymentIntentId) : null;
        if (row) {
          const wasFounder =
            row.subscription_type === 'founder' || row.entitlement_id === 'founder';
          await revokeByTransaction(row.user_id, wasFounder);
        } else {
          // Subscription (premium) invoice refunds don't match a row here —
          // premium revocation is driven by customer.subscription.* events.
          console.log('[stripe-webhook] refund not tied to a stored transaction:', charge.id);
        }
        break;
      }

      default: {
        // Ack unhandled events so Stripe stops retrying.
        console.log('[stripe-webhook] ignoring event type:', event.type);
        break;
      }
    }
  } catch (err) {
    console.error('[stripe-webhook] db error:', err);
    // 5xx makes Stripe retry with backoff.
    return new Response('db error', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});
