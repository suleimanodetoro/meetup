// supabase/functions/lifecycle-runner/index.ts
//
// Generic runner for one-shot lifecycle / account-"warming" jobs. A cron tick
// (or a manual curl) POSTs here; the runner walks a registry of jobs, selects
// candidate users for each, skips anyone already handled, executes, and records
// the outcome in public.lifecycle_events. The UNIQUE(user_id, job_key)
// constraint on that table is the idempotency backbone — every job runs at most
// once per user, forever.
//
// This is deliberately campaign-agnostic PLUMBING. The real warm-up campaigns
// are decided later; adding one means appending a LifecycleJob to the JOBS
// array below (see ./README.md for the contract). One example job ships here,
// DISABLED, purely to demonstrate the shape.
//
// Mirrors the conventions of the sibling webhooks (revenuecat-webhook,
// stripe-webhook): service_role client that bypasses RLS, fail-closed
// shared-secret auth, and plain JSON responses.
//
//   Auth:   Bearer <LIFECYCLE_RUNNER_AUTH>  (503 if the secret is unset, 401 on
//           mismatch — same pattern as revenuecat-webhook).
//   Invoke: POST {}                      -> run all ENABLED jobs
//           POST { "dryRun": true }      -> preview candidates for ALL jobs,
//                                           sending/recording nothing.
//
// See ./README.md for secrets, deploy, curl, and the pg_cron snippet.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const RUNNER_AUTH = Deno.env.get('LIFECYCLE_RUNNER_AUTH');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Email transport (optional). Without RESEND_API_KEY the runner still works
// end-to-end — jobs that would email simply resolve to 'skipped' (dry plumbing).
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const LIFECYCLE_FROM_EMAIL =
  Deno.env.get('LIFECYCLE_FROM_EMAIL') ?? 'Waypoint <hello@usewaypoint.app>';

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Cap candidates handled per job per run so a cron tick stays fast and bounded.
const BATCH_SIZE = 50;

type Admin = SupabaseClient;

// =====================================================================
// Email transport
// =====================================================================
type EmailArgs = { to: string; subject: string; html: string };

/**
 * Send an email via Resend's REST API. Returns 'sent' on success, or 'skipped'
 * when RESEND_API_KEY is unset (so the whole pipeline runs without email
 * configured). Throws on an actual API error so the caller records 'failed'.
 */
async function sendEmail({ to, subject, html }: EmailArgs): Promise<'sent' | 'skipped'> {
  if (!RESEND_API_KEY) {
    console.log('[lifecycle] RESEND_API_KEY unset — would email', to, '::', subject);
    return 'skipped';
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: LIFECYCLE_FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`resend ${res.status}: ${text}`);
  }
  return 'sent';
}

// =====================================================================
// Job registry contract
// =====================================================================
// A candidate is whatever selectUsers() decides run() needs. user_id + email
// are required; everything else is job-specific context. A candidate may carry
// its own job_key (must be prefixed with the job's static key) to scope the
// at-most-once guarantee — e.g. the cooling nudge keys per pair-week so the
// same user can be nudged again about a different pair, or in a later week.
type Candidate = { user_id: string; email: string; job_key?: string; [key: string]: unknown };

type LifecycleJob = {
  /** Stable key persisted to lifecycle_events.job_key. Never rename in place. */
  key: string;
  /** Master switch. Disabled jobs are skipped on real runs (still previewable in dryRun). */
  enabled: boolean;
  /** Human description for logs / README / dashboards. */
  description: string;
  /** Return up to ~BATCH_SIZE users to act on. Idempotency is handled by the runner. */
  selectUsers(admin: Admin): Promise<Candidate[]>;
  /** Do the work for one user. Return 'sent' if the side effect happened, 'skipped' if not. */
  run(admin: Admin, user: Candidate): Promise<'sent' | 'skipped'>;
};

