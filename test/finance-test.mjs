import test from 'node:test';
import assert from 'node:assert/strict';
import { cents, totals, validDate, FEES, SWIM_FEE, VOLUNTEER_FEE } from '../netlify/functions/_shared/finance.mts';
test('exact decimal payments, including partial payments',()=>{
 assert.equal(cents('10.01'),1001); assert.equal(cents('0.50'),50);
 for(const value of ['0','-1','1.001','1e2','NaN']) assert.throws(()=>cents(value));
});
test('monthly balances carry unpaid charges and subtract partial receipts',()=>{
 const entries=[{entry_date:'2026-08-10',kind:'game',amount_cents:2000},{entry_date:'2026-09-02',kind:'game',amount_cents:2000},{entry_date:'2026-09-03',kind:'payment',amount_cents:1500},{entry_date:'2026-10-01',kind:'payment',amount_cents:2500}];
 assert.deepEqual(totals(entries,'2026-09'),{opening:2000,charges:2000,payments:1500,closing:2500});
 assert.equal(totals(entries,'2026-10').closing,0);
});
test('credits and free sessions are retained',()=>{
 assert.equal(totals([{entry_date:'2026-09-02',kind:'game',amount_cents:0},{entry_date:'2026-09-03',kind:'payment',amount_cents:500}],'2026-09').closing,-500);
});
test('calendar validation and agreed rates',()=>{
 assert.equal(validDate('2026-02-30'),false); assert.equal(validDate('2026-09-12'),true);
 assert.deepEqual(FEES.unwaged,{game:1000,joining:1000,annual:500});
 assert.deepEqual(FEES.waged,{game:2000,joining:2000,annual:2000});
});

// Attendance kinds (20 Oct 2026). Not everyone who turns up is playing:
// lane swimmers pay a flat $10 and volunteers pay nothing. These pin the
// rates themselves; the SQL in finance.mts picks between them per row.
test('a lane swim is $10 flat, not split by waged status', () => {
  assert.equal(SWIM_FEE, 1000);
  // Deliberately NOT the unwaged game rate halved, and not the waged rate.
  assert.notEqual(SWIM_FEE, FEES.waged.game);
});

test('volunteers are never charged for a session', () => {
  assert.equal(VOLUNTEER_FEE, 0);
});

test('a free session still counts toward what a player owes as zero', () => {
  // A waived or free entry reaches totals() as a zero-amount row, so it
  // shows in the history without moving the balance.
  const month = '2026-10';
  assert.equal(totals([{ entry_date: '2026-10-07', amount_cents: VOLUNTEER_FEE, kind: 'game' }], month).closing, 0);
  assert.equal(totals([{ entry_date: '2026-10-07', amount_cents: SWIM_FEE, kind: 'game' }], month).closing, 1000);
});

// Family cap (28 Oct 2026): at most $20 + $10 per charged adult per night.
import { priceGames } from '../netlify/functions/_shared/finance.mts';
{
  const night = '2026-10-28';
  const adult = (id, partner, extra = {}) => ({ member_id: id, bill_to: id, is_child: false, trial_free: false, first_name: id, date_of_birth: '1985-01-01', partner_id: partner, parent_partner_id: null, session_date: night, marked_by: null, kind: 'player', category: 'waged', trial_eligible: false, attendance_number: 9, ...extra });
  const kid = (id, parent, parentPartner, extra = {}) => ({ member_id: id, bill_to: parent, is_child: true, trial_free: false, first_name: id, date_of_birth: '2014-05-05', partner_id: null, parent_partner_id: parentPartner, session_date: night, marked_by: null, kind: 'player', category: 'waged', trial_eligible: false, attendance_number: 9, ...extra });
  const total = (fees) => fees.reduce((s, f) => s + f.amount_cents, 0);
  const of = (fees, id) => fees.find((f) => f.attendee_id === id);

  test('1 adult + 2 juniors pays $30, taken off a child', () => {
    const fees = priceGames([adult('liam', 'allison'), kid('lucas', 'liam', 'allison'), kid('hannah', 'liam', 'allison')]);
    assert.equal(total(fees), 3000);
    assert.equal(of(fees, 'liam').amount_cents, 2000);
    assert.ok(fees.some((f) => f.note.endsWith('family cap')));
  });
  test('2 adults + juniors pays $40; the second partner is charged as normal', () => {
    const fees = priceGames([adult('liam', 'allison'), adult('allison', 'liam'), kid('lucas', 'liam', 'allison'), kid('hannah', 'liam', 'allison')]);
    assert.equal(total(fees), 4000);
    assert.equal(of(fees, 'allison').amount_cents, 2000);
    assert.equal(of(fees, 'lucas').amount_cents + of(fees, 'hannah').amount_cents, 0);
  });
  test('a volunteering partner does not raise the cap', () => {
    const fees = priceGames([adult('liam', 'allison'), adult('allison', 'liam', { kind: 'volunteer' }), kid('lucas', 'liam', 'allison'), kid('hannah', 'liam', 'allison')]);
    assert.equal(total(fees), 3000);
  });
  test('the other partner bringing the kids still counts as one family', () => {
    const fees = priceGames([adult('allison', 'liam'), kid('lucas', 'liam', 'allison'), kid('hannah', 'liam', 'allison')]);
    assert.equal(total(fees), 3000);
  });
  test('3 juniors only pays $20; 2 juniors only pays the normal $20', () => {
    assert.equal(total(priceGames([kid('a', 'p', null), kid('b', 'p', null), kid('c', 'p', null)])), 2000);
    assert.equal(total(priceGames([kid('a', 'p', null), kid('b', 'p', null)])), 2000);
  });
  test('cheaper normal rates stand (unwaged adult, free trial)', () => {
    assert.equal(total(priceGames([adult('u', null, { category: 'unwaged' }), kid('k', 'u', null)])), 2000);
    assert.equal(total(priceGames([adult('p', null), kid('k', 'p', null, { trial_free: true, attendance_number: 1 })])), 2000);
  });
  test('no cap before 28 Oct 2026, for lane swims, or across different families', () => {
    const before = { session_date: '2026-10-21' };
    assert.equal(total(priceGames([adult('p', null, before), kid('a', 'p', null, before), kid('b', 'p', null, before)])), 4000);
    assert.equal(total(priceGames([adult('p', null), kid('a', 'p', null, { kind: 'swim' }), kid('b', 'p', null, { kind: 'swim' })])), 4000);
    assert.equal(total(priceGames([adult('p', null), kid('a', 'q', null), kid('b', 'q', null)])), 4000);
  });
  test('an 18-year-old child counts as an adult, not a junior', () => {
    const fees = priceGames([adult('p', null), kid('a', 'p', null, { date_of_birth: '2008-01-01' }), kid('b', 'p', null), kid('c', 'p', null)]);
    assert.equal(total(fees), 4000); // 2 charged adults -> $40 cap; 20+10+10+10 = 50 -> 40
    assert.equal(of(fees, 'a').amount_cents, 1000);
  });
}
