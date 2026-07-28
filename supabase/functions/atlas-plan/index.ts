// Atlas plan — turn a free-text intention into a verified group plan proposal.
//
// POST { intent_text: string, mode?: 'shadow', user_id?: uuid }
//
// Auth: unlike auto-generate (cron-invoked, shared secret), atlas-plan is
// client-invoked: verify_jwt = true in config.toml, and the caller's JWT
// resolves the requester. A service-role bearer may also call it (ops/tests)
// and must pass user_id explicitly.
//
// Shadow mode is the only mode in this slice: the full pipeline runs —
// compile -> retrieve -> compose -> schedule -> verify — and every request
// writes one atlas_decisions provenance row plus an engine_events metric,
// but nothing real is created: no events, no invites, no messages.
//
// The intent compiler uses the Anthropic API when ANTHROPIC_API_KEY is set
// (see lib/anthropic.ts) and falls back to the deterministic rule-based
// compiler otherwise — the pipeline is fully runnable with zero credentials.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import { compileWithRules } from './lib/compiler.ts';
import { embed, toPgvectorLiteral } from './lib/embedder.ts';
import { ENGINE_VERSION, runAtlasPipeline } from './lib/engine.ts';
import type {
  CompileOutput,
  CompiledIntent,
  DecisionTrace,
  EnginePorts,
  MemberProfile,
  RequesterContext,
  RetrieveOutput,
  SocialMode,
} from './lib/types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SYSTEM_HOST_USER_ID = Deno.env.get('SYSTEM_HOST_USER_ID') ?? null;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? null;
const ATLAS_MODEL = Deno.env.get('ATLAS_MODEL') ?? undefined;

const MAX_INTENT_CHARS = 500;
const MIN_INTENT_CHARS = 3;

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ---------------------------------------------------------------------------
// Port wiring
// ---------------------------------------------------------------------------

async function compilePort(rawIntent: string, ctx: RequesterContext): Promise<CompileOutput> {
  if (ANTHROPIC_API_KEY) {
    try {
      const { createAnthropicCompiler } = await import('./lib/anthropic.ts');
      const compile = createAnthropicCompiler({ apiKey: ANTHROPIC_API_KEY, model: ATLAS_MODEL });
      return await compile(rawIntent, ctx);
    } catch (error) {
      // The LLM proposes; when it can't (refusal, timeout, API error) the
      // deterministic compiler keeps the pipeline alive and the ledger
      // records the degradation.
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`atlas-plan: anthropic compiler failed, using rules fallback: ${detail}`);
      const intent = compileWithRules(rawIntent, ctx);
      intent.notes.unshift(`anthropic compiler unavailable (${detail.slice(0, 120)}); rule-based fallback used`);
      return { intent, kind: 'anthropic_fallback_mock', modelId: null, promptVersion: null };
    }
  }
  return {
    intent: compileWithRules(rawIntent, ctx),
    kind: 'mock',
    modelId: null,
    promptVersion: null,
  };
}

interface MatchedQuestRow {
  quest_id: number;
  slug: string;
  title: string;
  dare: string;
  why: string | null;
  category: string;
  energy_level: number;
  social_mode: string;
  duration_min: number;
  cost_tier: number;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  risk_tier: number;
  is_solo_safe: boolean;
  vibe: string[];
  similarity: number;
  embedding_version: string;
}

interface SuggestQuestRow {
  id: number;
  slug: string;
  title: string;
  dare: string;
  why: string | null;
  category: string;
  energy_level: number;
  social_mode: string;
  duration_min: number;
  cost_tier: number;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  risk_tier: number;
  is_solo_safe: boolean;
  vibe: string[];
}

