import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  contentHash,
  embed,
  EMBEDDING_DIMS,
  fnv1a,
  questEmbeddingText,
  tokenize,
  toPgvectorLiteral,
} from '../lib/embedder.ts';

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

test('embedding is deterministic, 256-dim, unit-norm', () => {
  const a = embed('golden hour photography walk through the city');
  const b = embed('golden hour photography walk through the city');
  assert.equal(a.length, EMBEDDING_DIMS);
  assert.deepEqual(a, b);
  const norm = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9, `norm ${norm}`);
});

test('related text scores higher than unrelated text', () => {
  const query = embed('photography creative golden hour explore city evening');
  const photoQuest = embed(
    questEmbeddingText({
      title: 'Neon Corners',
      dare: 'Photograph three glowing corners of the city at golden hour and trade your best frame.',
      why: 'Chasing light turns a city you do not know into one you do.',
      category: 'Creative & self-expression',
      vibe: ['creative', 'explore', 'night'],
    })
  );
  const foodQuest = embed(
    questEmbeddingText({
      title: 'Dumpling Roulette',
      dare: 'Order the item you cannot pronounce and share it.',
      why: 'Taste is a shortcut to somewhere else.',
      category: 'Food, taste & sensory',
      vibe: ['cozy', 'taste'],
    })
  );
  assert.ok(
    cosine(query, photoQuest) > cosine(query, foodQuest),
    `photo ${cosine(query, photoQuest)} should beat food ${cosine(query, foodQuest)}`
  );
});

test('empty/stopword-only text degrades to a fixed unit vector', () => {
  const v = embed('the of and to');
  assert.equal(v[0], 1);
  assert.equal(v.reduce((s, x) => s + Math.abs(x), 0), 1);
});

test('pgvector literal shape', () => {
  const lit = toPgvectorLiteral(embed('photography'));
  assert.match(lit, /^\[-?\d+\.\d{6}(,-?\d+\.\d{6}){255}\]$/);
});

test('tokenizer drops stopwords and emits bigrams', () => {
  const tokens = tokenize('walk through the golden hour');
  assert.ok(tokens.includes('golden'));
  assert.ok(tokens.includes('golden_hour'));
  assert.ok(!tokens.includes('the'));
});

test('fnv1a and contentHash are stable', () => {
  assert.equal(fnv1a('atlas'), fnv1a('atlas'));
  assert.notEqual(fnv1a('atlas'), fnv1a('atlas '));
  assert.equal(contentHash('x').length, 16);
  assert.notEqual(contentHash('x'), contentHash('y'));
});
