-- pgbench body for a real two-connection duplicate-creation race.
--
-- Run only against local Supabase after removing any prior fixture whose
-- autogen_generations.city_key = 'oc3 concurrency regression'. Then:
--
--   pgbench postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--     -n -c 2 -j 2 -t 1 \
--     -f supabase/tests/autogen_concurrency.pgbench.sql
--
-- Both clients intentionally submit the same generation slot. Verification
-- must find one generation, one event/tag/creation metric, three invite rows,
-- and three lifecycle claims. Delete the fixture event and lifecycle claims
-- after verification.

select *
from public.reserve_autogen_event(
  'hot',
  'OC3 Concurrency Regression',
  'United Kingdom',
  'GB',
  (current_date + 30)::timestamptz + interval '18 hours 30 minutes',
  (
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where coalesce(p.onboarding_completed, false)
      and coalesce((select ups.profile_visibility
                    from public.user_privacy_settings ups
                    where ups.user_id = p.id), 'public') <> 'private'
    order by p.id
    limit 1
  ),
  (
    select q.id
    from public.quest_catalog q
    where q.is_active and q.risk_tier = 1 and q.social_mode in ('group', 'either')
    order by q.id
    limit 1
  ),
  array(
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where coalesce(p.onboarding_completed, false)
      and coalesce((select ups.profile_visibility
                    from public.user_privacy_settings ups
                    where ups.user_id = p.id), 'public') <> 'private'
    order by p.id
    offset 1
    limit 3
  ),
  2
);
