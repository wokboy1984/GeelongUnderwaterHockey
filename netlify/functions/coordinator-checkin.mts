import {getDatabase} from '@netlify/database';
import {ensureFamilyColumns,ensureNicknameColumn,getVerifiedUser,ensureMember,hasPermission,logAudit,shortName,unauthorized,forbidden} from './_shared/roles.mts';
import {clubToday,defaultRollDateISO,nextSessionDateISO,requestedSessionDate} from './_shared/attendance.mts';
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});

// Defensive, idempotent — belt-and-braces alongside the real migration
// (20260912000012_attendance_closeout). Added 13 Sept 2026 after Cheongy
// hit a live 500 here that traced back to session_attendance_closeouts
// not existing on the production database, even though the migration
// file was committed — the declarative migration hadn't actually run
// against the live Neon DB. `create table if not exists` is cheap and
// safe to run on every request, so this guarantees the table is there
// regardless of whether the migration pipeline picked it up.
async function ensureCloseoutTable(db:any){
 await db.sql`create table if not exists session_attendance_closeouts(
  session_date date primary key,
  closed_at timestamptz not null default now(),
  closed_by text not null references members(id)
 )`;
}

async function closeoutFor(db:any,sessionDate:string){
 const [row]=await db.sql`select c.session_date,c.closed_at,m.first_name,m.last_name
  from session_attendance_closeouts c join members m on m.id=c.closed_by
  where c.session_date=${sessionDate}::date`;
 if(!row)return null;
 return {closedAt:row.closed_at,closedByName:(row.first_name+' '+row.last_name).trim()};
}

