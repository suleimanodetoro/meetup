-- =====================================================
-- promo_codes — self-serve promotional access (community cohorts)
-- =====================================================
-- Waypoint-issued codes that grant the 'premium' entitlement for a fixed
-- number of days, written straight into user_subscriptions with
-- provider = 'promotional'. The existing useSubscription gating
-- (entitlement_id + expires_at) unlocks with zero client changes, and the
-- revenuecat-webhook is taught (same commit) never to clobber an active
-- promotional row with a non-entitled RC event.
--
-- Codes are created by hand (SQL console), e.g. a 6-month access code:
--
--   insert into public.promo_codes (code, note, duration_days, max_redemptions)
--   values ('WELCOME6M', 'Community access — 6 months free', 180, 50);
--
-- When a promo lapses nothing bespoke happens: expires_at passes, the hook's
-- derivation flips hasSubscription to false, and the user meets the normal
-- paywall.

create table public.promo_codes (
  code             text primary key
                     check (code = upper(code) and code ~ '^[A-Z0-9-]{4,32}$'),
  note             text,
  -- Promo codes grant premium only. Founder is a paid identity (badge,
  -- profiles.is_founder) and is intentionally not grantable by code.
  entitlement_id   text not null default 'premium'
                     check (entitlement_id = 'premium'),
  duration_days    integer not null default 180
                     check (duration_days between 1 and 730),
  -- NULL = unlimited redemptions.
  max_redemptions  integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0,
  -- NULL = code never stops being redeemable (grants still expire per
  -- duration_days). This bounds when the code can be REDEEMED, not the grant.
  redeemable_until timestamptz,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

comment on table public.promo_codes is
  'Waypoint-issued promotional codes. Redeemed via redeem_promo_code(); grants premium into user_subscriptions (provider=promotional). Create rows by hand in the SQL console.';

create table public.promo_redemptions (
  code        text not null references public.promo_codes(code),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  granted_until timestamptz not null,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

comment on table public.promo_redemptions is
  'One row per (code, user): audit of promo redemptions. The PK enforces a code is redeemable once per user.';

-- RLS: neither table is client-readable or client-writable. All access goes
-- through the redeem_promo_code definer function so code strings can't be
-- enumerated and counters can't be forged.
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
revoke all on public.promo_codes from anon, authenticated;
revoke all on public.promo_redemptions from anon, authenticated;

-- =====================================================
-- redeem_promo_code(p_code) -> jsonb
-- =====================================================
-- Validates and redeems a code for the calling user. Returns
--   { ok: true,  entitlement_id, expires_at }
-- or
--   { ok: false, reason: 'invalid' | 'expired' | 'exhausted'
--                       | 'already_redeemed' | 'already_subscribed' }
--
-- 'invalid' deliberately covers unknown AND deactivated codes so callers
-- can't probe which codes exist.
create or replace function public.redeem_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_code  public.promo_codes%rowtype;
  v_until timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Lock the code row so concurrent redemptions can't blow past
  -- max_redemptions.
  select * into v_code
  from public.promo_codes
  where code = upper(trim(p_code))
  for update;

  if not found or not v_code.is_active then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if v_code.redeemable_until is not null and v_code.redeemable_until < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if v_code.max_redemptions is not null
     and v_code.redemption_count >= v_code.max_redemptions then
    return jsonb_build_object('ok', false, 'reason', 'exhausted');
  end if;
  if exists (
    select 1 from public.promo_redemptions
    where code = v_code.code and user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  end if;

  -- Never overwrite an active entitlement — a paying (or already-promo'd)
  -- user redeeming a code must not have their row downgraded or its
  -- provider/transaction ownership rewritten.
  if exists (
    select 1 from public.user_subscriptions
    where user_id = v_uid
      and entitlement_id is not null
      and (expires_at is null or expires_at > now())
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_subscribed');
  end if;

  v_until := now() + make_interval(days => v_code.duration_days);

  insert into public.promo_redemptions (code, user_id, granted_until)
  values (v_code.code, v_uid, v_until);

  update public.promo_codes
  set redemption_count = redemption_count + 1
  where code = v_code.code;

  -- The row may already exist as 'free' (created by the on-profile trigger)
  -- or as a lapsed subscription; either way the active shape wins.
  -- original_transaction_id carries the code so the revenuecat-webhook's
  -- ownership guards can tell this row was not written by RC.
  insert into public.user_subscriptions
    (user_id, subscription_type, entitlement_id, provider,
     original_transaction_id, started_at, expires_at, updated_at)
  values
    (v_uid, 'premium', v_code.entitlement_id, 'promotional',
     'promo:' || v_code.code, now(), v_until, now())
  on conflict (user_id) do update set
    subscription_type       = excluded.subscription_type,
    entitlement_id          = excluded.entitlement_id,
    provider                = excluded.provider,
    original_transaction_id = excluded.original_transaction_id,
    started_at              = excluded.started_at,
    expires_at              = excluded.expires_at,
    updated_at              = excluded.updated_at;

  return jsonb_build_object(
    'ok', true,
    'entitlement_id', v_code.entitlement_id,
    'expires_at', v_until
  );
end;
$$;

revoke all on function public.redeem_promo_code(text) from public, anon;
grant execute on function public.redeem_promo_code(text) to authenticated;

do $$
begin
  raise notice 'promo_codes + promo_redemptions created; redeem_promo_code(text) grants premium (provider=promotional) into user_subscriptions.';
end $$;
