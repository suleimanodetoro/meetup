-- =====================================================
-- pair_pulse — per-pair relationship momentum (Pulse Monitor)
-- =====================================================
-- One row per canonical unordered pair (user_lo < user_hi, same convention as
-- quest_ledger). score/state are recomputed nightly by refresh_pair_pulse()
-- (next migration) from passive signals: quest co-completions, co-attendance,
-- friendship, DMs and shared group chats — with a 14-day half-life decay.
--
--   hot / warm        — the relationship has real momentum right now
--   cooling           — HAD momentum (was hot/warm at a prior refresh) and is
--                       drifting; this state is what triggers the re-engagement
--                       nudge. A pair that never warmed up is just cold.
--   cold              — the default state of strangers
--
-- prev_state keeps the last DIFFERENT state so drift transitions are visible
-- to the refresh function without replaying history.

create table public.pair_pulse (
  user_lo    uuid not null references public.profiles(id) on delete cascade,
  user_hi    uuid not null references public.profiles(id) on delete cascade,
  score      numeric not null default 0,
  state      text not null default 'cold'
             check (state in ('hot','warm','cooling','cold')),
  prev_state text,
  last_interaction_at timestamptz,
  computed_at timestamptz not null default now(),
  primary key (user_lo, user_hi),
  check (user_lo < user_hi)
);

comment on table public.pair_pulse is
  'Pulse Monitor: decayed momentum score + hot/warm/cooling/cold state per canonical pair. Written only by refresh_pair_pulse(); clients read their own pairs.';

-- The PK covers user_lo lookups; this covers "all pairs I''m the hi side of"
-- (the friends-list batch fetch queries both sides in one .or()).
create index pair_pulse_user_hi_idx on public.pair_pulse (user_hi);

-- RLS mirrors quest_ledger (20260619000000): read only the pairs you are in;
-- no client writes at all (the refresh function is SECURITY DEFINER).
alter table public.pair_pulse enable row level security;
revoke all on public.pair_pulse from anon;
revoke all on public.pair_pulse from authenticated;
grant select on public.pair_pulse to authenticated;

create policy "pair_pulse_read_own"
  on public.pair_pulse for select to authenticated
  using (auth.uid() = user_lo or auth.uid() = user_hi);
