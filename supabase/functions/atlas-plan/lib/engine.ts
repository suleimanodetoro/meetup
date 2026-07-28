// Atlas pipeline: compile -> retrieve -> compose -> schedule -> verify -> decide.
//
// The engine is pure orchestration over injected ports (types.ts
// EnginePorts): index.ts wires ports to Supabase RPCs and the Anthropic
// adapter, tests wire them to fixtures, and the replay harness wires them to
// historical ledger rows. Every stage's inputs, candidates, rejections, and
// timings land in the DecisionTrace that becomes the atlas_decisions row.

import { fnv1a } from './embedder.ts';
import { composeGroup, CHEMISTRY_MIN_AVG } from './optimizer.ts';
import { proposeSchedule } from './schedule.ts';
import { blockingFailures, verifyPlan } from './verifier.ts';
import type {
  DecisionTrace,
  EnginePorts,
  MemberProfile,
  PlanProposal,
  QuestCandidate,
  RequesterContext,
  RoleAssignment,
  VerifierResult,
} from './types.ts';

export const ENGINE_VERSION = 'atlas-0.1.0';

/** Candidates beyond this are dropped before chemistry scoring; with the
 * requester included this bounds pairwise RPC calls at 12*11/2 = 66, the same
 * budget auto-generate runs with. */
export const MAX_GROUP_CANDIDATES = 11;

/** How many retrieval candidates the engine will try to verify before giving up. */
export const MAX_QUEST_ATTEMPTS = 6;

/** Same normalization as the SQL side (lower + trim + collapse whitespace). */
export function toCityKey(city: string): string {
  return city.trim().replace(/\s+/g, ' ').toLowerCase();
}

const ROLE_POOLS: Array<{ pattern: RegExp; roles: string[] }> = [
  {
    pattern: /photo|creative|self-expression|art/i,
    roles: ['Director', 'Location Scout', 'Archivist', 'Wildcard', 'Framer', 'Connector'],
  },
  {
    pattern: /food|taste|sensory/i,
    roles: ['Navigator', 'Orderer-in-Chief', 'Taste Critic', 'Archivist', 'Wildcard', 'Connector'],
  },
  {
    pattern: /explor|urban|lost/i,
    roles: ['Navigator', 'Pathfinder', 'Archivist', 'Timekeeper', 'Wildcard', 'Connector'],
  },
];

const DEFAULT_ROLES = ['Navigator', 'Spark', 'Archivist', 'Timekeeper', 'Wildcard', 'Connector'];

/**
 * Every participant gets a distinct cooperative role, chosen from a pool
 * keyed to the quest's category/vibe and rotated deterministically by the
 * request id (same request replays to the same roles).
 */
export function assignRoles(members: string[], quest: QuestCandidate, requestId: string): RoleAssignment[] {
  const flavor = `${quest.category} ${quest.vibe.join(' ')}`;
  const pool = ROLE_POOLS.find((p) => p.pattern.test(flavor))?.roles ?? DEFAULT_ROLES;
  const offset = fnv1a(requestId) % pool.length;
  return members.map((userId, i) => ({ userId, role: pool[(offset + i) % pool.length] }));
}

export interface RunOptions {
  requestId: string;
  mode: 'shadow' | 'live';
}

function emptyTrace(rawIntent: string, opts: RunOptions): DecisionTrace {
  return {
    requestId: opts.requestId,
    mode: opts.mode,
    stage: 'received',
    status: 'error',
    rawIntent,
    compiled: null,
    compilerKind: 'mock',
    modelId: null,
    promptVersion: null,
    embeddingVersion: null,
    retrieval: [],
    group: null,
    groupConsidered: [],
    proposal: null,
    verifier: [],
    rejectionReasons: [],
    error: null,
    timings: {},
  };
}

