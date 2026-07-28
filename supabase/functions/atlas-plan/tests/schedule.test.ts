import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compileWithRules } from '../lib/compiler.ts';
import { proposeSchedule } from '../lib/schedule.ts';
import type { RequesterContext } from '../lib/types.ts';

const CTX: RequesterContext = {
  userId: 'r',
  fullName: 'Requester',
  profileCity: 'Leeds',
  profileCountryCode: 'GB',
};

// 2026-07-27 is a Monday; 2026-08-01 a Saturday; 2026-08-02 a Sunday.
const weekendIntent = () => compileWithRules('something creative this weekend', CTX);

test('weekend on a weekday targets the upcoming Saturday', () => {
  const schedule = proposeSchedule({
    intent: weekendIntent(),
    countryCode: 'GB',
    now: new Date('2026-07-27T10:00:00.000Z'), // Monday
  });
  // Saturday 11:00 local (UTC+1) = 10:00Z
  assert.equal(schedule.startsAtUtc, '2026-08-01T10:00:00.000Z');
});

test('weekend said ON Saturday stays this weekend (rolls to Sunday if 11:00 passed)', () => {
  const schedule = proposeSchedule({
    intent: weekendIntent(),
    countryCode: 'GB',
    now: new Date('2026-08-01T11:30:00.000Z'), // Saturday 12:30 local — 11:00 has passed
  });
  assert.equal(schedule.startsAtUtc, '2026-08-02T10:00:00.000Z', 'Sunday 11:00 local, not next Saturday');
});

test('weekend said Sunday morning stays today', () => {
  const schedule = proposeSchedule({
    intent: weekendIntent(),
    countryCode: 'GB',
    now: new Date('2026-08-02T08:00:00.000Z'), // Sunday 09:00 local
  });
  assert.equal(schedule.startsAtUtc, '2026-08-02T10:00:00.000Z', 'same-day Sunday 11:00 local');
});

test('a stated tonight window schedules at the window start', () => {
  const intent = compileWithRules('free 7-10 tonight in principle', CTX);
  const schedule = proposeSchedule({
    intent,
    countryCode: 'GB',
    now: new Date('2026-07-27T10:00:00.000Z'), // 11:00 local, window ahead
  });
  assert.equal(schedule.startsAtUtc, '2026-07-27T18:00:00.000Z'); // 19:00 local
  assert.equal(schedule.withinIntentWindow, true);
});
