// Schedule proposal.
//
// City-local time uses the same documented approximation as auto-generate: a
// static per-country UTC offset table with no DST, driving hour-granularity
// choices where ±1h is acceptable. Every label carries the honesty marker.

import type { CompiledIntent, ScheduleProposal } from './types.ts';

const COUNTRY_UTC_OFFSET_HOURS: Record<string, number> = {
  GB: 1, // BST approximation; the label flags no-DST
  IE: 1,
  FR: 2,
  DE: 2,
  ES: 2,
  IT: 2,
  NL: 2,
  PT: 1,
  US: -5,
  CA: -5,
  MX: -6,
  BR: -3,
  NG: 1,
  ZA: 2,
  AE: 4,
  IN: 5.5,
  SG: 8,
  JP: 9,
  AU: 10,
  NZ: 12,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_START = { hour: 18, minute: 30 };
const WEEKEND_START_HOUR = 11;

function parseLocalTime(value: string | null): { hour: number; minute: number } | null {
  if (!value) return null;
  const m = value.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) };
}

function atLocalTime(localDayMs: number, hour: number, minute: number): number {
  const dayStart = Math.floor(localDayMs / DAY_MS) * DAY_MS;
  return dayStart + (hour * 60 + minute) * 60 * 1000;
}

export function proposeSchedule(input: {
  intent: CompiledIntent;
  countryCode: string | null;
  now: Date;
}): ScheduleProposal {
  const { intent, now } = input;
  const offset = input.countryCode
    ? (COUNTRY_UTC_OFFSET_HOURS[input.countryCode.toUpperCase()] ?? 0)
    : 0;
  const offsetMs = offset * 60 * 60 * 1000;
  const nowLocalMs = now.getTime() + offsetMs;

  const start = parseLocalTime(intent.window.startLocal) ?? DEFAULT_START;
  const windowStated = intent.window.startLocal !== null;

  let targetLocalMs: number;
  if (intent.window.dateHint === 'tomorrow') {
    targetLocalMs = atLocalTime(nowLocalMs + DAY_MS, start.hour, start.minute);
  } else if (intent.window.dateHint === 'weekend') {
    const dayOfWeek = new Date(Math.floor(nowLocalMs / DAY_MS) * DAY_MS).getUTCDay();
    const hour = windowStated ? start.hour : WEEKEND_START_HOUR;
    const minute = windowStated ? start.minute : 0;
    // Saturday and Sunday ARE "this weekend": try today first, roll Sat→Sun
    // when the start time has passed, and only then fall to next Saturday.
    // Weekdays target the upcoming Saturday.
    const dayOffsets =
      dayOfWeek === 6 ? [0, 1, 7] : dayOfWeek === 0 ? [0, 6] : [(6 - dayOfWeek + 7) % 7];
    targetLocalMs = atLocalTime(nowLocalMs + dayOffsets[dayOffsets.length - 1] * DAY_MS, hour, minute);
    for (const d of dayOffsets) {
      const candidate = atLocalTime(nowLocalMs + d * DAY_MS, hour, minute);
      if (candidate > nowLocalMs + 30 * 60 * 1000) {
        targetLocalMs = candidate;
        break;
      }
    }
  } else {
    // 'today' or no hint: today at the stated/default time, rolling to
    // tomorrow if that moment has already passed (with a 30 min buffer).
    targetLocalMs = atLocalTime(nowLocalMs, start.hour, start.minute);
    if (targetLocalMs <= nowLocalMs + 30 * 60 * 1000) {
      targetLocalMs += DAY_MS;
    }
  }

  let withinIntentWindow: boolean | null = null;
  if (windowStated) {
    const end = parseLocalTime(intent.window.endLocal);
    const startOk = targetLocalMs >= atLocalTime(targetLocalMs, start.hour, start.minute);
    const endOk = end === null || targetLocalMs < atLocalTime(targetLocalMs, end.hour, end.minute);
    // The proposal starts exactly at the window start unless it rolled a day;
    // rolling a day past a 'today' hint still lands inside the same clock
    // window, which is what "within" means for a wall-clock window.
    withinIntentWindow = startOk && endOk;
  }

  const startsAtUtcMs = targetLocalMs - offsetMs;
  const local = new Date(targetLocalMs);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  const dayLabel = local.toISOString().slice(0, 10);
  const sign = offset >= 0 ? '+' : '−';

  return {
    startsAtUtc: new Date(startsAtUtcMs).toISOString(),
    localLabel: `${dayLabel} ${hh}:${mm} local (UTC${sign}${Math.abs(offset)}, static offset — no DST)`,
    utcOffsetHours: offset,
    withinIntentWindow,
  };
}
