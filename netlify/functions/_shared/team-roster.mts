// Starting teams (28 Oct 2026, Liam). The club's "Teams at October 28"
// list. A player who has never been on a main team in the app goes into
// the team named here the first time they're auto-placed (see
// autoPlaceReturningPlayers in carry-forward.mts). After that, their last
// team wins, exactly as for everyone else, so this list only decides a
// player's first week.
//
// Matching is by name and deliberately cautious: last names must match,
// and first names must match exactly, through the short forms below, or
// via the member's nickname. If no entry or more than one entry matches,
// the player is left unassigned for the coordinator to place.

export const STARTING_TEAMS: Record<string, string[]> = {
  Crays: [
    "Kev Chisholm", "Sarah Joordens", "Tony Freijah", "Dave Wilson", "Barry Hunt", "Sarah Richmond",
    "Brian Kirwan", "Nicola Fraser", "Jasper Chisholm", "Eloise McKinlay", "Rob McKinlay", "Ben Richards",
    "Isaac Hatty", "Matt Anderson", "Andy Han", "Winnie Richmond",
  ],
  Dolphins: [
    "Andrew Hunt", "Charlie Diiorio", "Dale Keating", "Mark Deller", "Danny Hurst", "Alice Fraser",
    "Harriet Richmond", "Nico Etoc", "Alicia Licorni", "Nick Strobel", "Oscar Hatty", "Sophia Hogan",
    "Patrick Tribe", "Barry Staggard", "Miley Hogan",
  ],
  Sharks: [
    "Liam Cooke", "Matt Walters", "Jack Curwen-Walker", "Brendon Backwell", "Lucas Cooke", "Bec Rae",
    "Martin Liebermann", "Byron Fraser", "Hannah Cooke", "Sharon Daniel", "Alex Cheong", "Maeve Hatty",
    "Matt Hogan", "Jay Hogan", "Stuart McCallum", "Andrea Chisholm",
  ],
};

// Short forms on the list -> the full names people may sign up with.
const SHORT_FORMS: Record<string, string> = {
  kev: "kevin", dave: "david", rob: "robert", bob: "robert", ben: "benjamin", matt: "matthew",
  andy: "andrew", danny: "daniel", dan: "daniel", bec: "rebecca", becky: "rebecca", alex: "alexander",
  stu: "stuart", nick: "nicholas", tony: "anthony", charlie: "charles",
};

const key = (s: unknown) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
const firstKey = (s: unknown) => { const k = key(s); return SHORT_FORMS[k] || k; };

// The starting team for a member, or null if there isn't exactly one match.
export function startingTeamFor(firstName: unknown, lastName: unknown, nickname?: unknown): string | null {
  const last = key(lastName);
  if (!last) return null;
  const firsts = [firstKey(firstName), firstKey(nickname)].filter(Boolean);
  const matches = new Set<string>();
  for (const [team, names] of Object.entries(STARTING_TEAMS)) {
    for (const full of names) {
      const i = full.indexOf(" ");
      if (key(full.slice(i + 1)) === last && firsts.includes(firstKey(full.slice(0, i)))) matches.add(team);
    }
  }
  return matches.size === 1 ? [...matches][0] : null;
}
