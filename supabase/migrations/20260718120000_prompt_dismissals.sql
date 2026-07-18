-- =====================================================
-- prompt_dismissals — "don't ask me that again" (Confidence Layer, spec 03)
-- =====================================================
-- One row per (user, target, prompt_type): the user was shown a graduation
-- prompt about the target and said no. get_graduation_prompts (next migration)
-- excludes dismissed prompts forever — a dismissal is scoped to the prompt
-- TYPE, so declining "add your quest partner" does not suppress a later
-- warm-pair suggestion for the same person, and vice versa.

create table public.prompt_dismissals (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  target_id   uuid not null references public.profiles(id) on delete cascade,
  prompt_type text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_id, prompt_type)
);

comment on table public.prompt_dismissals is
  'Confidence Layer: graduation prompts the user explicitly dismissed. Read by get_graduation_prompts to never re-nag. See docs/specs/03-confidence-layer.md.';

-- RLS: insert/select own rows only. No update/delete — a dismissal is a fact,
-- not a setting (the PK makes repeats no-ops via upsert ignoreDuplicates).
alter table public.prompt_dismissals enable row level security;
revoke all on public.prompt_dismissals from anon;
revoke all on public.prompt_dismissals from authenticated;
grant select, insert on public.prompt_dismissals to authenticated;

create policy "prompt_dismissals_insert_own"
  on public.prompt_dismissals for insert to authenticated
  with check (user_id = auth.uid());

create policy "prompt_dismissals_read_own"
  on public.prompt_dismissals for select to authenticated
  using (user_id = auth.uid());
