// ---------------------------------------------------------------------------
// GUWH concept — mock data
// Everything here stands in for a future API/database. Keep shapes stable so
// swapping this file for real fetch() calls later is a mechanical change.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};

GUWH.club = {
  name: "Geelong Underwater Hockey",
  shortName: "Geelong UWH",
  venue: "Handbury Centre for Wellbeing",
  venueAddress: "Foreshore Road, Corio VIC 3214",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=Handbury+Centre+for+Wellbeing+Foreshore+Road+Corio",
  sessionDay: "Wednesday",
  sessionTime: "6:00 – 7:30pm",
  freeSessions: 3,
  facebook: "https://www.facebook.com/GeelongUWHStu",
  highlightsVideo: "https://www.youtube.com/watch?v=JoiUTu4emcE",
  highlightsVideoId: "JoiUTu4emcE",
  email: "info@geelongunderwaterhockey.org.au",
  founded: 1978,
  poolCapacity: 48,
  fees: {
    unwaged: { joining: 10, yearly: 5, perGame: 10, auf: 55 },
    waged: { joining: 20, yearly: 20, perGame: 20, auf: 95 },
    family: { yearly: 30 },
    lapSwimmer: { perGame: 10 },
  },
  inclusion: [
    "All ages and physical capacities",
    "Neurodivergent-friendly",
    "Open to people with disability",
    "LGBTQIA+ friendly",
    "Juniors and families welcome",
  ],
  history: [
    { year: 1978, text: "Formed by a handful of Geelong scuba clubs looking for an off-season, foul-weather activity." },
    { year: 1997, text: "Geelong juniors combined with Wonthaggi to form a joint squad that won the National titles in Canberra." },
    { year: 2023, text: "Geelong's U15 squad took home bronze at the Victorian titles." },
    { year: 2026, text: "Still meeting every Wednesday, rain, hail or lockdown-shine, at the Handbury Centre." },
  ],
};

// Positions kept deliberately simple for the concept (real club formations vary).
GUWH.POSITIONS = ["Forward", "Midfield", "Back"];
GUWH.GRADES = ["A-grade", "B-grade", "Junior"];
GUWH.CAP_COLOURS = ["White", "Black"];
GUWH.POOLS = ["Pool A", "Pool B"];

