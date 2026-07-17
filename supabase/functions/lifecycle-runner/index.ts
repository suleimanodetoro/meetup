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
// are required; everything else is job-specific context.
type Candidate = { user_id: string; email: string; [key: string]: unknown };

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
// Registry — add new jobs here.
// =====================================================================
const JOBS: LifecycleJob[] = [welcomeIncompleteOnboarding];

// =====================================================================
// Runner
// =====================================================================
type RunCounts = { sent: number; skipped: number; failed: number };
type DryRunReport = {
  enabled: boolean;
  wouldSelect: number;
  sample: Array<{ user_id: string; email: string }>;
};

/** user_ids already recorded for this job_key (any status) — skip them. */
async function alreadyHandled(job_key: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data, error } = await admin
    .from('lifecycle_events')
    .select('user_id')
    .eq('job_key', job_key)
    .in('user_id', userIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.user_id as string));
}

async function runJob(job: LifecycleJob): Promise<RunCounts> {
  const counts: RunCounts = { sent: 0, skipped: 0, failed: 0 };

  const candidates = await job.selectUsers(admin);
  const handled = await alreadyHandled(
    job.key,
    candidates.map((c) => c.user_id),
  );
  const pending = candidates.filter((c) => !handled.has(c.user_id));

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
        .insert({ user_id: user.user_id, job_key: job.key, status: outcome, detail: null });

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
          job_key: job.key,
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
    job.key,
    candidates.map((c) => c.user_id),
  );
  const pending = candidates.filter((c) => !handled.has(c.user_id));
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
