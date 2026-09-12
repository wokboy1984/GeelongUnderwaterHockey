export function clubToday(now = new Date()): string {
 const parts = new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=(name:string)=>parts.find(p=>p.type===name)!.value;
 return `${value('year')}-${value('month')}-${value('day')}`;
}
