// Group composition optimizer.
//
// Greedy average-linkage growth seeded on the requester, the same family of
// algorithm auto-generate uses for its clusters, with two differences: the
// requester is always the seed (Atlas plans *for* someone), and every
// candidate — selected or not — gets a written reason in the decision trace.
// chemistry 0 is semantic (blocked / private / un-onboarded pairs are
// hard-zeroed by chemistry_score), so a zero edge disqualifies rather than
// ranking low.

import type { GroupCandidateReport, GroupComposition, MemberProfile, PairScore } from './types.ts';

export const CHEMISTRY_MIN_AVG = 25;
export const GROUP_MIN = 3;
export const GROUP_MAX = 6;

export interface ComposeParams {
  requester: MemberProfile;
  candidates: MemberProfile[];
  /** Pairwise chemistry 0..100 from a precomputed matrix; must be symmetric. */
  pairScore: (a: string, b: string) => number;
  minSize: number;
  maxSize: number;
  minAvgChemistry: number;
}

export type ComposeResult =
  | { ok: true; group: GroupComposition }
  | { ok: false; failure: string; considered: GroupCandidateReport[] };

function eligibilityReason(m: MemberProfile): string | null {
  if (!m.onboarded) return 'not-onboarded';
  if (m.isPrivate) return 'private-profile';
  if (m.isSystemHost) return 'system-host';
  if (m.invitedThisWeek) return 'weekly-invite-cap';
  return null;
}

function groupAverage(members: string[], pairScore: (a: string, b: string) => number): number {
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      total += pairScore(members[i], members[j]);
      pairs++;
    }
  }
  return pairs === 0 ? 0 : total / pairs;
}

export function composeGroup(params: ComposeParams): ComposeResult {
  const { requester, pairScore, minAvgChemistry } = params;
  const minSize = Math.max(GROUP_MIN, params.minSize);
  const maxSize = Math.min(GROUP_MAX, Math.max(minSize, params.maxSize));

  const considered: GroupCandidateReport[] = [];
  const pool: MemberProfile[] = [];

  const seen = new Set<string>([requester.userId]);
  const sorted = [...params.candidates].sort((a, b) => a.userId.localeCompare(b.userId));
  for (const candidate of sorted) {
    if (seen.has(candidate.userId)) continue;
    seen.add(candidate.userId);

    const reason = eligibilityReason(candidate);
    if (reason) {
      considered.push({ userId: candidate.userId, fullName: candidate.fullName, selected: false, reason });
      continue;
    }
    if (pairScore(requester.userId, candidate.userId) === 0) {
      considered.push({
        userId: candidate.userId,
        fullName: candidate.fullName,
        selected: false,
        reason: 'no-chemistry-with-requester',
      });
      continue;
    }
    pool.push(candidate);
  }

  const members: string[] = [requester.userId];
  const selectedNames = new Map<string, string | null>([[requester.userId, requester.fullName]]);
  const remaining = new Map(pool.map((c) => [c.userId, c]));

  while (members.length < maxSize && remaining.size > 0) {
    let best: { candidate: MemberProfile; avgWithMembers: number } | null = null;

    for (const candidate of remaining.values()) {
      let sum = 0;
      let hasZeroEdge = false;
      for (const m of members) {
        const s = pairScore(candidate.userId, m);
        if (s === 0) {
          hasZeroEdge = true;
          break;
        }
        sum += s;
      }
      if (hasZeroEdge) continue;
      const avgWithMembers = sum / members.length;
      if (
        !best ||
        avgWithMembers > best.avgWithMembers ||
        (avgWithMembers === best.avgWithMembers && candidate.userId < best.candidate.userId)
      ) {
        best = { candidate, avgWithMembers };
      }
    }

    // The threshold applies to the candidate's average with the CURRENT
    // members (auto-generate's rule), not the whole-group average — this is
    // what protects the weakest link from being diluted in.
    if (!best || best.avgWithMembers < minAvgChemistry) break;

    members.push(best.candidate.userId);
    selectedNames.set(best.candidate.userId, best.candidate.fullName);
    remaining.delete(best.candidate.userId);
    considered.push({
      userId: best.candidate.userId,
      fullName: best.candidate.fullName,
      selected: true,
      reason: null,
    });
  }

  for (const leftover of remaining.values()) {
    considered.push({
      userId: leftover.userId,
      fullName: leftover.fullName,
      selected: false,
      reason: 'not-selected: average chemistry with the group was below threshold, or the group was already full',
    });
  }

  if (members.length < minSize) {
    return {
      ok: false,
      failure: `only ${members.length} compatible member(s) found; need at least ${minSize}`,
      considered,
    };
  }

  const pairScores: PairScore[] = [];
  let minPair = Number.POSITIVE_INFINITY;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const score = pairScore(members[i], members[j]);
      pairScores.push({ a: members[i], b: members[j], score });
      if (score < minPair) minPair = score;
    }
  }

  return {
    ok: true,
    group: {
      members,
      averageChemistry: Math.round(groupAverage(members, pairScore) * 100) / 100,
      minPairChemistry: minPair === Number.POSITIVE_INFINITY ? 0 : minPair,
      pairScores,
      considered,
    },
  };
}