async function retrievePort(intent: CompiledIntent): Promise<RetrieveOutput> {
  const queryText = [intent.semanticQuery, ...intent.interestTags].join(' ');
  const literal = toPgvectorLiteral(embed(queryText));

  const { data, error } = await admin.rpc('atlas_match_quests', {
    p_embedding: literal,
    p_time_max: intent.durationMaxMin,
    p_budget: intent.budgetTier,
    p_risk_max: intent.comfort ?? 2,
    p_social: 'group',
    p_require_solo_safe: false,
    p_limit: 12,
  });
  if (error) throw new Error(`atlas_match_quests failed: ${error.message}`);

  const rows = (data ?? []) as MatchedQuestRow[];
  if (rows.length > 0) {
    return {
      embeddingVersion: rows[0].embedding_version,
      candidates: rows.map((r) => ({
        questId: r.quest_id,
        slug: r.slug,
        title: r.title,
        dare: r.dare,
        why: r.why,
        category: r.category,
        energyLevel: r.energy_level,
        socialMode: r.social_mode as SocialMode,
        durationMin: r.duration_min,
        costTier: r.cost_tier,
        budgetMin: r.budget_min,
        budgetMax: r.budget_max,
        currency: r.currency,
        riskTier: r.risk_tier,
        isSoloSafe: r.is_solo_safe,
        vibe: r.vibe ?? [],
        similarity: Math.round(r.similarity * 10000) / 10000,
        source: 'vector' as const,
      })),
    };
  }

  // No embeddings backfilled yet (or nothing survived the filters): fall back
  // to the deterministic catalog ranker so Atlas still plans.
  const { data: suggested, error: suggestError } = await admin.rpc('suggest_quest', {
    p_energy: intent.energy,
    p_social: 'group',
    p_time_max: intent.durationMaxMin,
    p_budget: intent.budgetTier,
    p_comfort: intent.comfort,
    p_categories: intent.interestTags.length > 0 ? intent.interestTags : null,
    p_limit: 12,
  });
  if (suggestError) throw new Error(`suggest_quest fallback failed: ${suggestError.message}`);

  return {
    embeddingVersion: null,
    candidates: ((suggested ?? []) as SuggestQuestRow[])
      .filter((r) => r.social_mode === 'group' || r.social_mode === 'either')
      .map((r) => ({
        questId: r.id,
        slug: r.slug,
        title: r.title,
        dare: r.dare,
        why: r.why,
        category: r.category,
        energyLevel: r.energy_level,
        socialMode: r.social_mode as SocialMode,
        durationMin: r.duration_min,
        costTier: r.cost_tier,
        budgetMin: r.budget_min,
        budgetMax: r.budget_max,
        currency: r.currency,
        riskTier: r.risk_tier,
        isSoloSafe: r.is_solo_safe,
        vibe: r.vibe ?? [],
        similarity: null,
        source: 'suggest_quest_fallback' as const,
      })),
  };
}

