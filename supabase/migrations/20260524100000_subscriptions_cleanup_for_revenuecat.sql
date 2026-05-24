-- 20260524100000_subscriptions_cleanup_for_revenuecat.sql
--
-- The user_subscriptions table was scaffolded with Stripe in mind but never
-- wired to any payment provider. Now that we're integrating RevenueCat as
-- the source of truth for subscription state, this migration reshapes the
-- table to match RC's mental model:
--
--   - Drop stripe_customer_id / stripe_subscription_id (we don't use Stripe;
--     RC's mobile flow uses Apple/Google original transaction IDs).
--   - Drop is_active. Whether a user is currently subscribed is derived
--     from "entitlement_id IS NOT NULL AND (expires_at IS NULL OR expires_at
--     > now())". One source of truth, no boolean that can drift.
--   - Collapse the 'free' | 'premium' | 'pro' enum to 'free' | 'premium'.
--     The 'pro' tier was never differentiated from 'premium' anywhere in
--     the app (the hook exported isPremium and isPro but only hasSubscription
--     was consumed). MVP ships one paid tier; multi-tier is feature-flagged
--     via RC entitlements when there's a real reason for it.
--   - Add columns RevenueCat's webhook will populate:
--       entitlement_id text          -- 'premium' when active, NULL when free
--       original_transaction_id text -- Apple's original_transaction_id
--                                       or Google's purchase token
--       provider text                -- 'app_store' | 'play_store' |
--                                       'stripe' | 'promotional'
--
-- Reads stay backward-compatible with one consumer (VisitDetailsBottomSheet
-- via useSubscription.hasSubscription). The hook is rewritten in the same
-- commit to use entitlement_id + expires_at semantics.

-- 1. Drop the Stripe-shaped columns.
ALTER TABLE public.user_subscriptions
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id;

-- 2. Drop is_active and its index. entitlement_id + expires_at replace it.
DROP INDEX IF EXISTS public.idx_user_subscriptions_active;
ALTER TABLE public.user_subscriptions DROP COLUMN IF EXISTS is_active;

-- 3. Collapse 'pro' into 'premium' for the single-tier MVP.
ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_subscription_type_check;
UPDATE public.user_subscriptions
  SET subscription_type = 'premium'
  WHERE subscription_type = 'pro';
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_subscription_type_check
  CHECK (subscription_type IN ('free', 'premium'));

-- 4. Add RevenueCat-shaped columns.
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS entitlement_id text,
  ADD COLUMN IF NOT EXISTS original_transaction_id text,
  ADD COLUMN IF NOT EXISTS provider text
    CHECK (provider IS NULL OR provider IN ('app_store', 'play_store', 'stripe', 'promotional'));

-- 5. Backfill entitlement_id from any existing 'premium' rows so the new
--    derivation gives the same answers as the old one for seeded data.
UPDATE public.user_subscriptions
  SET entitlement_id = 'premium'
  WHERE subscription_type = 'premium'
    AND entitlement_id IS NULL;

-- 6. The auto-create-on-profile trigger inserted is_active = true. Now that
--    column is gone, the trigger just needs to insert (user_id) and let
--    subscription_type default to 'free'.
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, subscription_type)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 7. Refresh the table comment so future readers understand the contract.
COMMENT ON TABLE public.user_subscriptions IS
  'Mirror of RevenueCat subscription state. Updated by a Supabase Edge Function webhook receiving RC events (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE). UI gating reads via useSubscription. RevenueCat remains the canonical source of truth.';

DO $$
BEGIN
  RAISE NOTICE 'user_subscriptions reshaped for RevenueCat. Dropped: stripe_*/is_active/''pro'' tier. Added: entitlement_id/original_transaction_id/provider.';
END $$;
