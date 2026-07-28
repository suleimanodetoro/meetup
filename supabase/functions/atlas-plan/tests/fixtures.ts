// Shared fixtures for the Atlas engine tests.

import type { MemberProfile, QuestCandidate } from '../lib/types.ts';

export const DEMO_INTENT =
  "I'm new to Leeds, free 7–10 tonight, have £15, don't drink, feel awkward meeting strangers, and like photography.";

/** 2026-07-27 10:00 UTC — a fixed Monday-ish morning so schedules are stable. */
export const FIXED_NOW = new Date('2026-07-27T10:00:00.000Z');

export function photoQuest(overrides: Partial<QuestCandidate> = {}): QuestCandidate {
  return {
    questId: 101,
    slug: 'neon-corners',
    title: 'Neon Corners',
    dare: 'Photograph three glowing corners of the city at golden hour and trade your best frame with the group.',
    why: 'Chasing light turns a city you do not know into one you do.',
    category: 'Creative & self-expression',
    energyLevel: 2,
    socialMode: 'group',
    durationMin: 120,
    costTier: 1,
    budgetMin: 0,
    budgetMax: 10,
    currency: 'GBP',
    riskTier: 1,
    isSoloSafe: true,
    vibe: ['creative', 'explore', 'night'],
    similarity: 0.42,
    source: 'vector',
    ...overrides,
  };
}

export function pubQuest(overrides: Partial<QuestCandidate> = {}): QuestCandidate {
  return {
    questId: 102,
    slug: 'pint-sized-adventure',
    title: 'Pint-Sized Adventure',
    dare: 'Lead the group on a mini pub crawl and order a beer you cannot pronounce.',
    why: 'A shared pint lowers every wall.',
    category: 'Group / party / co-op with the network',
    energyLevel: 3,
    socialMode: 'group',
    durationMin: 120,
    costTier: 1,
    budgetMin: 5,
    budgetMax: 15,
    currency: 'GBP',
    riskTier: 2,
    isSoloSafe: false,
    vibe: ['social', 'spontaneous'],
    similarity: 0.4,
    source: 'vector',
    ...overrides,
  };
}

export function member(id: string, overrides: Partial<MemberProfile> = {}): MemberProfile {
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

export function symmetricMatrix(scores: Record<string, number>): (a: string, b: string) => number {
  return (a, b) => scores[a < b ? `${a}|${b}` : `${b}|${a}`] ?? 0;
}
