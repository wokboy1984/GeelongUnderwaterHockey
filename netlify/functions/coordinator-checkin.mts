import {getDatabase} from '@netlify/database';
import {getVerifiedUser,ensureMember,hasPermission,unauthorized,forbidden} from './_shared/roles.mts';
import {clubToday} from './_shared/attendance.mts';
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export default async(req:Request)=>{
 if(!['GET','POST'].includes(req.method))return json({ok:false,error:'Method not allowed'},405);
 const user=await getVerifiedUser(req);if(!user)return unauthorized();
 try{
  const db=getDatabase(),caller=await ensureMember(db,user);
  if(!hasPermission(caller.roles,'mark_actual_attendance'))return forbidden();
  const sessionDate=clubToday();
  if(req.method==='POST'){
   const body=await req.json().catch(()=>null);
   if(!body||typeof body.memberId!=='string'||typeof body.attended!=='boolean')return json({ok:false,error:'Choose a player and attendance status'},400);
   if(body.sessionDate!==sessionDate)return json({ok:false,error:'The date has changed. Refresh the attendance list.'},409);
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
  const players=await db.sql`select m.id,m.first_name as "firstName",m.last_name as "lastName",
   coalesce(a.attended,false) as attended,
   exists(select 1 from bookings b join sessions s on s.id=b.session_id where b.member_id=m.id and b.status='in' and s.session_date=${sessionDate}::date) as booked
   from members m left join session_attendance a on a.member_id=m.id and a.session_date=${sessionDate}::date
   order by m.first_name,m.last_name,m.id`;
  return json({ok:true,sessionDate,players});
 }catch(error){console.error('Attendance request failed',error);return json({ok:false,error:'Could not load or save attendance. Please try again.'},500);}
};
export const config={path:'/api/coordinator/checkin'};
