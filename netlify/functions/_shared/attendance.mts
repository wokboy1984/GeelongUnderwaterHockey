export function clubToday(now = new Date()): string {
 const parts = new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=(name:string)=>parts.find(p=>p.type===name)!.value;
 return `${value('year')}-${value('month')}-${value('day')}`;
}

// The club's weekly cycle runs Thursday -> Wednesday, Melbourne time: as
// soon as it's Thursday in Geelong, the "active" session flips to next
// Wednesday, six days out, and members must confirm again. This must be
// computed from the calendar date Melbourne is actually on (clubToday()),
// never from the server's own wall-clock `new Date()` — a serverless
// function's clock is UTC, and naive `new Date().getDay()` math silently
// drifts a day around the Melbourne midnight boundary (worse again across
// the AEST/AEDT daylight-saving change, since the UTC offset itself
// moves). Building the target date from Y-M-D parts at UTC noon sidesteps
// both problems: noon is never near a DST transition, so date-only
// arithmetic (add N days) can't land on the wrong calendar day.
export function nextSessionDateISO(now = new Date()): string {
 const [y, m, d] = clubToday(now).split('-').map(Number);
 const today = Date.UTC(y, m - 1, d, 12); // noon UTC — clear of any DST edge
 const day = new Date(today).getUTCDay(); // 0 Sun ... 3 Wed ... 6 Sat
 const add = (3 - day + 7) % 7; // on Wednesday itself (add===0), STAY on today —
 // it's game day, not a week early. Found broken live on 16 Sept 2026 (an
 // actual Wednesday): this function still had "if(add===0) add=7", rolling
 // every read (Dashboard, This Week's Game, booking) forward to *next*
 // Wednesday on the one day it matters most, even though a game published
 // earlier in the week correctly targeted today. The doc had claimed this
 // was already fixed — it wasn't; this is the real fix.
 const next = new Date(today + add * 86400000);
 const pad = (n: number) => String(n).padStart(2, '0');
 return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}