/** Monday 00:00 UTC of the current ISO week — same guard window auto-generate uses. */
function isoWeekStartUtc(now: Date): string {
  const day = (now.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  return monday.toISOString();
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  location: string | null;
  username: string | null;
  onboarding_completed: boolean | null;
}

async function loadCandidatesPort(cityKey: string, requesterId: string): Promise<MemberProfile[]> {
  const cols = 'id, full_name, location, username, onboarding_completed';
  const { data: cityRows, error } = await admin
    .from('profiles')
    .select(cols)
    .ilike('location', cityKey)
    .order('updated_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(`candidate load failed: ${error.message}`);

  const profiles = new Map<string, ProfileRow>();
  for (const row of (cityRows ?? []) as ProfileRow[]) profiles.set(row.id, row);

  if (!profiles.has(requesterId)) {
    const { data: requesterRow, error: requesterError } = await admin
      .from('profiles')
      .select(cols)
      .eq('id', requesterId)
      .maybeSingle();
    if (requesterError) throw new Error(`requester load failed: ${requesterError.message}`);
    if (requesterRow) profiles.set(requesterId, requesterRow as ProfileRow);
  }

  const ids = [...profiles.keys()];
  if (ids.length === 0) return [];

  const [privacyResult, invitedResult] = await Promise.all([
    admin.from('user_privacy_settings').select('user_id, profile_visibility').in('user_id', ids),
    admin
      .from('lifecycle_events')
      .select('user_id')
      .in('user_id', ids)
      .like('job_key', 'autogen:%')
      .gte('created_at', isoWeekStartUtc(new Date())),
  ]);
  if (privacyResult.error) throw new Error(`privacy load failed: ${privacyResult.error.message}`);
  if (invitedResult.error) throw new Error(`weekly-invite load failed: ${invitedResult.error.message}`);

  const privateIds = new Set(
    (privacyResult.data ?? [])
      .filter((r) => r.profile_visibility === 'private')
      .map((r) => r.user_id as string)
  );
  const invitedIds = new Set((invitedResult.data ?? []).map((r) => r.user_id as string));

  return ids.map((id) => {
    const p = profiles.get(id)!;
    return {
      userId: id,
      fullName: p.full_name,
      city: p.location,
      onboarded: p.onboarding_completed === true,
      isPrivate: privateIds.has(id),
      isSystemHost: (SYSTEM_HOST_USER_ID !== null && id === SYSTEM_HOST_USER_ID) || p.username === 'waypoint',
      invitedThisWeek: invitedIds.has(id),
    };
  });
}

async function chemistryPort(a: string, b: string): Promise<number> {
  const { data, error } = await admin.rpc('chemistry_score', { p_a: a, p_b: b });
  if (error) throw new Error(`chemistry_score failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : null;
  return typeof row?.score === 'number' ? row.score : 0;
}

// ---------------------------------------------------------------------------
// Provenance persistence
// ---------------------------------------------------------------------------

async function persistDecision(trace: DecisionTrace, userId: string, latencyMs: number): Promise<number> {
  const { data, error } = await admin
    .from('atlas_decisions')
    .insert({
      request_id: trace.requestId,
      user_id: userId,
      mode: trace.mode,
      stage: trace.stage,
      status: trace.status,
      city: trace.proposal?.city ?? trace.compiled?.city ?? null,
      city_key: trace.proposal?.cityKey ?? null,
      country_code: trace.proposal?.countryCode ?? null,
      raw_intent: trace.rawIntent,
      compiled_intent: trace.compiled ?? {},
      retrieval_candidates: trace.retrieval,
      group_candidates: trace.groupConsidered,
      proposal: trace.proposal ?? {},
      verifier_results: trace.verifier,
      outcome: { executed: false, reason: 'shadow mode: no side effects' },
      engine_version: ENGINE_VERSION,
      compiler_kind: trace.compilerKind,
      model_id: trace.modelId,
      prompt_version: trace.promptVersion,
      embedding_version: trace.embeddingVersion,
      latency_ms: latencyMs,
      error: trace.error,
    })
    .select('id')
    .single();
  if (error) throw new Error(`atlas_decisions insert failed: ${error.message}`);
  return data.id as number;
}

// ---------------------------------------------------------------------------
// HTTP entrypoint
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method not allowed' });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { error: 'missing bearer token' });

    let body: { intent_text?: unknown; mode?: unknown; user_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'invalid JSON body' });
    }

    const isServiceCaller = token === SERVICE_ROLE_KEY;
    let requesterId: string;
    if (isServiceCaller) {
      if (typeof body.user_id !== 'string' || body.user_id.length === 0) {
        return json(400, { error: 'service callers must pass user_id' });
      }
      requesterId = body.user_id;
    } else {
      const { data: userData, error: userError } = await admin.auth.getUser(token);
      if (userError || !userData?.user) return json(401, { error: 'invalid token' });
      requesterId = userData.user.id;
    }

    const intentText = typeof body.intent_text === 'string' ? body.intent_text.trim() : '';
    if (intentText.length < MIN_INTENT_CHARS || intentText.length > MAX_INTENT_CHARS) {
      return json(400, { error: `intent_text must be ${MIN_INTENT_CHARS}-${MAX_INTENT_CHARS} characters` });
    }
    const mode = body.mode ?? 'shadow';
    if (mode !== 'shadow') {
      return json(400, {
        error: 'only shadow mode is implemented in this slice: Atlas decides and records, but never creates events or invites',
      });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, full_name, location, location_country_code')
      .eq('id', requesterId)
      .maybeSingle();
    if (profileError) throw new Error(`requester profile load failed: ${profileError.message}`);
    if (!profile) return json(404, { error: 'requester profile not found' });

    const ctx: RequesterContext = {
      userId: requesterId,
      fullName: profile.full_name,
      profileCity: profile.location,
      profileCountryCode: profile.location_country_code,
    };

    const ports: EnginePorts = {
      compile: compilePort,
      retrieve: retrievePort,
      loadCandidates: loadCandidatesPort,
      chemistry: chemistryPort,
      now: () => new Date(),
    };

    const startedAt = Date.now();
    const trace = await runAtlasPipeline(intentText, ctx, ports, {
      requestId: crypto.randomUUID(),
      mode: 'shadow',
    });
    const latencyMs = Date.now() - startedAt;

    const decisionId = await persistDecision(trace, requesterId, latencyMs);

    const { error: metricError } = await admin.from('engine_events').insert({
      event_key: 'atlas.decision',
      user_id: requesterId,
      payload: {
        request_id: trace.requestId,
        decision_id: decisionId,
        mode: trace.mode,
        status: trace.status,
        stage: trace.stage,
        compiler_kind: trace.compilerKind,
        city_key: trace.proposal?.cityKey ?? null,
      },
    });
    if (metricError) {
      // Metrics must never mask a completed decision; the ledger row exists.
      console.error(`atlas-plan: engine_events insert failed: ${metricError.message}`);
    }

    // Client-facing shape. The considered-candidates list (who was rejected
    // and why) stays in the service-only ledger — it names other users.
    const memberNames = new Map<string, string | null>();
    if (trace.proposal) {
      const { data: memberRows } = await admin
        .from('profiles')
        .select('id, full_name')
        .in('id', trace.proposal.group.members);
      for (const row of memberRows ?? []) memberNames.set(row.id as string, row.full_name as string | null);
    }

    return json(200, {
      request_id: trace.requestId,
      decision_id: decisionId,
      status: trace.status,
      stage: trace.stage,
      mode: trace.mode,
      compiled: trace.compiled,
      plan: trace.proposal
        ? {
            quest: {
              title: trace.proposal.quest.title,
              dare: trace.proposal.quest.dare,
              why: trace.proposal.quest.why,
              category: trace.proposal.quest.category,
              duration_min: trace.proposal.quest.durationMin,
              cost_tier: trace.proposal.quest.costTier,
              budget_min: trace.proposal.quest.budgetMin,
              budget_max: trace.proposal.quest.budgetMax,
              currency: trace.proposal.quest.currency,
              risk_tier: trace.proposal.quest.riskTier,
              vibe: trace.proposal.quest.vibe,
              similarity: trace.proposal.quest.similarity,
              source: trace.proposal.quest.source,
            },
            schedule: {
              starts_at_utc: trace.proposal.schedule.startsAtUtc,
              local_label: trace.proposal.schedule.localLabel,
            },
            city: trace.proposal.city,
            group: {
              size: trace.proposal.group.members.length,
              average_chemistry: trace.proposal.group.averageChemistry,
              min_pair_chemistry: trace.proposal.group.minPairChemistry,
              members: trace.proposal.roles.map((r) => ({
                user_id: r.userId,
                full_name: memberNames.get(r.userId) ?? null,
                role: r.role,
              })),
            },
          }
        : null,
      verifier: trace.verifier,
      rejection_reasons: trace.rejectionReasons,
      meta: {
        engine_version: ENGINE_VERSION,
        compiler_kind: trace.compilerKind,
        model_id: trace.modelId,
        prompt_version: trace.promptVersion,
        embedding_version: trace.embeddingVersion,
        timings: trace.timings,
        latency_ms: latencyMs,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`atlas-plan: ${detail}`);
    return json(500, { error: 'atlas error' });
  }
});
