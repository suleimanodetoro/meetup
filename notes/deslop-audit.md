# Waypoint Pre-Launch Audit — Consolidated & Verified

Lead-reviewer consolidation of adversarially-verified findings. Severities and fix notes below incorporate the verifier's corrections (some were downgraded, some fixes were factually wrong in the original and are corrected here). Overlapping findings reported under multiple dimensions have been merged.

---

## 1. Executive Summary

**Kept findings: 22** (after deduping cross-dimension overlaps).

**Counts by corrected severity:**
- Blocker: **3**
- High: **11**
- Medium: **7**
- Low: **1** (`is_user_premium` anon probe — verifier downgraded from the duplicate set)

> Note on counts: severities reflect the verifier's *corrected* severity, not the original author's. Notable downgrades: `map.tsx focus refetch` (high→medium, then a duplicate to low), `is_user_premium anon` (low), `select('*') subscriptions/visits` (low).

### Launch BLOCKERS (must fix before ship)
- **`profiles` SELECT `USING(true)` TO public** — anon key dumps every user's PII (name, photo, bio, city, gender, nationality); `profile_visibility` is a silent no-op.
- **`visits` SELECT `USING(true)` TO public** — anon key reconstructs any named user's travel itinerary (which city, which dates). Physical-safety leak.
- **IDOR in `get_user_conversations(p_user_id)`** — any authenticated user reads any victim's entire DM/inbox (partner names, avatars, message previews, unread counts). No `auth.uid()` check.

Plus one **needs-decision** item gating the privacy story: `profile_visibility` / blocked-users are not enforced in discovery (product call required — see Security §S4).

---

## 2. Security

### S1. [BLOCKER] `profiles` SELECT `USING(true)` TO public exposes every profile to anon
**Evidence:** `supabase/migrations/20250625104406_remote_schema.sql:87-92` (`"Public profiles are viewable by everyone." FOR SELECT TO public USING (true)`) + lines 45-57 GRANT all DML on `profiles` to `anon`. Anon key ships in the bundle (`utils/supabase.ts:5-8`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). No later migration drops/revokes it.
**Impact:** Anyone with the shipped anon key runs `select * from profiles` and pages the whole user table (full_name, avatar_url, bio, location, gender, nationality_code, is_founder). `profile_visibility` never consulted = silent no-op. GDPR/PII + competitor scraping.
**Fix (new migration):**
```sql
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
REVOKE ALL ON public.profiles FROM anon;
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (true);
```
**Verifier corrections:** Do NOT add a DELETE policy — none exists today and RLS denies-by-default; account deletion goes through `delete_user_account()`. Optionally re-scope the existing INSERT/UPDATE policies (currently `TO public`, gated `auth.uid()=id`) to `TO authenticated` for clarity. Discovery is unaffected (SECURITY DEFINER RPCs bypass RLS). Cross-user profile view (`app/profile/[userId].tsx`) preserved by the authenticated `USING(true)` policy.

### S2. [BLOCKER] `visits` SELECT `USING(true)` TO public leaks every user's city + travel dates
**Evidence:** `supabase/migrations/20250806183500_refactor_schema.sql:17` (`"Users can view all visits" FOR SELECT USING (true)`, no TO clause → PUBLIC incl. anon). `visits` stores user_id, city, country, start_date, end_date (lines 2-11). Anon default SELECT grant present; never revoked.
**Impact:** Joined with the public `profiles` read, an anon caller computes for any named user exactly which city they'll be in and when. Worst-class leak for a travel app.
**Fix (new migration):**
```sql
DROP POLICY IF EXISTS "Users can view all visits" ON public.visits;
REVOKE ALL ON public.visits FROM anon;
CREATE POLICY "Authenticated users can read visits"
  ON public.visits AS PERMISSIVE FOR SELECT TO authenticated USING (true);
```
**Verifier note:** Owner-scoped INSERT/UPDATE/DELETE (lines 18-20) are gated by `auth.uid()=user_id` and harmless to leave; optionally add `TO authenticated`. Use `REVOKE ALL` (not just SELECT/INSERT/UPDATE/DELETE) — Supabase default grant to anon is ALL.

### S3. [BLOCKER] IDOR in `get_user_conversations(p_user_id)` — read anyone's inbox
**Evidence:** Effective (latest) definition is `supabase/migrations/20250903074417_fix_ambiguous_conversation_id.sql` (NOT 20250829202448 as originally cited — Supabase applies in lexicographic order). SECURITY DEFINER, filters only `WHERE cp.user_id = p_user_id`, never compares to `auth.uid()`. GRANT EXECUTE TO authenticated. Only caller `app/(tabs)/chats.tsx:57-60` already passes own `session.user.id`.
**Impact:** Any logged-in user calls `rpc('get_user_conversations',{p_user_id:<victim>})` → victim's full inbox: DM partner names+avatars, last-message previews, last sender, unread counts. Full horizontal privilege escalation on private messaging.
**Fix (new migration — minimal non-breaking guard):**
```sql
CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id uuid)
RETURNS TABLE(conversation_id bigint, conversation_type text, conversation_name text,
  avatar_url text, last_message_content text, last_message_at timestamptz,
  last_message_user_name text, unread_count bigint, participant_count bigint,
  event_id bigint, event_country_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  <body copied from the LIVE def in 20250903074417_fix_ambiguous_conversation_id.sql>;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_user_conversations(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_conversations(uuid) FROM anon;
```
**Verifier note:** Source the body from `20250903074417`, not `20250829202448`. Long-term preferred: drop the param, use `auth.uid()` internally, change `chats.tsx:57-60` to `.rpc('get_user_conversations')` with no args (confirmed only caller).

