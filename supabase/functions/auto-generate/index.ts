// supabase/functions/auto-generate/index.ts
//
// Auto-Generate (Social Momentum Engine, spec 04): detects clusters of
// compatible users and auto-creates plans when no activity exists in their
// city — the structural fix for ghost-town cities. Two paths:
//
//   HOT  (every invocation)          — converts live, compatible quest_intents
//                                      submissions into a sidequest while the
//                                      feeling is fresh.
//   COLD (invoke with {"mode":"daily"}) — seeds activity in quiet cities on a
//                                      schedule, never competing with humans.
//
// Auto-created quests are transparently system-hosted: events.user_id is the
// "Waypoint" profile (scripts/admin/create-system-host.ts), and the client
// renders "Suggested by Waypoint" off its username. Invitees are EMAILED an
// invite (consent — never auto-RSVP'd).
//
// Creation is committed through reserve_autogen_event: event, tags, creation
// metric, invite outbox rows and lifecycle claims are one transaction. Email
// delivery happens only after that commit through leased outbox rows and uses
// the outbox's stable Resend idempotency key. See ./README.md.
//
//   Auth:   Bearer <AUTO_GENERATE_AUTH>  (503 if unset, 401 on mismatch)
//   Invoke: POST {}                  -> auto-cancel sweep + hot path
//           POST { "mode": "daily" } -> auto-cancel sweep + hot path + cold path

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const AUTOGEN_AUTH = Deno.env.get('AUTO_GENERATE_AUTH');
const SYSTEM_HOST_USER_ID = Deno.env.get('SYSTEM_HOST_USER_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Email transport (optional) — same posture and env names as lifecycle-runner
// so one Resend configuration serves both functions. Without RESEND_API_KEY,
// invites resolve to 'skipped' and the pipeline still runs end-to-end.
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('LIFECYCLE_FROM_EMAIL') ?? 'Waypoint <hello@usewaypoint.app>';

// Universal-link host registered in app.config.ts (pathPrefix /event).
const DEEP_LINK_BASE = 'https://usewaypoint.app/event';

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =====================================================================
// Tuning constants
// =====================================================================
const HOT_WINDOW_HOURS = 6; // intents considered "live"
const HOT_MIN_INTENT_USERS = 3; // distinct submitters to consider a city
const CLUSTER_MIN = 3;
const CLUSTER_MAX = 6;
const CHEMISTRY_MIN_AVG = 25; // avg chemistry to join (and to seed) a cluster
const COLD_MIN_RESIDENTS = 8; // onboarded profiles for a cold-path city
const COLD_MAX_FUTURE_EVENTS = 2; // "quiet" = fewer than this many future open quests
const MAX_LIVE_SYSTEM_EVENTS_PER_CITY = 2;
const MAX_CITIES_PER_RUN = 5; // bound a tick's work; overflow logged, next tick's problem
const MAX_CANDIDATES_PER_CITY = 12; // bounds pairwise chemistry_score calls (66 max)
const CANCEL_HORIZON_MS = 24 * 60 * 60 * 1000; // cancel window before start
const CANCEL_MIN_AGE_MS = 6 * 60 * 60 * 1000; // grace: min join-window before sweep may kill
const CANCEL_MIN_ATTENDEES = 2;

// =====================================================================
// City-local time approximation
// =====================================================================
// APPROXIMATION (documented per spec): one static UTC offset per country_code,
// no DST, and wide countries get their most populous zone (US → Eastern).
// It only drives hour-granularity choices ("is it before 15:00 local?",
// "schedule 18:30 local"), where being an hour off is acceptable. Unknown or
// null codes fall back to UTC.
const COUNTRY_UTC_OFFSET_HOURS: Record<string, number> = {
  GB: 0, IE: 0, PT: 0, IS: 0, MA: 0,
  DE: 1, FR: 1, ES: 1, IT: 1, NL: 1, BE: 1, AT: 1, CH: 1, PL: 1, SE: 1,
  NO: 1, DK: 1, CZ: 1, HU: 1, NG: 1, DZ: 1, TN: 1,
  GR: 2, FI: 2, RO: 2, BG: 2, UA: 2, ZA: 2, EG: 2, IL: 2,
  TR: 3, SA: 3, KE: 3, RU: 3,
  AE: 4, PK: 5, IN: 5.5, BD: 6, TH: 7, VN: 7, ID: 7,
  SG: 8, CN: 8, HK: 8, TW: 8, PH: 8, MY: 8,
  JP: 9, KR: 9, AU: 10, NZ: 12,
  BR: -3, AR: -3, UY: -3, CL: -4, VE: -4,
  US: -5, CA: -5, CO: -5, PE: -5, MX: -6, CR: -6, GT: -6,
};

function utcOffsetHours(countryCode: string | null | undefined): number {
  if (!countryCode) return 0;
  return COUNTRY_UTC_OFFSET_HOURS[countryCode.toUpperCase()] ?? 0;
}

/** Current wall-clock hour (0-23, fractional) in the country's approximated zone. */
function localHour(countryCode: string | null | undefined): number {
  const shifted = new Date(Date.now() + utcOffsetHours(countryCode) * 3_600_000);
  return shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
}

/** UTC Date for `dayOffset` days from local-today at local hh:mm. */
function atLocalTime(
  countryCode: string | null | undefined,
  dayOffset: number,
  hour: number,
  minute: number,
): Date {
  const offMs = utcOffsetHours(countryCode) * 3_600_000;
  const local = new Date(Date.now() + offMs);
  local.setUTCDate(local.getUTCDate() + dayOffset);
  local.setUTCHours(Math.floor(hour), minute + (hour % 1) * 60, 0, 0);
  return new Date(local.getTime() - offMs);
}

/** Days until the NEXT local Saturday (1..7 — today being Saturday counts as 7). */
function daysToNextSaturday(countryCode: string | null | undefined): number {
  const local = new Date(Date.now() + utcOffsetHours(countryCode) * 3_600_000);
  const d = (6 - local.getUTCDay() + 7) % 7;
  return d === 0 ? 7 : d;
}

/** Monday 00:00 UTC of the current ISO week — the "1 auto-invite/week" window. */
function isoWeekStartUTC(): Date {
  const d = new Date();
  const day = d.getUTCDay() || 7;
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (day - 1));
  return start;
}