export async function runAtlasPipeline(
  rawIntent: string,
  ctx: RequesterContext,
  ports: EnginePorts,
  opts: RunOptions
): Promise<DecisionTrace> {
  const trace = emptyTrace(rawIntent, opts);
  const startedAt = ports.now().getTime();
  let lastMark = startedAt;
  const mark = (stage: string) => {
    const t = ports.now().getTime();
    trace.timings[stage] = t - lastMark;
    lastMark = t;
  };

  try {
    // 1. Compile: free text -> typed constraints.
    const compiled = await ports.compile(rawIntent, ctx);
    trace.compiled = compiled.intent;
    trace.compilerKind = compiled.kind;
    trace.modelId = compiled.modelId;
    trace.promptVersion = compiled.promptVersion;
    trace.stage = 'compiled';
    mark('compile_ms');

    const city = compiled.intent.city ?? ctx.profileCity;
    if (!city) {
      trace.status = 'rejected';
      trace.rejectionReasons.push('no target city: not stated in the intent and no profile location');
      return trace;
    }
    const cityKey = toCityKey(city);

    // 2. Retrieve: semantic quest candidates under hard scalar constraints.
    const retrieval = await ports.retrieve(compiled.intent);
    trace.retrieval = retrieval.candidates;
    trace.embeddingVersion = retrieval.embeddingVersion;
    trace.stage = 'retrieved';
    mark('retrieve_ms');

    if (retrieval.candidates.length === 0) {
      trace.status = 'rejected';
      trace.rejectionReasons.push('no quest templates satisfy the stated constraints');
      return trace;
    }

    // 3. Compose: load city candidates, score pairwise chemistry, grow group.
    const loaded = await ports.loadCandidates(cityKey, ctx.userId);
    const requester = loaded.find((m) => m.userId === ctx.userId);
    if (!requester) {
      throw new Error('requester profile missing from candidate load');
    }
    const others = loaded.filter((m) => m.userId !== ctx.userId).slice(0, MAX_GROUP_CANDIDATES);

    const matrix = new Map<string, number>();
    const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    const cheaplyEligible = others.filter(
      (m) => m.onboarded && !m.isPrivate && !m.isSystemHost && !m.invitedThisWeek
    );
    const scoringSet = [requester, ...cheaplyEligible];
    for (let i = 0; i < scoringSet.length; i++) {
      for (let j = i + 1; j < scoringSet.length; j++) {
        const key = pairKey(scoringSet[i].userId, scoringSet[j].userId);
        if (!matrix.has(key)) {
          matrix.set(key, await ports.chemistry(scoringSet[i].userId, scoringSet[j].userId));
        }
      }
    }
    const pairScore = (a: string, b: string) => matrix.get(pairKey(a, b)) ?? 0;
    mark('chemistry_ms');

    const composed = composeGroup({
      requester,
      candidates: others,
      pairScore,
      minSize: compiled.intent.groupSizeMin ?? 3,
      maxSize: compiled.intent.groupSizeMax ?? 4,
      minAvgChemistry: CHEMISTRY_MIN_AVG,
    });
    trace.stage = 'composed';
    mark('compose_ms');

    if (!composed.ok) {
      trace.groupConsidered = composed.considered;
      trace.status = 'rejected';
      trace.rejectionReasons.push(`group composition failed: ${composed.failure}`);
      return trace;
    }
    trace.group = composed.group;
    trace.groupConsidered = composed.group.considered;

    // 4. Schedule once (independent of which quest wins).
    const schedule = proposeSchedule({
      intent: compiled.intent,
      countryCode: ctx.profileCountryCode,
      now: ports.now(),
    });

    // 5. Verify candidates in retrieval order until one passes every
    //    blocking check. Rejected attempts keep their verifier output so the
    //    ledger shows exactly why each was refused.
    const memberProfiles: MemberProfile[] = loaded.filter((m) => composed.group.members.includes(m.userId));
    let best: { proposal: PlanProposal; results: VerifierResult[]; blocks: number } | null = null;

    for (const quest of trace.retrieval.slice(0, MAX_QUEST_ATTEMPTS)) {
      const proposal: PlanProposal = {
        quest,
        group: composed.group,
        roles: assignRoles(composed.group.members, quest, opts.requestId),
        schedule,
        city,
        cityKey,
        countryCode: ctx.profileCountryCode,
      };
      const results = verifyPlan({
        intent: compiled.intent,
        proposal,
        members: memberProfiles,
        now: ports.now(),
      });
      const blocks = blockingFailures(results).length;
      if (best === null || blocks < best.blocks) {
        best = { proposal, results, blocks };
      }
      if (blocks === 0) break;
    }
    trace.stage = 'verified';
    mark('verify_ms');

    if (!best) {
      trace.status = 'rejected';
      trace.rejectionReasons.push('no quest candidates were available to verify');
      return trace;
    }

    trace.verifier = best.results;
    if (best.blocks === 0) {
      trace.proposal = best.proposal;
      trace.status = 'proposed';
    } else {
      trace.status = 'rejected';
      for (const failure of blockingFailures(best.results)) {
        trace.rejectionReasons.push(`${failure.id}: ${failure.detail}`);
      }
    }
    trace.stage = 'decided';
    return trace;
  } catch (error) {
    trace.stage = 'error';
    trace.status = 'error';
    trace.error = error instanceof Error ? `${error.message}` : String(error);
    return trace;
  } finally {
    trace.timings.total_ms = ports.now().getTime() - startedAt;
  }
}