### S4. [HIGH · NEEDS-DECISION] `profile_visibility` / blocked-users NOT enforced in discovery
**Choice required (product):** (a) Should `profile_visibility=private`/`friends_only` actually suppress a user from discovery? (b) Should blocks hide users two-way in discovery? Both change *who users see*.
**Evidence:** `user_privacy_settings.profile_visibility` (public|friends_only|private) exists (`20250820124900_messaging_system_schema.sql:71`) and is written by `app/settings/privacy.tsx`, but the SECURITY DEFINER discovery RPCs never read it or `blocked_users`: `get_users_in_city`/`get_nearby_city_users` (`20260530161000`), `get_city_users_ranked` (latest `20260530161100`), `get_city_meta_window` (`20260523140000`), `get_visit_users` (`20250819202000`), and `get_suggested_users` (`20260524150000`, SECURITY INVOKER). Setting is a system-wide no-op today.
**Impact:** A user who picks "Private" or blocks someone still appears in city lists, map, ranked discovery, and visit overlaps — a false sense of safety and a stalking vector.
**Fix (apply in EVERY discovery RPC's final SELECT — RLS cannot reach DEFINER fns):**
```sql
-- exclude blocks both directions
AND NOT EXISTS (SELECT 1 FROM public.blocked_users b
  WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
     OR (b.blocker_id = p.id AND b.blocked_id = auth.uid()))
-- honor visibility (public always; friends_only requires accepted friendship; private never)
AND (
  COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups
            WHERE ups.user_id = p.id), 'public') = 'public'
  OR (
    COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups
              WHERE ups.user_id = p.id), 'public') = 'friends_only'
    AND EXISTS (SELECT 1 FROM public.friendships f WHERE f.status='accepted'
      AND ((f.requester_id=auth.uid() AND f.addressee_id=p.id)
        OR (f.requester_id=p.id AND f.addressee_id=auth.uid())))
  )
)
```
**Verifier corrections:** The original list omitted `get_suggested_users` — it MUST be patched too (use `current_user_id`/`p.id` there, not `auth.uid()`). `get_city_meta_window` is COUNT-only — must use the *identical* filter as `get_city_users_ranked` or "has more" paging desyncs (`hooks/useCityOverview.tsx:98-177`). Keep the `profiles` table policy permissive (`TO authenticated USING(true)`); visibility belongs in the RPC layer. This supersedes the standalone "City/map RPCs ignore blocked_users" finding (same root cause).

### S5. [HIGH] `attendance` INSERT `WITH CHECK(true)` — forge RSVPs + conscript victims into group chats
**Evidence:** `supabase/migrations/20250702194302_remote_schema.sql:65-70` (`"Enable insert for authenticated users only" FOR INSERT TO authenticated WITH CHECK (true)`). `user_id` unconstrained. AFTER INSERT trigger `add_user_to_event_conversation()` (SECURITY DEFINER, `20250829202448_fix_messaging_system_complete.sql:84-126`) inserts `NEW.user_id` into `conversation_participants`, bypassing RLS. Both legit insert sites pass own id (`app/create-plan/review.tsx:134-139`, `app/event/[id]/index.tsx:174-179`).
**Impact:** Any authenticated user inserts `attendance{event_id, user_id:<victim>}` → forges the victim's RSVP AND silently adds them to an attacker-chosen group chat (readable, messageable). Inflates attendee counts; harassment vector.
**Fix (new migration):**
```sql
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.attendance;
REVOKE ALL ON public.attendance FROM anon;  -- hygiene; anon INSERT already RLS-denied
CREATE POLICY "attendance_self_insert" ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
```
**Verifier corrections:** The load-bearing change is the DROP+CREATE of the INSERT policy (the REVOKE is hygiene only — anon INSERT was already denied since the policy targets `authenticated`). The optional `attendance_self_delete` policy ADDS new "leave" capability (no client uses it today) — product choice, not part of the fix. Optionally add `UNIQUE (event_id, user_id)` (client already relies on error 23505 to dedupe).

### S6. [HIGH] `events` INSERT `WITH CHECK(true)` + write grants to anon — authorship spoof
**Evidence:** `supabase/migrations/20250705131242_remote_schema.sql:1-6` (`WITH CHECK (true)` TO authenticated); base table grants insert/update/delete/truncate on `events` to BOTH anon and authenticated (`20250702135323_remote_schema.sql:23-49`); no UPDATE/DELETE policy exists. Ownership column `user_id` (nullable, FK `ON DELETE SET NULL`). Only insert path sets `user_id: session.user.id` (`app/create-plan/review.tsx:71-90`).
**Impact:** Any authenticated (raw PostgREST) caller inserts an event with an arbitrary `user_id`, spoofing authorship; `on_event_created` trigger then names a group conversation after the forged event. Pollutes discovery, impersonation.
**Fix (new migration):**
```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.events FROM anon, authenticated;
-- drop ALL existing permissive write policies (real name unknown; enumerate)
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT polname FROM pg_policy
    WHERE polrelid='public.events'::regclass AND polcmd IN ('a','w','d')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.events', p.polname); END LOOP;
END $$;
CREATE POLICY "events_owner_insert" ON public.events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "events_owner_update" ON public.events
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "events_owner_delete" ON public.events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
```
**Verifier corrections:** Do NOT hardcode a guessed policy name (`events_insert_any`); enumerate via the `DO` block above (leaves the SELECT policy untouched). Also REVOKE TRUNCATE (granted to both roles). The owner UPDATE/DELETE policies are net-new capability (none exist today, no client edit/delete path) — safe to add. Keep public SELECT for anon browsing only if S7 is NOT applied; with S7 the SELECT becomes authenticated-only. *(Merges the duplicate "events: no INSERT/UPDATE/DELETE ownership policy" finding.)*

### S7. [HIGH] Anon discovery SELECT on `events` / `attendance` / `event_costs` / `event_venues` (+ `nearby_events`)
**Evidence:** Four tables expose `FOR SELECT USING(true)` to public plus anon grants: `events` (`20250702135323:65-70`), `attendance` (`20250702194302:73-78`), `event_costs`/`event_venues` (`20250814130008:42,47`). `nearby_events` (`20250705180737:13-34`) is SECURITY INVOKER with no explicit grant → EXECUTE defaults to PUBLIC, returns raw lat/long for every event. All direct reads in-app are authenticated (`app/explore.tsx:237/263`, `app/event/[id]/index.tsx:113`, `app/profile/[userId].tsx:131/138`, `useChat.ts:95`, `friend-requests.tsx:69/74`, `(tabs)/profile.tsx:114/141`).
**Impact:** Anon harvest of the entire event graph, attendee lists (de-anonymizes who attends what), and precise venue coordinates with only the shipped key. anon currently even holds DELETE/UPDATE/TRUNCATE on events/attendance.
**Fix (new migration):**
```sql
DROP POLICY IF EXISTS "Enable read access for all users" ON public.events;
CREATE POLICY "Authenticated can read events" ON public.events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable read access for all users" ON public.attendance;
CREATE POLICY "Authenticated can read attendance" ON public.attendance FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Public can view event venues" ON public.event_venues;
CREATE POLICY "Authenticated can read event venues" ON public.event_venues FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Public can view event costs" ON public.event_costs;
CREATE POLICY "Authenticated can read event costs" ON public.event_costs FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.events, public.attendance, public.event_costs, public.event_venues FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.nearby_events(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_events(double precision, double precision) TO authenticated;
```
**Verifier note:** The function signature `(double precision, double precision)` matches the sole def (no overloads). Prefer `REVOKE ... FROM PUBLIC` not just anon. This also closes anon WRITE on events/attendance (a bonus). *(This finding + S1 + S2 are the same "anon-key reads everything via USING(true)" family — see the merged note S12 below; apply all DROP/CREATE-to-authenticated + REVOKE in one coordinated migration.)*

### S8. [HIGH] Storage: avatars bucket — open anon INSERT, no size/MIME cap, flat filenames break owner policies
**Evidence:** `supabase/migrations/20250811210000_fix_avatars_bucket.sql:10-12` creates bucket with only (id,name,public=true) — no `file_size_limit`/`allowed_mime_types`. Lines 19-21 `"Anyone can upload an avatar" FOR INSERT WITH CHECK (bucket_id='avatars')` with NO `TO authenticated` → applies to anon (deliberately replaced the prior secure policy dropped at lines 3-7). All uploaders use FLAT filenames (`app/edit-profile.tsx:295`, `modules/onboarding/sequence.ts:25`, `app/create-plan/review.tsx:49`), so owner UPDATE/DELETE policies (lines 23-29, `(storage.foldername(name))[1]=auth.uid()::text`) never match (flat name → NULL). No `event-images` bucket exists; plan images go to `avatars`.
**Impact:** Anon key = free, public, CDN-served file host on your egress bill (cost + arbitrary-content abuse). Owner update/delete silently unenforceable.
**Fix (ship app path change + DB migration TOGETHER):**
```sql
-- DB
UPDATE storage.buckets SET file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'] WHERE id='avatars';
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "avatars_public_read"  ON storage.objects FOR SELECT USING (bucket_id='avatars');
CREATE POLICY "avatars_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
```
```diff
- // app/edit-profile.tsx:295
- const fileName = `${userId}-${position}-${Date.now()}.jpg`;
+ const fileName = `${userId}/${position}.jpg`;          // stable → upsert overwrites, no orphan
- // modules/onboarding/sequence.ts:25
- const fileName = `${userId}-${Date.now()}.jpg`;
+ const fileName = `${userId}/main.jpg`;                 // align with edit-profile "main"
- // app/create-plan/review.tsx:49
- const fileName = `plan-${Date.now()}-${session.user.id}.jpg`;
+ const fileName = `${session.user.id}/plan-${uuid}.jpg`; // client uuid; enables later delete
```
**Verifier corrections:** Deploying the path-scoped INSERT policy WITHOUT the filename change breaks ALL uploads — ship together. The UPDATE policy MUST include `WITH CHECK` (original lacked it). Dashboard-created duplicate policies (per ground truth) aren't in VC; the `DROP IF EXISTS` set is best-effort. *(This finding merges the two duplicate storage findings — the open-anon-INSERT one and the flat-filename/orphan one — into one coordinated fix.)*

### S9. [HIGH] Multiple SECURITY DEFINER functions lack `SET search_path`
**Evidence:** Missing on: `get_or_create_dm_conversation_v3` (`20250910122204`), `get_users_in_city`/`get_nearby_city_users` (`20260530161000`), `get_city_users_ranked` (latest `20260530161100`), `get_city_meta_window`/`get_city_plans_ranked` (`20260523140000`), `get_city_overview` (`20260523130100`), `get_visit_details`/`get_visit_users`/`get_visit_plans` (`20250819202000`), `is_user_premium`/`is_user_founder` (`20260606180000` — regression; `20260524150000:24` HAD it and the redefine dropped it). Reference impl `create_event_conversation` and `delete_user_account` set it correctly.
**Impact:** Defense-in-depth: classic Postgres privilege-escalation primitive. Bodies are mostly schema-qualified (mitigates table resolution) so likelihood is lower — hence severity is the original's medium in practice, but the verifier kept it confirmed and it should be fixed uniformly.
**Fix:** Append `SET search_path = public, pg_temp` immediately after `SECURITY DEFINER` on every flagged function's LATEST definition (for the redefined ones, patch `20260530161100` / `20260606180000`, not the earlier copies).
**Verifier correction:** Use a single uniform `SET search_path = public, pg_temp` — `auth` is NOT needed (all `auth.uid()` calls are already fully qualified). (Listed under High in the original set; treat as a fast hardening pass bundled with the other RPC edits.)

### S10. [LOW] `is_user_premium(uuid)` granted EXECUTE to anon — billing-status oracle
**Evidence:** `supabase/migrations/20260606180000_add_founder_supporter_entitlement.sql:30-60` + duplicate grant `20260524150000:35`. SECURITY DEFINER, takes arbitrary uuid, reads `user_subscriptions` (RLS-restricted, no anon grant). Anon can `select is_user_premium('<uuid>')` to learn any user's paid status.
**Impact:** Minor billing-status disclosure / paying-account enumeration pre-auth.
**Fix (new migration):**
```sql
REVOKE EXECUTE ON FUNCTION public.is_user_premium(uuid) FROM anon;
-- (optional, cosmetic) REVOKE EXECUTE ON FUNCTION public.is_user_founder(uuid) FROM anon;
```
**Verifier corrections:** Only `is_user_premium` matters — `is_user_founder` reads `profiles.is_founder` which is already public via the profiles grant, so revoking it is cosmetic. Do NOT drop the uuid param / self-scope to `auth.uid()` — `app/profile/[userId].tsx:111` passes the *viewed* user's id to badge them; removing it breaks the badge. A single REVOKE covers both historical grant sites.

### S11. [HIGH] `EXPO_PUBLIC_MAPBOX_TOKEN` ships unrestricted in the bundle
**Evidence:** Injected via `app.config.ts:126` into expo `extra` (ships in bundle); read at `map.tsx:27/80`, `profile.tsx:42`, `app/city/[name].tsx:14`, `utils/geographic.ts:314`, `utils/AddressAutocomplete.ts:3`. Token is a `pk.` public token (must ship for native maps, trivially extractable). `MAPBOX_DOWNLOAD_TOKEN` (sk) is correctly NOT `EXPO_PUBLIC_`. `.env` never committed (verified `git log --all` empty; gitignored).
**Impact:** Extracted token bills your Mapbox account for map loads + Geocoding/Search Box REST. Standard leaked-map-key abuse.
**Fix (dashboard + build, no code change — do NOT rename the env var):**
1. **Set a Mapbox billing alert/hard cap NOW** (only effective native control; highest-value, minutes to do).
2. Rotate the shipped token (assume compromised); new token: public scopes only, never a secret scope.
3. Move build-time injection to EAS secret: `eas secret:create --scope project --name EXPO_PUBLIC_MAPBOX_TOKEN --value <new>`.
**Verifier correction:** Moving to an EAS secret does NOT remove the token from the shipped IPA/APK — that is inherent and unavoidable for a native `pk` token. URL restrictions are referer-based = web-only, ineffective for native. The billing cap is the real bound on abuse.

### S12. [Merge note] The "anon reads everything via USING(true)" family
S1 (profiles), S2 (visits), S7 (events/attendance/event_costs/event_venues), and the `is_user_premium` anon grant (S10) are all the same root cause: `USING(true)` SELECT policies + default anon table/function grants + a bundled anon key. **Apply them as one coordinated migration**, each table getting: `DROP` the public policy → `CREATE` a `TO authenticated USING(true)` SELECT policy → `REVOKE ALL FROM anon` (use DROP+CREATE, never `ALTER POLICY ... TO` — Postgres cannot change a policy's role). Discovery DEFINER RPCs keep working (they bypass RLS via EXECUTE grants).

---

## 3. Cost & Egress

### C1. [HIGH] Migrate ~41 raw RN `<Image>` usages to `expo-image` with disk caching
**Evidence:** `package.json` has `expo-image-picker`/`expo-image-manipulator` but NOT `expo-image` (grep: zero hits). 41 raw `<Image>` (no persistent disk cache). Worst: `app/(tabs)/map.tsx:431/470/492/677` markers re-mount on every focus (`useFocusEffect` re-fetch). Other hot sites: `index.tsx:158`, `chats.tsx:216`, `profile.tsx:523`, `profile/[userId].tsx:354/508`, `event/[id]/index.tsx:314/387/550/591`, `PersonCard.tsx:73`, `PlanCard(Home)`, `UserCard.tsx:42`, `VisitCard.tsx:116/201`, chat screens, etc.
**Impact:** Every view/scroll/tab-refocus re-downloads avatars + event/city images from Supabase Storage egress (billed/GB). Returning users pay for the same bytes dozens of times/session.
**Fix:**
1. `npx expo install expo-image`.
2. `components/AppImage.tsx` wrapper with `cachePolicy="memory-disk"`, `transition={150}`, `recyclingKey` from uri.
3. Codemod call sites: `resizeMode="cover"` → `contentFit="cover"`; `source={{uri}}` unchanged; `onError` unchanged. Prioritize list/marker files: map, PersonCard, VisitCard, PlanCard(Home), UserCard, chats, event detail.
**Verifier corrections:** (a) `event/[id]/index.tsx:553` uses `defaultSource={{uri:<remote>}}` — do NOT convert to `placeholder={{uri}}` (expo-image placeholder is blurhash/local; a remote placeholder adds an egress fetch); drop the remote placeholder. (b) `create-plan/image.tsx:247` has `resizeMode:'cover'` inside a StyleSheet — expo-image ignores that; move to a `contentFit="cover"` prop on the `<Image>` at line 127.

### C2. [HIGH] No Supabase Storage image transforms — full-res ~2000px JPEGs into 32-120px boxes
**Evidence:** `utils/pickAndEncodeImage.ts:8` caps at maxWidth=2000; called `(2000, 0.5)` at `edit-profile.tsx:292` / `PictureField.tsx:16`. `create-plan/image.tsx:66-73` resizes to 2000 (not "no cap" as originally stated). `getPublicUrl` used everywhere with NO transform option. Rendered tiny: `ChatShell.tsx:168` (32px), `friend-requests.tsx:179` (60px), `search-users.tsx:151` (50px), map markers (~48px), PersonCard thumbs.
**Impact:** Avatars/thumbnails ship 10-40× more bytes than the pixels need — largest avoidable egress multiplier + decode/RAM cost (OOM/jank risk on low-end Android).
**Fix:**
1. **Tier-independent now:** lower `pickAndEncodeImage.ts:8` cap 2000 → ~1024; route the plan image through `pickAndEncodeImage` to dedupe.
2. If the Supabase Image Transform add-on is enabled (it is currently OFF — `config.toml:93-95` commented, Pro-only): add `utils/storageImage.ts` `sizedAvatar(url, px)` using `getPublicUrl(path, { transform: { width, height, resize:'cover' } })`; call at render with intent sizes (chat 64, list 96, hero 800, event hero 1200).
3. If add-on stays off: upload a 256px derivative at upload time → `avatar_thumb_url` column; render that for small contexts.
**Verifier corrections:** Transform add-on is NOT enabled — don't ship `sizedAvatar` as the sole fix assuming it works; verify or use the derivative path. The "expo-image caches each size separately" rationale is wrong for this repo (uses built-in `Image`, see C1). The lower-the-cap change is the immediate tier-independent win.

### C3. [HIGH] Replace ~14 pravatar/placeholder.com/unsplash/picsum fallbacks with a local initials avatar
**Evidence:** Avatar fallbacks hit third-party human-face/random-photo services when `avatar_url` is null. Sites: `map.tsx:433/472/678`, `chats.tsx:207`, `chat/[eventId].tsx:57`, `chat/dm/[conversationId].tsx:45`, `ChatShell.tsx:168`, `event/[id]/index.tsx:316/390/551/554/593`, `friend-requests.tsx:180`, `profile/[userId].tsx:356`, `search-users.tsx:151`, `settings/privacy.tsx:264`. **Live probes: `via.placeholder.com` is DOWN (000/timeout) and `source.unsplash.com` returns 503 — both broken in prod today.** `i.pravatar.cc` serves a real unrelated human's face for photo-less users (catfishing surface). `cityImages.ts:115` `getCityInitialsImage` (ui-avatars.com) is dead code.
**Impact:** (1) Egress + availability dependency on services that are already down. (2) Trust/safety — anon users shown a random real human's face. (3) unsplash/picsum return a different image per load → wasted egress + flicker.
**Fix:** Add `components/InitialsAvatar.tsx` (deterministic color+initials from id/name, zero network). At each site render it when `avatar_url` is falsy. For event hero (unsplash) + venue gallery (picsum per-index): drop random services, use a local gradient/asset. Delete dead `getCityInitialsImage`. `PersonCard`/`UserCard`/`VisitCard`/`PlanCardHome` already do conditional+local-Ionicons fallback — reuse that pattern.
**Verifier corrections:** The original example diff referenced `AppImage`/`sizedAvatar` which don't exist (won't compile) — use plain RN `Image` for the photo branch + `InitialsAvatar` for the no-photo branch. In `ChatShell`, id may need to come from `message.user_id` (verify `MessageWithDetails` shape). Also fold in `VisitCard.tsx:55` → `getPlaceholderImageUrl` → picsum (same cleanup).

### C4. [MEDIUM] `select('*')` on `profiles` fetches 27 columns where 5-13 are rendered
**Evidence:** `profiles` Row has 27 cols (`types/supabase.ts:519-549`). `select('*')` at `app/(tabs)/index.tsx:49-53` (uses only avatar_url), `app/(tabs)/profile.tsx:97`, `app/profile/[userId].tsx:93-97`, `modules/onboarding/persist.ts:6`. Hot navigation paths. `map.tsx` already narrows — leave it.
**Impact:** Wasted egress + deserialization on hot paths; leaks unused columns (avatar_url_2/3, website, username, onboarding_step) to clients.
**Fix:** Narrow each select to the consumed columns:
- `index.tsx:49-53` → `.select('avatar_url')`
- `profile.tsx:97` → `.select('id, avatar_url, full_name, bio, location, location_country, location_country_code, nationality, nationality_code')`
- `profile/[userId].tsx:93-97` → `.select('id, full_name, bio, avatar_url, birth_date, nationality, nationality_code, location, location_country, location_country_code, languages, interests, gender, instagram_url, tiktok_url, youtube_url, is_founder, founder_year')`
- `persist.ts:6` → `.select('id, full_name, birth_date, nationality, nationality_code, gender, gender_preference, meeting_preference, interests, languages, bio, avatar_url, location, location_country, location_country_code, onboarding_step, onboarding_completed')`
**Verifier correction:** The original `persist.ts` list OMITTED `avatar_url` — without it the onboarding "picture" step's `read()` returns undefined and re-commit can wipe the avatar to null. `avatar_url` is included above (required).

### C5. [LOW] `select('*')` on `user_subscriptions` + `visits`/`events`
**Evidence:** `hooks/useSubscription.tsx:69` `select('*')` (10 cols, reads only `entitlement_id`/`expires_at`; mounted by multiple components, refetches on every realtime tick). `profile.tsx:128-134` `visits.select('*')` (uses only `.length`). `profile/[userId].tsx:137-143` `events.select('*')` (pulls `location_point` geometry, renders only id/title/city/date/image_uri).
**Impact:** Repeated small over-fetch, worst on the fan-out subscription hook.
**Fix:** `useSubscription` → explicit full-column list (keeps typed row) or minimally `.select('entitlement_id, expires_at')`. `profile.tsx:130` → count query `.select('id', { count:'exact', head:true })`. `profile/[userId].tsx:139` → `.select('id, title, city, date, image_uri')`.
**Verifier note:** Cost micro-opt, not a bug; batch with C4.

### C6. [MEDIUM] `map.tsx` re-runs GPS + reverseGeocode + profiles SELECT/UPDATE + RPC on every tab focus
**Evidence:** `app/(tabs)/map.tsx:123-127` `useFocusEffect` calls `loadUserLocationAndCheckForChanges()` unconditionally; tab screens stay mounted. Each focus: profiles SELECT (132-138), `getCurrentPositionAsync`+`reverseGeocodeAsync` (168-176), conditional profiles UPDATE (212-220), `get_users_in_city` RPC (256). No TTL guard. `location_updated_at` column exists but only gates the UPDATE.
**Impact:** Repeated GPS fixes (battery) + redundant DB round-trips per tab bounce.
**Fix:**
```tsx
const lastLoadRef = useRef(0);
const loadedOnceRef = useRef(false);
useFocusEffect(useCallback(() => {
  const now = Date.now();
  if (loadedOnceRef.current && now - lastLoadRef.current < 60_000) return;
  lastLoadRef.current = now; loadedOnceRef.current = true;
  loadUserLocationAndCheckForChanges();
}, [session?.user?.id]));
```
**Verifier corrections:** The original snippet's `&& hasCheckedLocation` reads stale state inside the callback — use pure refs (above). reverseGeocode/getCurrentPosition use the **on-device OS geocoder, NOT Mapbox** — they are NOT Mapbox-billed (battery only); the only Mapbox-billed call is `geocodeCity()` (lines 74-96), which on the focus path runs only in the GPS-failure fallback. `get_users_in_city` is an indexed LIMIT-200 scan, not expensive. *(This + the "billed geo + DB write on focus" duplicate are the same finding — net severity medium→low; treat as one cleanup. Pairs with C1 marker re-download fix and the C7 fake-data removal.)*

### C7. [LOW] Event venue gallery — one random picsum image per venue + remote `defaultSource` placeholder
**Evidence:** `app/event/[id]/index.tsx:550-556` maps `venues` rendering `picsum.photos/400/300?random=${index}` (raw `<Image>`, no cache) with a remote `via.placeholder.com` `defaultSource`. Venue list unbounded; section expanded by default (`expandedSections.destinations:true`, line 97). `event_venues` has no photo column.
**Impact:** N venues = N picsum + up to N placeholder downloads, re-fetched and changing every open. Pure wasted egress + flicker; images aren't even the venue.
**Fix:** Drop the random remote imagery. Render a local gradient/solid behind the venue name (the existing overlay gradient at lines 557-565 must stay ON TOP — put the background View behind it via `StyleSheet.absoluteFill`). No `gradientFor()` helper needed; use a fixed theme color.

### C8. [LOW] City/visit images full-size from Pexels/Picsum every render; `getCityInitialsImage` external
**Evidence:** `utils/cityImages.ts:83/94` returns Pexels `w=800&h=600&dpr=2` (~1600×1200). `getPlaceholderImageUrl` (`:108`) returns picsum `800/600`. `VisitCard.tsx:55-58` ALWAYS uses the picsum placeholder (raw `<Image>:116`) and **discards the curated `visit.image_url` set at `index.tsx:63`** — so the home feed shows random picsum, a real bug. `getCityInitialsImage` (`:115`) is dead code.
**Impact:** Home feed (6 cards) + other-user profile thumbs re-download oversized third-party images; flicker; availability dependency. (Lower priority — third-party host, not your egress.)
**Fix:** (a) `VisitCard.tsx:56` — prefer `visit.image_url` when present, only fall back to placeholder (fixes the always-placeholder bug). (b) Drop `dpr=2`/lower `w` for these small cards. (c) Delete unused `getCityInitialsImage` (zero callers). (d) Optional: route through `expo-image` (C1) for disk cache.
**Verifier corrections:** Original overstated reach — `getCityImageUrl` is NOT called in city screens (`app/city/[name].tsx` is a Mapbox map, no hero image); real callsites are `index.tsx:63` + `profile/[userId].tsx:509`. The "use InitialsAvatar" advice is moot — just delete the dead export.

---

## 4. Quality / Prod-Readiness

### Q1. [HIGH] Zero crash/error reporting — install and wire `@sentry/react-native`
**Evidence:** No crash-reporting dep in `package.json` (only RevenueCat/Supabase/Mapbox). `app/_layout.tsx` has no init, no error boundary. Only ~69-80 raw `console.*` (go nowhere in release).
**Impact:** Production crashes / App Review rejections undiagnosable; render throws white-screen the whole app.
**Fix:** `npx expo install @sentry/react-native`; add the Expo config plugin in `app.config.ts`; `Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, enabled: !__DEV__, tracesSampleRate: 0.2 })` after `configureRevenueCat()` (line 20); `export default Sentry.wrap(function RootLayout(){...})`; add `EXPO_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` EAS secrets.
**Verifier note:** Also compose Metro config (`withSentryConfig(withNativeWind(...))`) if not auto-injected; verify the EAS build log shows "Uploaded ... source maps". Temporarily enable in dev to confirm events arrive.

### Q2. [HIGH] No React error boundary — any render throw white-screens the app
**Evidence:** Grep for errorboundary/componentDidCatch/getDerivedStateFromError = zero. `app/_layout.tsx:150-186` renders `<Stack>` with no boundary. expo-router's `Try` only wraps a route that exports a named `ErrorBoundary` — none do. Trigger paths real: `map.tsx:385` `(data||[]) as any` → indexed `usersInCity[0]` at `:482`.
**Impact:** A single bad RPC payload / null shape blanks the app with no recovery; App Review hard rejection.
**Fix:** Create `components/ErrorBoundary.tsx` (class with `getDerivedStateFromError` + `componentDidCatch`) rendering a "Something went wrong" + reload view; wrap `<Stack>` inside the providers in `app/_layout.tsx`. OR export an `ErrorBoundary` from a layout route (expo-router `Try` mechanism). Once Q1 lands, call `Sentry.captureException(error)` in `componentDidCatch`.
**Verifier correction:** Sentry is NOT installed yet — ship the boundary now; omit/guard the `Sentry.captureException` call until Q1 lands or it won't compile.

### Q3. [HIGH] Fake map data — `travelerDistance()` and `MARKER_OFFSETS`/`getRandomOffset()`
**Evidence:** `app/(tabs)/map.tsx:531-534` hashes `user.id` char codes into `${8 + total%12} mi` (fake distance, shown at :456). `MARKER_OFFSETS` (42-53) + `getRandomOffset()` (516-525) place pins at fixed offsets from city center (renderNearbyMarker 461-479). Backing RPC `get_users_in_city` returns NO coordinates/distance; `profiles` has no lat/lng (only `events` has geometry).
**Impact:** Users see precise-looking but fabricated distances + per-user map pins — App Review 2.3 misleading-content risk; trust erosion.
**Fix:** Remove the fake geo, keep the city-level map. Delete `MARKER_OFFSETS`, `getRandomOffset`, `travelerDistance` + its style block (971-977) + the distance `<Text>` (456). **Option A (recommended):** drop per-user pins entirely — delete the `visibleMapUsers.map(renderNearbyMarker)` (line 602) and `renderNearbyMarker` (461-479); the real-RPC traveler tray (636-671) preserves discovery. **Option B:** cluster into a single city-center count badge.
**Verifier correction:** Option A leaves dead code — `setSelectedUser` is only called in `renderNearbyMarker`, so ALSO delete `selectedUser` state (113), the user-detail modal (674-697), and orphaned modal/marker styles. (Do NOT attempt real per-user distance — `profiles` has no coords and storing them is a privacy regression.)

### Q4. [MEDIUM] ~80 `console.*` calls ship to production
**Evidence:** `babel.config.js` plugins array empty. 80 `console.*` across 30 files — **all are `console.error` (73) or `console.warn` (7); zero `console.log`.** `console.error` in catch blocks (`map.tsx:223/260/306`) leak Supabase error objects. Only `lib/revenuecat.ts` gates 3 behind `__DEV__`.
**Impact:** Perf overhead, noisy device logs, error-payload/user-id leakage in release.
**Fix:**
```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  const plugins = [];
  if (process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production') {
    plugins.push('transform-remove-console');  // NO exclude — see below
  }
  return { presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'], plugins };
};
```
`npm i -D babel-plugin-transform-remove-console`.
**Verifier correction:** The original `exclude: ['error','warn']` is a NO-OP — those are the ONLY two methods present, so nothing would be stripped and the leak remains. DROP the `exclude`. Better long-term: route real failures through `Sentry.captureException` (Q1) before stripping. Verify with a real `eas build --profile production` (the plugin is env-gated off in dev).

### Q5. [MEDIUM] 34 `as any` / `as unknown as` casts mask untyped Supabase payloads — the generated types are STALE
**Evidence:** 34 casts; the client is ALREADY `createClient<Database>(...)` (`utils/supabase.ts`) but `types/supabase.ts` is stale/drifting: `get_users_in_city` types lack `location_country_code` (added by `20260530161000`); `is_user_premium` absent entirely (added `20260524150000`); `get_city_users_ranked` types lack `is_premium`. Dangerous: `map.tsx:385 as any` (silences shape checks on indexed marker data) and `profile/[userId].tsx:111 (supabase.rpc as any)`.
**Impact:** RPC responses effectively untyped; a column rename (this repo has a history of `fix_ambiguous_columns` migrations) compiles clean and crashes at runtime with no error boundary.
**Fix:** Root cause = stale types, not "client untyped." (1) Regenerate: `npx supabase gen types typescript --project-id <REMOTE_REF> > types/supabase.ts` (use the remote ref from the dashboard — `config.toml` only has the local id). (2) Remove casts that now resolve (RPC casts, simple table selects). (3) Add a `gen:types` npm script + CI `tsc` check so it doesn't drift again.
**Verifier corrections:** Don't expect all 34 to vanish: `map.tsx:385` still mismatches (`interests: Json` vs local `string[]` — normalize); `useChat.ts` nested embedded-relation selects mostly still need explicit row mapping. Leave UI-prop casts (`edit-profile.tsx:713/977`, `signin.tsx:73`).

### Q6. [MEDIUM] Android `RECORD_AUDIO` permission declared but never used
**Evidence:** `app.config.ts:119` lists `android.permission.RECORD_AUDIO`; no mic usage anywhere (only photo-library `ImagePicker`). Generated manifest also has `MODIFY_AUDIO_SETTINGS` (line 5) + `RECORD_AUDIO` (line 8). **`expo-av` IS a direct dep (`package.json:32`) and its autolinked config plugin (`node_modules/expo-av/withAV.js:13-14`) re-injects these permissions** even though it's not in the `plugins` array.
**Impact:** Google Play flags a mic permission with no in-app feature = policy violation/rejection; scares users at install.
**Fix:** (1) Remove `expo-av` from `package.json` (genuinely unused — deletes the native module AND its autolinking plugin). (2) Remove `RECORD_AUDIO` from `app.config.ts:119`. (3) Delete the stale gitignored `android/` and `npx expo prebuild --clean`. Keep `ACCESS_*_LOCATION` + `POST_NOTIFICATIONS`.
**Verifier correction:** Removing only the `app.config.ts` line is INSUFFICIENT — `expo-av`'s plugin re-injects the permission. Dropping `expo-av` is REQUIRED, not optional. (If `expo-av` must stay, use `android.blockedPermissions` — but `MODIFY_AUDIO_SETTINGS` is still added unconditionally.)

### Q7. [MEDIUM] iOS permission strings weak + unused camera/mic strings auto-injected
**Evidence:** `app.config.ts:35-46`: photos string is grammatically broken ("upload it online"); location strings generic; `locationAlwaysAndWhenInUsePermission` declared but app is foreground-only (no background location anywhere). **`expo-image-picker` plugin auto-injects `NSCameraUsageDescription` + `NSMicrophoneUsageDescription` by default** (`withImagePicker.js:24-33`) — confirmed in the generated Info.plist with generic Apple-default strings, though the app never uses camera/mic (library-only).
**Impact:** App Review 5.1.1 — generic/broken purpose strings + an "Always" location declaration with no background use + unused camera/mic strings are all rejection triggers.
**Fix:**
```js
// app.config.ts
['expo-image-picker', {
  photosPermission: 'Waypoint needs access to your photo library so you can choose a profile photo and trip images to upload.',
  cameraPermission: false,        // app is library-only → suppress NSCamera
  microphonePermission: false,    // → suppress NSMicrophone
}],
['expo-location', {
  locationWhenInUsePermission: 'Waypoint uses your location to show your city on the map and find travelers near you.',
  // drop locationAlwaysAndWhenInUsePermission — no background use
}],
```
Then `npx expo prebuild --clean`.
**Verifier correction:** The original claim "no NSCameraUsageDescription is set, which is correct" is FALSE — the picker plugin injects it by default; the fix is to set `cameraPermission:false`/`microphonePermission:false`, not leave them.

### Q8. [LOW] `delete_user_account` leaves orphaned storage avatar/plan files
**Evidence:** `supabase/migrations/20251111163626_fix_delete_user_account.sql:20-39` deletes 8 tables + auth.users but never touches `storage.objects`. Avatar/plan files (uid-named) remain publicly served after deletion. *(The "orphaned user_subscriptions row" half of the original finding is FALSE — the FK is `ON DELETE CASCADE` to profiles, so the row IS removed; RevenueCat keys by `app_user_id`, not `original_transaction_id`.)*
**Impact:** Deleted users' photos served indefinitely (right-to-erasure) + storage cost accrues.
**Fix:** The robust fix is an edge function (service-role) that calls `storage.from('avatars').remove([...])` for the user's files, invoked from the delete flow — a plain SQL `DELETE FROM storage.objects` does NOT reliably free the underlying bytes. If doing it in SQL anyway, the ONLY predicate that matches today's flat names is a substring match (plan images embed the uid mid-string):
```sql
DELETE FROM storage.objects WHERE bucket_id='avatars'
  AND name LIKE '%' || user_id_to_delete::text || '%';
```
**Verifier corrections:** The original's folder-form (`(storage.foldername(name))[1] = uid`) and `split_part(...,'/',1)` predicates match ZERO objects today (flat names, no slash). Drop the `user_subscriptions` item (cascade handles it). Once S8's folder paths ship, switch to the folder predicate.

### Q9. [LOW] `get_city_users_ranked` regression — latest version dropped the `is_premium` column
**Evidence:** `20260524150000:159-261` added `is_premium boolean` (+ ORDER BY nudge + `s.user_id` tiebreaker). The later `20260530161100:4-103` recreates the function (to add `location_country_code`) and OMITS `is_premium` AND the tiebreaker. `hooks/useCityOverview.tsx:136` casts to `CityUser` (still declares `is_premium`) → undefined at runtime; `UserCard.tsx:50` then shows the blue verified check instead of the gold premium badge for premium users.
**Impact:** Premium/founder gold badge silently stopped rendering on the city Users tab; non-deterministic paging reintroduced.
**Fix:** When recreating `get_city_users_ranked` for S4/S9, restore `is_premium boolean` to RETURNS TABLE + project `public.is_user_premium(s.user_id) AS is_premium`; keep `location_country_code`; keep identical 5-arg signature; and restore `ORDER BY s.match_score DESC, s.s ASC, s.user_id ASC`.

---

## 5. Suggested Execution Order

### Phase 0 — Surgical one-file/one-RPC fixes (minutes each)
| Fix | Effort | Notes |
|---|---|---|
| **S3 IDOR `get_user_conversations` guard** | S | Single migration; non-breaking. **Do first — blocker.** |
| S10 `REVOKE is_user_premium FROM anon` | XS | One line. |
| Q3 remove fake map data | S | Delete-only edits in `map.tsx` (+ dead-code cleanup). |
| Q4 babel strip-console (drop `exclude`) | XS | `babel.config.js` + dep. |
| Q6 remove `expo-av` + `RECORD_AUDIO` | S | Drop dep, prebuild --clean. |
| Q7 iOS permission strings | S | `app.config.ts` + prebuild --clean. |

### Phase 1 — Policy / RPC migrations (one coordinated migration where noted)
| Fix | Effort | Notes |
|---|---|---|
| **S1+S2+S7 anon lockdown** (DROP public SELECT → authenticated, REVOKE anon) | M | **One migration.** S1, S2 are blockers. |
| **S5 attendance INSERT scope** | S | Closes conscription. |
| **S6 events INSERT/UPDATE/DELETE owner policies** | S | Use the `DO`-block enumerate-and-drop. |
| S9 `SET search_path` on all DEFINER fns | M | Bundle with the RPC recreations below. |
| **S4 visibility/blocks in discovery RPCs** (NEEDS-DECISION) | M-L | Gate on product decision; patch ALL 6 RPCs incl. `get_suggested_users` + `get_city_meta_window` with identical filter. |
| Q9 restore `is_premium` + tiebreaker in `get_city_users_ranked` | S | Fold into the S4 recreation of that RPC. |

### Phase 2 — Storage (DB + app shipped together)
| Fix | Effort | Notes |
|---|---|---|
| **S8 avatars bucket lockdown + per-user folder paths** | M | Migration + 3 filename edits **shipped together** (or all uploads break). |
| Q8 storage cleanup in account deletion | M | Prefer edge function; depends on S8 folder paths for the clean predicate. |

### Phase 3 — Prod-readiness wiring
| Fix | Effort | Notes |
|---|---|---|
| **Q1 Sentry** | M | Enables Q2's `captureException`. |
| **Q2 Error boundary** | S | Ship now (Sentry call guarded until Q1). |
| **S11 Mapbox token** — billing cap NOW, then rotate + EAS secret | S | Cap is minutes; highest-value first action. |
| Q5 regenerate stale DB types + CI guard | M | Removes most casts; surfaces real mismatches. |

### Phase 4 — Larger image/egress refactors
| Fix | Effort | Notes |
|---|---|---|
| C2 lower image cap 2000→1024 | XS | Tier-independent immediate egress win. |
| C3 InitialsAvatar + drop dead remote services | M | Two services already DOWN in prod. |
| C8 fix VisitCard always-placeholder bug + delete dead `getCityInitialsImage` | S | Real bug, cheap. |
| C7 venue gallery — drop random picsum | S | Local gradient. |
| C6 map focus TTL guard | S | Ref-based; battery/DB. |
| C4 narrow `profiles` selects | S | Watch `persist.ts` must keep `avatar_url`. |
| C5 narrow subscriptions/visits/events selects | S | Batch with C4. |
| **C1 migrate ~41 `<Image>` → expo-image** | L | Biggest refactor; do after the cheap egress wins. C2/C3 ride on this for some sites. |

**Effort key:** XS = <15 min · S = <1h · M = 1-4h · L = multi-day.
