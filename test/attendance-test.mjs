import test from 'node:test';
import assert from 'node:assert/strict';
import { clubToday, isAttendanceKind, toAttendanceKind } from '../netlify/functions/_shared/attendance.mts';
import { adminName, hasPermission } from '../netlify/functions/_shared/roles.mts';

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

// Attendance kinds (20 Oct 2026). Anything unrecognised must fall back to
// 'player': that's what booking in meant before kinds existed, and the
// alternative is a stale browser tab quietly making someone free.
test('attendance kinds validate, and anything else means playing', () => {
  for (const k of ['player', 'swim', 'volunteer']) {
    assert.equal(isAttendanceKind(k), true);
    assert.equal(toAttendanceKind(k), k);
  }
  for (const bad of ['', 'Player', 'referee', null, undefined, 0, {}]) {
    assert.equal(isAttendanceKind(bad), false);
    assert.equal(toAttendanceKind(bad), 'player');
  }
});

test('Administration shows full name with the nickname in brackets', () => {
  assert.equal(adminName('Tayls', 'Sam', 'Taylor'), 'Sam Taylor (Tayls)');
  assert.equal(adminName('', 'Sam', 'Taylor'), 'Sam Taylor');
  assert.equal(adminName('sam', 'Sam', 'Taylor'), 'Sam Taylor');
  assert.equal(adminName('Cheongy', '', ''), 'Cheongy');
});

import { startingTeamFor } from '../netlify/functions/_shared/team-roster.mts';

test('startingTeamFor matches the starting list by name, cautiously', () => {
  assert.equal(startingTeamFor('Liam', 'Cooke'), 'Sharks');
  assert.equal(startingTeamFor('kevin', 'chisholm'), 'Crays');      // short form, any case
  assert.equal(startingTeamFor('Jack', 'Curwen Walker'), 'Sharks'); // hyphen/space ignored
  assert.equal(startingTeamFor('Stu', 'McCallum'), 'Sharks');
  assert.equal(startingTeamFor('Isabelle', 'Hogan', 'Miley'), 'Dolphins'); // via nickname
  assert.equal(startingTeamFor('Oscar', 'Hatty'), 'Dolphins');
  assert.equal(startingTeamFor('Jane', 'Hogan'), null);   // family name, unknown first name
  assert.equal(startingTeamFor('Liam', ''), null);
});

import { roundRows } from '../netlify/functions/_shared/timetable-templates.mts';

test('A round matches the printed sheet', () => {
  const rows = roundRows([["Dolphins", "Crays", "Sharks"], ["Dolphins", "Sharks", "Crays"], ["Crays", "Sharks", "Dolphins"]]);
  assert.deepEqual(rows.map((r) => [r.label, r.startMin, r.durationMin]), [
    ['Set Up', 0, 10], ['Development', 15, 28], ['Game 1', 44, 18], ['Game 2', 63, 18], ['Game 3', 82, 18],
  ]);
  assert.deepEqual(rows[1].games, [{ pool: 'Pool A', white: 'Stingrays', black: 'Seahorses', refereeIds: [] }]);
  assert.deepEqual(rows[2].games[0], { pool: 'Pool A', white: 'Dolphins', black: 'Crays', refereeIds: [] });
  assert.equal(rows[2].notes, 'Ref / drills / coach: Sharks');
  assert.ok(rows.slice(1).every((r) => r.gameCount === 1));
});