const cityKey = (city: string) => city.trim().toLowerCase();

// =====================================================================
// Email transport (same contract as lifecycle-runner)
// =====================================================================
type EmailDelivery = {
  delivery: 'sent' | 'skipped';
  providerEmailId: string | null;
  detail: string | null;
};

class EmailDeliveryError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}): Promise<EmailDelivery> {
  if (!RESEND_API_KEY) {
    console.log('[autogen] RESEND_API_KEY unset — would email', args.to, '::', args.subject);
    return { delivery: 'skipped', providerEmailId: null, detail: 'RESEND_API_KEY unset' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      // Resend retains keys for 24 hours. The outbox lease is ten minutes and
      // cron runs hourly, so an ambiguous response is retried inside that
      // provider window with the exact same request identity.
      'Idempotency-Key': args.idempotencyKey,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: args.to, subject: args.subject, html: args.html }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const concurrent = res.status === 409 && text.includes('concurrent_idempotent_requests');
    const retryable = concurrent || res.status === 429 || res.status >= 500;
    throw new EmailDeliveryError(`resend ${res.status}: ${text}`, retryable);
  }
  const body = await res.json().catch(() => null) as { id?: string } | null;
  return { delivery: 'sent', providerEmailId: body?.id ?? null, detail: null };
}

