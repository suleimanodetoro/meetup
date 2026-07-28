// Deterministic feature-hash embedder (v0).
//
// 256-dim signed feature hashing over unigrams + bigrams, L2-normalized for
// cosine similarity. This is honest lexical retrieval, not a learned model:
// it exists so the whole Atlas pipeline — pgvector schema, HNSW index,
// retrieval RPC, ranking, verification — runs end-to-end with zero external
// credentials and byte-identical results everywhere (Deno edge runtime, Node
// tests, tsx scripts). Swapping in a learned embedding model later is a new
// EMBEDDING_VERSION plus a re-run of `npm run atlas:embed-quests`; nothing
// else changes.

export const EMBEDDING_VERSION = 'fh-v0-256';
export const EMBEDDING_DIMS = 256;

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'go',
  'get', 'has', 'have', 'if', 'in', 'into', 'is', 'it', 'its', 'like', 'my',
  'of', 'on', 'or', 'our', 'out', 'so', 'that', 'the', 'their', 'then',
  'there', 'they', 'this', 'to', 'up', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'will', 'with', 'you', 'your',
]);

/** 32-bit FNV-1a. Stable across runtimes; used for hashing and bucketing. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    // hash *= 16777619, in 32-bit space without BigInt
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

export function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]}_${words[i + 1]}`);
  }
  return [...words, ...bigrams];
}

export function embed(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIMS).fill(0);
  for (const token of tokenize(text)) {
    const h = fnv1a(token);
    const idx = h % EMBEDDING_DIMS;
    const sign = ((h >>> 16) & 1) === 1 ? 1 : -1;
    v[idx] += sign;
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm === 0) {
    // Degenerate input (all stopwords / empty): a fixed unit vector keeps the
    // pgvector cast valid and the retrieval deterministic.
    v[0] = 1;
    return v;
  }
  return v.map((x) => x / norm);
}

/** pgvector text literal, e.g. '[0.1,-0.2,...]', for RPC transport. */
export function toPgvectorLiteral(v: number[]): string {
  return `[${v.map((x) => x.toFixed(6)).join(',')}]`;
}

/** Stable content hash so the backfill can skip unchanged rows. */
export function contentHash(text: string): string {
  const a = fnv1a(text).toString(16).padStart(8, '0');
  const b = fnv1a(`${text}#salt`).toString(16).padStart(8, '0');
  return `${a}${b}`;
}

/** Canonical embedded text for a quest template. Keep in sync with backfill. */
export function questEmbeddingText(q: {
  title: string;
  dare: string;
  why: string | null;
  category: string;
  vibe: string[];
}): string {
  return [q.title, q.dare, q.why ?? '', q.category, q.vibe.join(' ')].join('\n');
}
