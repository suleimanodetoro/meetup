-- S10: is_user_premium(uuid) is SECURITY DEFINER, takes an arbitrary uuid, and
-- reads the (anon-restricted) user_subscriptions table. EXECUTE was granted to
-- anon, so an unauthenticated caller could probe any user's paid status and
-- enumerate paying accounts. Restrict execution to authenticated callers.
--
-- The uuid parameter is intentionally kept: app/profile/[userId].tsx passes the
-- *viewed* user's id to badge them, so self-scoping to auth.uid() would break
-- the premium badge. is_user_founder is left as-is (it reads profiles.is_founder,
-- already public via the profiles grant, so revoking it would be cosmetic).
REVOKE EXECUTE ON FUNCTION public.is_user_premium(uuid) FROM anon;
