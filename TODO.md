# Future Work

Tracking items deferred from cleanup passes. Each entry should explain _why_ it
was deferred so a future contributor can pick it up without re-doing the
analysis.

## Wire up RevenueCat (external steps)

The code is in place ([lib/revenuecat.ts](lib/revenuecat.ts),
[components/UpsellModal.tsx](components/UpsellModal.tsx),
[supabase/functions/revenuecat-webhook/index.ts](supabase/functions/revenuecat-webhook/index.ts))
but it needs dashboard config and secrets before purchases actually flow
end-to-end.

### 1. RevenueCat dashboard

Sign up at <https://app.revenuecat.com>. Free tier covers up to $10k/month.

- **Project**: create one named `Waypoint`.
- **Entitlement**: create one called `premium`. This matches the string the
  code checks (`customerInfo.entitlements.active['premium']`).
- **Products**: created later in App Store Connect, then mirrored here. Use
  identifiers like `app.usewaypoint.premium.monthly` and
  `app.usewaypoint.premium.yearly`. Attach both to the `premium` entitlement.
- **Offering**: create `default`, add both products as packages. The SDK's
  `Purchases.getOfferings()` returns whichever offering is marked
  "Current" — keep `default` as current unless you're A/B-ing.
- **App Store Connect API key**: generate in App Store Connect (Users →
  Integrations → App Store Connect API), upload to RC at
  Project Settings → Apps → iOS → App Store Connect API. Without this RC
  can't verify Apple receipts.
- **iOS Public SDK Key + Android Public SDK Key**: copy from Project
  Settings → API Keys. These go into local `.env.local` and EAS secrets as
  `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and
  `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. They're "public" — safe to
  ship in the bundle.

### 2. App Store Connect products

In App Store Connect → Your App → In-App Purchases:

- Create one auto-renewing subscription group, e.g. `premium_access`.
- Add subscriptions inside it matching the RC product IDs above
  (`app.usewaypoint.premium.monthly`, `.yearly`).
- Set pricing, localization (title + description that show in the Apple
  purchase sheet), and submit them for review _alongside_ the first app
  build that uses them — Apple ties IAP approval to a binary.
- Mirror the IDs back in the RC dashboard's Products section.

### Founder Supporter expansion

Chosen shape:

- `app.usewaypoint.founder.annual` — auto-renewing annual subscription.
- `app.usewaypoint.founder.forever` — non-consumable lifetime purchase.

RevenueCat:

- Create entitlement `founder`.
- Create offering `supporter`.
- Attach both Founder products to `founder`.
- Keep normal Premium products attached to `premium`.
- The app treats `founder` as a superset of `premium`.

App Store Connect:

- Add `app.usewaypoint.founder.annual` as an auto-renewing subscription.
- Add `app.usewaypoint.founder.forever` as a non-consumable.
- Product copy must list the deliverables: profile Founder badge/tag, Premium access, and early-supporter recognition.
- Do not describe it as a donation or tip jar.

App Store Connect screenshots needed from Suleiman:

- **Founder Annual → Review Information → Screenshot**
  - Use a real app screenshot of the `Support Waypoint` / Founder paywall.
  - The screenshot should clearly show the Founder Annual purchase option and the benefits: Premium access + Founder profile badge/tag.
- **Founder Forever → Review Information → Screenshot**
  - The same Founder paywall screenshot is acceptable if both Founder Annual and Founder Forever are visible.
  - If the options are on separate states/screens, capture the state showing Founder Forever.
- **Existing Premium subscriptions → Review Information screenshots** (if Apple still marks them missing)
  - Use a screenshot of the normal Premium paywall showing monthly/yearly Premium options.
- **Do not use marketing mockups**
  - Apple wants to see where the in-app purchase appears in the app. Use an actual simulator/device screenshot of the paywall UI.
- **Optional product image fields**
  - These are not the same as review screenshots. Only add them if we have a polished 1024x1024 product image; otherwise prioritize the required review screenshots.

### 3. Sandbox testing

You need a physical device, not the simulator, for full end-to-end
sandbox purchases through RC.

