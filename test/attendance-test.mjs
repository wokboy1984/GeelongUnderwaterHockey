import test from 'node:test';
import assert from 'node:assert/strict';
import { clubToday } from '../netlify/functions/_shared/attendance.mts';
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
