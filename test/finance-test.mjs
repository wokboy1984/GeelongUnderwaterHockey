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