function inviteEmailHtml(args: {
  fullName: string | null;
  title: string;
  dare: string;
  city: string;
  dateISO: string;
  eventId: number;
}): string {
  const hi = args.fullName ? `Hi ${args.fullName.split(' ')[0]},` : 'Hi,';
  const when = new Date(args.dateISO).toUTCString().replace(':00 GMT', ' UTC');
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:20px;margin:0 0 16px;">A sidequest in ${args.city}, picked for you</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">${hi}</p>
  <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">
    A few people near you are up for the same kind of thing right now, so Waypoint
    put a sidequest together. No pressure — join only if it sounds fun.
  </p>
  <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 16px;">
    <p style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#888;margin:0 0 6px;">Suggested by Waypoint</p>
    <p style="font-size:16px;font-weight:600;margin:0 0 6px;">${args.title}</p>
    <p style="font-size:14px;line-height:1.5;color:#444;margin:0 0 6px;">${args.dare}</p>
    <p style="font-size:13px;color:#666;margin:0;">${args.city} · ${when}</p>
  </div>
  <p style="font-size:15px;line-height:1.5;margin:0 0 24px;">
    <a href="${DEEP_LINK_BASE}/${args.eventId}" style="color:#2563eb;">See the plan and join</a>
  </p>
  <p style="font-size:12px;color:#888;margin:0;">Waypoint · auto-suggested because your city was quiet — it cancels itself if too few people join</p>
</div>`;
}

// =====================================================================
// Shared building blocks
// =====================================================================
type CatalogQuest = {
  id: number;
  slug: string;
  title: string;
  dare: string;
  category: string;
  energy_level: number;
  social_mode: string;
  duration_min: number;
  risk_tier: number;
  is_solo_safe: boolean;
  vibe: string[];
  interests: unknown; // jsonb ARRAY (hard rule) — passed through to events.interests
};

const chemistryMemo = new Map<string, number>();

/** chemistry_score(a,b) via RPC, memoised per invocation. 0 = unclusterable. */
async function chemistry(a: string, b: string): Promise<number> {
  const k = a < b ? `${a}|${b}` : `${b}|${a}`;
  const hit = chemistryMemo.get(k);
  if (hit !== undefined) return hit;
  const { data, error } = await admin.rpc('chemistry_score', { p_a: a, p_b: b });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const score = (row?.score as number) ?? 0;
  chemistryMemo.set(k, score);
  return score;
}

/**
 * Greedy chemistry clustering (both paths). Seed with the highest-scoring pair
 * (hot) or with `seedMember` + their best partner (cold), then repeatedly add
 * the candidate whose AVERAGE chemistry to the current cluster is highest and
 * ≥ CHEMISTRY_MIN_AVG. A 0-score edge to any member disqualifies a candidate
 * (chemistry_score hard-zeroes blocked / private / un-onboarded pairs —
 * "treat 0 as unclusterable"). Returns null below CLUSTER_MIN.
 */
async function buildCluster(candidates: string[], seedMember?: string): Promise<string[] | null> {
  if (candidates.length < CLUSTER_MIN) return null;

  let pair: [string, string] | null = null;
  let pairScore = 0;
  if (seedMember) {
    for (const u of candidates) {
      if (u === seedMember) continue;
      const s = await chemistry(seedMember, u);
      if (s > pairScore) {
        pairScore = s;
        pair = [seedMember, u];
      }
    }
  } else {
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const s = await chemistry(candidates[i], candidates[j]);
        if (s > pairScore) {
          pairScore = s;
          pair = [candidates[i], candidates[j]];
        }
      }
    }
  }
  // The founding pair is held to the same bar as later additions.
  if (!pair || pairScore < CHEMISTRY_MIN_AVG) return null;

  const cluster: string[] = [...pair];
  const rest = new Set(candidates.filter((u) => !cluster.includes(u)));

  while (cluster.length < CLUSTER_MAX && rest.size > 0) {
    let bestUser: string | null = null;
    let bestAvg = 0;
    for (const u of rest) {
      let sum = 0;
      let unclusterable = false;
      for (const m of cluster) {
        const s = await chemistry(u, m);
        if (s === 0) {
          unclusterable = true;
          break;
        }
        sum += s;
      }
      if (unclusterable) continue;
      const avg = sum / cluster.length;
      if (avg >= CHEMISTRY_MIN_AVG && avg > bestAvg) {
        bestAvg = avg;
        bestUser = u;
      }
    }
    if (!bestUser) break;
    cluster.push(bestUser);
    rest.delete(bestUser);
  }

  return cluster.length >= CLUSTER_MIN ? cluster : null;
}

/** user_ids already invited to ANY auto-quest this ISO week (guardrail). */
async function invitedThisWeek(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data, error } = await admin
    .from('lifecycle_events')
    .select('user_id')
    .like('job_key', 'autogen:%')
    .gte('created_at', isoWeekStartUTC().toISOString())
    .in('user_id', userIds);
  if (error) throw error;
  return new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
}

/**
 * Cluster eligibility (both paths): onboarded, not profile_visibility=private,
 * not the system host, and not already invited to an auto-quest this ISO week.
 * (Blocked pairs need no explicit check — chemistry_score returns 0 for them.)
 */
async function filterEligible(userIds: string[]): Promise<string[]> {
  const ids = [...new Set(userIds)].filter((u) => u !== SYSTEM_HOST_USER_ID);
  if (ids.length === 0) return [];

  const [profRes, privRes, weekly] = await Promise.all([
    admin.from('profiles').select('id').in('id', ids).eq('onboarding_completed', true),
    admin
      .from('user_privacy_settings')
      .select('user_id')
      .in('user_id', ids)
      .eq('profile_visibility', 'private'),
    invitedThisWeek(ids),
  ]);
  if (profRes.error) throw profRes.error;
  if (privRes.error) throw privRes.error;

  const onboarded = new Set((profRes.data ?? []).map((r: { id: string }) => r.id));
  const priv = new Set((privRes.data ?? []).map((r: { user_id: string }) => r.user_id));
  return ids.filter((u) => onboarded.has(u) && !priv.has(u) && !weekly.has(u));
}

/** Future ACTIVE system-hosted events in a city (guardrail: max 2 live). */
async function liveSystemEventCount(city: string): Promise<number> {
  const { count, error } = await admin
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', SYSTEM_HOST_USER_ID!)
    .eq('status', 'active')
    .gt('date', new Date().toISOString())
    .ilike('city', city.trim());
  if (error) throw error;
  return count ?? 0;
}

/**
 * Pick a quest template: suggest_quest with the cluster's preferences, then
 * the first result that is group-suitable AND risk_tier 1. Falls back to any
 * active low-risk group/either template so a valid cluster never dies on
 * template choice.
 */
async function pickQuest(prefs: {
  energy: number | null;
  social: string | null;
  timeMax: number | null;
  categories: string[] | null;
}): Promise<CatalogQuest | null> {
  const { data, error } = await admin.rpc('suggest_quest', {
    p_energy: prefs.energy,
    p_social: prefs.social,
    p_time_max: prefs.timeMax,
    p_budget: null,
    p_comfort: null,
    p_categories: prefs.categories,
    p_limit: 20,
  });
  if (error) throw error;
  const fit = ((data ?? []) as CatalogQuest[]).find(
    (q) => (q.social_mode === 'group' || q.social_mode === 'either') && q.risk_tier === 1,
  );
  if (fit) {
    // suggest_quest doesn't return interests; fetch the full catalog row.
    const { data: full, error: fullErr } = await admin
      .from('quest_catalog')
      .select('id, slug, title, dare, category, energy_level, social_mode, duration_min, risk_tier, is_solo_safe, vibe, interests')
      .eq('id', fit.id)
      .single();
    if (fullErr) throw fullErr;
    return full as CatalogQuest;
  }

  const { data: fb, error: fbErr } = await admin
    .from('quest_catalog')
    .select('id, slug, title, dare, category, energy_level, social_mode, duration_min, risk_tier, is_solo_safe, vibe, interests')
    .eq('is_active', true)
    .eq('risk_tier', 1)
    .in('social_mode', ['group', 'either'])
    .order('id', { ascending: true })
    .limit(1);
  if (fbErr) throw fbErr;
  return ((fb ?? [])[0] as CatalogQuest | undefined) ?? null;
}

// =====================================================================
// Create + invite (shared by both paths)
// =====================================================================
type CreatedReport = {
  event_id: number;
  generation_key: string;
  created: boolean;
  city: string;
  title: string;
  slug: string;
  date: string;
  cluster_size: number;
  invited: { user_id: string; delivery: string }[];
};

type ClaimedInvite = {
  invite_id: number;
  event_id: number;
  user_id: string;
  recipient_email: string | null;
  recipient_name: string | null;
  idempotency_key: string;
  attempt_count: number;
  path: 'hot' | 'daily';
  city: string;
  scheduled_for: string;
  quest_title: string;
  quest_dare: string;
};

/**
 * Deliver committed outbox rows. The database lease prevents two workers from
 * owning a row simultaneously; Resend's stable idempotency key covers a crash
 * after the provider accepted an email but before completion was recorded.
 */
async function drainInviteOutbox(
  eventId: number | null = null,
  limit = 20,
): Promise<{ user_id: string; delivery: string }[]> {
  const workerToken = crypto.randomUUID();
  const { data, error } = await admin.rpc('claim_autogen_invites', {
    p_worker_token: workerToken,
    p_event_id: eventId,
    p_limit: limit,
    p_lease_seconds: 600,
  });
  if (error) throw error;

  const delivered: { user_id: string; delivery: string }[] = [];
  for (const invite of (data ?? []) as ClaimedInvite[]) {
    let delivery: 'sent' | 'skipped' | 'failed' = 'skipped';
    let detail: string | null = null;
    let providerEmailId: string | null = null;
    let retryable = false;

    try {
      if (!invite.recipient_email) {
        detail = 'no email on auth user at reservation time';
      } else {
        const result = await sendEmail({
          to: invite.recipient_email,
          subject: `${invite.quest_title} — a sidequest in ${invite.city}`,
          html: inviteEmailHtml({
            fullName: invite.recipient_name,
            title: invite.quest_title,
            dare: invite.quest_dare,
            city: invite.city,
            dateISO: invite.scheduled_for,
            eventId: invite.event_id,
          }),
          idempotencyKey: invite.idempotency_key,
        });
        delivery = result.delivery;
        detail = result.detail;
        providerEmailId = result.providerEmailId;
      }
    } catch (err) {
      delivery = 'failed';
      detail = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      retryable = err instanceof EmailDeliveryError && err.retryable;
      console.error(`[autogen] invite attempt failed for ${invite.user_id}:`, detail);
    }

    const { data: finalStatus, error: completeErr } = await admin.rpc('complete_autogen_invite', {
      p_invite_id: invite.invite_id,
      p_worker_token: workerToken,
      p_delivery: delivery,
      p_detail: detail,
      p_provider_email_id: providerEmailId,
      p_retryable: retryable,
    });
    if (completeErr) throw completeErr;
    delivered.push({ user_id: invite.user_id, delivery: finalStatus as string });
  }

  return delivered;
}

async function createAndInvite(args: {
  path: 'hot' | 'daily';
  city: string;
  country: string | null;
  countryCode: string | null;
  cluster: string[];
  quest: CatalogQuest;
  date: Date;
}): Promise<CreatedReport> {
  const dateISO = args.date.toISOString();

  const { data, error } = await admin.rpc('reserve_autogen_event', {
    p_path: args.path,
    p_city: args.city,
    p_country: args.country,
    p_country_code: args.countryCode,
    p_scheduled_for: dateISO,
    p_system_host_user_id: SYSTEM_HOST_USER_ID!,
    p_quest_catalog_id: args.quest.id,
    p_cluster_user_ids: args.cluster,
    p_max_live_city_events: MAX_LIVE_SYSTEM_EVENTS_PER_CITY,
  });
  if (error) throw error;
  const reservation = (Array.isArray(data) ? data[0] : data) as {
    event_id: number;
    generation_key: string;
    created: boolean;
  } | null;
  if (!reservation) throw new Error('reserve_autogen_event returned no row');

  // The transaction above committed the event and every claim before this
  // external side effect. A retry that finds the same reservation simply
  // drains any outbox work that remains.
  const invited = await drainInviteOutbox(reservation.event_id, CLUSTER_MAX);

  return {
    event_id: reservation.event_id,
    generation_key: reservation.generation_key,
    created: reservation.created,
    city: args.city,
    title: args.quest.title,
    slug: args.quest.slug,
    date: dateISO,
    cluster_size: args.cluster.length,
    invited,
  };
}

// =====================================================================
// HOT path — live intent → same-day/next-day quest
// =====================================================================
type IntentRow = {
  user_id: string;
  city: string;
  country_code: string | null;
  energy: number | null;
  social: string | null;
  time_max: number | null;
  categories: string[] | null;
  created_at: string;
};

type SkipReport = { city: string; reason: string };
type PathReport = { citiesConsidered: number; created: CreatedReport[]; skipped: SkipReport[] };

function modal<T>(values: (T | null | undefined)[]): T | null {
  const tally = new Map<T, number>();
  for (const v of values) if (v !== null && v !== undefined) tally.set(v, (tally.get(v) ?? 0) + 1);
  let best: T | null = null;
  let n = 0;
  for (const [v, c] of tally) if (c > n) { best = v; n = c; }
  return best;
}

function median(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
  if (nums.length === 0) return null;
  return nums[Math.floor((nums.length - 1) / 2)];
}

async function runHotPath(): Promise<PathReport> {
  const report: PathReport = { citiesConsidered: 0, created: [], skipped: [] };
  const since = new Date(Date.now() - HOT_WINDOW_HOURS * 3_600_000).toISOString();

  const { data: intents, error } = await admin
    .from('quest_intents')
    .select('user_id, city, country_code, energy, social, time_max, categories, created_at')
    .gte('created_at', since)
    .in('social', ['pair', 'group', 'either'])
    .not('city', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;

  // Group by city; keep the first-seen display spelling.
  const byCity = new Map<string, { city: string; rows: IntentRow[] }>();
  for (const row of (intents ?? []) as IntentRow[]) {
    const k = cityKey(row.city);
    const entry = byCity.get(k) ?? { city: row.city.trim(), rows: [] };
    entry.rows.push(row);
    byCity.set(k, entry);
  }

  const cities = [...byCity.values()]
    .map((c) => ({ ...c, users: [...new Set(c.rows.map((r) => r.user_id))] }))
    .filter((c) => c.users.length >= HOT_MIN_INTENT_USERS)
    .sort((a, b) => b.users.length - a.users.length);
  report.citiesConsidered = cities.length;
  if (cities.length > MAX_CITIES_PER_RUN) {
    console.log(
      `[autogen] hot: ${cities.length - MAX_CITIES_PER_RUN} intent cities over the per-run cap — deferred to the next tick`,
    );
  }

  for (const c of cities.slice(0, MAX_CITIES_PER_RUN)) {
    try {
      if ((await liveSystemEventCount(c.city)) >= MAX_LIVE_SYSTEM_EVENTS_PER_CITY) {
        report.skipped.push({ city: c.city, reason: 'city cap: 2 live system events' });
        continue;
      }

      // Most-recent submitters first (rows are newest-first), bounded.
      const eligible = (await filterEligible(c.users)).slice(0, MAX_CANDIDATES_PER_CITY);
      if (eligible.length < CLUSTER_MIN) {
        report.skipped.push({ city: c.city, reason: `only ${eligible.length} eligible submitters` });
        continue;
      }

      const cluster = await buildCluster(eligible);
      if (!cluster) {
        report.skipped.push({ city: c.city, reason: 'no cluster ≥3 with avg chemistry ≥25' });
        continue;
      }

      // Majority preferences from the CLUSTER's intents in the window.
      const clusterRows = c.rows.filter((r) => cluster.includes(r.user_id));
      const catTally = new Map<string, number>();
      for (const r of clusterRows) for (const cat of r.categories ?? []) catTally.set(cat, (catTally.get(cat) ?? 0) + 1);
      const topCategories = [...catTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v]) => v);
      const medTimeMax = median(clusterRows.map((r) => r.time_max));

      const quest = await pickQuest({
        energy: modal(clusterRows.map((r) => r.energy)),
        social: modal(clusterRows.map((r) => r.social)),
        timeMax: medTimeMax,
        categories: topCategories.length ? topCategories : null,
      });
      if (!quest) {
        report.skipped.push({ city: c.city, reason: 'no group-suitable risk-1 template' });
        continue;
      }

      // Country name/code: intents carry the code; the name comes from the
      // cluster's profiles (modal), since quest_intents doesn't store it.
      const countryCode = modal(clusterRows.map((r) => r.country_code));
      const { data: geo, error: geoErr } = await admin
        .from('profiles')
        .select('location_country, location_country_code')
        .in('id', cluster);
      if (geoErr) throw geoErr;
      const country = modal((geo ?? []).map((g: { location_country: string | null }) => g.location_country));
      const cc = countryCode ?? modal((geo ?? []).map((g: { location_country_code: string | null }) => g.location_country_code));

      // Same day 18:30 local while the feeling is fresh (enough time budget +
      // early enough in the day); otherwise tomorrow 18:30 local.
      const sameDay = (medTimeMax ?? 0) >= 90 && localHour(cc) < 15;
      const date = atLocalTime(cc, sameDay ? 0 : 1, 18, 30);

      report.created.push(
        await createAndInvite({ path: 'hot', city: c.city, country, countryCode: cc, cluster, quest, date }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[autogen] hot path failed for ${c.city}:`, msg);
      report.skipped.push({ city: c.city, reason: `error: ${msg.slice(0, 200)}` });
    }
  }

  return report;
}

