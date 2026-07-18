-- =====================================================
-- engine_events — the Social Momentum Engine's metrics ledger
-- =====================================================
-- Append-only evidence layer shared by every engine component (Pulse Monitor,
-- Chemistry, Confidence Layer, Auto-Generate — see docs/specs/00-overview.md).
-- Each component emits its measurable moments here ('pulse.transition',
-- 'nudge.sent', 'nudge.converted', 'confidence.prompt_*', 'intent.submitted',
-- 'autogen.*'); the queries that turn them into impact metrics come later.
--
-- Access model:
--   * Clients never SELECT (metrics are operator-only; query via service role).
--   * Client-side emissions go through ONE allowlisted RPC, log_engine_event().
--   * Server-side jobs (edge functions, refresh_pair_pulse) insert directly as
--     the service role / function owner.

create table public.engine_events (
  id         bigint generated always as identity primary key,
  event_key  text not null,
  user_id    uuid references auth.users(id) on delete set null,
  -- Canonical unordered pair (pair_lo < pair_hi) when the event is about a
  -- relationship. No FK on purpose: metrics must survive account deletion.
  pair_lo    uuid,
  pair_hi    uuid,
  event_id   bigint,   -- events.id when applicable (no FK — same reason)
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.engine_events is
  'Append-only metrics ledger for the Social Momentum Engine. Operator/service-role read only; clients write solely via log_engine_event(). See docs/specs/00-overview.md.';

-- Metric queries slice by key + time; pulse/nudge logic looks up by pair.
create index engine_events_key_created_idx
  on public.engine_events (event_key, created_at desc);
create index engine_events_pair_idx
  on public.engine_events (pair_lo, pair_hi, event_key, created_at desc);

-- RLS: enabled with ZERO policies => anon/authenticated are default-denied for
-- every operation; the service role bypasses RLS. Baseline grants revoked too
-- (same lockdown convention as lifecycle_events, 20260706000000).
alter table public.engine_events enable row level security;
revoke all on public.engine_events from anon;
revoke all on public.engine_events from authenticated;

-- ---------------------------------------------------------------------------
-- log_engine_event — the single client-side emission path
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so it can insert into the locked-down table; stamps
-- auth.uid() (never trusts a caller-supplied user id) and allowlists the event
-- keys clients may emit. Server-side keys ('pulse.transition', 'nudge.*', ...)
-- are inserted directly by service-role jobs, NOT through this RPC.
create or replace function public.log_engine_event(
  p_event_key text,
  p_payload   jsonb  default '{}'::jsonb,
  p_event_id  bigint default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  -- Client-emittable keys. Extend deliberately, one spec at a time.
  v_allowed constant text[] := array[
    'confidence.prompt_shown',
    'confidence.prompt_accepted',
    'confidence.prompt_dismissed',
    'intent.submitted'
  ];
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_event_key is null or not (p_event_key = any (v_allowed)) then
    raise exception 'event_key % is not client-emittable', coalesce(p_event_key, '<null>');
  end if;
  -- Keep the ledger lean — payloads are context crumbs, not documents.
  if pg_column_size(coalesce(p_payload, '{}'::jsonb)) > 8192 then
    raise exception 'payload too large';
  end if;

  insert into public.engine_events (event_key, user_id, event_id, payload)
  values (p_event_key, v_uid, p_event_id, coalesce(p_payload, '{}'::jsonb));
end;
$$;

revoke all on function public.log_engine_event(text, jsonb, bigint) from anon, public;
grant execute on function public.log_engine_event(text, jsonb, bigint) to authenticated;
