import { getDatabase } from '@netlify/database';
import { getVerifiedUser, ensureMember, hasPermission, logAudit, unauthorized, forbidden } from './_shared/roles.mts';
import { FEES, cents, validDate, totals } from './_shared/finance.mts';
const json = (data: any, status = 200) => new Response(JSON.stringify(data), {status, headers: {'content-type':'application/json','cache-control':'no-store'}});
export default async (req: Request) => {
 if (!['GET','POST'].includes(req.method)) return json({ok:false,error:'Method not allowed'},405);
 const user = await getVerifiedUser(req); if (!user) return unauthorized();
 try {
  const db = getDatabase(), caller = await ensureMember(db,user);
  const url = new URL(req.url);
  // Self-service summary for the member dashboard: any logged-in member can
  // see their OWN balance (never anyone else's, and never the full roster) —
  // this does not need manage_finances. Same tables, same totals() math the
  // Treasurer view already trusts; just scoped to one member_id.
  if (url.searchParams.get('self') === '1') {
   if (req.method !== 'GET') return json({ok:false,error:'Method not allowed'},405);
   const month = url.searchParams.get('month') || new Date().toISOString().slice(0,7);
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ok:false,error:'Invalid month'},400);
   const [account] = await db.sql`select category,trial_eligible from finance_accounts where member_id=${caller.id}`;
   if (!account) return json({ok:true,self:true,month,hasAccount:false});
   const entries = await db.sql`
    with attended as (
     select sa.member_id,sa.session_date,
      row_number() over(partition by sa.member_id order by sa.session_date) as attendance_number
     from session_attendance sa where sa.attended=true and sa.member_id=${caller.id}
    ), game_entries as (
     select 'game'::text as kind, to_char(a.session_date,'YYYY-MM-DD') as entry_date,
      case when fa.trial_eligible and a.attendance_number<=3 then 0
           when fa.category='waged' then 2000 else 1000 end as amount_cents,
      case when fa.trial_eligible and a.attendance_number<=3 then 'Try Underwater Hockey — free session' else 'Confirmed attendance' end as note,
      a.session_date::timestamptz as created_at
     from attended a join finance_accounts fa on fa.member_id=a.member_id
    ), manual_entries as (
     -- Includes retrospective manual 'game' entries (a game that was never
     -- checked in) alongside joining/annual/payment/custom — finance.mts
     -- refuses a manual game entry for any date session_attendance already
     -- covers, so this can never double up with game_entries above.
     select kind,to_char(entry_date,'YYYY-MM-DD') as entry_date,amount_cents,note,created_at
     from finance_entries where member_id=${caller.id}
    ) select * from (select * from game_entries union all select * from manual_entries) all_entries order by entry_date,created_at`;
   return json({ok:true,self:true,month,hasAccount:true,category:account.category,trialEligible:account.trial_eligible,
    ...totals(entries,month),entries});
  }
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
    if(!validDate(date) || date > today || !['joining','annual','payment','game','custom'].includes(b.kind) || !/^[0-9a-f-]{36}$/i.test(b.id || '')) return json({ok:false,error:'Invalid entry, date or request ID'},400);
    const note = String(b.note || '').trim().slice(0,1000);
    if((b.kind === 'custom' || b.kind === 'game') && !note) return json({ok:false,error:'A note is required for a ' + (b.kind === 'custom' ? 'custom charge' : 'manual game entry')},400);
    const [account] = await db.sql`select * from finance_accounts where member_id=${b.memberId}`;
    if(!account) return json({ok:false,error:'Set up the player fee category first'},400);
    const [previous] = await db.sql`select id from finance_entries where id=${b.id}`;
    if(previous) return json({ok:true});
    // A manual game entry is for a game that was never checked in via the
    // Coordinator's Attendance tab — refuse one for a date that already has
    // real tracked attendance, so the two sources can never double-charge.
    if(b.kind === 'game') {
     const [tracked] = await db.sql`select 1 from session_attendance where member_id=${b.memberId} and session_date=${date}::date and attended=true`;
     if(tracked) return json({ok:false,error:'Attendance for this date is already tracked and charged automatically — no manual entry needed.'},409);
    }
    const amount = (b.kind === 'payment' || b.kind === 'custom') ? cents(b.amount) : FEES[account.category as keyof typeof FEES][b.kind as 'joining'|'annual'|'game'];
    const result = await db.sql`select record_finance_entry(${b.id},${b.memberId},${b.kind},${date}::date,${amount},${note},${caller.id}) as id`;
    const inserted = result.filter((r: any) => r.id);
    if(!inserted.length) return json({ok:false,error:'Already recorded for this player and date.'},409);
   } else if(b.action === 'delete') {
    // Removing a mistaken fee — joining/annual/game/custom only. Payments are
    // never deletable here (money that actually changed hands stays on the
    // record; fix a wrong payment with a correcting entry, not a delete) and
    // a live-attendance game charge has no row in finance_entries at all
    // (it's computed from session_attendance), so it's naturally untouched —
    // uncheck the player's attendance on the Coordinator tab to remove that one.
    if(!/^[0-9a-f-]{36}$/i.test(b.id || '')) return json({ok:false,error:'Invalid record'},400);
    const [entry] = await db.sql`select * from finance_entries where id=${b.id}`;
    if(!entry) return json({ok:false,error:'Record not found — it may already be removed, or it is an automatic game charge (uncheck attendance instead).'},404);
    if(entry.kind === 'payment') return json({ok:false,error:'Payments can\'t be deleted — record a correcting entry instead.'},400);
    await db.sql`delete from finance_entries where id=${b.id}`;
    await logAudit(db,{actorId:caller.id,actorEmail:caller.email,action:'finance_entry_deleted',resourceType:'finance_entries',resourceId:b.id,previousValue:{memberId:entry.member_id,kind:entry.kind,date:entry.entry_date,amountCents:entry.amount_cents,note:entry.note},note:`${caller.email} deleted a ${entry.kind} charge of $${(entry.amount_cents/100).toFixed(2)}`});
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
    -- Includes retrospective manual 'game' entries alongside joining/annual/
    -- payment/custom — finance.mts refuses a manual game entry for any date
    -- session_attendance already covers, so this can never double up with
    -- game_entries above.
    select id,member_id,kind,to_char(entry_date,'YYYY-MM-DD') as entry_date,amount_cents,note,actor_id,created_at
    from finance_entries
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

