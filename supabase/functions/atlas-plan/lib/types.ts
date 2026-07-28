// Shared types for the Atlas planning engine.
//
// Everything in lib/ is runtime-agnostic TypeScript: no Deno globals, no URL
// imports, explicit .ts extensions on relative imports. The same modules run
// inside the Deno edge function (index.ts), under Node's test runner
// (npm run test:atlas), and in the tsx ops scripts (atlas:embed-quests,
// atlas:replay).

export type SocialMode = 'solo' | 'pair' | 'group' | 'either';

export type CompilerKind = 'mock' | 'anthropic' | 'anthropic_fallback_mock';

export interface IntentWindow {
  dateHint: 'today' | 'tomorrow' | 'weekend' | null;
  /** 'HH:MM' local to the requester's city, or null when not stated. */
  startLocal: string | null;
  endLocal: string | null;
}

/**
 * The typed plan request an intent compiler produces from free text. This is
 * the contract boundary between the LLM (or the rule-based mock) and the
 * deterministic engine: nothing downstream ever sees prose, only this shape,
 * and normalizeWireIntent() clamps every field before the engine trusts it.
 */
export interface CompiledIntent {
  /** Search text for semantic quest retrieval. */
  semanticQuery: string;
  city: string | null;
  window: IntentWindow;
  durationMaxMin: number | null;
  budgetGbp: number | null;
  /** quest_catalog.cost_tier scale: 0 free, 1 cheap, 2 spendy. */
  budgetTier: 0 | 1 | 2 | null;
  energy: 1 | 2 | 3 | null;
  social: SocialMode | null;
  groupSizeMin: number | null;
  groupSizeMax: number | null;
  /** Risk tolerance on the quest_catalog.risk_tier scale (1 gentle .. 3 bold). */
  comfort: 1 | 2 | 3 | null;
  /** Hard-exclusion tags, e.g. ['alcohol','bar'] for "I don't drink". */
  avoidTags: string[];
  interestTags: string[];
  /** Human-readable extraction notes — provenance for the decision ledger. */
  notes: string[];
  /** Compiler self-estimate, 0..1. */
  confidence: number;
}

export interface QuestCandidate {
  questId: number;
  slug: string;
  title: string;
  dare: string;
  why: string | null;
  category: string;
  energyLevel: number;
  socialMode: SocialMode;
  durationMin: number;
  costTier: number;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string | null;
  riskTier: number;
  isSoloSafe: boolean;
  vibe: string[];
  /** Cosine similarity when retrieved via embeddings, null via fallback. */
  similarity: number | null;
  source: 'vector' | 'suggest_quest_fallback';
}

export interface MemberProfile {
  userId: string;
  fullName: string | null;
  city: string | null;
  onboarded: boolean;
  isPrivate: boolean;
  isSystemHost: boolean;
  /** Already claimed by the weekly auto-invite guard (advisory in shadow). */
  invitedThisWeek: boolean;
}

export interface PairScore {
  a: string;
  b: string;
  score: number;
}

export interface GroupCandidateReport {
  userId: string;
  fullName: string | null;
  selected: boolean;
  /** Why the candidate was rejected; null when selected. */
  reason: string | null;
}

export interface GroupComposition {
  /** Chosen member ids, requester first. */
  members: string[];
  averageChemistry: number;
  minPairChemistry: number;
  pairScores: PairScore[];
  considered: GroupCandidateReport[];
}

export interface RoleAssignment {
  userId: string;
  role: string;
}

export interface ScheduleProposal {
  startsAtUtc: string;
  /** e.g. 'tomorrow 18:30 local (UTC+1, static offset — no DST)'. */
  localLabel: string;
  utcOffsetHours: number;
  /** null when the intent stated no window. */
  withinIntentWindow: boolean | null;
}

export interface PlanProposal {
  quest: QuestCandidate;
  group: GroupComposition;
  roles: RoleAssignment[];
  schedule: ScheduleProposal;
  city: string;
  cityKey: string;
  countryCode: string | null;
}

export type VerifierSeverity = 'block' | 'warn';

export interface VerifierResult {
  id: string;
  description: string;
  severity: VerifierSeverity;
  pass: boolean;
  detail: string;
}

export type DecisionStage =
  | 'received'
  | 'compiled'
  | 'retrieved'
  | 'composed'
  | 'verified'
  | 'decided'
  | 'error';

export type DecisionStatus = 'proposed' | 'rejected' | 'error';

export interface DecisionTrace {
  requestId: string;
  mode: 'shadow' | 'live';
  stage: DecisionStage;
  status: DecisionStatus;
  rawIntent: string;
  compiled: CompiledIntent | null;
  compilerKind: CompilerKind;
  modelId: string | null;
  promptVersion: string | null;
  embeddingVersion: string | null;
  retrieval: QuestCandidate[];
  group: GroupComposition | null;
  /** Every group candidate considered, with selection/rejection reasons — populated even when composition fails. */
  groupConsidered: GroupCandidateReport[];
  proposal: PlanProposal | null;
  verifier: VerifierResult[];
  rejectionReasons: string[];
  error: string | null;
  /** Per-stage wall-clock, milliseconds. */
  timings: Record<string, number>;
}

export interface RequesterContext {
  userId: string;
  fullName: string | null;
  profileCity: string | null;
  profileCountryCode: string | null;
}

export interface CompileOutput {
  intent: CompiledIntent;
  kind: CompilerKind;
  modelId: string | null;
  promptVersion: string | null;
}

export interface RetrieveOutput {
  candidates: QuestCandidate[];
  embeddingVersion: string | null;
}

/**
 * Everything the engine needs from the outside world. index.ts wires these
 * to Supabase RPCs and the Anthropic adapter; tests and the replay harness
 * inject in-memory implementations.
 */
export interface EnginePorts {
  compile(rawIntent: string, ctx: RequesterContext): Promise<CompileOutput>;
  retrieve(intent: CompiledIntent): Promise<RetrieveOutput>;
  loadCandidates(cityKey: string, requesterId: string): Promise<MemberProfile[]>;
  /** Pairwise chemistry 0..100; 0 means unclusterable (blocked/private). */
  chemistry(a: string, b: string): Promise<number>;
  now(): Date;
}
