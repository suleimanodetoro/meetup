-- =====================================================
-- quest_intents — persisted create-plan intent submissions (Chemistry, spec 02)
-- =====================================================
-- Every "Suggest sidequests" tap in app/create-plan/intent.tsx currently throws
-- the stated preferences away after calling suggest_quest. This table keeps
-- them: one row per suggestion REQUEST (not per slider move), stamped with the
-- profile's city/country at submission time. chemistry_score() (next
-- migration) reads the last 30 days of rows to compare two users' modal
-- energy / social preferences — stated intent as behavioural signal.
--
-- Nullable on purpose: every slider is optional and skippable in the UI.
-- comfort has no UI control yet; the column exists so a future comfort slider
-- needs no schema change.

create table public.quest_intents (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  city         text,            -- profile location at submission time
  country_code text,
  energy       smallint,        -- 1..3, nullable (user may skip sliders)
  social       text check (social in ('solo','pair','group','either')),
  time_max     int,             -- minutes
  budget       smallint,        -- 0..2
  comfort      smallint,        -- 1..3
  categories   text[],
  created_at   timestamptz not null default now()
);

comment on table public.quest_intents is
  'Chemistry: stated intent from the create-plan on-ramp, one row per suggestion request. Users insert/read their own rows; the engine reads it via SECURITY DEFINER / service role.';

-- chemistry_score()'s modal-preference lookups are always
-- "user_id = X and created_at >= now() - 30d".
create index quest_intents_user_recent_idx
  on public.quest_intents (user_id, created_at desc);

-- RLS: insert own rows, select own rows, nothing else. Engine functions read
-- it as SECURITY DEFINER (chemistry_score) or service role, bypassing this.
alter table public.quest_intents enable row level security;
revoke all on public.quest_intents from anon;
revoke all on public.quest_intents from authenticated;
grant select, insert on public.quest_intents to authenticated;

create policy "quest_intents_insert_own"
  on public.quest_intents for insert to authenticated
  with check (user_id = auth.uid());

create policy "quest_intents_read_own"
  on public.quest_intents for select to authenticated
  using (user_id = auth.uid());
