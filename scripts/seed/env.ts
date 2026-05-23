import 'dotenv/config';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', override: true });

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

export const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const SEED_EMAIL_DOMAIN = '@seed.local';
export const SEED_PASSWORD = 'seed123';
