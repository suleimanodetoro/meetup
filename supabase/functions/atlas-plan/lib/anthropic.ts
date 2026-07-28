// Anthropic-backed intent compiler (Deno-only module).
//
// This file is the ONLY place Atlas touches an LLM, and index.ts imports it
// dynamically — solely when ANTHROPIC_API_KEY is configured — so mock mode
// never loads the SDK. The model produces a strict JSON plan request under
// INTENT_WIRE_JSON_SCHEMA (structured outputs); normalizeWireIntent() then
// clamps every field before the deterministic engine sees it. On refusal or
// any API error the caller falls back to the rule-based compiler.

import Anthropic from 'npm:@anthropic-ai/sdk@0.110.0';

import { INTENT_WIRE_JSON_SCHEMA, normalizeWireIntent } from './compiler.ts';
import type { CompileOutput, RequesterContext } from './types.ts';

export const ATLAS_PROMPT_VERSION = 'atlas-intent-v1';
export const DEFAULT_ATLAS_MODEL = 'claude-opus-5';

const SYSTEM_PROMPT = `You compile a person's free-text social intention into a strict JSON plan request for Waypoint, an app that plans small real-world meetups ("sidequests") in a city.

Extract only what the text supports; use null when a field is not stated or clearly implied. Field semantics:
- semantic_query: 5-15 lowercase search terms for matching quest templates. Favor this vocabulary where it fits: spontaneous, cozy, social, outdoors, creative, adventurous, brave, playful, nostalgic, mindful, golden hour, night, food, taste, micro-connection, strangers, explore, city, self-expression, learning, co-op.
- city: proper-cased city name if one is stated ("new to Leeds" means Leeds).
- window: date_hint 'today' for tonight/this evening, 'tomorrow', 'weekend'; start_local/end_local as 24h "HH:MM" city-local ("free 7-10 tonight" means 19:00-22:00).
- duration_max_min: minutes available, derived from the window when explicit.
- budget_gbp: stated spend ceiling in pounds; budget_tier: 0 = free only, 1 = up to ~£20, 2 = above.
- energy: 1 calm, 2 moderate, 3 high. comfort: risk tolerance, 1 gentle (shy/awkward/nervous), 2 default, 3 bold.
- social: 'group' when they want to meet people/strangers, 'pair' for a 1:1 or date, 'solo' for alone.
- group_size_min/max: only when a count is stated (2-6).
- avoid_tags: hard exclusions as lowercase single words. "don't drink" means ["alcohol","drink","drinking","bar","pub","beer","wine","pint","cocktail","brewery"].
- interest_tags: stated interests as lowercase single words.
- notes: one short string per extraction decision, quoting the source phrase.
- confidence: 0-1 self-estimate of how completely the text was captured.`;

export interface AnthropicCompilerConfig {
  apiKey: string;
  model?: string;
}

export class AtlasCompilerRefusal extends Error {
  constructor(detail: string) {
    super(`intent compilation refused: ${detail}`);
    this.name = 'AtlasCompilerRefusal';
  }
}

export function createAnthropicCompiler(config: AnthropicCompilerConfig) {
  const client = new Anthropic({
    apiKey: config.apiKey,
    // A phone is waiting on this request; fail fast and let the caller fall
    // back to the rule-based compiler instead of riding the 10-min default.
    timeout: 30_000,
    maxRetries: 1,
  });
  const model = config.model ?? DEFAULT_ATLAS_MODEL;

  return async function compile(rawIntent: string, ctx: RequesterContext): Promise<CompileOutput> {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      output_config: {
        effort: 'medium',
        format: {
          type: 'json_schema',
          schema: INTENT_WIRE_JSON_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            `Requester profile city: ${ctx.profileCity ?? 'unknown'}`,
            `Requester country code: ${ctx.profileCountryCode ?? 'unknown'}`,
            'Intent:',
            rawIntent,
          ].join('\n'),
        },
      ],
    });

    // Safety classifiers can decline with a normal 200 — check before
    // reading content (claude-opus-5 contract).
    if (response.stop_reason === 'refusal') {
      throw new AtlasCompilerRefusal(response.stop_details?.category ?? 'unspecified');
    }

    const textBlock = response.content.find(
      (block): block is { type: 'text'; text: string } => block.type === 'text'
    );
    if (!textBlock) {
      throw new Error(`intent compilation returned no text block (stop_reason ${response.stop_reason})`);
    }

    return {
      intent: normalizeWireIntent(JSON.parse(textBlock.text), rawIntent),
      kind: 'anthropic',
      modelId: response.model,
      promptVersion: ATLAS_PROMPT_VERSION,
    };
  };
}
