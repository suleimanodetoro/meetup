import assert from 'node:assert/strict';
import { test } from 'node:test';

import { composeGroup } from '../lib/optimizer.ts';
import type { MemberProfile } from '../lib/types.ts';

function member(id: string, overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    userId: id,
    fullName: `User ${id}`,
    city: 'Leeds',
    onboarded: true,
    isPrivate: false,
    isSystemHost: false,
    invitedThisWeek: false,
    ...overrides,
  };
}

function matrix(scores: Record<string, number>): (a: string, b: string) => number {
  return (a, b) => scores[a < b ? `${a}|${b}` : `${b}|${a}`] ?? 0;
}

const REQ = member('r');

test('grows a group from the requester by best average chemistry', () => {
  const result = composeGroup({
    requester: REQ,
    candidates: [member('a'), member('b'), member('c'), member('d')],
    pairScore: matrix({
      'a|r': 80, 'b|r': 70, 'c|r': 60, 'd|r': 50,
      'a|b': 75, 'a|c': 40, 'a|d': 30,
      'b|c': 45, 'b|d': 35, 'c|d': 20,
    }),
    minSize: 3,
    maxSize: 4,
    minAvgChemistry: 25,
  });

  assert.ok(result.ok);
  assert.equal(result.group.members[0], 'r');
  assert.equal(result.group.members.length, 4);
  assert.ok(result.group.members.includes('a'));
  assert.ok(result.group.members.includes('b'));
  assert.ok(result.group.averageChemistry >= 25);
  assert.ok(result.group.minPairChemistry > 0);
  // provenance: every candidate got a written outcome
  assert.equal(result.group.considered.length, 4);
});

test('zero chemistry with the requester disqualifies (blocked/private semantics)', () => {
  const result = composeGroup({
    requester: REQ,
    candidates: [member('a'), member('z')],
    pairScore: matrix({ 'a|r': 60, 'r|z': 0, 'a|z': 90 }),
    minSize: 3,
    maxSize: 4,
    minAvgChemistry: 25,
  });

  assert.ok(!result.ok);
  const z = result.considered.find((c) => c.userId === 'z');
  assert.equal(z?.reason, 'no-chemistry-with-requester');
});

test('ineligible candidates are reported with exact reasons', () => {
  const result = composeGroup({
    requester: REQ,
    candidates: [
      member('a'),
      member('b', { onboarded: false }),
      member('c', { isPrivate: true }),
      member('d', { isSystemHost: true }),
      member('e', { invitedThisWeek: true }),
    ],
    pairScore: () => 50,
    minSize: 3,
    maxSize: 4,
    minAvgChemistry: 25,
  });

  assert.ok(!result.ok, 'only one eligible candidate cannot reach minSize 3');
  const reasons = Object.fromEntries(result.considered.map((c) => [c.userId, c.reason]));
  assert.equal(reasons.b, 'not-onboarded');
  assert.equal(reasons.c, 'private-profile');
  assert.equal(reasons.d, 'system-host');
  assert.equal(reasons.e, 'weekly-invite-cap');
});

test('stops growing when the average would drop below threshold', () => {
  const result = composeGroup({
    requester: REQ,
    candidates: [member('a'), member('b'), member('weak')],
    pairScore: matrix({
      'a|r': 90, 'b|r': 80, 'a|b': 85,
      'r|weak': 5, 'a|weak': 5, 'b|weak': 5,
    }),
    minSize: 3,
    maxSize: 4,
    minAvgChemistry: 40,
  });

  assert.ok(result.ok);
  assert.deepEqual([...result.group.members].sort(), ['a', 'b', 'r']);
  const weak = result.group.considered.find((c) => c.userId === 'weak');
  assert.ok(weak && !weak.selected && weak.reason !== null);
});

test('deterministic under candidate reordering', () => {
  const candidates = [member('a'), member('b'), member('c')];
  const scores = matrix({ 'a|r': 50, 'b|r': 50, 'c|r': 50, 'a|b': 50, 'a|c': 50, 'b|c': 50 });
  const run = (order: MemberProfile[]) =>
    composeGroup({
      requester: REQ,
      candidates: order,
      pairScore: scores,
      minSize: 3,
      maxSize: 3,
      minAvgChemistry: 25,
    });

  const forward = run(candidates);
  const reversed = run([...candidates].reverse());
  assert.ok(forward.ok && reversed.ok);
  assert.deepEqual(forward.group.members, reversed.group.members);
});
