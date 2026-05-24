import 'dotenv/config';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// .env.local is loaded with override=true so local-dev defaults beat the
// production values that live in .env. But inline command-line env vars
// (e.g. `SUPABASE_URL=https://... npm run seed`) should beat both, since
// that's how a prod seed is invoked. Capture inline values before dotenv
// touches them, then restore.
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
if (!isLocal && process.env.SEED_I_KNOW_WHAT_IM_DOING !== '1') {
  throw new Error(
    `Refusing to seed against ${url}. This script is for local Supabase only. ` +
      'To override (NOT RECOMMENDED), set SEED_I_KNOW_WHAT_IM_DOING=1.'
  );
}

if (!isLocal) {
  // Loud banner — easy to miss the env var when re-running in the same shell.
  const bar = '═'.repeat(70);
  console.log(`\n\x1b[33m${bar}`);
  console.log('   WRITING SEED DATA TO A REMOTE SUPABASE PROJECT');
  console.log(`   Target: ${url}`);
  console.log('   Override flag is set. Make sure this is intentional.');
  console.log('   To wipe later: SEED_I_KNOW_WHAT_IM_DOING=1 npm run seed:reset');
  console.log(`${bar}\x1b[0m\n`);
}

export const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const SEED_EMAIL_DOMAIN = '@seed.local';
export const SEED_PASSWORD = 'seed123';
