# stripe-webhook

Supabase Edge Function that mirrors **web** (Stripe Checkout) purchases into
`public.user_subscriptions` — the same table the RevenueCat webhook writes — so a
purchase made on the marketing site unlocks the exact same `premium` / `founder`
entitlements the mobile app grants via RevenueCat. Gating in the app reads a single
Postgres row through `hooks/useSubscription.tsx` (+ realtime), so nothing app-side
needs to change for web entitlements to take effect.

It is the sibling of [`../revenuecat-webhook/index.ts`](../revenuecat-webhook/index.ts)
and mirrors its conventions: `service_role` client, text/timestamptz column shapes,
fail-closed auth, and 200/4xx/5xx semantics (5xx makes Stripe retry).

## Site-side contract (fixed — do not change here)

The site creates Checkout Sessions with:

- `client_reference_id = <supabase user uuid>`
- `metadata = { supabase_uid, entitlement: 'premium' | 'founder' }`
- subscription-mode sessions also set `subscription_data.metadata = { supabase_uid, entitlement: 'premium' | 'founder' }`

**Premium** = recurring subscription (weekly/monthly/annual). **Founder Annual**
is a recurring subscription. **Founder Forever** = one-time `mode: 'payment'`
lifetime purchase.

## Entitlement mapping

| Stripe event                                                                                                            | Action                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout.session.completed` / `checkout.session.async_payment_succeeded` (`mode=payment`, `entitlement=founder`, paid) | Upsert founder lifetime (`expires_at` NULL, `original_transaction_id` = payment_intent id), set `profiles.is_founder = true` + `founder_year` |
| `checkout.session.completed` (`mode=subscription`)                                                                      | Persist Stripe customer link only; entitlement comes from the subscription events                                                             |
| `customer.subscription.created` / `.updated`, status `active`/`trialing`                                                | Upsert the metadata-selected Premium or Founder entitlement, `expires_at` = current period end                                                |
| `customer.subscription.updated`, status `past_due`                                                                      | Keep the selected entitlement until period end                                                                                                |
| `customer.subscription.updated`, status `canceled`/`unpaid`/`incomplete_expired`                                        | Expire the matching recurring entitlement                                                                                                     |
| `customer.subscription.deleted`                                                                                         | Expire the matching recurring entitlement; never revoke Founder Forever                                                                       |
| `charge.refunded` (full refund)                                                                                         | Revoke the entitlement that transaction granted (founder maps via payment_intent)                                                             |
| `checkout.session.async_payment_failed`                                                                                 | Revoke if it can be tied to the exact transaction                                                                                             |

Guards: a premium expiry/downgrade never clobbers a founder-lifetime row; an old
subscription's expiry event never regresses a newer active row (compared by
`original_transaction_id`); replayed events are idempotent. `current_period_end` is
read from both the subscription and (newer "basil" API versions) the subscription
item.

## Secrets to set

```bash
# Stripe dashboard -> Developers -> Webhooks -> your endpoint -> "Signing secret"
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx

# Optional. Not used for signature verification and no API calls are made in this
# handler, but recommended so future expanded-object lookups work.
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the
Edge runtime (same as revenuecat-webhook).

## Deploy

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

`--no-verify-jwt` is required because Stripe POSTs are unauthenticated at the JWT
layer — authenticity is the `Stripe-Signature` HMAC, verified inside the function.
`verify_jwt = false` is already set for this function in
[`supabase/config.toml`](../../config.toml), matching how `revenuecat-webhook` is
configured, so `supabase functions deploy stripe-webhook` will also pick it up; the
explicit flag makes it unambiguous.

## Stripe dashboard configuration

1. Developers → Webhooks → **Add endpoint**.
2. Endpoint URL:
   ```
   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
   ```
3. Subscribe to exactly these events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
4. Copy the endpoint's **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

## Database migration (apply before/with deploy)

- `supabase/migrations/20260705000000_add_stripe_customer_id_to_user_subscriptions.sql`
  adds a nullable `stripe_customer_id` column used by the site's billing-portal flow.
  Entitlements unlock **without** it (the webhook writes the column best-effort and
  ignores the error if the column is absent), but apply it to enable the portal
  mapping.

`user_subscriptions.provider` already accepts `'stripe'` (added in
`20260524100000_subscriptions_cleanup_for_revenuecat.sql`) and RLS already lets an
authenticated user `SELECT` their own row (policy "Users can view their own
subscription" from `20250819192100`), so the site's `/account` page can read it.

## Local testing

```bash
supabase functions serve stripe-webhook --no-verify-jwt --env-file ./supabase/functions/.env
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```
