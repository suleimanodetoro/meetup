# Admin: bulk account teardown

`teardown.ts` purges organically-created trash/test accounts. Deletion is
**destructive and irreversible**, so the tool is dry-run-first and guarded.

## Safety model

- **Dry run by default.** Nothing is deleted unless you pass `--execute` *and*
  clear every guard below.
- **Owner accounts are hardcoded-protected** (`odetoro75*`, `suleimanodetoro*`).
  No flag can override this.
- **`@seed.local` users are excluded by default** — use `npm run seed:reset` for
  those. Pass `--include-seed` to override.
- **Paying users are auto-skipped**: `user_subscriptions.subscription_type != 'free'`,
  an active `entitlement_id` (`expires_at` null or in the future), or
  `profiles.is_founder = true`.
- **Execute needs three independent confirmations:**
  1. `--execute`
  2. env `TEARDOWN_I_KNOW_WHAT_IM_DOING=1`
  3. `--expect <N>` where `N` equals the candidate count computed this run
     (guards against the list shifting between dry run and execute).
- Against a **non-local** `SUPABASE_URL` even a dry run prints a loud banner
  naming the target project.

## Selection filters

At least one is required. Filters are **AND-combined** (they narrow the set),
except `--all` which selects everyone and overrides the rest.

| Flag | Meaning |
| --- | --- |
| `--before <ISO date>` | created strictly before this date |
| `--pattern <str \| /regex/>` | email substring (case-insensitive) or `/regex/` |
| `--incomplete` | `onboarding_completed` is false or null |
| `--inactive` | 0 events created AND 0 messages sent AND 0 attendance |
| `--all` | every account (still minus the keep-list) — must be explicit |

Options: `--keep <a,b,/re/>` (extra protected emails/patterns),
`--include-seed`, `--execute`, `--expect <N>`.

## Usage

Dry run (always do this first):

```bash
npm run admin:teardown -- --incomplete --before 2025-06-01
```

The dry run prints the exact execute command to copy, e.g.:

```bash
TEARDOWN_I_KNOW_WHAT_IM_DOING=1 npm run admin:teardown -- --incomplete --before 2025-06-01 --execute --expect 42
```

Against production, prefix the inline URL/key (same precedence as the seed
scripts) — dry run first, then execute only when the count is right:

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> \
  npm run admin:teardown -- --inactive --before 2025-01-01
```

## Audit log

Every executed run appends one JSON line per deleted user to
`scripts/admin/logs/teardown-<timestamp>.jsonl` (id, email, created_at,
last_sign_in_at, onboarding_completed, counts). That directory is gitignored —
it contains PII of deleted users.

## What cleanup happens

For each deleted account the tool removes avatar objects from the `avatars`
bucket (`user_id/*`, legacy `user_id-*`, and `plan-*-user_id.jpg`) via the
Storage API — mirroring `delete_user_account()` — then calls
`admin.auth.admin.deleteUser`. The auth-user delete cascades through the schema
FKs to remove profile, events, messages, attendance, friendships, etc.
`reports` rows survive via `ON DELETE SET NULL` (moderation history is retained).
