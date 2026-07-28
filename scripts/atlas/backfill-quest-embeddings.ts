// Backfill atlas_quest_embeddings from quest_catalog.
//
//   npm run atlas:embed-quests
//
// Local-only by default (same guard as the seed scripts via scripts/seed/env).
// Idempotent: rows whose content hash and embedding version are unchanged are
// skipped, so re-running after a catalog tweak re-embeds only what changed.

import {
  contentHash,
  embed,
  EMBEDDING_VERSION,
  questEmbeddingText,
  toPgvectorLiteral,
} from '../../supabase/functions/atlas-plan/lib/embedder.ts';
import { admin } from '../seed/env';

interface CatalogRow {
  id: number;
  slug: string;
  title: string;
  dare: string;
  why: string | null;
  category: string;
  vibe: string[];
}

interface ExistingRow {
  quest_id: number;
  content_hash: string;
  embedding_version: string;
}

async function main() {
  const { data: catalog, error: catalogError } = await admin
    .from('quest_catalog')
    .select('id, slug, title, dare, why, category, vibe')
    .eq('is_active', true)
    .order('id');
  if (catalogError) throw new Error(`quest_catalog read failed: ${catalogError.message}`);

  const { data: existing, error: existingError } = await admin
    .from('atlas_quest_embeddings')
    .select('quest_id, content_hash, embedding_version');
  if (existingError) throw new Error(`atlas_quest_embeddings read failed: ${existingError.message}`);

  const existingById = new Map((existing as ExistingRow[]).map((r) => [r.quest_id, r]));

  const upserts: {
    quest_id: number;
    embedding: string;
    embedding_version: string;
    content_hash: string;
    updated_at: string;
  }[] = [];
  let skipped = 0;

  for (const quest of (catalog ?? []) as CatalogRow[]) {
    const text = questEmbeddingText({ ...quest, vibe: quest.vibe ?? [] });
    const hash = contentHash(`${EMBEDDING_VERSION}:${text}`);
    const current = existingById.get(quest.id);
    if (current && current.content_hash === hash && current.embedding_version === EMBEDDING_VERSION) {
      skipped++;
      continue;
    }
    upserts.push({
      quest_id: quest.id,
      embedding: toPgvectorLiteral(embed(text)),
      embedding_version: EMBEDDING_VERSION,
      content_hash: hash,
      updated_at: new Date().toISOString(),
    });
  }

  for (let i = 0; i < upserts.length; i += 50) {
    const batch = upserts.slice(i, i + 50);
    const { error } = await admin.from('atlas_quest_embeddings').upsert(batch, { onConflict: 'quest_id' });
    if (error) throw new Error(`upsert failed at batch ${i / 50}: ${error.message}`);
  }

  console.log(
    `atlas:embed-quests — ${upserts.length} embedded (${EMBEDDING_VERSION}), ${skipped} unchanged, ${
      (catalog ?? []).length
    } active templates total`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