// =====================================================================
// COLD path — seed quiet cities (mode: "daily")
// =====================================================================
// Shared profile interests → catalog vocabulary (suggest_quest matches
// p_categories against quest_catalog.category AND vibe tags; profile-interest
// tokens come from onboarding and don't overlap either, so map the common ones
// to vibe tags and pass null when nothing maps).
const INTEREST_TO_CATALOG: Record<string, string[]> = {
  outdoor: ['outdoors', 'explore'],
  hiking: ['outdoors'],
  sports: ['outdoors', 'adventurous'],
  thrill: ['adventurous', 'brave'],
  travel: ['explore', 'spontaneous'],
  music: ['social', 'playful'],
  partying: ['social', 'playful'],
  raves: ['social'],
  karaoke: ['playful', 'social'],
  dance: ['playful', 'social'],
  boardgames: ['playful', 'cozy'],
  gaming: ['playful'],
  art: ['creative'],
  film: ['creative', 'nostalgic'],
  photography: ['creative', 'explore'],
  fashion: ['creative'],
  yoga: ['mindful', 'calm'],
  meditation: ['mindful', 'calm'],
  wellness: ['mindful', 'calm'],
  foodie: ['cozy', 'social'],
  coffee: ['cozy'],
  reading: ['reflective', 'cozy'],
  volunteer: ['kindness', 'wholesome'],
};

