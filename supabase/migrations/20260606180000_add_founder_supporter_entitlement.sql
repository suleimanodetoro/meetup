-- Add Founder Supporter entitlement support.
--
-- RevenueCat exposes Founder as a separate `founder` entitlement. In-app,
-- founder is treated as a superset of premium, while public identity metadata
-- lives on profiles so profile screens can render the badge without consulting
-- RevenueCat or the private subscription row.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_founder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS founder_year integer;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_founder_year_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_founder_year_check
  CHECK (founder_year IS NULL OR founder_year BETWEEN 2020 AND 2100);

CREATE INDEX IF NOT EXISTS idx_profiles_is_founder
  ON public.profiles (is_founder)
  WHERE is_founder = true;

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_subscription_type_check;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_subscription_type_check
  CHECK (subscription_type IN ('free', 'premium', 'founder'));

CREATE OR REPLACE FUNCTION public.is_user_premium(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions us
    WHERE us.user_id = uid
      AND us.entitlement_id IN ('premium', 'founder')
      AND (us.expires_at IS NULL OR us.expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_user_founder(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = uid
      AND p.is_founder = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_user_premium(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_user_founder(uuid) TO authenticated, anon;

DO $$
BEGIN
  RAISE NOTICE 'Added founder supporter entitlement support: profiles.is_founder/founder_year, founder subscription_type, founder-aware premium RPC.';
END $$;
