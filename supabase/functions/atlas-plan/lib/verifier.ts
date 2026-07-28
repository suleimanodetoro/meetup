// Deterministic plan verifier.
//
// The AI (or any other proposer) proposes; this code decides. Every check is
// pure, explainable, and recorded in the decision ledger whether it passes or
// not. A plan ships only when zero 'block' checks fail — 'warn' failures ride
// along as context for the reviewer.
//
// Several checks re-assert facts upstream stages already enforced (member
// eligibility, chemistry floor). That duplication is deliberate defense in
// depth, mirroring how reserve_autogen_event re-validates clusters the edge
// function already filtered.

import { CHEMISTRY_MIN_AVG, GROUP_MAX, GROUP_MIN } from './optimizer.ts';
import type { CompiledIntent, MemberProfile, PlanProposal, VerifierResult } from './types.ts';

const MIN_LOCAL_HOUR = 8;
const MAX_LOCAL_HOUR = 23;
const HORIZON_WARN_DAYS = 14;
const MIN_CONFIDENCE = 0.3;

function check(
  id: string,
  description: string,
  severity: 'block' | 'warn',
  pass: boolean,
  detail: string
): VerifierResult {
  return { id, description, severity, pass, detail };
}

function containsAvoidTag(haystack: string, tag: string): boolean {
  // Word-boundary match so 'bar' does not flag 'barista'.
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack);
}

