import test from 'node:test';
import assert from 'node:assert/strict';
import { clubToday, bookingCutoffFor, BOOKING_CUTOFF_HOUR, BOOKING_CUTOFF_MINUTE } from '../netlify/functions/_shared/attendance.mts';
import { hasPermission } from '../netlify/functions/_shared/roles.mts';

test('club attendance date uses Melbourne time', () => {
  assert.equal(clubToday(new Date('2026-09-12T15:30:00Z')), '2026-09-13');
});

test('only operational roles can mark actual attendance', () => {
  for (const role of ['game_coordinator', 'treasurer', 'community_moderator', 'administrator']) {
    assert.equal(hasPermission([role], 'mark_actual_attendance'), true);
  }
  assert.equal(hasPermission([], 'mark_actual_attendance'), false);
  assert.equal(hasPermission(['member'], 'mark_actual_attendance'), false);
});

// Booking cut-off moved to 7:30pm on game night (20 Oct 2026). These pin
// the Melbourne wall-clock time to a real instant on both sides of the
// daylight-saving boundary, which is where the old naive date maths used
// to drift: October is AEDT (UTC+11), July is AEST (UTC+10).
test('booking closes at 7:30pm Melbourne on game night', () => {
  assert.equal(BOOKING_CUTOFF_HOUR, 19);
  assert.equal(BOOKING_CUTOFF_MINUTE, 30);
  // AEDT: 19:30 +11:00 -> 08:30Z the same day
  assert.equal(bookingCutoffFor('2026-10-21').toISOString(), '2026-10-21T08:30:00.000Z');
  // AEST: 19:30 +10:00 -> 09:30Z the same day
  assert.equal(bookingCutoffFor('2026-07-15').toISOString(), '2026-07-15T09:30:00.000Z');
});
