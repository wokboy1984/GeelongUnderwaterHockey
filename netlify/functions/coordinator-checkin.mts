import {getDatabase} from '@netlify/database';
import {getVerifiedUser,ensureMember,hasPermission,logAudit,unauthorized,forbidden} from './_shared/roles.mts';
import {clubToday} from './_shared/attendance.mts';
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
  const db=getDatabase(),caller=await ensureMember(db,user);
  if(!hasPermission(caller.roles,'mark_actual_attendance'))return forbidden();
  await ensureCloseoutTable(db);
  const sessionDate=clubToday();
  if(req.method==='POST'){
   const body=await req.json().catch(()=>null);
   if(!body)return json({ok:false,error:'Nothing to save'},400);
   if(body.sessionDate!==sessionDate)return json({ok:false,error:'The date has changed. Refresh the attendance list.'},409);

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
  const players=await db.sql`select m.id,m.first_name as "firstName",m.last_name as "lastName",
   coalesce(a.attended,false) as attended,
   exists(select 1 from bookings b join sessions s on s.id=b.session_id where b.member_id=m.id and b.status='in' and s.session_date=${sessionDate}::date) as booked
   from members m left join session_attendance a on a.member_id=m.id and a.session_date=${sessionDate}::date
   order by m.first_name,m.last_name,m.id`;
  const closeout=await closeoutFor(db,sessionDate);
  return json({ok:true,sessionDate,players,closed:!!closeout,closedAt:closeout?closeout.closedAt:null,closedByName:closeout?closeout.closedByName:null});
 }catch(error){console.error('Attendance request failed',error);return json({ok:false,error:'Could not load or save attendance. Please try again.'},500);}
};
export const config={path:'/api/coordinator/checkin'};