export function verifyPlan(input: {
  intent: CompiledIntent;
  proposal: PlanProposal;
  members: MemberProfile[];
  now: Date;
}): VerifierResult[] {
  const { intent, proposal, members, now } = input;
  const { quest, group, schedule } = proposal;
  const results: VerifierResult[] = [];

  results.push(
    check(
      'intent_confidence',
      'Compiler is reasonably confident in its reading of the intent',
      'warn',
      intent.confidence >= MIN_CONFIDENCE,
      `confidence ${intent.confidence} (floor ${MIN_CONFIDENCE})`
    )
  );

  results.push(
    check(
      'city_present',
      'A target city is known',
      'block',
      proposal.city.trim().length > 0,
      proposal.city ? `city "${proposal.city}"` : 'no city in intent or requester profile'
    )
  );

  results.push(
    check(
      'social_mode_supported',
      'Atlas plans group experiences in this slice',
      'block',
      intent.social !== 'solo',
      intent.social === 'solo'
        ? 'intent asks for a solo experience; the Atlas vertical slice composes groups'
        : `social mode "${intent.social ?? 'unspecified'}"`
    )
  );

  results.push(
    check(
      'quest_social_mode',
      'Quest template supports a group',
      'block',
      quest.socialMode === 'group' || quest.socialMode === 'either',
      `template social_mode "${quest.socialMode}"`
    )
  );

  if (intent.durationMaxMin !== null) {
    results.push(
      check(
        'duration_fits',
        'Quest fits inside the stated time window',
        'block',
        quest.durationMin <= intent.durationMaxMin,
        `quest needs ${quest.durationMin} min; window allows ${intent.durationMaxMin} min`
      )
    );
  }

  if (intent.budgetTier !== null) {
    results.push(
      check(
        'budget_tier',
        'Quest cost tier is within the stated budget tier',
        'block',
        quest.costTier <= intent.budgetTier,
        `quest cost_tier ${quest.costTier}; budget tier ${intent.budgetTier}`
      )
    );
  }

  if (intent.budgetGbp !== null && quest.budgetMax !== null) {
    results.push(
      check(
        'budget_amount',
        'Quest estimated max spend is within the stated amount',
        'warn',
        quest.budgetMax <= intent.budgetGbp,
        `quest budget_max ${quest.budgetMax} ${quest.currency ?? 'GBP'}; stated ~£${intent.budgetGbp}`
      )
    );
  }

  const comfort = intent.comfort ?? 2;
  results.push(
    check(
      'risk_within_comfort',
      'Quest risk tier is within the requester comfort level',
      'block',
      quest.riskTier <= comfort,
      `quest risk_tier ${quest.riskTier}; comfort ${comfort}${intent.comfort === null ? ' (defaulted)' : ''}`
    )
  );

  if (intent.avoidTags.length > 0) {
    const haystack = [quest.title, quest.dare, quest.why ?? '', quest.category, quest.vibe.join(' ')].join(' ');
    const hits = intent.avoidTags.filter((tag) => containsAvoidTag(haystack, tag));
    results.push(
      check(
        'avoid_tags_clear',
        'Quest content is clear of hard-exclusion tags',
        'block',
        hits.length === 0,
        hits.length === 0
          ? `checked ${intent.avoidTags.length} exclusion tag(s), none present`
          : `quest text matches excluded: ${hits.join(', ')}`
      )
    );
  }

  const sizeOk = group.members.length >= GROUP_MIN && group.members.length <= GROUP_MAX;
  const intentSizeOk =
    (intent.groupSizeMin === null || group.members.length >= Math.max(GROUP_MIN, intent.groupSizeMin)) &&
    (intent.groupSizeMax === null || group.members.length <= Math.min(GROUP_MAX, intent.groupSizeMax));
  results.push(
    check(
      'group_size_bounds',
      `Group size is ${GROUP_MIN}–${GROUP_MAX} and honors the stated size`,
      'block',
      sizeOk && intentSizeOk,
      `group of ${group.members.length}; stated ${intent.groupSizeMin ?? '–'}..${intent.groupSizeMax ?? '–'}`
    )
  );

  results.push(
    check(
      'chemistry_floor',
      `Group average chemistry ≥ ${CHEMISTRY_MIN_AVG} with no zero-score pair`,
      'block',
      group.averageChemistry >= CHEMISTRY_MIN_AVG && group.minPairChemistry > 0,
      `avg ${group.averageChemistry}, weakest pair ${group.minPairChemistry}`
    )
  );

  const memberById = new Map(members.map((m) => [m.userId, m]));
  const ineligible: string[] = [];
  for (const id of group.members) {
    const m = memberById.get(id);
    if (!m) {
      ineligible.push(`${id}: profile missing from verifier input`);
      continue;
    }
    if (!m.onboarded) ineligible.push(`${id}: not onboarded`);
    if (m.isPrivate) ineligible.push(`${id}: private profile`);
    if (m.isSystemHost) ineligible.push(`${id}: system host`);
    if (m.invitedThisWeek) ineligible.push(`${id}: weekly auto-invite cap`);
  }
  results.push(
    check(
      'members_eligible',
      'Every group member is eligible (re-asserted independently of the optimizer)',
      'block',
      ineligible.length === 0,
      ineligible.length === 0 ? `${group.members.length} members eligible` : ineligible.join('; ')
    )
  );

  const startsAt = Date.parse(schedule.startsAtUtc);
  results.push(
    check(
      'starts_in_future',
      'Scheduled start is in the future',
      'block',
      Number.isFinite(startsAt) && startsAt > now.getTime(),
      `starts ${schedule.startsAtUtc}; now ${now.toISOString()}`
    )
  );

  results.push(
    check(
      'within_intent_window',
      'Scheduled start honors the stated time window',
      'block',
      schedule.withinIntentWindow !== false,
      schedule.withinIntentWindow === null
        ? 'no window stated'
        : `withinIntentWindow=${schedule.withinIntentWindow}`
    )
  );

  const localHour = (() => {
    if (!Number.isFinite(startsAt)) return null;
    const localMs = startsAt + schedule.utcOffsetHours * 60 * 60 * 1000;
    return new Date(localMs).getUTCHours();
  })();
  results.push(
    check(
      'sociable_hours',
      `Starts between ${MIN_LOCAL_HOUR}:00 and ${MAX_LOCAL_HOUR}:00 city-local`,
      'block',
      localHour !== null && localHour >= MIN_LOCAL_HOUR && localHour <= MAX_LOCAL_HOUR,
      localHour === null ? 'unparseable start time' : `local start hour ${localHour}:xx`
    )
  );

  results.push(
    check(
      'horizon',
      `Starts within ${HORIZON_WARN_DAYS} days`,
      'warn',
      Number.isFinite(startsAt) && startsAt - now.getTime() <= HORIZON_WARN_DAYS * 24 * 60 * 60 * 1000,
      `lead time ${Number.isFinite(startsAt) ? Math.round((startsAt - now.getTime()) / 36e5) : '?'} h`
    )
  );

  return results;
}

export function blockingFailures(results: VerifierResult[]): VerifierResult[] {
  return results.filter((r) => r.severity === 'block' && !r.pass);
}
