# Founder Supporter Tier — handoff note

A higher-priced "support the early days" purchase on top of normal Premium. Captured for the next agent picking this up. Nothing has been built yet — this is a decisions doc only.

## The ask

> Is it possible to let people pay whatever the fuck they want — like a separate "plan" for users who want to pay more than the normal price (something insane like $500) just because they love us and want to support the early days of our startup? Is it allowed by the App Store?

## What the App Store actually allows

App Store Review Guideline 3.1.1 (in-app purchase) + 4.3 (spam / no-value apps):

- **Arbitrary amounts: no.** Apple uses a fixed tier list. A `<TextInput placeholder="how much?">` ships nothing — it gets rejected. You pick from Apple's preset prices.
- **High preset prices: yes.** The tier ceiling is around **$999.99 USD** for a consumable, and you can stack any number of subscription/non-consumable tiers. $499.99 lifetime "founder pass" is well within range.
- **Pure donations / tip jars: no, unless you're a 501(c)(3).** For-profit apps soliciting tips with zero deliverable get rejected. There must be _something_ attached — even purely cosmetic.
- **External payment links: effectively no.** The 2024 US "external purchase entitlement" still requires Apple's permission + a 27% cut, and the policy is explicitly tied to a US class-action carve-out. Don't route a startup's "support us" via Stripe — it's a rejection vector and doesn't even save money.

The bar for "value attached" is **low** — a unique badge, a flair tag, a credits screen with the supporter's name on it. Apple has waved through dozens of indie apps doing exactly this (Castro, Overcast, Tweetbot, Marco Arment's stuff). Telegram Premium, Discord Nitro, Bluesky's pro tiers all live under the same rule.

## Recommended shape for Waypoint

**Product type:** two Founder SKUs:

- `app.usewaypoint.founder.annual` — auto-renewing annual subscription.
- `app.usewaypoint.founder.forever` — non-consumable lifetime purchase.

Use two SKUs because:

- Annual gives a lower support entry point.
- Lifetime keeps the "early supporter forever" narrative.
- Both unlock the same RevenueCat `founder` entitlement.

**Where it sits in the codebase:**

- App Store Connect → add annual Founder subscription and lifetime Founder non-consumable.
- RevenueCat → add `founder` entitlement and a `supporter` offering containing both Founder packages.
- Code treats `founder` as a superset of `premium`.
- `profiles.is_founder` / `profiles.founder_year` drive profile-only display.
- Settings screen → "Support Waypoint" row opens the supporter paywall. Don't put it on the main paywall — keep it as an opt-in surface so it doesn't feel like a hard upsell.

**Perks to attach** (in priority order, cheapest-to-implement first):

| Perk                                                                                                            | Why it earns the price                                                                                                                                                        | Implementation                                                                                                    |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Lifetime Premium (everything current Premium gets)                                                              | Highest objective value; alone justifies the price tag                                                                                                                        | Add `founder` arm to the entitlement gate in `useSubscription`                                                    |
| Unique avatar ring — diamond/animated/whatever, distinct from the existing gold premium ring (commit `8be72f3`) | The visible flex. Other users see it on profile screens                                                                                                                       | New `<FounderBadge>` component                                                                                    |
| `Founder · 2026` inline tag next to display name                                                                | Recognizable on profile screens                                                                                                                                               | Profile-only display                                                                                              |
| Founders credits screen in Settings (public list of supporter display names)                                    | Public recognition is what people actually pay $500 for. The "name on a brick" psychology                                                                                     | `select display_name from profiles where is_founder` — tiny query. Add a `Founders` row in Settings linking to it |
| Year tag on the badge (`✦ Founder · 2026`) — locked to the year they bought                                     | Makes the badge **scarce over time**. Telegram, Bluesky, Discord all use this trick. Costs nothing to ship, gives early adopters something later founders can never replicate | Persist `founder_year` int on the profile row when the purchase fires                                             |
| Early access to new features via a `founder_only` flag                                                          | Real signal, costs nothing                                                                                                                                                    | Already plumbing in growthbook flags — reuse                                                                      |

## Open decisions for whoever picks this up

1. **Final price.** Two-SKU shape is chosen. Suggested default: $99.99/year recurring "Founder Annual" + $499.99 lifetime "Founder Forever".
2. **Visibility of the badge.** Chosen: profile-only. Do not show Founder in feeds/chats unless this decision changes.
3. **What happens if a founder downgrades.** They can't — non-consumable is forever. But if Apple refunds them, RC removes the entitlement, and we should make sure their badge / credits-screen entry also disappears. Cron job vs. realtime via RC webhook.
4. **Copy.** "Founder", "Founding Member", "Backstage Pass", "Trailblazer", "Day One" — pick one and commit. Pairs with the existing "Waypoint" brand voice.
5. **Reveal in the App Store paperwork.** The product description in App Store Connect must list the perks explicitly. Apple reviewers read it. Don't just write "Support Waypoint" — list the badge, lifetime Premium, credits screen, etc.

## What is NOT allowed (don't go here, will get the app rejected)

- Free-form amount input ("type your support amount")
- "Tip us" with no deliverable
- External Stripe/PayPal donation link for the for-profit app
- A "remove ads" tier for ads you don't have (fake-value rejection)
- Subscription with zero functional difference from a cheaper sub ("Premium" vs. "Premium Plus" with identical perks)

## Related codebase touchpoints

- `hooks/useSubscription.tsx` — entitlement read
- `lib/revenuecat.ts` — RC SDK config
- `components/...` — wherever the gold premium avatar ring lives (per commit `8be72f3`)
- `app/settings.tsx` — where the "Support Waypoint" entry would live
- `types/supabase.ts` — new `is_founder: boolean | null`, `founder_year: number | null` columns on `profiles`
- `supabase/migrations/` — migration to add those columns + an index if we'll filter by them