- App Store Connect → Users and Access → Sandbox Testers → add a fake
  email (doesn't have to actually exist).
- On the device: Settings → App Store → Sandbox Account → sign in with
  the sandbox tester.
- Run the dev build (not Expo Go — RC requires native code).
- Open the paywall and tap a package. Apple's purchase sheet should
  show "[Environment: Sandbox]" at the top. Confirm with Face ID.
- Verify in the RC dashboard's Customer view that the event appeared.
- Verify in Supabase that the user_subscriptions row updated.

### 4. Supabase Edge Function deploy

The webhook code lives in
[supabase/functions/revenuecat-webhook/index.ts](supabase/functions/revenuecat-webhook/index.ts).

```bash
# Pick any long random string. Set the same value in both places.
WEBHOOK_AUTH=$(openssl rand -hex 32)

# 1. Set the secret on the function side.
supabase secrets set REVENUECAT_WEBHOOK_AUTH=$WEBHOOK_AUTH

# 2. Deploy the function.
supabase functions deploy revenuecat-webhook

# 3. In the RC dashboard (Project Settings -> Integrations -> Webhooks),
#    add the URL:
#      https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
#    and set the Authorization header to:
#      Bearer <WEBHOOK_AUTH>
```

`verify_jwt = false` is set in supabase/config.toml so the function
accepts RC's unauthenticated POSTs; auth lives in the shared-secret
Bearer header inside the function itself.

### 5. Env vars summary

Production / dev build needs:

```
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_xxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_xxxxxxxxxxxx
```

Set in:

- `.env.local` for local dev (already gitignored)
- EAS secrets (`eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value appl_...`) for production builds

Edge Function needs:

```
REVENUECAT_WEBHOOK_AUTH=<the long random string you generated above>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase
into Edge Functions automatically — no setup needed.

### 6. Switching to corporate Apple account later

Apps transfer between Apple Developer accounts via App Store Connect once
both are enrolled. IAP subscription history transfers with the app. Don't
block the initial launch on the corporate switch — ship under the
individual account first, switch when D-U-N-S / Companies House
verification is done.

---

## Wire email confirmation + password reset (Supabase Dashboard)

The app-side flow is shipped:

- [app/(auth)/forgot-password.tsx](<app/(auth)/forgot-password.tsx>) requests a
  reset email
- [app/(auth)/reset-password.tsx](<app/(auth)/reset-password.tsx>) handles
  `waypoint://reset-password?code=...`
- [app/(auth)/check-email.tsx](<app/(auth)/check-email.tsx>) is shown after
  sign-up
- [app/(auth)/confirm-email.tsx](<app/(auth)/confirm-email.tsx>) handles
  `waypoint://confirm-email?code=...`
- [utils/supabase.ts](utils/supabase.ts) is set to `flowType: 'pkce'` so
  Supabase ships a one-time `?code=` instead of a fragment

Three Dashboard things still need flipping before any of it works in
production:

### 1. Redirect URL allowlist

Dashboard → **Authentication → URL Configuration → Redirect URLs**. Add
these patterns (Supabase blocks any `redirectTo` value not on this list):

```
waypoint://reset-password
waypoint://confirm-email
waypoint://**
```

The `**` wildcard is the easiest "all-of-our-scheme" guard, but if you
want to be strict, the two specific URLs above are sufficient.

### 2. Toggle email confirmation on (optional but recommended)

Dashboard → **Authentication → Sign In / Up → Confirm email** → **Enable**.

With this off, `signUp()` returns a session immediately and the user
walks straight into onboarding — fine for testing, weak signal of email
ownership in prod. With this on, `signUp()` returns a user but no
session, our code routes to `/check-email`, and the user must tap the
emailed link before they can sign in.

`supabase/config.toml` controls this for local Supabase only — line 157
(`[auth.email] enable_confirmations`). Flip it there if you want the same
behaviour against `supabase start`.

### 3. Customize the two email templates

Dashboard → **Authentication → Email Templates**.

- **Confirm signup** — body should contain `{{ .ConfirmationURL }}`; PKCE
  appends the `?code=` automatically. Default template works; just
  branding/copy.
- **Reset password** — same: keep `{{ .ConfirmationURL }}`. Subject line
  defaults to "Reset your password".

If you're using a custom SMTP, also confirm the **From** name + address
under **Authentication → SMTP Settings** so reset emails don't land in
spam.

### 4. Smoke-test on a real device

Email auth deep links require the `waypoint://` scheme handler to be
registered, which only happens in a real build (Expo Go cannot register
custom schemes). The current EAS dev build already has it. To verify:

1. Sign up with a real email → confirm `/check-email` shows
2. Tap link in email → app should open at `/confirm-email`, exchange code,
   route to `/onboarding/basic`
3. From `/signin`, tap **Forgot password?** → enter the same email →
   tap the link → app should open at `/reset-password`, accept new
   password, route to `/(tabs)`

---

## Verify production parity with local

A lot of this branch's work is local-only at the time of writing. Before
relying on production behaviour, walk through this list:

**Migrations.** Supabase Branching applies migrations to preview DBs
automatically; whether it auto-applies to production on merge depends on the
project's branch settings (Dashboard → Branches → Settings → "Auto-merge
migrations"). If that toggle is off, production still doesn't have the new
RPCs. Check from the production SQL editor:

```sql
SELECT proname
FROM pg_proc
WHERE proname IN (
  'search_cities',
  'get_city_meta_window',
  'get_city_users_ranked',
  'get_city_plans_ranked',
  'get_city_overview',          -- should be ABSENT post-merge
  'get_visit_details'           -- should be ABSENT post-merge
)
ORDER BY proname;
```

Expect four rows (the new ones), and the two old ones gone. If anything is
off, trigger the migration from the Branches tab manually.

**Seed data.** The seed (`scripts/seed/`) is run only against local /
preview DBs, never production. Production has whatever real users have
created. Faker-generated visit/event data, the `pro` subscription row, and
the city distributions you've been testing against are local-only.

**Mapbox token.** `EXPO_PUBLIC_MAPBOX_TOKEN` needs to be set in whatever
environment runs the production build (Expo EAS secrets, .env in CI, etc.),
not just local `.env`. `/search`'s Mapbox fallback and `getCityCoordinates`
both fail silently without it.

**Type regen.** `types/supabase.ts` is generated from the local Supabase
schema with `supabase gen types typescript --local`. If production has
schema that local doesn't (or vice versa), the types will drift. Regenerate
post-merge from prod once migrations are confirmed applied.

**Storage buckets.** None of this branch's work creates new buckets, but
the Wikimedia image hydration (below) will need one — flag if that lands.

## Delete `/explore`

[app/explore.tsx](app/explore.tsx) is partially obsoleted by `/search`
([app/search.tsx](app/search.tsx)) and the home-tab rails (Trending Trips,
Popular Plans, New Plans).

What `/explore` does today:

- **City/title text search** — fully covered by `/search`.
- **Trending / Popular / New filter modes** — covered by home rails.
- **`COUNTRY_PILLS` filter** — 8 hardcoded countries (`GB, US, FR, ES, IT, JP,
TH, DE`). The only piece without a direct replacement on home today.

Deferred because killing `/explore` removes the country-pill browse surface
with nothing to take its place. To unblock the deletion, either:

1. Replace `COUNTRY_PILLS` on home with a `get_popular_countries()` RPC ranked
   by activity (top N countries in events + visits), or
2. Decide the surface isn't worth replacing — users can type a country's main
   city into `/search`.

Then delete `app/explore.tsx`, drop the `'explore'` entry from
[app/\_layout.tsx](app/_layout.tsx) (both the dynamic-routes allow-list and the
`Stack.Screen` registration), and grep for any deep links pointing at it.

## Wikimedia city image hydration

[utils/cityImages.ts](utils/cityImages.ts) hardcodes ~28 cities → curated
Pexels URLs, with a generic-photo fallback for unknown cities. Result: a city
the app discovers via Mapbox (e.g. Dundee, Nagoya) shows a generic stock photo
that looks vaguely off-brand.

Plan:

1. New `city_media` table: `(city_key text PK, image_url text, attribution text,
fetched_at timestamptz)`.
2. Supabase Edge Function that, given a city name, hits Wikidata's SPARQL
   endpoint (`?city wdt:P18 ?image`) for the city image, falls back to
   Wikipedia's REST `page/summary/<city>` endpoint, downloads the image,
   re-uploads to a Supabase Storage bucket, and inserts the row. Returns the
   storage URL.
3. Frontend: `getCityImageUrl(city)` queries `city_media` first; on miss, calls
   the function; the function fills the cache. Subsequent loads are instant.

Why route through Supabase Storage: Wikipedia/Commons URLs can change, and
most Wikimedia images require **attribution** (CC-BY-SA in most cases).
Caching ourselves means stable URLs + we control the attribution string
surfaced near the image.

Estimate: ~half a day including attribution display. Pexels fallback works
today, so this isn't blocking.

## Implement presence indicator

[components/PersonCard.tsx:24](components/PersonCard.tsx#L24) declares
`is_online?: boolean` with a `// TODO: Implement presence` marker but the
field is never populated. To wire it up:

- Persist `last_seen_at` on `profiles` (already there in some shape) and write
  it from a client heartbeat or RLS-safe RPC on app foreground.
- Compute `is_online = (NOW() - last_seen_at) < interval '5 minutes'` in the
  RPC that hydrates user cards (`get_city_users_ranked` and friends).
- Render a small green dot on the avatar when `is_online` is true.

Not a debt risk — the existing card just doesn't show the dot.

## Sweep type-escape-hatches

There are ~33 `as any` / `as unknown as` casts across `app/`, `components/`,
`hooks/`, and `modules/`. Most are RPC return-shape coercions (the
auto-generated supabase types are wide and the consumers narrow them) and
appear safe, but a sweep would catch real bugs hidden behind them.

Run `rg "as (any|unknown as)" app components hooks modules` to find them.
