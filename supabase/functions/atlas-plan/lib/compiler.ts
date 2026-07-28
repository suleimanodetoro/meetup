// Intent compilation: free text -> CompiledIntent.
//
// Two compilers share this module:
//   - compileWithRules(): the deterministic rule-based compiler. It is the
//     default engine (no credentials required) and the fallback when the
//     Anthropic adapter is unavailable, errors, or refuses.
//   - normalizeWireIntent(): clamps/validates the JSON the LLM returns under
//     INTENT_WIRE_JSON_SCHEMA. The LLM proposes; this function decides what
//     the engine is allowed to see. Every numeric range and enum is enforced
//     here because structured outputs cannot express min/max constraints.

import type { CompiledIntent, IntentWindow, RequesterContext, SocialMode } from './types.ts';

// ---------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------

/** Phrase -> hard-exclusion tags (matched word-by-word by the verifier). */
const AVOID_RULES: Array<{ pattern: RegExp; tags: string[]; note: string }> = [
  {
    pattern: /\b(?:don'?t|do not|no|never|can'?t) (?:drink|booze)|alcohol[- ]free|\bsober\b|\bteetotal/i,
    tags: ['alcohol', 'drink', 'drinking', 'bar', 'pub', 'beer', 'wine', 'pint', 'cocktail', 'brewery'],
    note: 'no-alcohol constraint detected',
  },
  {
    pattern: /\bvegan\b|\bvegetarian\b/i,
    tags: ['steak', 'bbq', 'butcher'],
    note: 'dietary constraint detected',
  },
  {
    pattern: /\bafraid of heights\b|\bvertigo\b/i,
    tags: ['climb', 'climbing', 'rooftop', 'heights'],
    note: 'heights constraint detected',
  },
];

/** Interest keyword -> retrieval tags aligned with quest_catalog vibe/category vocabulary. */
const INTEREST_RULES: Array<{ pattern: RegExp; tag: string; retrieval: string[] }> = [
  { pattern: /photograph|camera|photo walk/i, tag: 'photography', retrieval: ['photography', 'creative', 'golden hour', 'explore', 'city'] },
  { pattern: /\bfood(?:ie)?\b|\beat(?:ing)?\b|restaurant|street food/i, tag: 'food', retrieval: ['food', 'taste', 'sensory', 'cozy'] },
  { pattern: /\bcoffee\b|\bcafe\b|café/i, tag: 'coffee', retrieval: ['coffee', 'cozy', 'taste'] },
  { pattern: /\bmusic\b|\bgig\b|\bconcert\b|\bvinyl\b/i, tag: 'music', retrieval: ['music', 'creative', 'social'] },
  { pattern: /\bart\b|gallery|museum|sketch|draw(?:ing)?|paint(?:ing)?/i, tag: 'art', retrieval: ['creative', 'self-expression', 'art'] },
  { pattern: /\bhik(?:e|ing)\b|\bwalk(?:ing)?\b|outdoors?|nature|park\b/i, tag: 'outdoors', retrieval: ['outdoors', 'explore', 'adventurous'] },
  { pattern: /\bgame(?:s)?\b|board game|arcade/i, tag: 'games', retrieval: ['playful', 'social', 'co-op'] },
  { pattern: /\bbook(?:s)?\b|read(?:ing)?|library/i, tag: 'books', retrieval: ['cozy', 'mindful', 'learning'] },
  { pattern: /\bwrit(?:e|ing)\b|journal/i, tag: 'writing', retrieval: ['creative', 'self-expression', 'mindful'] },
  { pattern: /\brun(?:ning)?\b|\bgym\b|fitness|climb(?:ing)?/i, tag: 'fitness', retrieval: ['adventurous', 'outdoors', 'brave'] },
];

const ROLE_SAFE_WORDS = ['meet', 'meeting', 'talk', 'talking'];

// ---------------------------------------------------------------------------
// Rule-based compiler (the deterministic default / fallback)
// ---------------------------------------------------------------------------

