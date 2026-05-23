# Seed scripts

Populates a local Supabase with 25 personas and a realistic social graph so the
app stops looking empty in dev.

## Run

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

## What gets created

- **25 users** across 6 cities (London, NYC, Lagos, Berlin, Tokyo, Mexico City).
  Profiles fully populated: bio, avatar (DiceBear), birth date, gender,
  preferences, interests, languages, location.
- **Friendship clusters** — most edges within a city, some cross-city, plus
  4 pending requests so the inbox isn't empty.
- **~50–100 visits**, weighted so 2 cities are "hot" (trending).
- **30 events** with realistic attendance counts; group conversations are
  auto-created by the trigger and chat history is backfilled in 70% of them.
- **DMs** between ~40% of friend pairs with 1–12 messages each.
- **Sentinels** for edge cases:
  - 1 pro-tier user (to test paid-feature UI)
  - 1 DM with 80 messages (scroll-perf test)
  - 1 sparse profile (no bio, no avatar)
  - 1 wall-of-text bio user

## Login

Any seeded user, password `seed123`. Email follows the pattern
`<firstname>_<lastname>_<n>@seed.local` — the script prints a few examples at
the end.

## Safety

`env.ts` refuses to run unless `SUPABASE_URL` points at `127.0.0.1` /
`localhost`. To force-override (do not), set `SEED_I_KNOW_WHAT_IM_DOING=1`.

## Reset semantics

`reset.ts` deletes every user whose email ends in `@seed.local`. The
`ON DELETE CASCADE` foreign keys take care of profiles, visits, events,
attendance, conversations, messages, etc.
