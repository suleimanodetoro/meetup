/**
 * Bulk account-teardown admin tool.
 *
 * The owner has ~a year of organically-created trash/test accounts and wants a
 * safe way to purge them. Deletion is DESTRUCTIVE and irreversible, so this tool
 * is built to fail safe:
 *
 *   • DRY RUN by default. It prints exactly who *would* be deleted and never
 *     touches anything unless you pass --execute AND clear three separate guards.
 *   • A hardcoded owner protection list (odetoro75* / suleimanodetoro*) that no
 *     flag can override.
 *   • @seed.local users are excluded by default (they have `npm run seed:reset`).
 *   • Paying users (premium / founder / active entitlement) are auto-skipped.
 *   • Execute requires --execute + env TEARDOWN_I_KNOW_WHAT_IM_DOING=1 + an
 *     --expect <N> that must match the candidate count computed this run.
 *   • Storage avatar objects are cleaned before the auth user is deleted.
 *   • Every deleted user is written to an append-only JSONL audit log.
 *
 * Env loading mirrors scripts/seed/env.ts: inline `SUPABASE_URL=... npm run ...`
 * beats .env.local, which beats .env. Unlike the seed scripts this one does NOT
 * refuse to run against a remote project for DRY RUN — you need to inspect prod
 * to know what to purge — but a remote target prints a loud banner and EXECUTE
 * still demands the env flag.
 *
 * Usage:
 *   npm run admin:teardown -- <selection filters> [options]
 *
 * Selection filters (at least one required; multiple filters are AND-combined
 * to narrow the set, EXCEPT --all which selects everyone):
 *   --before <ISO date>   accounts created strictly before this date
 *   --pattern <str|/re/>  email matches substring (case-insensitive) or /regex/
 *   --incomplete          onboarding_completed is false or null
 *   --inactive            zero created events AND zero sent messages AND zero attendance
 *   --all                 every account (still minus the keep-list) — must be explicit
 *
 * Options:
 *   --keep <a,b,/re/>     extra emails/patterns to protect (comma-separated)
 *   --include-seed        also consider @seed.local users (off by default)
 *   --execute             actually delete (see guards above)
 *   --expect <N>          required with --execute; must equal the candidate count
 */

import 'dotenv/config';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// ────────────────────────────────────────────────────────────────────────────
// Env (same precedence rules as scripts/seed/env.ts)
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
const EXECUTE_ENV_FLAG = process.env.TEARDOWN_I_KNOW_WHAT_IM_DOING === '1';

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Hardcoded protection: nothing the operator passes can ever delete these.
const OWNER_PREFIXES = ['odetoro75', 'suleimanodetoro'];
const SEED_EMAIL_DOMAIN = '@seed.local';
const AVATAR_BUCKET = 'avatars';
const DELETE_DELAY_MS = 150;