// =====================================================================
// Example job (DISABLED) — welcome_incomplete_onboarding
// =====================================================================
// Web-signup straggler nudge: an account was created >24h ago but onboarding
// still isn't finished, so remind them to open the app and set up Waypoint.
//
// SELECTION NOTE: the natural "select from profiles where created_at < now-24h"
// is impossible here — public.profiles has NO created_at column (only a
// nullable updated_at) and NO email column; the authoritative signup time and
// email live only in auth.users, which PostgREST/service-role .from() cannot
// reach (the auth schema isn't exposed). So we use the Supabase Admin auth API
// (listUsers) for created_at + email and intersect it with the small, indexed
// set of not-yet-onboarded profiles. This is the "awkward but works" path; a
// real campaign at scale should replace it with a SECURITY DEFINER SQL selector
// over auth.users. See README "Adding a job".

const CUTOFF_MS = 24 * 60 * 60 * 1000; // 24h
const LIST_USERS_PER_PAGE = 200;
const LIST_USERS_MAX_PAGES = 5; // bound the auth scan; skeleton, not exhaustive

async function selectWelcomeIncompleteOnboarding(admin: Admin): Promise<Candidate[]> {
  const cutoff = Date.now() - CUTOFF_MS;

  // 1) Not-yet-onboarded profiles (indexed on onboarding_completed). Small set.
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('onboarding_completed', false)
    .limit(BATCH_SIZE * 4);
  if (error) throw error;
  if (!profiles || profiles.length === 0) return [];

  const byId = new Map<string, { full_name: string | null }>(
    profiles.map((p) => [p.id as string, { full_name: (p.full_name as string) ?? null }]),
  );

  // 2) Pull created_at + email from auth.users and intersect. listUsers returns
  //    newest-first and is paginated; we scan a bounded window only.
  const candidates: Candidate[] = [];
  for (let page = 1; page <= LIST_USERS_MAX_PAGES && candidates.length < BATCH_SIZE; page++) {
    const { data, error: listErr } = await admin.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PER_PAGE,
    });
    if (listErr) throw listErr;
    const users = data?.users ?? [];
    if (users.length === 0) break;

    for (const u of users) {
      const prof = byId.get(u.id);
      if (!prof) continue; // already onboarded (not in the incomplete set)
      if (!u.email) continue; // can't email them
      const createdMs = u.created_at ? Date.parse(u.created_at) : NaN;
      if (!Number.isFinite(createdMs) || createdMs > cutoff) continue; // too new
      candidates.push({ user_id: u.id, email: u.email, full_name: prof.full_name });
      if (candidates.length >= BATCH_SIZE) break;
    }

    if (users.length < LIST_USERS_PER_PAGE) break; // last page
  }

  return candidates;
}

// --- Email template (PLACEHOLDER) --------------------------------------------
// Minimal, clearly-provisional branded HTML. Replace copy, colours, and the
// store links with the real ones when the campaign is finalised.
const APP_STORE_URL = 'https://apps.apple.com/app/waypoint/id0000000000'; // TODO placeholder
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.usewaypoint'; // TODO placeholder

function welcomeEmailHtml(fullName: string | null): string {
  const hi = fullName ? `Hi ${fullName},` : 'Hi there,';
  // NOTE: placeholder template — intentionally bare. Real design TBD.
  return `<!-- PLACEHOLDER lifecycle template: welcome_incomplete_onboarding -->
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:20px;margin:0 0 16px;">Finish setting up Waypoint</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">${hi}</p>
  <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">
    You created a Waypoint account but haven't finished setting up your profile yet.
    Open the app to complete onboarding and start meeting people wherever you travel.
  </p>
  <p style="font-size:15px;line-height:1.5;margin:0 0 24px;">
    <a href="${APP_STORE_URL}" style="color:#2563eb;">Download on the App Store</a><br/>
    <a href="${PLAY_STORE_URL}" style="color:#2563eb;">Get it on Google Play</a>
  </p>
  <p style="font-size:12px;color:#888;margin:0;">Waypoint · placeholder warm-up email</p>
</div>`;
}

const welcomeIncompleteOnboarding: LifecycleJob = {
  key: 'welcome_incomplete_onboarding',
  enabled: false, // ← flip to true (and finalise the template) to activate
  description:
    'Web-signup straggler: account created >24h ago with onboarding_completed=false — nudge them to finish setup in the app.',
  selectUsers: selectWelcomeIncompleteOnboarding,
  run: async (_admin, user) => {
    return await sendEmail({
      to: user.email,
      subject: 'Finish setting up Waypoint',
      html: welcomeEmailHtml((user.full_name as string | null) ?? null),
    });
  },
};

