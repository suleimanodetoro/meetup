/**
 * Create (or repair) the Waypoint SYSTEM HOST identity — the profile that
 * fronts auto-generated sidequests (see supabase/functions/auto-generate).
 * Auto-created quests are transparently system-hosted, never disguised as
 * human activity; this account is that transparency.
 *
 *   • Idempotent: safe to run repeatedly. Finds the auth user by email,
 *     creates it only if missing, then converges the profile row and avatar
 *     to the canonical values below.
 *   • No password is ever set — nobody can sign in as this account.
 *   • The avatar is the app's own mark (assets/icon.png), uploaded to the
 *     public `avatars` bucket under the system user's folder, so the URL is
 *     stable and environment-local (no external asset dependency).
 *   • Prints the UUID: the auto-generate edge function receives it as the
 *     SYSTEM_HOST_USER_ID secret (fail-closed 503 when unset).
 *   • scripts/admin/teardown.ts hard-protects SYSTEM_EMAILS — this account
 *     can never be selected for deletion, no matter the filters.
 *
 * Env loading mirrors scripts/admin/teardown.ts: inline `SUPABASE_URL=...`
 * beats .env.local, which beats .env. Unlike teardown (whose dry run may
 * inspect prod), this script WRITES — so a non-local target requires an
 * explicit --allow-remote flag.
 *
 * Usage:
 *   npm run admin:create-system-host
 *   npm run admin:create-system-host -- --allow-remote   # deliberate prod run
 */

import 'dotenv/config';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// ────────────────────────────────────────────────────────────────────────────
// Env (same precedence rules as scripts/admin/teardown.ts)
// ────────────────────────────────────────────────────────────────────────────

const PROTECTED_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const inline: Record<string, string | undefined> = {};
for (const k of PROTECTED_VARS) inline[k] = process.env[k];

dotenv.config({ path: '.env.local', override: true });

for (const k of PROTECTED_VARS) {
  if (inline[k] !== undefined) process.env[k] = inline[k];
}

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local. ' +
      'Run `supabase start` and copy the printed values.'
  );
}

const isLocal = url.includes('127.0.0.1') || url.includes('localhost');
const allowRemote = process.argv.includes('--allow-remote');

if (!isLocal && !allowRemote) {
  console.error(
    'ABORT: target is not local Supabase and this script creates an auth user.\n' +
      `  Target: ${url}\n` +
      'Pass --allow-remote to run against a hosted project deliberately.'
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ────────────────────────────────────────────────────────────────────────────
// Canonical system-host identity
// ────────────────────────────────────────────────────────────────────────────

const SYSTEM_EMAIL = 'system@usewaypoint.app';
const SYSTEM_USERNAME = 'waypoint';
const SYSTEM_FULL_NAME = 'Waypoint';
const SYSTEM_BIO = 'Official sidequests, suggested by Waypoint when your city is quiet.';
const AVATAR_BUCKET = 'avatars';
const AVATAR_SOURCE = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const AVATAR_OBJECT_NAME = 'waypoint-mark.png'; // stored at {userId}/waypoint-mark.png

async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  // GoTrue has no lookup-by-email admin endpoint; paginate like teardown.ts.
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data.users ?? [];
    const hit = batch.find((u) => (u.email ?? '').toLowerCase() === email);
    if (hit) return { id: hit.id };
    if (batch.length < perPage) return null;
  }
}

async function main() {
  console.log(`Target: ${isLocal ? 'LOCAL' : url}`);

  // 1) Auth user — find or create (no password: the account is not signable-in).
  let userId: string;
  const existing = await findAuthUserByEmail(SYSTEM_EMAIL);
  if (existing) {
    userId = existing.id;
    console.log(`Auth user already exists: ${SYSTEM_EMAIL}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: SYSTEM_EMAIL,
      email_confirm: true,
      user_metadata: { full_name: SYSTEM_FULL_NAME },
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    userId = data.user.id;
    console.log(`Created auth user ${SYSTEM_EMAIL}`);
  }

  // 2) Username collision guard: 'waypoint' is UNIQUE on profiles and the
  //    client renders "Suggested by Waypoint" off it — it must belong to
  //    this account and nobody else.
  const { data: taken, error: takenErr } = await admin
    .from('profiles')
    .select('id')
    .eq('username', SYSTEM_USERNAME)
    .maybeSingle();
  if (takenErr) throw new Error(`username check: ${takenErr.message}`);
  if (taken && taken.id !== userId) {
    throw new Error(
      `username "${SYSTEM_USERNAME}" is already taken by profile ${taken.id} — ` +
        'free it up before creating the system host.'
    );
  }

  // 3) Avatar: upload the app mark into the public avatars bucket under the
  //    system user's folder (the path shape the storage cleanup tools know).
  let avatarUrl: string | null = null;
  if (fs.existsSync(AVATAR_SOURCE)) {
    const objectPath = `${userId}/${AVATAR_OBJECT_NAME}`;
    const { error: upErr } = await admin.storage
      .from(AVATAR_BUCKET)
      .upload(objectPath, fs.readFileSync(AVATAR_SOURCE), {
        contentType: 'image/png',
        upsert: true,
      });
    if (upErr) throw new Error(`avatar upload: ${upErr.message}`);
    avatarUrl = admin.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath).data.publicUrl;
    console.log(`Avatar uploaded: ${objectPath}`);
  } else {
    console.warn(`Avatar source missing (${AVATAR_SOURCE}) — leaving avatar_url unchanged.`);
  }

  // 4) Converge the profile row. The on_auth_user_created trigger inserted a
  //    bare row on step 1; update it (upsert covers a trigger-less environment).
  const profileValues: Record<string, unknown> = {
    id: userId,
    username: SYSTEM_USERNAME,
    full_name: SYSTEM_FULL_NAME,
    bio: SYSTEM_BIO,
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  };
  if (avatarUrl) profileValues.avatar_url = avatarUrl;

  const { error: profErr } = await admin.from('profiles').upsert(profileValues);
  if (profErr) throw new Error(`profile upsert: ${profErr.message}`);
  console.log(`Profile converged: @${SYSTEM_USERNAME} ("${SYSTEM_FULL_NAME}")`);

  console.log('\nSystem host is ready.');
  console.log(`  UUID: ${userId}`);
  console.log('\nWire it into the edge function:');
  console.log(`  supabase secrets set SYSTEM_HOST_USER_ID=${userId}`);
  console.log('  (locally: put it in the --env-file passed to `supabase functions serve`)');
}

main().catch((err) => {
  console.error('\nCREATE-SYSTEM-HOST FAILED:', err?.message ?? err);
  process.exit(1);
});