function projectRef(u: string): string {
  try {
    const host = new URL(u).hostname;
    return host.split('.')[0] || host;
  } catch {
    return u;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Arg parsing (no external deps)
// ────────────────────────────────────────────────────────────────────────────

type Options = {
  before?: string;
  pattern?: string;
  incomplete: boolean;
  inactive: boolean;
  all: boolean;
  keep: string[];
  includeSeed: boolean;
  execute: boolean;
  expect?: number;
  help: boolean;
};

const VALUE_FLAGS = new Set(['before', 'pattern', 'keep', 'expect']);
const BOOL_FLAGS = new Set([
  'incomplete',
  'inactive',
  'all',
  'include-seed',
  'execute',
  'help',
]);

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    incomplete: false,
    inactive: false,
    all: false,
    keep: [],
    includeSeed: false,
    execute: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith('--')) {
      console.warn(`Ignoring unexpected argument: ${raw}`);
      continue;
    }
    let key = raw.slice(2);
    let val: string | undefined;
    const eq = key.indexOf('=');
    if (eq !== -1) {
      val = key.slice(eq + 1);
      key = key.slice(0, eq);
    }

    if (VALUE_FLAGS.has(key)) {
      if (val === undefined) {
        val = argv[i + 1];
        i++;
      }
      if (val === undefined) throw new Error(`--${key} requires a value`);
      switch (key) {
        case 'before':
          opts.before = val;
          break;
        case 'pattern':
          opts.pattern = val;
          break;
        case 'keep':
          opts.keep = val
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          break;
        case 'expect':
          opts.expect = Number.parseInt(val, 10);
          if (Number.isNaN(opts.expect)) throw new Error(`--expect must be an integer, got "${val}"`);
          break;
      }
    } else if (BOOL_FLAGS.has(key)) {
      switch (key) {
        case 'incomplete':
          opts.incomplete = true;
          break;
        case 'inactive':
          opts.inactive = true;
          break;
        case 'all':
          opts.all = true;
          break;
        case 'include-seed':
          opts.includeSeed = true;
          break;
        case 'execute':
          opts.execute = true;
          break;
        case 'help':
          opts.help = true;
          break;
      }
    } else {
      console.warn(`Ignoring unknown flag: --${key}`);
    }
  }

  return opts;
}

function printUsage() {
  console.log(
    [
      'Bulk account-teardown admin tool (DRY RUN by default).',
      '',
      'Usage:',
      '  npm run admin:teardown -- <selection filters> [options]',
      '',
      'Selection filters (>=1 required; combined with AND, except --all):',
      '  --before <ISO date>   accounts created strictly before this date',
      '  --pattern <str|/re/>  email substring (case-insensitive) or /regex/',
      '  --incomplete          onboarding_completed is false or null',
      '  --inactive            0 events created AND 0 messages sent AND 0 attendance',
      '  --all                 every account (still minus keep-list) — must be explicit',
      '',
      'Options:',
      '  --keep <a,b,/re/>     extra emails/patterns to protect (comma-separated)',
      '  --include-seed        also consider @seed.local users (off by default)',
      '  --execute             actually delete (needs env + --expect, see below)',
      '  --expect <N>          required with --execute; must equal candidate count',
      '',
      'Execute guards (ALL required):',
      '  --execute  +  TEARDOWN_I_KNOW_WHAT_IM_DOING=1  +  --expect <candidateCount>',
    ].join('\n')
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Data loading (batched, paginated — no per-user round trips for classification)
// ────────────────────────────────────────────────────────────────────────────

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string | undefined;
  last_sign_in_at: string | null | undefined;
};

async function listAllAuthUsers(): Promise<AdminUser[]> {
  const users: AdminUser[] = [];
  const perPage = 1000;
  let page = 1;
  // GoTrue paginates; loop until a short page comes back.
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data.users ?? [];
    for (const u of batch) {
      users.push({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    }
    if (batch.length < perPage) break;
    page++;
  }
  return users;
}

async function fetchAllRows<T>(table: string, columns: string): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const out: T[] = [];
  for (;;) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      // Stable pagination: without an explicit order, PostgREST pages can
      // shift between requests, and these counts feed the --inactive filter.
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function tally(map: Map<string, number>, id: string | null | undefined) {
  if (!id) return;
  map.set(id, (map.get(id) ?? 0) + 1);
}

// ────────────────────────────────────────────────────────────────────────────
// Storage cleanup — replicates delete_user_account()'s avatar deletion
// (folder path user_id/*, legacy flat user_id-*, and plan-*-user_id.jpg).
// Uses the Storage API (which reclaims bytes, unlike a raw storage.objects
// DELETE) rather than SQL, since this tool only has the service-role JS client.
// ────────────────────────────────────────────────────────────────────────────

/** Recursively list every object path under a prefix in the avatars bucket. */
async function listUnderPrefix(prefix: string): Promise<string[]> {
  const results: string[] = [];
  const pageSize = 100;
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage
      .from(AVATAR_BUCKET)
      .list(prefix, { limit: pageSize, offset });
    if (error) throw new Error(`list avatars "${prefix}": ${error.message}`);
    const items = data ?? [];
    for (const item of items) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      // Storage returns folders as entries with a null id; recurse into them.
      if (item.id === null) {
        results.push(...(await listUnderPrefix(full)));
      } else {
        results.push(full);
      }
    }
    if (items.length < pageSize) break;
    offset += pageSize;
  }
  return results;
}

