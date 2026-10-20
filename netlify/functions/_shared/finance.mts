export const FEES = { waged: { game: 2000, joining: 2000, annual: 2000 }, unwaged: { game: 1000, joining: 1000, annual: 500 } };

// What each kind of attendance costs for a night (20 Oct 2026). A lane
// swim is $10 flat — deliberately NOT split by waged/unwaged like the game
// fee, because it's pool entry rather than a club session. Volunteers
// aren't in the water, so they pay nothing. Players fall through to FEES
// above, where the waged split and the free-trial rules still apply.
export const SWIM_FEE = 1000;
export const VOLUNTEER_FEE = 0;
export function cents(value: unknown): number {
 const raw = String(value);
 if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) throw new Error('Enter a positive amount with at most two decimal places');
 const [whole, fraction = ''] = raw.split('.');
 const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
 if (result <= 0) throw new Error('Payment must be greater than zero');
 return result;
}
export function validDate(value: string) {
 return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function totals(entries: any[], month: string) {
 let opening = 0, charges = 0, payments = 0;
 for (const e of entries) {
  const date = String(e.entry_date).slice(0,10), amount = Number(e.amount_cents);
  if (date.slice(0,7) < month) opening += e.kind === 'payment' ? -amount : amount;
  if (date.slice(0,7) === month) { if(e.kind === 'payment') payments += amount; else charges += amount; }
 }
 return { opening, charges, payments, closing: opening + charges - payments };
}
