// Run via `npm run test:atlas` (node --experimental-strip-types --test).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compileWithRules, normalizeWireIntent } from '../lib/compiler.ts';
import type { RequesterContext } from '../lib/types.ts';

const CTX: RequesterContext = {
  userId: '70000000-0000-4000-8000-000000000001',
  fullName: 'Regression One',
  profileCity: 'London',
  profileCountryCode: 'GB',
};

test('compiles the flagship demo sentence', () => {
  const intent = compileWithRules(
    "I'm new to Leeds, free 7–10 tonight, have £15, don't drink, feel awkward meeting strangers, and like photography.",
    CTX
  );

  assert.equal(intent.city, 'Leeds');
  assert.equal(intent.window.dateHint, 'today');
  assert.equal(intent.window.startLocal, '19:00');
  assert.equal(intent.window.endLocal, '22:00');
  assert.equal(intent.durationMaxMin, 180);
  assert.equal(intent.budgetGbp, 15);
  assert.equal(intent.budgetTier, 1);
  assert.equal(intent.social, 'group');
  assert.equal(intent.comfort, 1);
  assert.ok(intent.avoidTags.includes('alcohol'));
  assert.ok(intent.avoidTags.includes('pub'));
  assert.ok(intent.interestTags.includes('photography'));
  assert.ok(intent.semanticQuery.includes('photography'));
  assert.ok(intent.confidence > 0.5);
  assert.ok(intent.notes.length >= 5, `expected rich extraction notes, got ${intent.notes.length}`);
});

test('falls back to profile city when none is stated', () => {
  const intent = compileWithRules('fancy something creative this weekend for free', CTX);
  assert.equal(intent.city, 'London');
  assert.equal(intent.window.dateHint, 'weekend');
  assert.equal(intent.budgetTier, 0);
});

test('pm meridiem and explicit hour ranges parse', () => {
  const intent = compileWithRules('around Manchester, 6pm-9pm tomorrow, 20 quid', CTX);
  assert.equal(intent.city, 'Manchester');
  assert.equal(intent.window.dateHint, 'tomorrow');
  assert.equal(intent.window.startLocal, '18:00');
  assert.equal(intent.window.endLocal, '21:00');
  assert.equal(intent.budgetGbp, 20);
  assert.equal(intent.budgetTier, 1);
});

test('solo phrasing is detected (verifier rejects it later, honestly)', () => {
  const intent = compileWithRules('want something chill by myself tonight', CTX);
  assert.equal(intent.social, 'solo');
  assert.equal(intent.energy, 1);
});

test('normalizeWireIntent clamps out-of-contract LLM output instead of throwing', () => {
  const intent = normalizeWireIntent(
    {
      semantic_query: '  night photography walk  ',
      city: 'Leeds',
      window: { date_hint: 'someday', start_local: '25:99', end_local: '21:30' },
      duration_max_min: 999999,
      budget_gbp: -5,
      budget_tier: 7,
      energy: 0,
      social: 'swarm',
      group_size_min: 5,
      group_size_max: 2,
      comfort: 2,
      avoid_tags: ['Alcohol', 'alcohol', 42, '  PUB '],
      interest_tags: 'photography',
      notes: ['ok', 123],
      confidence: 3.5,
    },
    'raw text'
  );

  assert.equal(intent.semanticQuery, 'night photography walk');
  assert.equal(intent.window.dateHint, null);
  assert.equal(intent.window.startLocal, null);
  assert.equal(intent.window.endLocal, '21:30');
  assert.equal(intent.durationMaxMin, null);
  assert.equal(intent.budgetGbp, null);
  assert.equal(intent.budgetTier, null);
  assert.equal(intent.energy, null);
  assert.equal(intent.social, null);
  // max < min degrades to min so the pair stays coherent
  assert.equal(intent.groupSizeMin, 5);
  assert.equal(intent.groupSizeMax, 5);
  assert.deepEqual(intent.avoidTags, ['alcohol', 'pub']);
  assert.deepEqual(intent.interestTags, []);
  assert.deepEqual(intent.notes, ['ok']);
  assert.equal(intent.confidence, 1);
});

test('normalizeWireIntent survives garbage', () => {
  const intent = normalizeWireIntent(null, 'plain raw intent');
  assert.equal(intent.semanticQuery, 'plain raw intent');
  assert.equal(intent.city, null);
  assert.equal(intent.confidence, 0.5);
});