/** Single-level file names at the bucket root (legacy flat avatar names live here). */
async function listRootFiles(): Promise<string[]> {
  const files: string[] = [];
  const pageSize = 100;
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage
      .from(AVATAR_BUCKET)
      .list('', { limit: pageSize, offset });
    if (error) throw new Error(`list avatars root: ${error.message}`);
    const items = data ?? [];
    for (const item of items) if (item.id !== null) files.push(item.name);
    if (items.length < pageSize) break;
    offset += pageSize;
  }
  return files;
}

async function cleanupAvatars(userId: string, rootFiles: string[]): Promise<number> {
  const paths = new Set<string>();

  // Pattern 1: everything under the user_id/ folder.
  for (const p of await listUnderPrefix(userId)) paths.add(p);

  // Patterns 2 & 3: legacy flat names + plan images at the bucket root.
  for (const name of rootFiles) {
    if (name.startsWith(`${userId}-`)) paths.add(name);
    else if (name.startsWith('plan-') && name.endsWith(`-${userId}.jpg`)) paths.add(name);
  }

  const list = [...paths];
  if (list.length === 0) return 0;

  // remove() takes an array; chunk defensively for very large sets.
  let removed = 0;
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const { error } = await admin.storage.from(AVATAR_BUCKET).remove(chunk);
    if (error) throw new Error(`remove avatars for ${userId}: ${error.message}`);
    removed += chunk.length;
  }
  return removed;
}

// ────────────────────────────────────────────────────────────────────────────
// Classification
// ────────────────────────────────────────────────────────────────────────────

type Counts = { ev: number; msg: number; fr: number; att: number };

type Candidate = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  onboarding: boolean | null;
  counts: Counts;
};

function buildMatchers(entries: string[]): Array<(email: string) => boolean> {
  return entries.map((entry) => {
    const re = asRegex(entry);
    if (re) return (email: string) => re.test(email);
    const lower = entry.toLowerCase();
    return (email: string) => email.toLowerCase().includes(lower);
  });
}

function asRegex(entry: string): RegExp | null {
  if (entry.length >= 2 && entry.startsWith('/') && entry.endsWith('/')) {
    return new RegExp(entry.slice(1, -1), 'i');
  }
  return null;
}

