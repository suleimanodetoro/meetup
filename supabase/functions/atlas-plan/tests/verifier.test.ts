import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compileWithRules } from '../lib/compiler.ts';
import { blockingFailures, verifyPlan } from '../lib/verifier.ts';
import type { GroupComposition, PlanProposal, QuestCandidate, RequesterContext } from '../lib/types.ts';
import { DEMO_INTENT, FIXED_NOW, member, photoQuest, pubQuest } from './fixtures.ts';

const CTX: RequesterContext = {
  userId: 'r',
  fullName: 'Requester',
  profileCity: 'Leeds',
  profileCountryCode: 'GB',
};

const GROUP: GroupComposition = {
  members: ['r', 'a', 'b'],
  averageChemistry: 55,
  minPairChemistry: 45,
  pairScores: [
    { a: 'a', b: 'r', score: 60 },
    { a: 'b', b: 'r', score: 50 },
    { a: 'a', b: 'b', score: 55 },
  ],
  considered: [],
};

const MEMBERS = [member('r'), member('a'), member('b')];

function proposalFor(quest: QuestCandidate): PlanProposal {
  return {
    quest,
    group: GROUP,
    roles: [
      { userId: 'r', role: 'Director' },
      { userId: 'a', role: 'Location Scout' },
      { userId: 'b', role: 'Archivist' },
    ],
    schedule: {
      // 19:30 Leeds-local on the fixture day (UTC+1 static offset)
      startsAtUtc: '2026-07-27T18:30:00.000Z',
      localLabel: '2026-07-27 19:30 local (UTC+1, static offset — no DST)',
      utcOffsetHours: 1,
      withinIntentWindow: true,
    },
    city: 'Leeds',
    cityKey: 'leeds',
    countryCode: 'GB',
  };
}

const DEMO = compileWithRules(DEMO_INTENT, CTX);

test('a clean plan passes every blocking check', () => {
  const results = verifyPlan({ intent: DEMO, proposal: proposalFor(photoQuest()), members: MEMBERS, now: FIXED_NOW });
  assert.deepEqual(blockingFailures(results), []);
  assert.ok(results.length >= 10, 'expected a substantial checklist');
  assert.ok(results.every((r) => r.detail.length > 0));
});

test('alcohol quest is blocked for a no-drink intent (word-boundary match)', () => {
  const results = verifyPlan({ intent: DEMO, proposal: proposalFor(pubQuest()), members: MEMBERS, now: FIXED_NOW });
  const avoid = results.find((r) => r.id === 'avoid_tags_clear');
  assert.ok(avoid && !avoid.pass);
  assert.match(avoid.detail, /pub|beer/);
});

test('word-boundary matching does not flag barista for bar', () => {
  const quest = photoQuest({
    dare: 'Ask a barista to pick your next stop and photograph what you find there.',
  });
  const results = verifyPlan({ intent: DEMO, proposal: proposalFor(quest), members: MEMBERS, now: FIXED_NOW });
  const avoid = results.find((r) => r.id === 'avoid_tags_clear');
  assert.ok(avoid?.pass, avoid?.detail);
});

test('risk above stated comfort blocks', () => {
  const quest = photoQuest({ riskTier: 2 }); // DEMO comfort is 1 ("awkward")
  const results = verifyPlan({ intent: DEMO, proposal: proposalFor(quest), members: MEMBERS, now: FIXED_NOW });
  const risk = results.find((r) => r.id === 'risk_within_comfort');
  assert.ok(risk && !risk.pass);
});

test('budget tier above stated budget blocks; amount overrun only warns', () => {
  const expensive = photoQuest({ costTier: 2, budgetMax: 40 });
  const results = verifyPlan({ intent: DEMO, proposal: proposalFor(expensive), members: MEMBERS, now: FIXED_NOW });
  const tier = results.find((r) => r.id === 'budget_tier');
  const amount = results.find((r) => r.id === 'budget_amount');
  assert.ok(tier && !tier.pass && tier.severity === 'block');
  assert.ok(amount && !amount.pass && amount.severity === 'warn');
});

test('quest too long for the stated window blocks', () => {
  const long = photoQuest({ durationMin: 240 }); // window is 180 min
  const results = verifyPlan({ intent: DEMO, proposal: proposalFor(long), members: MEMBERS, now: FIXED_NOW });
  const duration = results.find((r) => r.id === 'duration_fits');
  assert.ok(duration && !duration.pass);
});

test('solo intents are rejected honestly in this slice', () => {
  const solo = { ...DEMO, social: 'solo' as const };
  const results = verifyPlan({ intent: solo, proposal: proposalFor(photoQuest()), members: MEMBERS, now: FIXED_NOW });
  const social = results.find((r) => r.id === 'social_mode_supported');
  assert.ok(social && !social.pass && social.severity === 'block');
});

test('ineligible member is caught even if the optimizer missed it', () => {
  const members = [member('r'), member('a', { invitedThisWeek: true }), member('b')];
  const results = verifyPlan({ intent: DEMO, proposal: proposalFor(photoQuest()), members, now: FIXED_NOW });
  const eligible = results.find((r) => r.id === 'members_eligible');
  assert.ok(eligible && !eligible.pass);
  assert.match(eligible.detail, /weekly auto-invite cap/);
});

test('past start time and antisocial hours block', () => {
  const proposal = proposalFor(photoQuest());
  proposal.schedule = {
    startsAtUtc: '2026-07-27T01:00:00.000Z', // in the past, 02:00 local
    localLabel: 'x',
    utcOffsetHours: 1,
    withinIntentWindow: null,
  };
  const results = verifyPlan({ intent: DEMO, proposal, members: MEMBERS, now: FIXED_NOW });
  const future = results.find((r) => r.id === 'starts_in_future');
  const hours = results.find((r) => r.id === 'sociable_hours');
  assert.ok(future && !future.pass);
  assert.ok(hours && !hours.pass);
});

test('schedule outside the stated window blocks', () => {
  const proposal = proposalFor(photoQuest());
  proposal.schedule = { ...proposal.schedule, withinIntentWindow: false };
  const results = verifyPlan({ intent: DEMO, proposal, members: MEMBERS, now: FIXED_NOW });
  const window = results.find((r) => r.id === 'within_intent_window');
  assert.ok(window && !window.pass && window.severity === 'block');
});

test('sociable hours are minutes-aware: 23:00 passes, 23:30 blocks', () => {
  const at = (utcIso: string) => {
    const proposal = proposalFor(photoQuest());
    proposal.schedule = {
      startsAtUtc: utcIso,
      localLabel: 'x',
      utcOffsetHours: 1,
      withinIntentWindow: null,
    };
    const results = verifyPlan({ intent: DEMO, proposal, members: MEMBERS, now: FIXED_NOW });
    return results.find((r) => r.id === 'sociable_hours');
  };

  const exactCap = at('2026-07-27T22:00:00.000Z'); // 23:00 local
  assert.ok(exactCap?.pass, exactCap?.detail);

  const pastCap = at('2026-07-27T22:30:00.000Z'); // 23:30 local
  assert.ok(pastCap && !pastCap.pass, pastCap?.detail);
});
