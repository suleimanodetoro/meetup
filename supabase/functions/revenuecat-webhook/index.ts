// supabase/functions/revenuecat-webhook/index.ts
//
// Webhook endpoint that RevenueCat calls whenever a subscription
// changes. Mirrors RC's state into public.user_subscriptions so the
// app can gate UI off a single Postgres row via the existing
// useSubscription hook + realtime subscription, rather than
// round-tripping to RC's API on every render.
//
// Configuration in the RC dashboard (Project Settings -> Integrations
// -> Webhooks):
//
//   URL:           https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
//   Auth header:   Bearer <REVENUECAT_WEBHOOK_AUTH>  (set the same value in
//                  Supabase Edge Function secrets)
//
// The function uses the service_role key to bypass RLS — we need to
// write subscription rows on behalf of arbitrary users.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const WEBHOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface RcEvent {
  type: string;
  app_user_id: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number | null;
  entitlement_ids?: string[] | null;
  store?: string;
  original_transaction_id?: string;
  environment?: 'PRODUCTION' | 'SANDBOX';
}

interface RcWebhookPayload {
  event?: RcEvent;
  api_version?: string;
}

/**
 * RC's `store` is uppercase string keys; the user_subscriptions.provider
 * column takes a constrained set of lowercase tags.
 */
function mapProvider(store?: string): string | null {
  switch (store) {
    case 'APP_STORE':
    case 'MAC_APP_STORE':
      return 'app_store';
    case 'PLAY_STORE':
      return 'play_store';
    case 'STRIPE':
      return 'stripe';
    case 'PROMOTIONAL':
      return 'promotional';
    default:
      return null;
  }
}

serve(async (req) => {
  // Shared-secret auth. RC sends the value we configured in their
  // dashboard as a `Bearer <token>` header. We compare against the
  // function's REVENUECAT_WEBHOOK_AUTH secret. If the secret isn't set,
  // refuse all requests — fail closed, never accept unauthenticated.
  if (!WEBHOOK_AUTH) {
    return new Response('webhook auth not configured', { status: 503 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${WEBHOOK_AUTH}`) {
    return new Response('unauthorized', { status: 401 });
  }

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  let payload: RcWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const event = payload.event;
  if (!event?.app_user_id || !event.type) {
    return new Response('missing event fields', { status: 400 });
  }

  // Ignore sandbox traffic against prod. RC dashboard lets you point a
  // separate webhook URL at sandbox if needed; this one is whichever
  // env you pointed it at.
  // (Comment intentionally non-enforcing — we accept both for now so
  // sandbox testing flows update the local row.)

  const userId = event.app_user_id;
  const provider = mapProvider(event.store);
  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;
  const startedAt = event.purchased_at_ms
    ? new Date(event.purchased_at_ms).toISOString()
    : null;
  const entitlementId =
    event.entitlement_ids && event.entitlement_ids.length > 0
      ? event.entitlement_ids[0]
      : null;

  try {
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
      case 'UNCANCELLATION':
      case 'NON_RENEWING_PURCHASE': {
        // Either the user just bought something or RC reaffirmed an
        // existing active subscription. Either way: write the active
        // shape. The row may have been auto-created as 'free' by the
        // on_profile_created trigger; UPSERT handles both cases.
        const patch: Record<string, unknown> = {
          user_id: userId,
          subscription_type: entitlementId ? 'premium' : 'free',
          entitlement_id: entitlementId,
          original_transaction_id: event.original_transaction_id ?? null,
          provider,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        };
        if (event.type === 'INITIAL_PURCHASE' && startedAt) {
          patch.started_at = startedAt;
        }
        const { error } = await admin
          .from('user_subscriptions')
          .upsert(patch, { onConflict: 'user_id' });
        if (error) throw error;
        break;
      }

      case 'EXPIRATION': {
        // Subscription has actually lapsed. Clear the active fields but
        // leave the row in place so we still have a record the user
        // was once a subscriber (useful for win-back campaigns).
        const { error } = await admin
          .from('user_subscriptions')
          .update({
            subscription_type: 'free',
            entitlement_id: null,
            expires_at: null,
            original_transaction_id: null,
            provider: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        if (error) throw error;
        break;
      }

      case 'CANCELLATION': {
        // User disabled renewal but is still entitled until expires_at.
        // No DB change needed — EXPIRATION will fire when the period ends.
        break;
      }

      case 'BILLING_ISSUE': {
        // RC's grace period kicks in; entitlement stays active. If the
        // billing problem can't be resolved, RC will follow up with an
        // EXPIRATION event. Nothing to do here for now.
        break;
      }

      case 'TRANSFER':
      case 'SUBSCRIPTION_PAUSED':
      default: {
        // Acknowledge but don't act. RC retries 5xx but happily accepts
        // 200 for events we choose to ignore.
        console.log('[rc-webhook] ignoring event type:', event.type);
        break;
      }
    }
  } catch (err) {
    console.error('[rc-webhook] db error:', err);
    return new Response('db error', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});