// =====================================================================
// Job: cooling_pair_nudge (Pulse Monitor drift re-engagement)
// =====================================================================
// refresh_pair_pulse() emits engine_events('pulse.transition' -> 'cooling')
// when a pair that had momentum (hot/warm) starts drifting. This job emails
// BOTH members of every pair that cooled in the last 24h: their shared tally,
// how long it's been quiet, and one concrete sidequest to do together.
//
// Idempotency: per-candidate job_key `cooling:{lo}:{hi}:{ISO-week}` — dated so
// a pair that cools again in a LATER week can be nudged again, but at most
// once per pair-week per user (lifecycle_events UNIQUE(user_id, job_key)).
//
// Every send is recorded as engine_events('nudge.sent') so the refresh
// function can detect re-engagement and emit 'nudge.converted' — the drift-
// nudge conversion metric is instrumented from day one.

/** ISO-8601 week key, UTC — e.g. '2026-W29'. */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - day); // shift to this week's Thursday
  const isoYear = date.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

const COOLING_LOOKBACK_MS = 24 * 60 * 60 * 1000;
// Two candidates (both members) per pair — keep within the runner's batch cap.
const COOLING_MAX_PAIRS = Math.floor(BATCH_SIZE / 2);

type PairKey = { lo: string; hi: string };
type SuggestedQuest = { slug: string; title: string; dare: string };

/**
 * One quest to do together: the catalog entry best matching the vibes of the
 * events this pair actually co-attended; falling back to any low-energy,
 * company-required, pair-friendly quest.
 */
async function suggestPairQuest(admin: Admin, pair: PairKey): Promise<SuggestedQuest | null> {
  const QUEST_COLS = 'slug, title, dare';

  // Events both attended -> their quest_tags vibes, tallied.
  const [aRes, bRes] = await Promise.all([
    admin.from('attendance').select('event_id').eq('user_id', pair.lo).limit(500),
    admin.from('attendance').select('event_id').eq('user_id', pair.hi).limit(500),
  ]);
  if (aRes.error) throw aRes.error;
  if (bRes.error) throw bRes.error;
  const bEvents = new Set((bRes.data ?? []).map((r: { event_id: number }) => r.event_id));
  const shared = (aRes.data ?? [])
    .map((r: { event_id: number }) => r.event_id)
    .filter((id: number) => bEvents.has(id))
    .slice(0, 50);

  if (shared.length > 0) {
    const { data: tags, error: tagErr } = await admin
      .from('quest_tags')
      .select('vibe')
      .in('event_id', shared);
    if (tagErr) throw tagErr;
    const tally = new Map<string, number>();
    for (const row of tags ?? []) {
      for (const v of (row.vibe as string[]) ?? []) tally.set(v, (tally.get(v) ?? 0) + 1);
    }
    const topVibes = [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([v]) => v);

    if (topVibes.length > 0) {
      const { data: matched, error: matchErr } = await admin
        .from('quest_catalog')
        .select(QUEST_COLS)
        .eq('is_active', true)
        .overlaps('vibe', topVibes)
        .in('social_mode', ['pair', 'either'])
        .limit(1);
      if (matchErr) throw matchErr;
      if (matched && matched.length > 0) return matched[0] as SuggestedQuest;
    }
  }

  // Fallback: low-energy, needs-company, pair-friendly.
  const { data: fallback, error: fbErr } = await admin
    .from('quest_catalog')
    .select(QUEST_COLS)
    .eq('is_active', true)
    .eq('energy_level', 1)
    .eq('is_solo_safe', false)
    .in('social_mode', ['pair', 'either'])
    .limit(1);
  if (fbErr) throw fbErr;
  return (fallback?.[0] as SuggestedQuest | undefined) ?? null;
}

