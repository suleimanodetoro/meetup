// Atlas counterfactual replay.
//
//   npm run atlas:replay                     # last 50 decisions
//   ATLAS_REPLAY_LIMIT=200 npm run atlas:replay
//
// Re-runs recorded atlas_decisions rows through the CURRENT engine code and
// reports drift, with zero side effects and zero writes:
//
//   1. compile drift  — the raw intent is recompiled with today's rule-based
//      compiler and diffed field-by-field against the recorded constraints.
//   2. verifier drift — the recorded proposal is re-verified with today's
//      checks (at the decision's original timestamp) and diffed check-by-check
//      against the recorded results.
//
// Group composition is NOT re-run: the ledger stores candidate outcomes, not
// the full candidate/chemistry snapshot needed to recompute it. Persisting
// that snapshot is the listed next step for full-pipeline replay. The
// members_eligible check is excluded from drift for the same reason.

import { compileWithRules } from '../../supabase/functions/atlas-plan/lib/compiler.ts';
import { verifyPlan } from '../../supabase/functions/atlas-plan/lib/verifier.ts';
import type {
  CompiledIntent,
  MemberProfile,
  PlanProposal,
  VerifierResult,
} from '../../supabase/functions/atlas-plan/lib/types.ts';
import { admin } from '../seed/env';

interface DecisionRow {
  id: number;
  request_id: string;
  status: string;
  stage: string;
  raw_intent: string;
  city: string | null;
  compiled_intent: CompiledIntent | Record<string, never>;
  proposal: PlanProposal | Record<string, never>;
  verifier_results: VerifierResult[];
  engine_version: string;
  compiler_kind: string;
  created_at: string;
}

const REPLAY_EXCLUDED_CHECKS = new Set(['members_eligible']);

function isCompiled(value: DecisionRow['compiled_intent']): value is CompiledIntent {
  return typeof (value as CompiledIntent).semanticQuery === 'string';
}

function isProposal(value: DecisionRow['proposal']): value is PlanProposal {
  return typeof (value as PlanProposal).cityKey === 'string';
}

function diffCompiled(recorded: CompiledIntent, current: CompiledIntent): string[] {
  const drift: string[] = [];
  const fields: (keyof CompiledIntent)[] = [
    'city', 'durationMaxMin', 'budgetGbp', 'budgetTier', 'energy', 'social',
    'groupSizeMin', 'groupSizeMax', 'comfort',
  ];
  for (const f of fields) {
    const a = JSON.stringify(recorded[f] ?? null);
    const b = JSON.stringify(current[f] ?? null);
    if (a !== b) drift.push(`${String(f)}: ${a} -> ${b}`);
  }
  const tagDiff = (name: string, a: string[], b: string[]) => {
    if (JSON.stringify([...a].sort()) !== JSON.stringify([...b].sort())) {
      drift.push(`${name}: [${a.join(',')}] -> [${b.join(',')}]`);
    }
  };
  tagDiff('avoidTags', recorded.avoidTags ?? [], current.avoidTags ?? []);
  tagDiff('interestTags', recorded.interestTags ?? [], current.interestTags ?? []);
  return drift;
}

function diffVerifier(recorded: VerifierResult[], current: VerifierResult[]): string[] {
  const drift: string[] = [];
  const recordedById = new Map(recorded.map((r) => [r.id, r]));
  const currentById = new Map(current.map((r) => [r.id, r]));
  for (const [id, r] of recordedById) {
    if (REPLAY_EXCLUDED_CHECKS.has(id)) continue;
    const c = currentById.get(id);
    if (!c) drift.push(`${id}: removed from current verifier`);
    else if (c.pass !== r.pass) drift.push(`${id}: ${r.pass ? 'pass' : 'FAIL'} -> ${c.pass ? 'pass' : 'FAIL'}`);
  }
  for (const id of currentById.keys()) {
    if (!recordedById.has(id) && !REPLAY_EXCLUDED_CHECKS.has(id)) drift.push(`${id}: new check`);
  }
  return drift;
}

async function main() {
  const limit = Math.min(500, Math.max(1, parseInt(process.env.ATLAS_REPLAY_LIMIT ?? '50', 10) || 50));
  const { data, error } = await admin
    .from('atlas_decisions')
    .select(
      'id, request_id, status, stage, raw_intent, city, compiled_intent, proposal, verifier_results, engine_version, compiler_kind, created_at'
    )
    .neq('status', 'error')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`atlas_decisions read failed: ${error.message}`);

  const rows = (data ?? []) as unknown as DecisionRow[];
  if (rows.length === 0) {
    console.log('atlas:replay — no recorded decisions yet. Run a plan first.');
    return;
  }

  let clean = 0;
  let drifted = 0;

  for (const row of rows) {
    const driftLines: string[] = [];

    // Compile drift only makes sense for rows the rule-based compiler
    // produced — recompiling an LLM-compiled row with the rules would report
    // the two compilers' differences, not engine drift.
    if (row.compiler_kind === 'mock' && isCompiled(row.compiled_intent)) {
      const currentCompiled = compileWithRules(row.raw_intent, {
        userId: 'replay',
        fullName: null,
        profileCity: row.compiled_intent.city ?? row.city,
        profileCountryCode: null,
      });
      driftLines.push(...diffCompiled(row.compiled_intent, currentCompiled).map((d) => `compile ${d}`));
    }

    if (isCompiled(row.compiled_intent) && isProposal(row.proposal) && row.verifier_results.length > 0) {
      // Members were eligible at decision time (the recorded check says so);
      // synthesize eligible profiles and exclude that check from the diff.
      const members: MemberProfile[] = row.proposal.group.members.map((id) => ({
        userId: id,
        fullName: null,
        city: null,
        onboarded: true,
        isPrivate: false,
        isSystemHost: false,
        invitedThisWeek: false,
      }));
      const currentResults = verifyPlan({
        intent: row.compiled_intent,
        proposal: row.proposal,
        members,
        now: new Date(row.created_at),
      });
      driftLines.push(...diffVerifier(row.verifier_results, currentResults).map((d) => `verify ${d}`));
    }

    if (driftLines.length === 0) {
      clean++;
    } else {
      drifted++;
      console.log(`\n#${row.id} (${row.created_at}) ${row.status}/${row.stage} — "${row.raw_intent.slice(0, 60)}"`);
      console.log(`  recorded by ${row.engine_version} (${row.compiler_kind})`);
      for (const line of driftLines) console.log(`  ~ ${line}`);
    }
  }

  console.log(
    `\natlas:replay — ${rows.length} decisions replayed: ${clean} unchanged, ${drifted} drifted under the current engine`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