export function compileWithRules(rawIntent: string, ctx: RequesterContext): CompiledIntent {
  const text = rawIntent.trim();
  const notes: string[] = [];
  let signals = 0;

  // City: "new to Leeds", "around Manchester", "visiting York". Bare "in" is
  // deliberately absent — it captures interest phrases ("interested in
  // Music") far more often than cities; the profile city covers that case.
  let city: string | null = null;
  const cityMatch = text.match(
    /\b(?:new to|visiting|around|based in|moved to)\s+([A-Z][A-Za-z''-]+(?:\s+[A-Z][A-Za-z''-]+)?)/
  );
  if (cityMatch) {
    city = cityMatch[1].trim();
    notes.push(`city "${city}" from phrase "${cityMatch[0].trim()}"`);
    signals++;
  } else if (ctx.profileCity) {
    city = ctx.profileCity;
    notes.push(`city defaulted to profile location "${ctx.profileCity}"`);
  }

  // Time window: "free 7–10 tonight", "7pm-10pm", "between 19:00 and 22:00".
  const window: IntentWindow = { dateHint: null, startLocal: null, endLocal: null };
  let durationMaxMin: number | null = null;
  // The trailing negative lookahead keeps head-count ranges ("3-4 people",
  // "5 to 6 new people") from parsing as 03:00–04:00 time windows.
  const windowMatch = text.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(?:pm|am)?\s*(?:–|-|—|to|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*(pm|am)?\b(?!\s*(?:new\s+)?(?:people|person|of us|others?|friends|mates))/i
  );
  const saysTonight = /\btonight\b|\bthis evening\b/i.test(text);
  const saysTomorrow = /\btomorrow\b/i.test(text);
  const saysWeekend = /\bweekend\b|\bsaturday\b|\bsunday\b/i.test(text);
  if (saysTonight) window.dateHint = 'today';
  else if (saysTomorrow) window.dateHint = 'tomorrow';
  else if (saysWeekend) window.dateHint = 'weekend';

  if (windowMatch) {
    let startH = parseInt(windowMatch[1], 10);
    let endH = parseInt(windowMatch[3], 10);
    const startM = windowMatch[2] ? parseInt(windowMatch[2], 10) : 0;
    const endM = windowMatch[4] ? parseInt(windowMatch[4], 10) : 0;
    const meridiem = (windowMatch[5] ?? '').toLowerCase();
    if (meridiem === 'pm') {
      if (endH < 12) endH += 12;
      if (startH < 12 && startH <= endH - 12) startH += 12;
    } else if ((saysTonight || /\bevening\b/i.test(text)) && startH < 12 && endH <= 12) {
      // "free 7–10 tonight" means 19:00–22:00, not breakfast.
      startH += 12;
      endH += 12;
    }
    if (startH >= 0 && startH <= 23 && endH >= 0 && endH <= 23 && endH > startH) {
      window.startLocal = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
      window.endLocal = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      durationMaxMin = (endH * 60 + endM) - (startH * 60 + startM);
      notes.push(`window ${window.startLocal}–${window.endLocal} (${durationMaxMin} min) from "${windowMatch[0].trim()}"`);
      signals++;
    }
  }
  if (durationMaxMin === null) {
    const hoursMatch = text.match(/\b(?:for|have|got)\s+(?:about\s+)?(\d{1,2})\s*(?:hours?|hrs?)\b/i);
    if (hoursMatch) {
      durationMaxMin = parseInt(hoursMatch[1], 10) * 60;
      notes.push(`duration cap ${durationMaxMin} min from "${hoursMatch[0].trim()}"`);
      signals++;
    } else if (/\bquick\b|\bshort\b|an hour\b/i.test(text)) {
      durationMaxMin = 60;
      notes.push('duration cap 60 min from "quick/short/an hour"');
    }
  }

  // Budget: "£15", "$20", "15 quid", "for free", "broke".
  let budgetGbp: number | null = null;
  let budgetTier: 0 | 1 | 2 | null = null;
  const moneyMatch = text.match(/(?:£|\$|€)\s*(\d{1,4})|\b(\d{1,4})\s*(?:quid|pounds?|gbp)\b/i);
  if (moneyMatch) {
    budgetGbp = parseInt(moneyMatch[1] ?? moneyMatch[2], 10);
    budgetTier = budgetGbp <= 0 ? 0 : budgetGbp <= 20 ? 1 : 2;
    notes.push(`budget ~£${budgetGbp} (tier ${budgetTier}) from "${moneyMatch[0].trim()}"`);
    signals++;
  } else if (/\bfor free\b|\bno money\b|\bbroke\b|\bskint\b/i.test(text)) {
    budgetGbp = 0;
    budgetTier = 0;
    notes.push('budget free (tier 0) from free/broke phrasing');
    signals++;
  }

  // Social mode.
  let social: SocialMode | null = null;
  if (/\bmeet(?:ing)? (?:strangers|new people|people)\b|\bmake friends\b|\bgroup\b/i.test(text)) {
    social = 'group';
    notes.push('social "group" from meeting-people phrasing');
    signals++;
  } else if (/\bdate\b|\bone on one\b|\b1:1\b/i.test(text)) {
    social = 'pair';
    notes.push('social "pair" from date phrasing');
    signals++;
  } else if (/\balone\b|\bby myself\b|\bsolo\b/i.test(text)) {
    social = 'solo';
    notes.push('social "solo" from alone phrasing');
    signals++;
  }

  // Comfort (risk tolerance) and energy.
  let comfort: 1 | 2 | 3 | null = null;
  if (/\bawkward\b|\bnervous\b|\bshy\b|\banxious\b|\bintrovert/i.test(text)) {
    comfort = 1;
    notes.push('comfort 1 (gentle) from awkward/nervous/shy phrasing');
    signals++;
  } else if (/\bup for anything\b|\badventurous\b|\bwild\b|\bdare me\b/i.test(text)) {
    comfort = 3;
    notes.push('comfort 3 from up-for-anything phrasing');
    signals++;
  }
  let energy: 1 | 2 | 3 | null = null;
  if (/\bchill\b|\brelax(?:ed|ing)?\b|\bcalm\b|\blow[- ]key\b|\btired\b/i.test(text)) {
    energy = 1;
    notes.push('energy 1 from chill/low-key phrasing');
    signals++;
  } else if (/\bparty\b|\badrenaline\b|\bhigh energy\b|\bcrazy\b/i.test(text)) {
    energy = 3;
    notes.push('energy 3 from party/adrenaline phrasing');
    signals++;
  }

  // Group size: "the four of us", "3 people".
  let groupSizeMin: number | null = null;
  let groupSizeMax: number | null = null;
  const sizeMatch = text.match(/\b(\d)\s*(?:people|of us|others?)\b/i);
  if (sizeMatch) {
    const n = parseInt(sizeMatch[1], 10);
    if (n >= 2 && n <= 6) {
      groupSizeMin = n;
      groupSizeMax = n;
      notes.push(`group size ${n} from "${sizeMatch[0].trim()}"`);
      signals++;
    }
  }

  // Hard exclusions.
  const avoidTags: string[] = [];
  for (const rule of AVOID_RULES) {
    if (rule.pattern.test(text)) {
      avoidTags.push(...rule.tags);
      notes.push(rule.note);
      signals++;
    }
  }

  // Interests.
  const interestTags: string[] = [];
  const retrievalTerms: string[] = [];
  for (const rule of INTEREST_RULES) {
    if (rule.pattern.test(text)) {
      interestTags.push(rule.tag);
      retrievalTerms.push(...rule.retrieval);
      notes.push(`interest "${rule.tag}"`);
      signals++;
    }
  }

  if (social === 'group') retrievalTerms.push('social', 'group', 'co-op');
  if (comfort === 1) retrievalTerms.push('gentle', 'cozy');
  if (energy === 1) retrievalTerms.push('mindful', 'cozy');
  if (energy === 3) retrievalTerms.push('adventurous', 'brave');
  if (saysTonight || /\bevening\b|\bnight\b/i.test(text)) retrievalTerms.push('evening', 'night', 'golden hour');
  for (const w of ROLE_SAFE_WORDS) {
    if (text.toLowerCase().includes(w)) {
      retrievalTerms.push('micro-connection', 'strangers');
      break;
    }
  }

  const semanticQuery = [...new Set(retrievalTerms)].join(' ') || text.slice(0, 200);
  const confidence = Math.min(0.9, 0.3 + signals * 0.08);

  return {
    semanticQuery,
    city,
    window,
    durationMaxMin,
    budgetGbp,
    budgetTier,
    energy,
    social,
    groupSizeMin,
    groupSizeMax,
    comfort,
    avoidTags: [...new Set(avoidTags)],
    interestTags,
    notes,
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// LLM wire contract
// ---------------------------------------------------------------------------

/**
 * JSON schema the Anthropic adapter enforces via structured outputs. Wire
 * shape is snake_case; every object closes with additionalProperties:false
 * and lists all keys as required (structured-outputs rules). Numeric ranges
 * cannot be expressed here — normalizeWireIntent() clamps them.
 */
export const INTENT_WIRE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'semantic_query', 'city', 'window', 'duration_max_min', 'budget_gbp',
    'budget_tier', 'energy', 'social', 'group_size_min', 'group_size_max',
    'comfort', 'avoid_tags', 'interest_tags', 'notes', 'confidence',
  ],
  properties: {
    semantic_query: { type: 'string' },
    city: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    window: {
      type: 'object',
      additionalProperties: false,
      required: ['date_hint', 'start_local', 'end_local'],
      properties: {
        date_hint: { anyOf: [{ type: 'string', enum: ['today', 'tomorrow', 'weekend'] }, { type: 'null' }] },
        start_local: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        end_local: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      },
    },
    duration_max_min: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    budget_gbp: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    budget_tier: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    energy: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    social: { anyOf: [{ type: 'string', enum: ['solo', 'pair', 'group', 'either'] }, { type: 'null' }] },
    group_size_min: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    group_size_max: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    comfort: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    avoid_tags: { type: 'array', items: { type: 'string' } },
    interest_tags: { type: 'array', items: { type: 'string' } },
    notes: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
  },
} as const;

function clampInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < min || n > max) return null;
  return n;
}

function cleanTags(value: unknown, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 40)
  )].slice(0, cap);
}

function cleanTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/**
 * Clamp untrusted wire JSON (LLM output) into a CompiledIntent. Anything out
 * of range degrades to null/empty instead of throwing: a sloppy model answer
 * produces a weaker plan, never a crash or an out-of-contract value.
 */
export function normalizeWireIntent(wire: unknown, rawIntent: string): CompiledIntent {
  const w = (wire && typeof wire === 'object' ? wire : {}) as Record<string, unknown>;
  const windowWire = (w.window && typeof w.window === 'object' ? w.window : {}) as Record<string, unknown>;

  const dateHint = windowWire.date_hint;
  const startLocal = cleanTime(windowWire.start_local);
  const endLocal = cleanTime(windowWire.end_local);

  const social = w.social;
  const budgetGbp =
    typeof w.budget_gbp === 'number' && Number.isFinite(w.budget_gbp) && w.budget_gbp >= 0 && w.budget_gbp <= 10000
      ? Math.round(w.budget_gbp * 100) / 100
      : null;

  const groupSizeMin = clampInt(w.group_size_min, 2, 6);
  const groupSizeMax = clampInt(w.group_size_max, 2, 6);

  const confidence =
    typeof w.confidence === 'number' && Number.isFinite(w.confidence)
      ? Math.min(1, Math.max(0, w.confidence))
      : 0.5;

  const semanticQuery =
    typeof w.semantic_query === 'string' && w.semantic_query.trim().length > 0
      ? w.semantic_query.trim().slice(0, 300)
      : rawIntent.slice(0, 200);

  return {
    semanticQuery,
    city: typeof w.city === 'string' && w.city.trim().length > 0 ? w.city.trim().slice(0, 80) : null,
    window: {
      dateHint: dateHint === 'today' || dateHint === 'tomorrow' || dateHint === 'weekend' ? dateHint : null,
      startLocal,
      endLocal,
    },
    durationMaxMin: clampInt(w.duration_max_min, 15, 24 * 60),
    budgetGbp,
    budgetTier: clampInt(w.budget_tier, 0, 2) as 0 | 1 | 2 | null,
    energy: clampInt(w.energy, 1, 3) as 1 | 2 | 3 | null,
    social: social === 'solo' || social === 'pair' || social === 'group' || social === 'either' ? social : null,
    groupSizeMin,
    groupSizeMax:
      groupSizeMax !== null && groupSizeMin !== null && groupSizeMax < groupSizeMin ? groupSizeMin : groupSizeMax,
    comfort: clampInt(w.comfort, 1, 3) as 1 | 2 | 3 | null,
    avoidTags: cleanTags(w.avoid_tags, 16),
    interestTags: cleanTags(w.interest_tags, 16),
    notes: Array.isArray(w.notes)
      ? w.notes.filter((n): n is string => typeof n === 'string').map((n) => n.slice(0, 200)).slice(0, 16)
      : [],
    confidence,
  };
}
