import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compileWithRules } from '../lib/compiler.ts';
import { assignRoles, runAtlasPipeline, toCityKey } from '../lib/engine.ts';
import type { EnginePorts, MemberProfile, QuestCandidate, RequesterContext } from '../lib/types.ts';
import { DEMO_INTENT, FIXED_NOW, member, photoQuest, pubQuest, symmetricMatrix } from './fixtures.ts';

const CTX: RequesterContext = {
  userId: 'r',
  fullName: 'Requester',
  profileCity: 'London',
  profileCountryCode: 'GB',
};

function fixturePorts(overrides: Partial<EnginePorts> = {}): EnginePorts {
  const scores = symmetricMatrix({
    'a|r': 60,
    'b|r': 50,
    'a|b': 55,
    'c|r': 70,
    'a|c': 70,
    'b|c': 70,
  });
  return {
    compile: async (raw, ctx) => ({
      intent: compileWithRules(raw, ctx),
      kind: 'mock',
      modelId: null,
      promptVersion: null,
    }),
    retrieve: async () => ({
      // Ranked so the FIRST candidate violates the no-alcohol constraint —
      // the engine must reject it via the verifier and promote the second.
      candidates: [pubQuest(), photoQuest()],
      embeddingVersion: 'fh-v0-256',
    }),
    loadCandidates: async (): Promise<MemberProfile[]> => [
      member('r', { city: 'Leeds' }),
      member('a'),
      member('b'),
      member('c', { isPrivate: true }),
    ],
    chemistry: async (a, b) => scores(a, b),
    now: () => FIXED_NOW,
    ...overrides,
  };
}

test('end-to-end shadow decision: verifier rejects the first quest, promotes the second', async () => {
  const trace = await runAtlasPipeline(DEMO_INTENT, CTX, fixturePorts(), {
    requestId: 'test-request-1',
    mode: 'shadow',
  });

  assert.equal(trace.status, 'proposed');
  assert.equal(trace.stage, 'decided');
  assert.equal(trace.proposal?.quest.slug, 'neon-corners', 'pub quest must not survive a no-drink intent');
  assert.equal(trace.proposal?.city, 'Leeds');
  assert.equal(trace.proposal?.cityKey, 'leeds');
  assert.deepEqual(trace.proposal?.group.members, ['r', 'a', 'b']);
  assert.equal(trace.verifier.filter((r) => r.severity === 'block' && !r.pass).length, 0);

  // provenance
  assert.equal(trace.compilerKind, 'mock');
  assert.equal(trace.embeddingVersion, 'fh-v0-256');
  assert.equal(trace.retrieval.length, 2);
  const c = trace.groupConsidered.find((g) => g.userId === 'c');
  assert.equal(c?.reason, 'private-profile');
  const roles = new Set(trace.proposal?.roles.map((r) => r.role));
  assert.equal(roles.size, 3, 'each member holds a distinct role');
  assert.ok(trace.timings.total_ms !== undefined);
});

test('rejects with reasons when no compatible group exists', async () => {
  const trace = await runAtlasPipeline(DEMO_INTENT, CTX, fixturePorts({ chemistry: async () => 0 }), {
    requestId: 'test-request-2',
    mode: 'shadow',
  });

  assert.equal(trace.status, 'rejected');
  assert.equal(trace.stage, 'composed');
  assert.match(trace.rejectionReasons.join(' '), /group composition failed/);
  assert.ok(trace.groupConsidered.length > 0, 'rejected candidates still recorded');
});

test('rejects when retrieval returns nothing', async () => {
  const trace = await runAtlasPipeline(
    DEMO_INTENT,
    CTX,
    fixturePorts({ retrieve: async () => ({ candidates: [], embeddingVersion: null }) }),
    { requestId: 'test-request-3', mode: 'shadow' }
  );

  assert.equal(trace.status, 'rejected');
  assert.match(trace.rejectionReasons.join(' '), /no quest templates/);
});

test('rejects when no city can be resolved', async () => {
  const noCityCtx: RequesterContext = { ...CTX, profileCity: null };
  const trace = await runAtlasPipeline('want to do something fun for an hour', noCityCtx, fixturePorts(), {
    requestId: 'test-request-4',
    mode: 'shadow',
  });

  assert.equal(trace.status, 'rejected');
  assert.match(trace.rejectionReasons.join(' '), /no target city/);
});

test('port failures surface as error traces, never throws', async () => {
  const trace = await runAtlasPipeline(
    DEMO_INTENT,
    CTX,
    fixturePorts({
      loadCandidates: async () => {
        throw new Error('db down');
      },
    }),
    { requestId: 'test-request-5', mode: 'shadow' }
  );

  assert.equal(trace.status, 'error');
  assert.equal(trace.stage, 'error');
  assert.match(trace.error ?? '', /db down/);
});

test('rejected plans carry the failing verifier checks', async () => {
  const trace = await runAtlasPipeline(
    DEMO_INTENT,
    CTX,
    fixturePorts({
      retrieve: async () => ({ candidates: [pubQuest()], embeddingVersion: 'fh-v0-256' }),
    }),
    { requestId: 'test-request-6', mode: 'shadow' }
  );

  assert.equal(trace.status, 'rejected');
  assert.equal(trace.stage, 'decided');
  assert.ok(trace.rejectionReasons.some((r) => r.startsWith('avoid_tags_clear')));
  assert.ok(trace.rejectionReasons.some((r) => r.startsWith('risk_within_comfort')));
});

test('toCityKey matches the SQL normalization', () => {
  assert.equal(toCityKey('  Leeds  '), 'leeds');
  assert.equal(toCityKey('NEW   York'), 'new york');
});

test('toCityKey strips LIKE/PostgREST wildcards (candidate scoping cannot widen)', () => {
  assert.equal(toCityKey('Le%eds_*'), 'leeds');
  assert.equal(toCityKey('%'), '');
  assert.equal(toCityKey('\\Leeds'), 'leeds');
});

test('assignRoles is deterministic per request and distinct per member', () => {
  const quest: QuestCandidate = photoQuest();
  const a = assignRoles(['r', 'a', 'b'], quest, 'req-1');
  const b = assignRoles(['r', 'a', 'b'], quest, 'req-1');
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((x) => x.role)).size, 3);
});