async function selectCoolingPairNudge(admin: Admin): Promise<Candidate[]> {
  const since = new Date(Date.now() - COOLING_LOOKBACK_MS).toISOString();

  // Pairs that drifted to cooling in the last 24h (deduped, newest first).
  const { data: transitions, error } = await admin
    .from('engine_events')
    .select('pair_lo, pair_hi')
    .eq('event_key', 'pulse.transition')
    .eq('payload->>to', 'cooling')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  const pairs: PairKey[] = [];
  const seenPairs = new Set<string>();
  for (const t of transitions ?? []) {
    const lo = t.pair_lo as string | null;
    const hi = t.pair_hi as string | null;
    if (!lo || !hi || seenPairs.has(`${lo}|${hi}`)) continue;
    seenPairs.add(`${lo}|${hi}`);
    pairs.push({ lo, hi });
    if (pairs.length >= COOLING_MAX_PAIRS) break;
  }
  if (pairs.length === 0) return [];

  const userIds = [...new Set(pairs.flatMap((p) => [p.lo, p.hi]))];

  // Consent wins ties: a block placed AFTER the transition kills the nudge.
  const { data: blocks, error: blockErr } = await admin
    .from('blocked_users')
    .select('blocker_id, blocked_id')
    .in('blocker_id', userIds)
    .in('blocked_id', userIds);
  if (blockErr) throw blockErr;
  const blockSet = new Set(
    (blocks ?? []).map((b: { blocker_id: string; blocked_id: string }) => `${b.blocker_id}|${b.blocked_id}`),
  );
  const openPairs = pairs.filter(
    (p) => !blockSet.has(`${p.lo}|${p.hi}`) && !blockSet.has(`${p.hi}|${p.lo}`),
  );
  if (openPairs.length === 0) return [];

  // Pair context: names, shared tally, how long it's been quiet.
  const [profRes, ledgerRes, pulseRes] = await Promise.all([
    admin.from('profiles').select('id, full_name').in('id', userIds),
    admin.from('quest_ledger').select('user_lo, user_hi, quest_count').in('user_lo', userIds).in('user_hi', userIds),
    admin.from('pair_pulse').select('user_lo, user_hi, last_interaction_at').in('user_lo', userIds).in('user_hi', userIds),
  ]);
  if (profRes.error) throw profRes.error;
  if (ledgerRes.error) throw ledgerRes.error;
  if (pulseRes.error) throw pulseRes.error;

  const nameById = new Map<string, string | null>(
    (profRes.data ?? []).map(
      (p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? null] as const,
    ),
  );
  const questCountByPair = new Map<string, number>(
    (ledgerRes.data ?? []).map(
      (r: { user_lo: string; user_hi: string; quest_count: number | null }) =>
        [`${r.user_lo}|${r.user_hi}`, r.quest_count ?? 0] as const,
    ),
  );
  const lastInteractionByPair = new Map<string, string | null>(
    (pulseRes.data ?? []).map(
      (r: { user_lo: string; user_hi: string; last_interaction_at: string | null }) =>
        [`${r.user_lo}|${r.user_hi}`, r.last_interaction_at] as const,
    ),
  );

  // Emails live only in auth.users (see the note on the welcome job).
  const emailById = new Map<string, string>();
  for (const id of userIds) {
    const { data, error: userErr } = await admin.auth.admin.getUserById(id);
    if (userErr) {
      console.warn(`[lifecycle] cooling nudge: could not load auth user ${id}:`, userErr.message);
      continue;
    }
    if (data?.user?.email) emailById.set(id, data.user.email);
  }

  const week = isoWeekKey(new Date());
  const candidates: Candidate[] = [];
  for (const pair of openPairs) {
    const pairKey = `${pair.lo}|${pair.hi}`;
    const lastAt = lastInteractionByPair.get(pairKey);
    const daysQuiet = lastAt
      ? Math.max(1, Math.floor((Date.now() - Date.parse(lastAt)) / 86_400_000))
      : null;
    const quest = await suggestPairQuest(admin, pair);
    const shared = {
      job_key: `cooling:${pair.lo}:${pair.hi}:${week}`,
      pair_lo: pair.lo,
      pair_hi: pair.hi,
      quest_count: questCountByPair.get(pairKey) ?? 0,
      days_quiet: daysQuiet,
      quest,
    };
    for (const [self, other] of [
      [pair.lo, pair.hi],
      [pair.hi, pair.lo],
    ] as Array<[string, string]>) {
      const email = emailById.get(self);
      if (!email) continue; // can't reach them — no lifecycle row, retried next tick
      candidates.push({ ...shared, user_id: self, email, partner_name: nameById.get(other) ?? null });
    }
  }
  return candidates;
}

