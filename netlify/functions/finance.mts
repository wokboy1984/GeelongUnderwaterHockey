import { getDatabase } from '@netlify/database';
import { getVerifiedUser, ensureMember, hasPermission, unauthorized, forbidden } from './_shared/roles.mts';
import { FEES, cents, validDate, totals } from './_shared/finance.mts';
const json = (data: any, status = 200) => new Response(JSON.stringify(data), {status, headers: {'content-type':'application/json','cache-control':'no-store'}});
export default async (req: Request) => {
 if (!['GET','POST'].includes(req.method)) return json({ok:false,error:'Method not allowed'},405);
 const user = await getVerifiedUser(req); if (!user) return unauthorized();
 try {
  const db = getDatabase(), caller = await ensureMember(db,user);
  if (!hasPermission(caller.roles,'manage_finances')) return forbidden();
  if(req.method === 'POST') {
   const b = await req.json();
   if (b.action === 'account') {
    if (!['waged','unwaged'].includes(b.category) || typeof b.trialEligible !== 'boolean') return json({ok:false,error:'Select a fee category and trial eligibility'},400);
    const evidence = String(b.evidence || '').trim();
    if(b.trialEligible && !evidence) return json({ok:false,error:'Record evidence of Try Underwater Hockey enrolment'},400);
    // Freeze the classification after the first entry so historic fees cannot be silently rewritten.
    const rows = await db.sql`insert into finance_accounts(member_id,category,trial_eligible,trial_evidence)
     values(${b.memberId},${b.category},${b.trialEligible},${evidence}) on conflict(member_id) do nothing returning member_id`;
    if (!rows.length) return json({ok:false,error:'This player already has a finance account'},409);
   } else if(b.action === 'entry') {
    const date = String(b.date), today = new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    if(!validDate(date) || date > today || !['joining','annual','payment'].includes(b.kind) || !/^[0-9a-f-]{36}$/i.test(b.id || '')) return json({ok:false,error:'Invalid entry, date or request ID'},400);
    const [account] = await db.sql`select * from finance_accounts where member_id=${b.memberId}`;
    if(!account) return json({ok:false,error:'Set up the player fee category first'},400);
    const [previous] = await db.sql`select id from finance_entries where id=${b.id}`;
    if(previous) return json({ok:true});
    let amount = b.kind === 'payment' ? cents(b.amount) : FEES[account.category as keyof typeof FEES][b.kind as 'joining'|'annual'];
    const note = String(b.note || '').trim().slice(0,1000);
    const result = await db.sql`select record_finance_entry(${b.id},${b.memberId},${b.kind},${date}::date,${amount},${note},${caller.id}) as id`;
    const inserted = result.filter((r: any) => r.id);
    if(!inserted.length) return json({ok:false,error:'Already recorded, or attendance is earlier than the last recorded session. Record attendance in date order.'},409);
   } else return json({ok:false,error:'Unknown action'},400);
   return json({ok:true});
  }
  const month = new URL(req.url).searchParams.get('month') || new Date().toISOString().slice(0,7);
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ok:false,error:'Invalid month'},400);
  const members = await db.sql`select m.id,m.first_name,m.last_name,a.category,a.trial_eligible,a.trial_evidence from members m left join finance_accounts a on a.member_id=m.id order by m.last_name,m.first_name`;
  // Game fees are derived from actual check-ins. Unchecking attendance removes
  // the charge, and setting up an account later automatically includes history.
  const entries = await db.sql`
   with attended as (
    select sa.member_id,sa.session_date,sa.marked_by,
     row_number() over(partition by sa.member_id order by sa.session_date) as attendance_number
    from session_attendance sa where sa.attended=true
   ), game_entries as (
    select 'attendance:'||a.member_id||':'||a.session_date::text as id,a.member_id,'game'::text as kind,
     to_char(a.session_date,'YYYY-MM-DD') as entry_date,
     case when fa.trial_eligible and a.attendance_number<=3 then 0
          when fa.category='waged' then 2000 else 1000 end as amount_cents,
     case when fa.trial_eligible and a.attendance_number<=3 then 'Try Underwater Hockey — free session' else 'Confirmed attendance' end as note,
     a.marked_by as actor_id,a.session_date::timestamptz as created_at
    from attended a join finance_accounts fa on fa.member_id=a.member_id
   ), manual_entries as (
    select id,member_id,kind,to_char(entry_date,'YYYY-MM-DD') as entry_date,amount_cents,note,actor_id,created_at
    from finance_entries where kind<>'game'
   ) select id,member_id,kind,entry_date,amount_cents,note,actor_id from (
    select * from game_entries union all select * from manual_entries
   ) all_entries order by entry_date,created_at`;
  return json({ok:true,month,members:members.map((m:any)=>({...m,...totals(entries.filter((e:any)=>e.member_id===m.id),month)})),entries});
 } catch(error) {
  console.error('Finance request failed',error);
  return json({ok:false,error: error instanceof Error && error.message.startsWith('Payment') ? error.message : 'Could not save or load finance records. Check the database migration and input.'},400);
 }
};
export const config = {path:'/api/finance'};

