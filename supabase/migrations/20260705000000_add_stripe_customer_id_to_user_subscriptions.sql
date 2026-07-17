-- 20260705000000_add_stripe_customer_id_to_user_subscriptions.sql
--
-- Add stripe_customer_id to user_subscriptions for the web (Stripe Checkout)
-- purchase flow served by the stripe-webhook edge function.
--
-- Background: the original scaffold (20250819192100) carried stripe_customer_id
-- and stripe_subscription_id, but 20260524100000_subscriptions_cleanup_for_revenuecat
-- dropped both when the app standardised on RevenueCat. The marketing site now
-- sells the same 'premium' / 'founder' entitlements via Stripe Checkout, and the
-- stripe-webhook function mirrors those purchases into this table (provider = 'stripe').
--
-- IMPORTANT: entitlement gating does NOT depend on this column. The webhook
-- resolves the Supabase user from Stripe metadata (client_reference_id /
-- metadata.supabase_uid / subscription_data.metadata.supabase_uid) and records the
-- transaction in original_transaction_id (payment_intent id for the founder one-time
-- purchase, subscription id for recurring premium). This column exists only so the
-- site's /account "Manage billing" flow can map a Supabase user to their Stripe
-- customer and open a Billing Portal session without a separate lookup table.
--
-- The webhook writes this column best-effort: if this migration has not been applied
-- the write is caught and ignored, and entitlements still unlock correctly. Apply this
-- migration to enable the billing-portal mapping.
--
-- Nullable, no constraint: Apple / Google / RevenueCat rows leave it NULL.

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id
  ON public.user_subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN public.user_subscriptions.stripe_customer_id IS
  'Stripe customer id for web (Stripe Checkout) purchases; NULL for Apple/Google/RevenueCat rows. Used by the site billing-portal flow, not by entitlement gating.';

DO $$
BEGIN
  RAISE NOTICE 'Added user_subscriptions.stripe_customer_id (nullable, indexed) for the Stripe web purchase flow.';
END $$;