async function runColdPath(): Promise<PathReport> {
  const report: PathReport = { citiesConsidered: 0, created: [], skipped: [] };
  const nowISO = new Date().toISOString();

  const { data: profs, error } = await admin
    .from('profiles')
    .select('id, location, location_country, location_country_code, interests')
    .eq('onboarding_completed', true)
    .not('location', 'is', null)
    .limit(5000);
  if (error) throw error;

  type Resident = { id: string; interests: unknown };
  const byCity = new Map<
    string,
    { city: string; residents: Resident[]; countries: (string | null)[]; codes: (string | null)[] }
  >();
  for (const p of profs ?? []) {
    const loc = (p.location as string).trim();
    if (!loc) continue;
    const k = cityKey(loc);
    const entry = byCity.get(k) ?? { city: loc, residents: [], countries: [], codes: [] };
    entry.residents.push({ id: p.id as string, interests: p.interests });
    entry.countries.push((p.location_country as string | null) ?? null);
    entry.codes.push((p.location_country_code as string | null) ?? null);
    byCity.set(k, entry);
  }

  const candidates = [...byCity.values()]
    .filter((c) => c.residents.length >= COLD_MIN_RESIDENTS)
    .sort((a, b) => b.residents.length - a.residents.length);
  report.citiesConsidered = candidates.length;

  // The per-run cap counts cities that PASS the (cheap) quietness checks and
  // reach the expensive clustering stage. Capping the candidate list instead
  // would let big, busy cities eat every slot and starve the quiet ones this
  // path exists for.
  let attempts = 0;

  for (const c of candidates) {
    if (attempts >= MAX_CITIES_PER_RUN) {
      console.log('[autogen] cold: per-run city cap reached — remaining quiet cities deferred to tomorrow');
      break;
    }
    try {
      // Quiet = fewer than 2 future, non-cancelled, PUBLIC open sidequests,
      // and ZERO of those human-hosted (never compete with a human host).
      const { data: future, error: futErr } = await admin
        .from('events')
        .select('id, user_id, is_private')
        .ilike('city', c.city)
        .gt('date', nowISO)
        .neq('status', 'cancelled')
        .eq('kind', 'open');
      if (futErr) throw futErr;
      const pub = (future ?? []).filter((e: { is_private: boolean | null }) => e.is_private !== true);
      if (pub.length >= COLD_MAX_FUTURE_EVENTS) {
        report.skipped.push({ city: c.city, reason: `not quiet: ${pub.length} future open sidequests` });
        continue;
      }
      if (pub.some((e: { user_id: string | null }) => e.user_id !== SYSTEM_HOST_USER_ID)) {
        report.skipped.push({ city: c.city, reason: 'human-hosted future sidequest exists' });
        continue;
      }
      // (pub.length < 2 and all system-hosted also implies the city cap holds.)
      attempts++;

      const eligible = await filterEligible(c.residents.map((r) => r.id));
      if (eligible.length < CLUSTER_MIN) {
        report.skipped.push({ city: c.city, reason: `only ${eligible.length} eligible residents` });
        continue;
      }

      // Seed member: the eligible resident with the most recent app signal
      // (latest message or attendance row).
      const signalAt = new Map<string, number>();
      const [msgRes, attRes] = await Promise.all([
        admin
          .from('messages')
          .select('user_id, created_at')
          .in('user_id', eligible)
          .order('created_at', { ascending: false })
          .limit(500),
        admin
          .from('attendance')
          .select('user_id, created_at')
          .in('user_id', eligible)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);
      if (msgRes.error) throw msgRes.error;
      if (attRes.error) throw attRes.error;
      for (const r of [...(msgRes.data ?? []), ...(attRes.data ?? [])]) {
        const t = Date.parse(r.created_at as string);
        const cur = signalAt.get(r.user_id as string) ?? 0;
        if (t > cur) signalAt.set(r.user_id as string, t);
      }
      const ordered = [...eligible]
        .sort((a, b) => (signalAt.get(b) ?? 0) - (signalAt.get(a) ?? 0))
        .slice(0, MAX_CANDIDATES_PER_CITY);
      const seed = ordered[0];

      const cluster = await buildCluster(ordered, seed);
      if (!cluster) {
        report.skipped.push({ city: c.city, reason: 'no cluster ≥3 around the seed member' });
        continue;
      }

      // Template: interests shared by ≥2 cluster members → catalog vocabulary.
      const interestTally = new Map<string, number>();
      for (const r of c.residents) {
        if (!cluster.includes(r.id) || !Array.isArray(r.interests)) continue;
        for (const raw of r.interests as unknown[]) {
          if (typeof raw !== 'string') continue;
          const key = raw.trim().toLowerCase();
          interestTally.set(key, (interestTally.get(key) ?? 0) + 1);
        }
      }
      const mapped = new Set<string>();
      for (const [interest, n] of interestTally) {
        if (n < 2) continue;
        for (const tag of INTEREST_TO_CATALOG[interest] ?? []) mapped.add(tag);
      }

      const quest = await pickQuest({
        energy: 2, // cold-path default per spec
        social: 'group',
        timeMax: null,
        categories: mapped.size ? [...mapped] : null,
      });
      if (!quest) {
        report.skipped.push({ city: c.city, reason: 'no group-suitable risk-1 template' });
        continue;
      }

      // Weekend-biased: next Saturday, 11:00 local for high-energy templates,
      // 18:00 local otherwise.
      const cc = modal(c.codes);
      const date = atLocalTime(cc, daysToNextSaturday(cc), quest.energy_level >= 3 ? 11 : 18, 0);

      report.created.push(
        await createAndInvite({
          path: 'daily',
          city: c.city,
          country: modal(c.countries),
          countryCode: cc,
          cluster,
          quest,
          date,
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[autogen] cold path failed for ${c.city}:`, msg);
      report.skipped.push({ city: c.city, reason: `error: ${msg.slice(0, 200)}` });
    }
  }

  return report;
}

// =====================================================================
// Auto-cancel sweep (every invocation, BEFORE creation so a freed city slot
// can be reused the same tick)
// =====================================================================
type CancelReport = {
  swept: number;
  cancelled: { event_id: number; city: string | null; participant_count: number }[];
};

async function runAutoCancel(): Promise<CancelReport> {
  const { data, error } = await admin.rpc('cancel_underfilled_autogen_events', {
    p_system_host_user_id: SYSTEM_HOST_USER_ID!,
    p_horizon_hours: CANCEL_HORIZON_MS / 3_600_000,
    p_min_age_hours: CANCEL_MIN_AGE_MS / 3_600_000,
    p_min_participants: CANCEL_MIN_ATTENDEES,
  });
  if (error) throw error;
  return data as CancelReport;
}

// =====================================================================
// HTTP entrypoint
// =====================================================================
serve(async (req) => {
  // Fail closed on BOTH required secrets (mirrors lifecycle-runner's posture).
  if (!AUTOGEN_AUTH || !SYSTEM_HOST_USER_ID) {
    return new Response('auto-generate not configured', { status: 503 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${AUTOGEN_AUTH}`) {
    return new Response('unauthorized', { status: 401 });
  }
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  let mode: 'hourly' | 'daily' = 'hourly';
  try {
    const raw = await req.text();
    if (raw) {
      const body = JSON.parse(raw) as { mode?: string };
      if (body?.mode === 'daily') mode = 'daily';
    }
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  chemistryMemo.clear();

  try {
    const autoCancel = await runAutoCancel();
    // Recover delivery work left by a crash or retriable provider error before
    // discovering new cohorts. Newly reserved events drain their own rows too.
    const recoveredInvites = await drainInviteOutbox(null, 50);
    const hot = await runHotPath();
    const cold = mode === 'daily' ? await runColdPath() : null;

    return new Response(JSON.stringify({ mode, autoCancel, recoveredInvites, hot, cold }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('[autogen] runner error:', err);
    return new Response('runner error', { status: 500 });
  }
});
