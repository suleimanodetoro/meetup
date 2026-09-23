import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateAge,
  formatCalendarDate,
  parseCalendarDate,
} from '../../utils/calendarDate.ts';

test('calendar dates round-trip without a day shift across timezones', () => {
  const originalTimezone = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'Europe/London', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Auckland']) {
      process.env.TZ = timezone;
      for (const value of ['1998-01-01', '2000-02-29', '2008-09-23', '2026-03-29', '2026-10-25']) {
        const [year, month, day] = value.split('-').map(Number);
        const selected = new Date(year, month - 1, day);
        assert.equal(formatCalendarDate(selected), value, `${timezone}: selected date`);
        const restored = parseCalendarDate(value);
        assert.equal(restored.getDate(), day, `${timezone}: restored day`);
        assert.equal(restored.getMonth(), month - 1, `${timezone}: restored month`);
        assert.equal(formatCalendarDate(restored), value, `${timezone}: saved again`);

        const birthday = parseCalendarDate('2008-09-23');
        assert.equal(calculateAge(birthday, new Date(2026, 8, 22)), 17, `${timezone}: before birthday`);
        assert.equal(calculateAge(birthday, new Date(2026, 8, 23)), 18, `${timezone}: on birthday`);
      }
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});
