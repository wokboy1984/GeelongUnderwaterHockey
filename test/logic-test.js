// Node-only smoke test for data.js + store.js business logic (no DOM/React
// involved — this exercises the exact same code the browser runs).
const fs = require('fs');
const path = require('path');

// Minimal browser shim: make `window` literally be the Node global object,
// exactly like a real browser, so bare top-level identifiers created via
// `window.X = ...` in the source files are reachable as plain `X` too.
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = v; },
};
global.window = global;

const indirectEval = eval; // indirect eval runs as true global-scope code,
// so it can't see (and get shadowed/TDZ'd by) this module's own local `const` bindings.

function loadInWindowScope(file) {
  const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  indirectEval(code);
}

loadInWindowScope('js/data.js');
loadInWindowScope('js/store.js');

const GUWH = global.GUWH;
let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log('FAIL:', msg); }
  else console.log('pass:', msg);
}

// --- basic seed sanity ---
const s0 = GUWH.Store.getState();
assert(GUWH.players.length === 36, 'seeded 36 players (' + GUWH.players.length + ')');
assert(Object.keys(s0.bookings).length === 36, 'bookings seeded for every player');
const confirmedStart = GUWH.Store.confirmedPlayerIds().length;
assert(confirmedStart === 35, 'exactly one player seeded as not-in (' + confirmedStart + ' confirmed)');

// --- booking toggle ---
GUWH.Store.setBooking('p01', false);
assert(GUWH.Store.bookingFor('p01').in === false, 'setBooking can mark a player out');
GUWH.Store.setBooking('p01', true);
assert(GUWH.Store.bookingFor('p01').in === true, 'setBooking can mark a player back in');

// --- ad-hoc players (new player / bring-a-mate added by organiser) ---
const rec = GUWH.Store.addAdHocPlayer({ firstName: 'Test', lastName: 'Guest', grade: 'B-grade', position: 'Forward', tag: 'new-player' });
assert(!!GUWH.Store.findPlayer(rec.id), 'ad-hoc player is findable via Store.findPlayer');
assert(GUWH.Store.bookingFor(rec.id).in === true, 'ad-hoc player is auto-booked in');
assert(GUWH.Store.allPlayers().length === 37, 'allPlayers includes the ad-hoc player');

// --- move into a team, then unassign ---
GUWH.Store.movePlayer(rec.id, 'Pool A', 'White');
let board = GUWH.Store.getState().gameBoard;
assert(board.pools['Pool A'].white.includes(rec.id), 'movePlayer places player in Pool A white');
GUWH.Store.movePlayer(rec.id, 'Pool B', 'Black');
board = GUWH.Store.getState().gameBoard;
assert(!board.pools['Pool A'].white.includes(rec.id), 'movePlayer removes player from previous team');
assert(board.pools['Pool B'].black.includes(rec.id), 'movePlayer adds player to new team');
GUWH.Store.unassignPlayer(rec.id);
board = GUWH.Store.getState().gameBoard;
const stillAssigned = Object.values(board.pools).some((p) => p.white.includes(rec.id) || p.black.includes(rec.id));
assert(!stillAssigned, 'unassignPlayer removes the player from every pool');

// --- remove ad-hoc player cleans up bookings + pools ---
GUWH.Store.removeAdHocPlayer(rec.id);
assert(!GUWH.Store.findPlayer(rec.id), 'removeAdHocPlayer removes the player from the roster');
assert(GUWH.Store.getState().bookings[rec.id] === undefined, 'removeAdHocPlayer clears their booking');

// --- suggestBalancedTeams: every confirmed player ends up assigned exactly once ---
const result = GUWH.Store.suggestBalancedTeams();
board = GUWH.Store.getState().gameBoard;
const allAssigned = [].concat(
  board.pools['Pool A'].white, board.pools['Pool A'].black,
  board.pools['Pool B'].white, board.pools['Pool B'].black
);
const confirmedIds = GUWH.Store.confirmedPlayerIds();
assert(allAssigned.length === confirmedIds.length, 'suggestBalancedTeams assigns every confirmed player (' + allAssigned.length + ' vs ' + confirmedIds.length + ')');
assert(new Set(allAssigned).size === allAssigned.length, 'suggestBalancedTeams never double-assigns a player');
assert(confirmedIds.every((id) => allAssigned.includes(id)), 'suggestBalancedTeams leaves nobody unassigned');
assert(typeof result.explanation === 'string' && result.explanation.length > 0, 'suggestBalancedTeams returns a human explanation');

// --- invites / bring a mate ---
const inv = GUWH.Store.addInvite('Jamie Rivers', '0400 000 000');
assert(GUWH.Store.getState().invites.some((i) => i.id === inv.id), 'addInvite records the invite');
GUWH.Store.markInviteRegistered(inv.id);
assert(GUWH.Store.getState().invites.find((i) => i.id === inv.id).status === 'registered', 'markInviteRegistered updates status');

// --- guest bookings (new-player form) ---
const guest = GUWH.Store.addGuestBooking({ firstName: 'Sam', lastName: 'Otway', age: '24' });
assert(GUWH.Store.getState().guestBookings.some((g) => g.id === guest.id), 'addGuestBooking records a new-player signup');

// --- profile edits ---
GUWH.Store.updateProfile('p01', { photoEmoji: '🐬', phone: '0411 111 111' });
assert(GUWH.Store.profileFor('p01').photoEmoji === '🐬', 'updateProfile persists a field');
GUWH.Store.updateProfile('p01', { phone: '0422 222 222' });
assert(GUWH.Store.profileFor('p01').photoEmoji === '🐬' && GUWH.Store.profileFor('p01').phone === '0422 222 222', 'updateProfile merges rather than overwrites');

// --- publish toggle ---
GUWH.Store.publishBoard(false);
assert(GUWH.Store.getState().gameBoard.published === false, 'publishBoard(false) hides the board');
GUWH.Store.publishBoard(true);
assert(GUWH.Store.getState().gameBoard.published === true, 'publishBoard(true) republishes it');

// --- nextWednesday always returns an actual Wednesday in the future ---
const wed = GUWH.nextWednesday(new Date('2026-09-11T10:00:00+10:00')); // a Friday
assert(wed.getDay() === 3, 'nextWednesday returns a Wednesday');
assert(wed.getTime() > new Date('2026-09-11T10:00:00+10:00').getTime(), 'nextWednesday is in the future');

console.log('\n' + (failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'));
process.exit(failures ? 1 : 0);