export default async(req:Request)=>{
 if(!['GET','POST'].includes(req.method))return json({ok:false,error:'Method not allowed'},405);
 const user=await getVerifiedUser(req);if(!user)return unauthorized();
 try{
  const db=getDatabase();await ensureNicknameColumn(db);const caller=await ensureMember(db,user);
  if(!hasPermission(caller.roles,'mark_actual_attendance'))return forbidden();
  await ensureCloseoutTable(db);
  await ensureFamilyColumns(db);
  // The roll belongs to a game night (12 Oct 2026, Cheongy) - it used to
  // record against *today*, so a roll ticked the morning after (and the
  // game fees it charges) landed on the wrong date. ?date= / sessionDate
  // picks the Wednesday; default is defaultRollDateISO() (Thu/Fri: the
  // night just gone, otherwise the upcoming Wednesday).
  const body=req.method==='POST'?await req.json().catch(()=>null):null;
  if(req.method==='POST'&&!body)return json({ok:false,error:'Nothing to save'},400);
  const asked=req.method==='POST'?body.sessionDate:new URL(req.url).searchParams.get('date');
  const sessionDate=asked?requestedSessionDate(asked):defaultRollDateISO();
  const today=clubToday();
  if(req.method==='POST'){
   if(asked&&asked!==sessionDate)return json({ok:false,error:'That date is not a game night.'},400);
   const writes=body.action==='save'||(body.action!=='close'&&body.action!=='reopen');
   if(writes&&sessionDate>today)return json({ok:false,error:'The roll opens on game day - this Wednesday hasn\'t happened yet.'},400);

   if(body.action==='close'||body.action==='reopen'){
    if(body.action==='close'){
     await db.sql`insert into session_attendance_closeouts(session_date,closed_by) values(${sessionDate}::date,${caller.id})
      on conflict(session_date) do update set closed_at=now(),closed_by=excluded.closed_by`;
     await logAudit(db,{actorId:caller.id,actorEmail:caller.email,action:'attendance_closed_out',resourceType:'session_attendance',resourceId:sessionDate,note:`${caller.email} closed out attendance for ${sessionDate}`});
    }else{
     await db.sql`delete from session_attendance_closeouts where session_date=${sessionDate}::date`;
     await logAudit(db,{actorId:caller.id,actorEmail:caller.email,action:'attendance_reopened',resourceType:'session_attendance',resourceId:sessionDate,note:`${caller.email} reopened attendance for ${sessionDate}`});
    }
   }else if(body.action==='save'){
    // One roll, one request: the Attendance tab ticks boxes locally and
    // sends every confirmed player's state at once via "Save Roll" —
    // replaced each checkbox firing its own instant save (13 Sept 2026,
    // Cheongy's request for a plain tick-then-save roll). "Close Roll"
    // sends the same request with close:true, so it saves and locks the
    // day in one step rather than needing Save first.
    if(!Array.isArray(body.entries))return json({ok:false,error:'Nothing to save'},400);
    if(await closeoutFor(db,sessionDate))return json({ok:false,error:'This day is closed out — reopen it first to make changes.'},409);
    for(const e of body.entries){
     if(!e||typeof e.memberId!=='string'||typeof e.attended!=='boolean')continue;
     await db.sql`with changed as (
      insert into session_attendance(session_date,member_id,attended,marked_by)
      values(${sessionDate}::date,${e.memberId},${e.attended},${caller.id})
      on conflict(session_date,member_id) do update set attended=excluded.attended,marked_by=excluded.marked_by,marked_at=now()
      where session_attendance.attended is distinct from excluded.attended
      returning session_date,member_id,attended,marked_by
     ) insert into session_attendance_history(session_date,member_id,attended,marked_by)
     select session_date,member_id,attended,marked_by from changed`;
    }
    await logAudit(db,{actorId:caller.id,actorEmail:caller.email,action:'attendance_roll_saved',resourceType:'session_attendance',resourceId:sessionDate,note:`${caller.email} saved the roll for ${sessionDate} (${body.entries.length} players)`});
    if(body.close){
     await db.sql`insert into session_attendance_closeouts(session_date,closed_by) values(${sessionDate}::date,${caller.id})
      on conflict(session_date) do update set closed_at=now(),closed_by=excluded.closed_by`;
     await logAudit(db,{actorId:caller.id,actorEmail:caller.email,action:'attendance_closed_out',resourceType:'session_attendance',resourceId:sessionDate,note:`${caller.email} closed out attendance for ${sessionDate}`});
    }
   }else{
    if(typeof body.memberId!=='string'||typeof body.attended!=='boolean')return json({ok:false,error:'Choose a player and attendance status'},400);
    if(await closeoutFor(db,sessionDate))return json({ok:false,error:'This day is closed out — reopen it first to make changes.'},409);
    const [member]=await db.sql`select id from members where id=${body.memberId}`;
    if(!member)return json({ok:false,error:'Player not found'},404);
    await db.sql`with changed as (
     insert into session_attendance(session_date,member_id,attended,marked_by)
     values(${sessionDate}::date,${body.memberId},${body.attended},${caller.id})
     on conflict(session_date,member_id) do update set attended=excluded.attended,marked_by=excluded.marked_by,marked_at=now()
     where session_attendance.attended is distinct from excluded.attended
     returning session_date,member_id,attended,marked_by
    ) insert into session_attendance_history(session_date,member_id,attended,marked_by)
    select session_date,member_id,attended,marked_by from changed`;
   }
  }
  const players=await db.sql`select m.id,m.nickname,m.first_name as "firstName",m.last_name as "lastName",
   nullif(trim(coalesce(pp.first_name,'')||' '||coalesce(pp.last_name,'')),'') as "parentName",
   coalesce(a.attended,false) as attended,
   exists(select 1 from bookings b join sessions s on s.id=b.session_id where b.member_id=m.id and b.status='in' and s.session_date=${sessionDate}::date) as booked
   from members m left join members pp on pp.id=m.parent_id left join session_attendance a on a.member_id=m.id and a.session_date=${sessionDate}::date
   where m.dependant_removed_at is null or a.attended is not null
   order by m.first_name,m.last_name,m.id`;
  players.forEach((p:any)=>{p.displayName=shortName(p.nickname,p.firstName,p.lastName);delete p.nickname;});
  const closeout=await closeoutFor(db,sessionDate);
  return json({ok:true,sessionDate,today,upcoming:nextSessionDateISO(),players,closed:!!closeout,closedAt:closeout?closeout.closedAt:null,closedByName:closeout?closeout.closedByName:null});
 }catch(error){console.error('Attendance request failed',error);return json({ok:false,error:'Could not load or save attendance. Please try again.'},500);}
};
export const config={path:'/api/coordinator/checkin'};