function coolingNudgeEmailHtml(user: Candidate): string {
  const partnerFirst = ((user.partner_name as string | null) ?? 'your sidequest partner').split(' ')[0];
  const questCount = (user.quest_count as number) ?? 0;
  const daysQuiet = user.days_quiet as number | null;
  const quest = user.quest as SuggestedQuest | null;

  const tallyLine =
    questCount > 0
      ? `You and ${partnerFirst}: <strong>${questCount} sidequest${questCount === 1 ? '' : 's'} together</strong>.`
      : `You and ${partnerFirst} had real momentum going.`;
  const quietLine = daysQuiet ? ` It's been ${daysQuiet} day${daysQuiet === 1 ? '' : 's'}.` : '';
  const questBlock = quest
    ? `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 16px;">
    <p style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#888;margin:0 0 6px;">One for the two of you</p>
    <p style="font-size:16px;font-weight:600;margin:0 0 6px;">${quest.title}</p>
    <p style="font-size:14px;line-height:1.5;color:#444;margin:0;">${quest.dare}</p>
  </div>`
    : '';

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:20px;margin:0 0 16px;">Don't let it fade</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">${tallyLine}${quietLine}</p>
  <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">
    The best streaks are the ones you restart. Open Waypoint, send ${partnerFirst} a message,
    and pick your next sidequest.
  </p>
  ${questBlock}
  <p style="font-size:12px;color:#888;margin:0;">Waypoint · you're getting this because you two have history</p>
</div>`;
}

const coolingPairNudge: LifecycleJob = {
  key: 'cooling_pair_nudge',
  enabled: true,
  description:
    'Pulse Monitor drift re-engagement: email both members of a pair that transitioned to cooling in the last 24h, with their shared tally and one suggested quest.',
  selectUsers: selectCoolingPairNudge,
  run: async (admin, user) => {
    const partnerFirst = ((user.partner_name as string | null) ?? 'your sidequest partner').split(
      ' ',
    )[0];
    const questCount = (user.quest_count as number) ?? 0;
    const outcome = await sendEmail({
      to: user.email,
      subject:
        questCount > 0
          ? `You and ${partnerFirst}: ${questCount} sidequest${questCount === 1 ? '' : 's'} together`
          : `Pick up where you and ${partnerFirst} left off`,
      html: coolingNudgeEmailHtml(user),
    });

    // Evidence ledger: one 'nudge.sent' per recipient. payload.delivery
    // distinguishes a real send from the no-transport dev skip ('skipped'
    // only happens when RESEND_API_KEY is unset — filter it in prod metrics).
    const quest = user.quest as SuggestedQuest | null;
    const { error } = await admin.from('engine_events').insert({
      event_key: 'nudge.sent',
      user_id: user.user_id,
      pair_lo: user.pair_lo as string,
      pair_hi: user.pair_hi as string,
      payload: { job_key: user.job_key, quest_slug: quest?.slug ?? null, delivery: outcome },
    });
    if (error) throw error;

    return outcome;
  },
};

// =====================================================================
// Registry — add new jobs here.
// =====================================================================
const JOBS: LifecycleJob[] = [welcomeIncompleteOnboarding, coolingPairNudge];

// =====================================================================
// Runner
// =====================================================================
type RunCounts = { sent: number; skipped: number; failed: number };
type DryRunReport = {
  enabled: boolean;
  wouldSelect: number;
  sample: Array<{ user_id: string; email: string }>;
};

/** The lifecycle_events key for a candidate: its own job_key, else the job's. */
function candidateKey(job: LifecycleJob, c: Candidate): string {
  return c.job_key ?? job.key;
}

/** "user_id|job_key" combos already recorded (any status) — skip them. */
async function alreadyHandled(
  keys: Array<{ user_id: string; job_key: string }>,
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const { data, error } = await admin
    .from('lifecycle_events')
    .select('user_id, job_key')
    .in('job_key', [...new Set(keys.map((k) => k.job_key))])
    .in('user_id', [...new Set(keys.map((k) => k.user_id))]);
  if (error) throw error;
  return new Set(
    (data ?? []).map((r: { user_id: string; job_key: string }) => `${r.user_id}|${r.job_key}`),
  );
}

async function runJob(job: LifecycleJob): Promise<RunCounts> {
  const counts: RunCounts = { sent: 0, skipped: 0, failed: 0 };

  const candidates = await job.selectUsers(admin);
  const handled = await alreadyHandled(
    candidates.map((c) => ({ user_id: c.user_id, job_key: candidateKey(job, c) })),
  );
  const pending = candidates.filter(
    (c) => !handled.has(`${c.user_id}|${candidateKey(job, c)}`),
  );

  for (const user of pending) {
    try {
      const outcome = await job.run(admin, user);

      // Record the outcome. The UNIQUE(user_id, job_key) constraint double-guards
      // against a concurrent runner tick that raced past the alreadyHandled()
      // pre-filter: a 23505 here means the other tick already recorded this
      // user, so we count it as skipped rather than erroring.
      //
      // (Known narrow window: because we record AFTER run(), two overlapping
      // ticks could both send before either insert. An hourly, batch-bounded
      // cron makes this effectively impossible; a stricter guarantee would
      // claim-insert BEFORE run(). Documented in README.)
      const { error: insErr } = await admin
        .from('lifecycle_events')
        .insert({ user_id: user.user_id, job_key: candidateKey(job, user), status: outcome, detail: null });

      if (insErr) {
        if ((insErr as { code?: string }).code === '23505') {
          counts.skipped++;
          continue;
        }
        throw insErr;
      }

      if (outcome === 'sent') counts.sent++;
      else counts.skipped++;
    } catch (err) {
      counts.failed++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[lifecycle] job ${job.key} failed for ${user.user_id}:`, message);
      // Best-effort failure record (also unique-guarded; ignore 23505).
      const { error: failErr } = await admin
        .from('lifecycle_events')
        .insert({
          user_id: user.user_id,
          job_key: candidateKey(job, user),
          status: 'failed',
          detail: message.slice(0, 500),
        });
      if (failErr && (failErr as { code?: string }).code !== '23505') {
        console.error('[lifecycle] could not record failure:', failErr.message);
      }
    }
  }

  return counts;
}