function pad(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

function onboardingLabel(v: boolean | null): string {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return '—';
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printUsage();
    return;
  }

  const hasSelection =
    opts.before !== undefined ||
    opts.pattern !== undefined ||
    opts.incomplete ||
    opts.inactive ||
    opts.all;

  if (!hasSelection) {
    console.error('ERROR: at least one selection filter is required.\n');
    printUsage();
    process.exit(1);
  }

  let beforeDate: Date | undefined;
  if (opts.before !== undefined) {
    beforeDate = new Date(opts.before);
    if (Number.isNaN(beforeDate.getTime())) {
      throw new Error(`--before: could not parse date "${opts.before}"`);
    }
  }

  const patternMatch = opts.pattern
    ? buildMatchers([opts.pattern])[0]
    : undefined;

  // Production latch: dry run is allowed against a remote target, but shout about it.
  if (!isLocal) {
    const bar = '═'.repeat(70);
    console.log(`\n\x1b[31m${bar}`);
    console.log('   ⚠  TEARDOWN IS POINTED AT A NON-LOCAL SUPABASE PROJECT');
    console.log(`   Target project: ${projectRef(url!)}`);
    console.log(`   URL:            ${url}`);
    console.log(`   Mode:           ${opts.execute ? 'EXECUTE (DELETE)' : 'DRY RUN'}`);
    if (opts.execute && !EXECUTE_ENV_FLAG) {
      console.log('   Execute is blocked: TEARDOWN_I_KNOW_WHAT_IM_DOING is not set.');
    }
    console.log(`${bar}\x1b[0m\n`);
  }

  console.log(`Loading accounts from ${isLocal ? 'LOCAL' : projectRef(url!)}...`);

  // --- Batched loads ---
  const [users, profiles, subs, events, messages, attendance, friendships] = await Promise.all([
    listAllAuthUsers(),
    fetchAllRows<{ id: string; onboarding_completed: boolean | null; is_founder: boolean | null }>(
      'profiles',
      'id, onboarding_completed, is_founder'
    ),
    fetchAllRows<{
      user_id: string;
      subscription_type: string | null;
      entitlement_id: string | null;
      expires_at: string | null;
    }>('user_subscriptions', 'user_id, subscription_type, entitlement_id, expires_at'),
    fetchAllRows<{ user_id: string | null }>('events', 'user_id'),
    fetchAllRows<{ user_id: string | null }>('messages', 'user_id'),
    fetchAllRows<{ user_id: string | null }>('attendance', 'user_id'),
    fetchAllRows<{ requester_id: string | null; addressee_id: string | null }>(
      'friendships',
      'requester_id, addressee_id'
    ),
  ]);

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const subByUser = new Map(subs.map((s) => [s.user_id, s]));

  const evCount = new Map<string, number>();
  for (const r of events) tally(evCount, r.user_id);
  const msgCount = new Map<string, number>();
  for (const r of messages) tally(msgCount, r.user_id);
  const attCount = new Map<string, number>();
  for (const r of attendance) tally(attCount, r.user_id);
  const frCount = new Map<string, number>();
  for (const r of friendships) {
    tally(frCount, r.requester_id);
    tally(frCount, r.addressee_id);
  }

  const keepMatchers = buildMatchers(opts.keep);
  const now = Date.now();

  function protectedReason(email: string): string | null {
    const lower = email.toLowerCase();
    for (const prefix of OWNER_PREFIXES) {
      if (lower.startsWith(prefix)) return `owner (${prefix}*)`;
    }
    if (!opts.includeSeed && lower.endsWith(SEED_EMAIL_DOMAIN)) return 'seed (@seed.local)';
    for (let i = 0; i < keepMatchers.length; i++) {
      if (keepMatchers[i](email)) return `keep (${opts.keep[i]})`;
    }
    return null;
  }

  function premiumReason(userId: string): string | null {
    const sub = subByUser.get(userId);
    if (sub) {
      if (sub.subscription_type && sub.subscription_type !== 'free') {
        return `subscription_type=${sub.subscription_type}`;
      }
      if (sub.entitlement_id) {
        const active = sub.expires_at === null || new Date(sub.expires_at).getTime() > now;
        if (active) return `active entitlement=${sub.entitlement_id}`;
      }
    }
    // Founder identity flag is a paying-supporter signal too — protect it.
    if (profileById.get(userId)?.is_founder === true) return 'is_founder=true';
    return null;
  }

  function counts(userId: string): Counts {
    return {
      ev: evCount.get(userId) ?? 0,
      msg: msgCount.get(userId) ?? 0,
      fr: frCount.get(userId) ?? 0,
      att: attCount.get(userId) ?? 0,
    };
  }

  function matchesSelection(u: AdminUser, c: Counts, onboarding: boolean | null): boolean {
    if (opts.all) return true; // --all overrides the narrowing filters
    if (beforeDate) {
      if (!u.created_at) return false;
      if (new Date(u.created_at).getTime() >= beforeDate.getTime()) return false;
    }
    if (patternMatch) {
      if (!u.email || !patternMatch(u.email)) return false;
    }
    if (opts.incomplete) {
      if (onboarding === true) return false; // want false OR null
    }
    if (opts.inactive) {
      if (!(c.ev === 0 && c.msg === 0 && c.att === 0)) return false;
    }
    return true;
  }

  if (opts.all && (opts.before || opts.pattern || opts.incomplete || opts.inactive)) {
    console.warn('WARNING: --all overrides the other selection filters; every account is in scope.\n');
  }

  // --- Classify ---
  const candidates: Candidate[] = [];
  const protectedHits: Array<{ email: string; reason: string }> = [];
  const premiumHits: Array<{ email: string; reason: string }> = [];
  let seedProtected = 0;
  let notSelected = 0;

  for (const u of users) {
    const email = u.email ?? '(no-email)';
    const c = counts(u.id);
    const onboarding = profileById.get(u.id)?.onboarding_completed ?? null;

    if (!matchesSelection(u, c, onboarding)) {
      notSelected++;
      continue;
    }

    const pr = protectedReason(email);
    if (pr) {
      if (pr.startsWith('seed')) seedProtected++;
      else protectedHits.push({ email, reason: pr });
      continue;
    }

    const prem = premiumReason(u.id);
    if (prem) {
      premiumHits.push({ email, reason: prem });
      continue;
    }

    candidates.push({
      id: u.id,
      email,
      createdAt: u.created_at ?? '',
      lastSignInAt: u.last_sign_in_at ?? null,
      onboarding,
      counts: c,
    });
  }

  // Deterministic, oldest-first — easiest to eyeball as "the crustiest accounts".
  candidates.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const protectedCount = protectedHits.length + seedProtected;

  // --- Report ---
  console.log(
    `\nScanned ${users.length} accounts. ${notSelected} did not match the selection filters.\n`
  );

  if (candidates.length > 0) {
    const emailWidth = Math.min(
      40,
      Math.max(20, ...candidates.map((c) => c.email.length))
    );
    const header =
      pad('EMAIL', emailWidth) +
      '  ' +
      pad('CREATED', 10) +
      '  ' +
      pad('LAST SEEN', 10) +
      '  ' +
      pad('ONB', 4) +
      '  ' +
      pad('EV', 4) +
      pad('MSG', 5) +
      pad('FR', 4) +
      '  USER ID';
    console.log(header);
    console.log('─'.repeat(header.length));
    for (const c of candidates) {
      console.log(
        pad(c.email, emailWidth) +
          '  ' +
          pad(fmtDate(c.createdAt), 10) +
          '  ' +
          pad(fmtDate(c.lastSignInAt), 10) +
          '  ' +
          pad(onboardingLabel(c.onboarding), 4) +
          '  ' +
          pad(String(c.counts.ev), 4) +
          pad(String(c.counts.msg), 5) +
          pad(String(c.counts.fr), 4) +
          '  ' +
          c.id
      );
    }
    console.log('');
  }

  // Premium skips get an explicit warning line each (per spec).
  for (const p of premiumHits) {
    console.log(`\x1b[33mSKIP (premium): ${p.email} — ${p.reason}\x1b[0m`);
  }
  // Non-seed protected hits listed explicitly; seed protection summarised.
  for (const p of protectedHits) {
    console.log(`PROTECTED: ${p.email} — ${p.reason}`);
  }
  if (seedProtected > 0) {
    console.log(
      `PROTECTED: ${seedProtected} @seed.local user(s) excluded by default (pass --include-seed to include them).`
    );
  }

  console.log(
    `\n${candidates.length} accounts would be deleted, ${protectedCount} protected, ${premiumHits.length} skipped (premium).`
  );

  // ── DRY RUN ──────────────────────────────────────────────────────────────
  if (!opts.execute) {
    console.log('\nDRY RUN — nothing was deleted.');
    if (candidates.length > 0) {
      const flagsEcho = process.argv.slice(2).filter((a) => a !== '--execute').join(' ');
      console.log('To execute, re-run with the exact same filters plus:');
      console.log(
        `  TEARDOWN_I_KNOW_WHAT_IM_DOING=1 npm run admin:teardown -- ${flagsEcho} --execute --expect ${candidates.length}`
      );
    }
    return;
  }

  // ── EXECUTE GUARDS ───────────────────────────────────────────────────────
  if (!EXECUTE_ENV_FLAG) {
    console.error(
      '\nABORT: --execute requires env TEARDOWN_I_KNOW_WHAT_IM_DOING=1. ' +
        'Re-run with that variable set once you are certain.'
    );
    process.exit(1);
  }
  if (opts.expect === undefined) {
    console.error(
      `\nABORT: --execute requires --expect <N>. This run computed ${candidates.length} candidate(s); ` +
        `pass --expect ${candidates.length} to confirm the list has not shifted.`
    );
    process.exit(1);
  }
  if (opts.expect !== candidates.length) {
    console.error(
      `\nABORT: --expect ${opts.expect} does not match the ${candidates.length} candidate(s) computed this run. ` +
        'The account set shifted since your dry run. Re-run the dry run and pass the new count.'
    );
    process.exit(1);
  }
  if (candidates.length === 0) {
    console.log('\nNothing to delete.');
    return;
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logDir = path.join(__dirname, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `teardown-${stamp}.jsonl`);

  const banner = '━'.repeat(70);
  console.log(`\n\x1b[31m${banner}`);
  console.log(`   EXECUTING teardown of ${candidates.length} account(s)`);
  console.log(`   Target: ${isLocal ? 'LOCAL' : projectRef(url!)}`);
  console.log(`   Audit log: ${logPath}`);
  console.log(`${banner}\x1b[0m\n`);

  console.log('Pre-scanning avatar bucket root for legacy flat names...');
  let rootFiles: string[] = [];
  try {
    rootFiles = await listRootFiles();
  } catch (err: any) {
    console.warn(`  (could not list bucket root: ${err.message}; continuing with folder cleanup only)`);
  }

  let deleted = 0;
  let avatarsRemoved = 0;
  const errors: Array<{ email: string; id: string; error: string }> = [];

  for (const c of candidates) {
    // 1. Storage first (matches delete_user_account ordering; deleteUser does
    //    NOT run that RPC and does NOT cascade storage objects).
    try {
      avatarsRemoved += await cleanupAvatars(c.id, rootFiles);
    } catch (err: any) {
      // Non-fatal: log and still delete the account so we don't leave it live.
      console.warn(`  avatar cleanup failed for ${c.email}: ${err.message}`);
    }

    // 2. Delete the auth user (FK cascades remove profile/events/messages/etc.).
    const { error } = await admin.auth.admin.deleteUser(c.id);
    if (error) {
      errors.push({ email: c.email, id: c.id, error: error.message });
      console.error(`  FAILED ${c.email}: ${error.message}`);
      continue;
    }

    // 3. Audit line (append-only, so a mid-run crash still records progress).
    fs.appendFileSync(
      logPath,
      JSON.stringify({
        deleted_at: new Date().toISOString(),
        id: c.id,
        email: c.email,
        created_at: c.createdAt,
        last_sign_in_at: c.lastSignInAt,
        onboarding_completed: c.onboarding,
        counts: c.counts,
      }) + '\n'
    );

    deleted++;
    process.stdout.write(`  deleted ${deleted}/${candidates.length}  ${c.email}\n`);

    if (DELETE_DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELETE_DELAY_MS));
  }

  console.log(
    `\nDone. Deleted ${deleted}/${candidates.length} account(s), removed ${avatarsRemoved} avatar object(s).`
  );
  if (errors.length > 0) {
    console.log(`\n${errors.length} deletion(s) failed:`);
    for (const e of errors) console.log(`  ${e.email} (${e.id}): ${e.error}`);
  }
  console.log(`Audit log: ${logPath}`);
}

main().catch((err) => {
  console.error('\nTEARDOWN FAILED:', err?.message ?? err);
  process.exit(1);
});
