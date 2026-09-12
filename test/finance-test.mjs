import test from 'node:test';
import assert from 'node:assert/strict';
import { cents, totals, validDate, FEES } from '../netlify/functions/_shared/finance.mts';
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
