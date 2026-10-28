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

// ---------------------------------------------------------------------------
// Game fees, worked out from the roll (session_attendance). One copy shared
// by the member's own statement, the Treasurer's Finance page and the
// Administration member page (28 Oct 2026); there used to be three SQL
// copies, and the Administration one had fallen behind (it charged
// volunteers and lane swims as games).
//
// A child's games bill to their parent. The first 3 games are free only for
// a child ticked as a Try Underwater Hockey trial (members.trial_free), or
// an adult whose fee account is ticked; otherwise the usual rate.
//
// Family cap (committee decision, from 28 Oct 2026): on a game night a
// family pays at most $20, plus $10 for each adult who is charged. So
// juniors only $20, 1 adult with any number of juniors $30, 2 adults $40.
// A family is the login accounts an Administrator has put together
// (members.family_id) plus the children under any of them; a junior is
// anyone under 18 on the night, with their own login or not. Volunteers ($0)
// don't count as an adult, and unwaged adults may come in under the cap
// anyway. Lane swims aren't covered. The saving comes off the juniors'
// charges (it always fits there for up to two adults; with more, adults just
// pay as normal), so adults' own charges never change. A junior with their
// own login has the saving on their own account; a child under a parent, on
// the parent's.
// ---------------------------------------------------------------------------
export const FAMILY_CAP_FROM = '2026-10-28';
export function familyCapCents(adultsCharged: number): number {
 return 2000 + 1000 * adultsCharged;
}
function ageOn(dob: unknown, date: string): number | null {
 if (!dob) return null;
 const d = typeof dob === 'string' ? dob.slice(0, 10) : new Date(dob as any).toISOString().slice(0, 10);
 const [y, m, day] = d.split('-').map(Number), [ty, tm, td] = date.split('-').map(Number);
 return ty - y - (tm < m || (tm === m && td < day) ? 1 : 0);
}

export type GameFee = {
 id: string; member_id: string; attendee_id: string; kind: 'game'; entry_date: string;
 amount_cents: number; note: string; actor_id: string | null; created_at: string;
};

// The rows the SQL below returns, kept separate so the rules can be tested
// without a database.
export type AttendedRow = {
 member_id: string; bill_to: string; is_child: boolean; trial_free: boolean; first_name: string;
 date_of_birth: unknown; family_key: string;
 session_date: string; marked_by: string | null; kind: string; category: string; trial_eligible: boolean;
 attendance_number: number | string;
};

export function priceGames(rows: AttendedRow[]): GameFee[] {
 const fees = rows.map((a) => {
  const n = Number(a.attendance_number);
  let amount: number, note: string;
  if (a.kind === 'volunteer') { amount = 0; note = 'Volunteering — no charge'; }
  else if (a.kind === 'swim') { amount = 1000; note = 'Lane swim'; }
  else if (a.is_child) { const free = a.trial_free && n <= 3; amount = free ? 0 : 1000; note = a.first_name + ' (child) — ' + (free ? 'free session' : 'confirmed attendance'); }
  else if (a.trial_eligible && n <= 3) { amount = 0; note = 'Try Underwater Hockey — free session'; }
  else { amount = a.category === 'waged' ? 2000 : 1000; note = 'Confirmed attendance'; }
  return {
   fee: {
    id: 'attendance:' + a.member_id + ':' + a.session_date, member_id: a.bill_to, attendee_id: a.member_id, kind: 'game' as const,
    entry_date: a.session_date, amount_cents: amount, note, actor_id: a.marked_by, created_at: a.session_date + 'T00:00:00Z',
   },
   row: a,
  };
 });

 const nights: Record<string, typeof fees> = {};
 for (const f of fees) {
  if (f.row.kind !== 'player' || f.row.session_date < FAMILY_CAP_FROM) continue;
  (nights[f.row.family_key + '@' + f.row.session_date] ||= []).push(f);
 }
 for (const night of Object.values(nights)) {
  // No date of birth: a child under a parent is a junior, a login isn't.
  const junior = (f: (typeof fees)[number]) => { const age = ageOn(f.row.date_of_birth, f.row.session_date); return age == null ? f.row.is_child : age < 18; };
  const adultsCharged = night.filter((f) => !junior(f) && f.fee.amount_cents > 0).length;
  let over = night.reduce((s, f) => s + f.fee.amount_cents, 0) - familyCapCents(adultsCharged);
  for (const f of night.filter(junior).sort((a, b) => b.fee.amount_cents - a.fee.amount_cents || a.fee.attendee_id.localeCompare(b.fee.attendee_id))) {
   if (over <= 0) break;
   const take = Math.min(over, f.fee.amount_cents);
   if (take <= 0) continue;
   f.fee.amount_cents -= take;
   f.fee.note = f.row.is_child ? f.row.first_name + ' (child) — family cap' : 'Confirmed attendance — family cap';
   over -= take;
  }
 }
 return fees.map((f) => f.fee);
}

// Every attended game for anyone with a fee account (or, with payerId,
// just the ones that person pays for). The whole roll is priced either way,
// because the cap depends on who else in the family came that night.
export async function gameFeeEntries(db: any, payerId?: string): Promise<GameFee[]> {
 const rows = await db.sql`
  select sa.member_id, coalesce(m.parent_id, sa.member_id) as bill_to, (m.parent_id is not null) as is_child,
   m.trial_free, m.first_name, m.date_of_birth, coalesce(p.family_id, p.id, m.family_id, m.id) as family_key,
   to_char(sa.session_date, 'YYYY-MM-DD') as session_date, sa.marked_by, sa.kind, fa.category, fa.trial_eligible,
   row_number() over (partition by sa.member_id, sa.kind order by sa.session_date) as attendance_number
  from session_attendance sa
  join members m on m.id = sa.member_id
  left join members p on p.id = m.parent_id
  join finance_accounts fa on fa.member_id = coalesce(m.parent_id, sa.member_id)
  where sa.attended = true`;
 const fees = priceGames(rows);
 return payerId ? fees.filter((f) => f.member_id === payerId) : fees;
}

// Game fees and stored entries (joining, annual, payments, custom, manual
// games) in date order, as the three statements show them.
export function byDate(a: any, b: any): number {
 return String(a.entry_date).localeCompare(String(b.entry_date)) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}
