# Pricing relaunch — July 2026

Decision (2026-07-19): Waypoint Premium moves to a three-tier ladder.

| Package  | Price (GBP base) | Intro offer          | Notes                          |
| -------- | ---------------- | -------------------- | ------------------------------ |
| Weekly   | £9.99 / week     | **1-week free trial**| Pre-selected default on paywall|
| Monthly  | £19.99 / month   | optional trial       |                                |
| Yearly   | £59.99 / year    | **no trial**         | "best value" badge; upfront    |

Trial = Apple's **1 Week** free intro (there is no "7-day" option; 1 week = 7
days). Put it on weekly (default funnel), optionally monthly. NOT on yearly —
a trial converting to a £59.99 charge invites refunds/chargebacks Apple
penalises. Trial length is data-driven: the paywall reads it off the product,
so changing it in ASC needs no app change.

Founder (supporter offering: annual + Founder Forever lifetime) is unchanged.

The app code is already done (`components/UpsellModal.tsx`): renders up to three
packages ordered weekly → monthly → yearly, pre-selects weekly, shows a
"free trial" badge + "1-week free, then £9.99/wk" meta line, switches the CTA to
"start 1-week free trial", and states the full trial terms in the legal footer.
No app code references product IDs — everything below is dashboard config,
picked up at runtime via `Purchases.getOfferings()`.

### Currency / localization note

The `premium_access` group is currently localized **English (U.S.)** only
(group display name "Waypoint Premium"). Display localization is independent of
price territory, but you must pick **one base currency for all three products**
so the ladder is consistent everywhere. The decision above is GBP; when you set
the weekly price (1a) confirm the existing monthly/yearly base prices are also
GBP-based (1b). If they were created in USD tiers, either move all three to GBP
base or restate this doc's numbers in USD — don't mix.

---

## Actual setup (from RevenueCat + ASC, confirmed 2026-07-20)

Nothing is live yet — the `premium_access` group has never been submitted, so
this is a **first submission**, not a reprice. There are no existing
subscribers to protect.

| Product ID (Apple = RC identifier) | What        | Group           | Status now            |
| ---------------------------------- | ----------- | --------------- | --------------------- |
| `app.usewaypoint.premium.monthly`  | Monthly     | `premium_access`| Prepare for Submission|
| `app.usewaypoint.premium.yearly`   | Yearly      | `premium_access`| Prepare for Submission|
| `app.usewaypoint.premium.weekly`   | **new**     | `premium_access`| — (you create it, 1a) |
| `app.usewaypoint.founder.annual`   | Founder yr  | `founder_support`| ⚠️ Missing Metadata  |
| `app.usewaypoint.founder.forever`  | Founder life| `founder_support`| Ready to Submit       |

`premium_access` group ID: **22110450**. Current levels: Monthly = L1,
Yearly = L2.

⚠️ **Founder Annual shows "Missing Metadata"** — it needs a localization +
review screenshot before the founder group can be submitted. Not blocking the
premium overhaul, but fix it in the same pass or the founder page will 500 on
`getOfferings` for that package.

## Step 1 — App Store Connect: products & prices (~30 min)

Go to **appstoreconnect.apple.com** → **My Apps** → **Waypoint**.

### 1a. Create the weekly product

1. In the left sidebar, under **Monetization**, click **Subscriptions**.
2. Click the **`premium_access`** group (ID 22110450) to open it.
   ⚠️ Create weekly INSIDE this group, next to Monthly + Yearly — same group is
   what makes weekly↔yearly a switch, not a parallel second subscription.
3. **Subscriptions** section → **“+”** (the blue plus).
   - **Reference Name**: `Premium Weekly` (matches your `Premium Monthly` /
     `Premium Yearly` naming)
   - **Product ID**: `app.usewaypoint.premium.weekly` (follows your existing
     `app.usewaypoint.premium.*` convention; cannot be changed later)
4. On the new product's page:
   - **Subscription Duration**: `1 Week`.
   - **Subscription Prices** → **“+” → Add Subscription Price** → pick the base
     territory that matches monthly/yearly (see currency note above) at the
     **£9.99 / $9.99** price point → Next → let it auto-generate other
     territories → Confirm.
5. Add the free trial, same page:
   - **Subscription Prices** area → **Introductory Offers** → **“+”**.
   - Territories: **All countries or regions** → Next.
   - Start: today, End: **No End Date** → Next.
   - Type: **Free** → Duration: **1 Week** (= 7 days; there is no "7-day"
     option) → Confirm.
   - Do NOT add this offer to Yearly. Monthly optional.
6. **App Store Localization** → add **English (U.S.)** (match the group's
   existing localization, not en-GB):
   - Display Name: `Weekly`
   - Description: `Full Waypoint access, billed weekly.`
7. **Review Information** → **Screenshot** (min 640×920; run the app, open the
   paywall, ⌘S in simulator) + notes: "Auto-renewable subscription, 1-week free
   trial. Paywall reachable from Settings → Support Waypoint."
8. Status flips to **"Ready to Submit"**. It's submitted WITH the app version
   (step 4), same as monthly/yearly.

### 1b. Set monthly + yearly prices (NOT a reprice — nothing is live)

Both products are still "Prepare for Submission," so there are no subscribers
and no price-change/consent flow. Just set the price directly:

For **Premium Monthly** and **Premium Yearly** (Subscriptions → `premium_access`
→ click the product → **Subscription Prices**):

