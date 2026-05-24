# Seed scripts

Populates a Supabase with 75 personas and a realistic social graph so the app
stops looking empty.

## Run against local

```bash
# 1. Make sure local Supabase is running
supabase start

# 2. Confirm .env.local has SUPABASE_URL=http://127.0.0.1:54321
#    and SUPABASE_SERVICE_ROLE_KEY set to the local service_role key

# 3. Seed
npm run seed

# To wipe and redo:
npm run seed:reset
npm run seed
```

## Run against prod (use sparingly)

For demos / co-founder testing / paywall density on a real device. The seed
script will refuse to write to a remote project unless
`SEED_I_KNOW_WHAT_IM_DOING=1` is set, and prints a loud banner when it does.

```bash
# 1. Point env vars at prod
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<prod service_role key> \
SEED_I_KNOW_WHAT_IM_DOING=1 \
npm run seed

# 2. When done, wipe (also requires the override flag)
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<prod service_role key> \
SEED_I_KNOW_WHAT_IM_DOING=1 \
npm run seed:reset
```

The service_role key bypasses RLS — never expose it from the client. Find it
in Supabase Dashboard → Project Settings → API → service_role secret. Do not
commit it.

## What gets created

- **75 users** across 6 cities (London, NYC, Lagos, Berlin, Tokyo, Mexico City).
  Profiles fully populated: bio, avatar (real-looking photos from
  randomuser.me), birth date, gender, preferences, interests, languages,
  location.
- **Friendship clusters** — most edges within a city, some cross-city, plus
  4 pending requests so the inbox isn't empty.
- **~150–300 visits**, weighted so 2 cities are "hot" (trending).
- **90 events** with realistic attendance counts and curated Pexels cover
  photos. Group conversations are auto-created by the schema trigger and
  chat history is backfilled in 70% of them.
- **DMs** between ~40% of friend pairs with 1–12 messages each.
- **Sentinels** for edge cases:
  - 1 premium-tier user (to test paid-feature UI)
  - 1 DM with 80 messages (scroll-perf test)
  - 1 sparse profile (no bio, no avatar)
  - 1 wall-of-text bio user

## Login

Any seeded user, password `seed123`. Email follows the pattern
`<firstname>_<lastname>_<n>@seed.local` — the script prints a few examples
at the end.

## Safety

`env.ts` refuses to run unless `SUPABASE_URL` points at `127.0.0.1` /
`localhost`. To force-override (do not), set `SEED_I_KNOW_WHAT_IM_DOING=1`.
The override also triggers a yellow banner showing the target URL so you
know it's writing to a remote project.

## Reset semantics

`reset.ts` deletes every user whose email ends in `@seed.local`. The
`ON DELETE CASCADE` foreign keys take care of profiles, visits, events,
attendance, conversations, messages, etc.

After the cascade pass, `reset.ts` also runs a paranoia sweep: deletes any
`events` or `visits` rows whose `user_id` no longer matches a live profile.
In a healthy schema this finds zero rows, but it catches anything that slips
past the cascade (missing FK, hand-edited row, etc).