// 36 realistic weekly players. `id` is stable and used as the storage key.
GUWH.players = [
  { id: "p01", firstName: "Alex", lastName: "Chen", age: 34, grade: "A-grade", position: "Forward", handed: "Right", finSize: "9", lastWeekTeam: "Pool A / Black", gamesThisYear: 28, isNew: false },
  { id: "p02", firstName: "Priya", lastName: "Nair", age: 29, grade: "A-grade", position: "Back", handed: "Left", finSize: "7", lastWeekTeam: "Pool A / White", gamesThisYear: 31, isNew: false },
  { id: "p03", firstName: "Marcus", lastName: "Webb", age: 41, grade: "B-grade", position: "Midfield", handed: "Right", finSize: "10", lastWeekTeam: "Pool B / Black", gamesThisYear: 19, isNew: false },
  { id: "p04", firstName: "Sione", lastName: "Taufa", age: 22, grade: "A-grade", position: "Forward", handed: "Right", finSize: "11", lastWeekTeam: "Pool A / Black", gamesThisYear: 24, isNew: false },
  { id: "p05", firstName: "Isla", lastName: "Ferguson", age: 17, grade: "Junior", position: "Midfield", handed: "Right", finSize: "6", lastWeekTeam: "Pool B / White", gamesThisYear: 12, isNew: false },
  { id: "p06", firstName: "Declan", lastName: "O'Meara", age: 38, grade: "B-grade", position: "Back", handed: "Left", finSize: "9", lastWeekTeam: "Pool A / White", gamesThisYear: 22, isNew: false },
  { id: "p07", firstName: "Grace", lastName: "Lindqvist", age: 26, grade: "A-grade", position: "Midfield", handed: "Right", finSize: "7", lastWeekTeam: "Pool B / Black", gamesThisYear: 30, isNew: false },
  { id: "p08", firstName: "Tane", lastName: "Ropata", age: 31, grade: "B-grade", position: "Forward", handed: "Right", finSize: "10", lastWeekTeam: "Pool A / Black", gamesThisYear: 18, isNew: false },
  { id: "p09", firstName: "Chloe", lastName: "Dimitriou", age: 24, grade: "A-grade", position: "Back", handed: "Left", finSize: "8", lastWeekTeam: "Pool B / White", gamesThisYear: 27, isNew: false },
  { id: "p10", firstName: "Rhys", lastName: "Pham", age: 19, grade: "Junior", position: "Forward", handed: "Right", finSize: "8", lastWeekTeam: "Pool B / Black", gamesThisYear: 9, isNew: false },
  { id: "p11", firstName: "Bea", lastName: "Kowalski", age: 45, grade: "B-grade", position: "Back", handed: "Right", finSize: "7", lastWeekTeam: "Pool A / White", gamesThisYear: 20, isNew: false },
  { id: "p12", firstName: "Oscar", lastName: "Reyes", age: 33, grade: "A-grade", position: "Forward", handed: "Left", finSize: "10", lastWeekTeam: "Pool A / Black", gamesThisYear: 29, isNew: false },
  { id: "p13", firstName: "Nell", lastName: "Sutherland", age: 27, grade: "B-grade", position: "Midfield", handed: "Right", finSize: "7", lastWeekTeam: "Pool B / White", gamesThisYear: 15, isNew: false },
  { id: "p14", firstName: "Kai", lastName: "Matagi", age: 20, grade: "A-grade", position: "Back", handed: "Right", finSize: "9", lastWeekTeam: "Pool B / Black", gamesThisYear: 23, isNew: false },
  { id: "p15", firstName: "Freya", lastName: "Adamski", age: 36, grade: "B-grade", position: "Forward", handed: "Left", finSize: "8", lastWeekTeam: "Pool A / White", gamesThisYear: 17, isNew: false },
  { id: "p16", firstName: "Wei", lastName: "Zhou", age: 30, grade: "A-grade", position: "Midfield", handed: "Right", finSize: "9", lastWeekTeam: "Pool A / Black", gamesThisYear: 26, isNew: false },
  { id: "p17", firstName: "Amara", lastName: "Okafor", age: 25, grade: "B-grade", position: "Back", handed: "Right", finSize: "7", lastWeekTeam: "Pool B / White", gamesThisYear: 14, isNew: false },
  { id: "p18", firstName: "Lachie", lastName: "Fenton", age: 16, grade: "Junior", position: "Back", handed: "Right", finSize: "6", lastWeekTeam: "Pool B / Black", gamesThisYear: 11, isNew: false },
  { id: "p19", firstName: "Sasha", lastName: "Volkov", age: 39, grade: "A-grade", position: "Forward", handed: "Left", finSize: "10", lastWeekTeam: "Pool A / White", gamesThisYear: 25, isNew: false },
  { id: "p20", firstName: "Tui", lastName: "Falcao", age: 28, grade: "B-grade", position: "Midfield", handed: "Right", finSize: "8", lastWeekTeam: "Pool A / Black", gamesThisYear: 16, isNew: false },
  { id: "p21", firstName: "Ivy", lastName: "Marchetti", age: 32, grade: "A-grade", position: "Back", handed: "Right", finSize: "7", lastWeekTeam: "Pool B / White", gamesThisYear: 28, isNew: false },
  { id: "p22", firstName: "Noah", lastName: "Bianchi", age: 23, grade: "B-grade", position: "Forward", handed: "Right", finSize: "9", lastWeekTeam: "Pool B / Black", gamesThisYear: 13, isNew: false },
  { id: "p23", firstName: "Mele", lastName: "Fifita", age: 35, grade: "A-grade", position: "Midfield", handed: "Left", finSize: "8", lastWeekTeam: "Pool A / White", gamesThisYear: 27, isNew: false },
  { id: "p24", firstName: "Harvey", lastName: "Stott", age: 44, grade: "B-grade", position: "Back", handed: "Right", finSize: "10", lastWeekTeam: "Pool A / Black", gamesThisYear: 21, isNew: false },
  { id: "p25", firstName: "Della", lastName: "Ahmadi", age: 21, grade: "A-grade", position: "Forward", handed: "Right", finSize: "7", lastWeekTeam: "Pool B / White", gamesThisYear: 22, isNew: false },
  { id: "p26", firstName: "Toby", lastName: "Wren", age: 18, grade: "Junior", position: "Forward", handed: "Left", finSize: "7", lastWeekTeam: "Pool B / Black", gamesThisYear: 10, isNew: false },
  { id: "p27", firstName: "Saoirse", lastName: "Byrne", age: 29, grade: "B-grade", position: "Midfield", handed: "Right", finSize: "8", lastWeekTeam: "Pool A / White", gamesThisYear: 18, isNew: false },
  { id: "p28", firstName: "Femi", lastName: "Adeyemi", age: 26, grade: "A-grade", position: "Back", handed: "Right", finSize: "9", lastWeekTeam: "Pool A / Black", gamesThisYear: 24, isNew: false },
  { id: "p29", firstName: "Lior", lastName: "Katz", age: 37, grade: "B-grade", position: "Forward", handed: "Left", finSize: "9", lastWeekTeam: "Pool B / White", gamesThisYear: 19, isNew: false },
  { id: "p30", firstName: "Ruby", lastName: "Considine", age: 24, grade: "A-grade", position: "Midfield", handed: "Right", finSize: "7", lastWeekTeam: "Pool B / Black", gamesThisYear: 26, isNew: false },
  { id: "p31", firstName: "Stu", lastName: "McCallum", age: 52, grade: "B-grade", position: "Back", handed: "Right", finSize: "10", lastWeekTeam: "Pool A / White", gamesThisYear: 30, isNew: false, isOrganiser: true },
  { id: "p32", firstName: "Tama", lastName: "Ngata", age: 27, grade: "A-grade", position: "Forward", handed: "Right", finSize: "9", lastWeekTeam: "Pool A / Black", gamesThisYear: 23, isNew: false },
  { id: "p33", firstName: "Winnie", lastName: "Hartono", age: 19, grade: "Junior", position: "Midfield", handed: "Left", finSize: "6", lastWeekTeam: "Pool B / White", gamesThisYear: 8, isNew: false },
  { id: "p34", firstName: "Cormac", lastName: "Lehane", age: 31, grade: "B-grade", position: "Back", handed: "Right", finSize: "9", lastWeekTeam: "Pool B / Black", gamesThisYear: 15, isNew: false },
  { id: "p35", firstName: "Anika", lastName: "Berg", age: 33, grade: "A-grade", position: "Forward", handed: "Right", finSize: "7", lastWeekTeam: null, gamesThisYear: 2, isNew: true },
  { id: "p36", firstName: "Jono", lastName: "Petropoulos", age: 28, grade: "B-grade", position: "Midfield", handed: "Right", finSize: "10", lastWeekTeam: null, gamesThisYear: 1, isNew: true, viaBringAMate: true, invitedBy: "Alex Chen" },
];