async function dryRunJob(job: LifecycleJob): Promise<DryRunReport> {
  const candidates = await job.selectUsers(admin);
  const handled = await alreadyHandled(
    candidates.map((c) => ({ user_id: c.user_id, job_key: candidateKey(job, c) })),
  );
  const pending = candidates.filter(
    (c) => !handled.has(`${c.user_id}|${candidateKey(job, c)}`),
  );
  return {
    enabled: job.enabled,
    wouldSelect: pending.length,
    sample: pending.slice(0, 10).map((c) => ({ user_id: c.user_id, email: c.email })),
  };
}

serve(async (req) => {
  // Fail closed: no secret configured => refuse everything (mirrors the webhooks).
  if (!RUNNER_AUTH) {
    return new Response('runner auth not configured', { status: 503 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${RUNNER_AUTH}`) {
    return new Response('unauthorized', { status: 401 });
  }
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  // Optional body: { "dryRun": true }. Empty body is fine (cron POSTs '{}').
  let dryRun = false;
  try {
    const raw = await req.text();
    if (raw) {
      const body = JSON.parse(raw) as { dryRun?: boolean };
      dryRun = body?.dryRun === true;
    }
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  try {
    if (dryRun) {
      // Preview EVERY registered job (including disabled ones) so you can see
      // what a job would pick up before enabling it.
      const report: Record<string, DryRunReport> = {};
      for (const job of JOBS) {
        report[job.key] = await dryRunJob(job);
      }
      return new Response(JSON.stringify({ dryRun: true, jobs: report }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Real run: enabled jobs only.
    const summary: Record<string, RunCounts> = {};
    for (const job of JOBS) {
      if (!job.enabled) continue;
      summary[job.key] = await runJob(job);
    }
    return new Response(JSON.stringify(summary), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('[lifecycle] runner error:', err);
    return new Response('runner error', { status: 500 });
  }
});
