# Future Work

Tracking items deferred from cleanup passes. Each entry should explain *why* it
was deferred so a future contributor can pick it up without re-doing the
analysis.

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
[app/_layout.tsx](app/_layout.tsx) (both the dynamic-routes allow-list and the
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