GUWH.referees = ["Priya Nair", "Stu McCallum", "Bea Kowalski"];

// Team names for the night. Organisers can rename these later (Publish tab) —
// for the concept they're fixed defaults, mapped onto the same Pool/cap
// buckets the Team Builder already assigns players into.
GUWH.TEAM_NAMES = ["Freedivers", "Snorklers", "Swimmers", "Dippers"];

GUWH.TEAM_ASSIGNMENTS = [
  { team: "Freedivers", pool: "Pool A", cap: "White" },
  { team: "Snorklers", pool: "Pool A", cap: "Black" },
  { team: "Swimmers", pool: "Pool B", cap: "White" },
  { team: "Dippers", pool: "Pool B", cap: "Black" },
];

GUWH.teamNameFor = function (pool, cap) {
  const a = GUWH.TEAM_ASSIGNMENTS.find((x) => x.pool === pool && x.cap === cap);
  return a ? a.team : pool + " " + cap;
};

GUWH.bucketForTeam = function (teamName) {
  return GUWH.TEAM_ASSIGNMENTS.find((x) => x.team === teamName) || null;
};

// Format a minute offset from a 6:00pm session start into a clock time, e.g. 15 -> "6:15pm".
GUWH.timeFromSessionStart = function (minutes) {
  const base = new Date(2000, 0, 1, 18, 0, 0);
  base.setMinutes(base.getMinutes() + minutes);
  let hr = base.getHours();
  const min = base.getMinutes();
  const suffix = hr >= 12 ? "pm" : "am";
  hr = hr % 12 || 12;
  return hr + ":" + String(min).padStart(2, "0") + suffix;
};