1. If a price is already set, confirm it's **£19.99 / $19.99** (monthly) and
   **£59.99 / $59.99** (yearly) in the SAME base currency as weekly. If it's a
   different number (they were created May 24 — likely placeholder), click the
   current price → **Edit** and pick the correct tier.
2. There is **no "keep existing subscribers" prompt** here — that only appears
   for live products. Setting the price on a not-yet-submitted product just
   sticks.

No App Review implication — all three go to review together as the first
submission anyway.

### 1c. Group ranking

You currently have **Monthly = Level 1, Yearly = Level 2**. All three are the
same service (one `premium` entitlement, different billing), so the cleanest
setup is **all three on the same level** → any switch is a crossgrade Apple
handles automatically.

- Subscriptions section → **Edit** → drag **Weekly** and **Yearly** onto
  Level 1 alongside Monthly (multiple subs per level is allowed).
- If you'd rather not reshuffle, just add Weekly at its own level below Yearly.
  It still works — levels only affect Apple's proration mechanics on a switch,
  not what the `premium` entitlement unlocks. Same-level is just tidier.

## Step 2 — RevenueCat (~15 min)

**app.revenuecat.com** → Waypoint project.

1. **Product catalog → Products → + New product** (under the **Waypoint iOS**
   app store, where `app.usewaypoint.premium.monthly/.yearly` already live):
   - Store: **Waypoint iOS** (App Store).
   - Identifier: `app.usewaypoint.premium.weekly` (must match ASC exactly).
2. **Product catalog → Entitlements → `premium`** → **Attach products** →
   select `app.usewaypoint.premium.weekly`. (`...premium.monthly` and
   `...premium.yearly` are already attached — leave them. The
   `...founder.annual` / `...founder.forever` products stay on the `founder`
   entitlement — don't touch.)
3. **Product catalog → Offerings** → open the offering marked **Current**
   (this is what `offerings.current` returns to the app):
   - **+ Add package** → identifier **`$rc_weekly`** → attach
     `app.usewaypoint.premium.weekly` (Waypoint iOS) → Save.
   - Confirm packages **`$rc_monthly`** → `...premium.monthly` and
     **`$rc_annual`** → `...premium.yearly` exist. Create them if the current
     offering doesn't have them yet.
   - Remove any other package in this offering — the paywall renders up to
     three and you want exactly these.
   ⚠️ Use the `$rc_*` standard identifiers: the app switches on RC's
   `packageType`, which is derived from them. A weekly product in a
   non-`$rc_weekly` package won't be detected as weekly.
4. The `supporter` offering (founder page) is untouched. No webhook/API-key
   changes.
5. **Test Store** (the second store in your RC Products list) is RC's sandbox —
   ignore it for this; it doesn't affect the App Store offering.

## Step 3 — sandbox verification (~20 min)

1. Create a FRESH sandbox tester (trial eligibility is per-Apple-ID; a used
   tester won't show the trial): **appstoreconnect.apple.com → Users and
   Access → Sandbox → Testers (tab) → “+”**. Any fake email works (e.g.
   `wp-sandbox-jul19@example.com`); note the password.
2. On a physical device (sandbox purchases are flaky on simulator):
   **iOS Settings → App Store → Sandbox Account** (bottom) → sign in with the
   tester.
3. Run a dev build, open the paywall (Settings → Support Waypoint, swipe to
   the premium page) and check:
   - [ ] three cards render: **weekly** ("free trial" badge, "1-week free, then
         £9.99/wk"), **monthly**, **yearly** ("best value");
   - [ ] weekly is pre-selected; CTA reads **"start 1-week free trial"**;
   - [ ] legal footer states trial length, post-trial price, auto-renewal;
   - [ ] purchase weekly → Apple sheet shows "1 week free, then £9.99/week" →
         confirm → paywalled content unlocks;
   - [ ] `user_subscriptions` row updates (provider `app_store`) — check
         Studio or `supabase functions logs revenuecat-webhook`;
   - [ ] with weekly active, buying yearly upgrades (no double charge);
   - [ ] **restore purchases** works after reinstall.
   Sandbox speed-run: a 1-week sandbox sub renews every ~3 min and
   auto-expires after 6 renewals, so you can watch expiry same-session.

## Step 4 — store submission prep

- [ ] Bump the version, build + submit via EAS
      (`eas build --platform ios --profile production`, then `eas submit`).
- [ ] On the new version's page in ASC, find the
      **In-App Purchases and Subscriptions** section → **“+”** → attach
      `Waypoint Premium Weekly`. First-time subscriptions MUST ride with a
      version; without this the weekly product silently never goes live.
- [ ] **Screenshots**: only mandatory if existing store screenshots show old
      prices (stale pricing = rejection/complaint magnet). Sizes: one 6.9"
      set (1320×2868) + one 6.5" set (1242×2688).
- [ ] **App description**: update any pricing copy to the new ladder; the
      description must name the subscription, its length, and price.
- [ ] **App Review Information**: demo account credentials (seeded test
      account), note where the paywall lives, and that invite/promo codes are
      a server-side pilot feature not tied to Apple offer codes.
- [ ] Confirm **Privacy Policy URL** and **Terms of Use (EULA)** fields in the
      version metadata point at usewaypoint.app/privacy and /terms and that
      both resolve.
- [ ] After approval: one real purchase on TestFlight/production, watch
      `supabase functions logs revenuecat-webhook`.

## Related but separate

- Promo codes for the pilot cohort are Waypoint-side (see
  `supabase/migrations/20260719090000_promo_codes.sql`) and need no ASC/RC
  config — pilots never touch the paywall until their 6 months lapse.