// The night's run sheet. Briefing and warm-up are shared; the three games are a
// fixed round robin across the two pools so all four teams play each other once.
GUWH.gameSchedule = [
  { kind: "briefing", label: "Briefing", startMin: 0, endMin: 10 },
  { kind: "warmup", label: "Warm-up", startMin: 10, endMin: 15 },
  {
    kind: "game", label: "Game 1", startMin: 15, endMin: 35,
    matches: [
      { pool: "Pool A", teamA: "Freedivers", teamB: "Snorklers" },
      { pool: "Pool B", teamA: "Swimmers", teamB: "Dippers" },
    ],
  },
  {
    kind: "game", label: "Game 2", startMin: 40, endMin: 60,
    matches: [
      { pool: "Pool A", teamA: "Freedivers", teamB: "Swimmers" },
      { pool: "Pool B", teamA: "Snorklers", teamB: "Dippers" },
    ],
  },
  {
    kind: "game", label: "Game 3", startMin: 65, endMin: 85,
    matches: [
      { pool: "Pool A", teamA: "Freedivers", teamB: "Dippers" },
      { pool: "Pool B", teamA: "Snorklers", teamB: "Swimmers" },
    ],
  },
];

// Referees rostered for a given game index, cycling through whatever referee
// list is currently set (so it stays in sync with organiser edits on Publish).
GUWH.refereesForGame = function (refereeList, gameIndex) {
  const list = (refereeList || []).filter(Boolean);
  if (list.length <= 2) return list.slice(); // too few to rotate meaningfully — everyone refs every game
  const a = list[gameIndex % list.length];
  const b = list[(gameIndex + 1) % list.length];
  return a === b ? [a] : [a, b];
};

GUWH.socialPlan = "BBQ and drinks at Corio Bay, from around 8pm. Everyone's welcome, including anyone who just watched.";

// Minimum confirmed players a team needs to run — used to show how close the
// club is to fielding another team on the Wednesday games page.
GUWH.TEAM_MIN_SIZE = 8;

GUWH.milestones = {
  clubGamesThisYear: 486,
  newPlayersThisYear: 41,
  friendsInvitedThisYear: 58,
  juniorsActive: 9,
  seniorsActive: 27,
};

GUWH.news = [
  { date: "2026-08-19", title: "Four teams building for finals month", body: "Numbers are up across both pools heading into September — if you've been on the fence about coming back, this is the month to do it." },
  { date: "2026-07-22", title: "New loan gear arrived", body: "Fresh set of junior fins and two new sticks added to the loan kit, thanks to a grant from the City of Greater Geelong." },
  { date: "2026-06-10", title: "Geelong players in new caps", body: "The club's new white and black playing caps are in and already being fought over on Wednesday nights." },
];

GUWH.testimonialFacts = [
  "Formed in the late 1970s by Geelong scuba divers looking for something to do over winter.",
  "In 1997 the combined Geelong/Wonthaggi juniors won the National titles in Canberra.",
  "Loan gear — including junior sizes — is available every week, no need to own a thing to start.",
];

// Helper: next Wednesday's date, formatted, from any reference date.
GUWH.nextWednesday = function (from) {
  const d = from ? new Date(from) : new Date();
  const day = d.getDay(); // 0 Sun ... 3 Wed ... 6 Sat
  let add = (3 - day + 7) % 7;
  if (add === 0) {
    // if it's already Wednesday, decide by time of day (before/after session)
    add = 7;
  }
  d.setDate(d.getDate() + add);
  d.setHours(0, 0, 0, 0);
  return d;
};

GUWH.formatDate = function (date) {
  return date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
};
