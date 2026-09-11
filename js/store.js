// ---------------------------------------------------------------------------
// GUWH concept — client-side store
// Everything here is a stand-in for a future backend. Persistence is
// localStorage; auth is a fixed pair of demo accounts; "publishing" the game
// board just flips a flag other views read. Swap STORAGE for real API calls
// later without touching the components that call these functions.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};

(function () {
  const KEY = "guwh-concept-v1";
  const listeners = new Set();

  function defaultState() {
    const wed = GUWH.nextWednesday();
    return {
      auth: { loggedIn: false, role: null, playerId: null }, // role: 'player' | 'organiser'
      profile: {
        p01: { photoEmoji: "🤿" }, // per-player overrides (photo placeholder, edits)
      },
      bookings: {
        // playerId -> { in: true/false, respondedAt }
        // seed most of the regular roster as "in" for a lively demo board
      },
      guestBookings: [], // new-player / bring-a-mate signups: {id, firstName, lastName, ...}
      invites: [], // bring-a-mate invites sent: {id, friendName, sentAt, status}
      adHocPlayers: [], // players added on the fly by an organiser (new players, bring-a-mate guests turned up)
      gameBoard: {
        published: true,
        weekOf: wed.toISOString(),
        pools: {
          "Pool A": { matchTime: "6:15pm", white: [], black: [] },
          "Pool B": { matchTime: "6:15pm", white: [], black: [] },
        },
        referees: [GUWH.referees[0], GUWH.referees[1]],
        socialPlan: GUWH.socialPlan,
      },
    };
  }

  function seedBookingsAndBoard(state) {
    // Seed bookings: everyone except a couple of players is "in" this week.
    GUWH.players.forEach((p, i) => {
      const skip = i === 34; // Anika sits this week out, for a realistic "not everyone" feel
      state.bookings[p.id] = { in: !skip, respondedAt: new Date().toISOString() };
    });

    // Seed a plausible team split across two pools using lastWeekTeam as a hint.
    const pools = state.gameBoard.pools;
    const buckets = {
      "Pool A|White": [], "Pool A|Black": [],
      "Pool B|White": [], "Pool B|Black": [],
    };
    const overflow = [];
    GUWH.players.forEach((p) => {
      if (!state.bookings[p.id].in) return;
      const key = p.lastWeekTeam;
      if (key && buckets[key.replace(" / ", "|")]) {
        buckets[key.replace(" / ", "|")].push(p.id);
      } else {
        overflow.push(p.id);
      }
    });
    // Distribute overflow (new players, bring-a-mate guests) evenly.
    const bucketKeys = Object.keys(buckets);
    overflow.forEach((id, i) => buckets[bucketKeys[i % 4]].push(id));

    pools["Pool A"].white = buckets["Pool A|White"];
    pools["Pool A"].black = buckets["Pool A|Black"];
    pools["Pool B"].white = buckets["Pool B|White"];
    pools["Pool B"].black = buckets["Pool B|Black"];

    return state;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Roll the "week of" forward if we've crossed into a new week, so the
        // demo always feels current no matter when it's opened.
        const storedWed = new Date(parsed.gameBoard.weekOf);
        const freshWed = GUWH.nextWednesday();
        if (storedWed.getTime() !== freshWed.getTime() && Date.now() > storedWed.getTime() + 12 * 3600 * 1000) {
          const fresh = seedBookingsAndBoard(defaultState());
          save(fresh);
          return fresh;
        }
        return parsed;
      }
    } catch (e) {
      console.warn("GUWH store: failed to read localStorage, reseeding.", e);
    }
    const fresh = seedBookingsAndBoard(defaultState());
    save(fresh);
    return fresh;
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("GUWH store: failed to write localStorage.", e);
    }
  }

  let state = load();

  function notify() {
    listeners.forEach((fn) => fn(state));
  }

  const Store = {
    getState() {
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    update(mutator) {
      mutator(state);
      save(state);
      notify();
    },
    reset() {
      state = seedBookingsAndBoard(defaultState());
      save(state);
      notify();
    },

    // ---- auth (demo only — two fixed accounts) ----
    login(role) {
      this.update((s) => {
        s.auth = { loggedIn: true, role, playerId: role === "player" ? "p01" : "p31" };
      });
    },
    logout() {
      this.update((s) => {
        s.auth = { loggedIn: false, role: null, playerId: null };
      });
    },
    currentPlayer() {
      const id = state.auth.playerId;
      return GUWH.players.find((p) => p.id === id) || null;
    },

    // ---- combined roster (static mock roster + anyone an organiser has added on the fly) ----
    allPlayers() {
      return GUWH.players.concat(state.adHocPlayers);
    },
    findPlayer(id) {
      return GUWH.players.find((p) => p.id === id) || state.adHocPlayers.find((p) => p.id === id) || null;
    },
    addAdHocPlayer({ firstName, lastName, grade = "B-grade", position = "Midfield", age = "", tag }) {
      const rec = {
        id: "adhoc-" + Date.now() + "-" + Math.round(Math.random() * 999),
        firstName, lastName, age, grade, position,
        handed: "Right", finSize: "", lastWeekTeam: null, gamesThisYear: 0,
        isNew: true, tag, // tag: 'new-player' | 'bring-a-mate'
      };
      this.update((s) => s.adHocPlayers.push(rec));
      this.setBooking(rec.id, true);
      return rec;
    },
    removeAdHocPlayer(id) {
      this.update((s) => {
        s.adHocPlayers = s.adHocPlayers.filter((p) => p.id !== id);
        delete s.bookings[id];
        Object.values(s.gameBoard.pools).forEach((pool) => {
          pool.white = pool.white.filter((pid) => pid !== id);
          pool.black = pool.black.filter((pid) => pid !== id);
        });
      });
    },
    unassignPlayer(playerId) {
      this.update((s) => {
        Object.values(s.gameBoard.pools).forEach((pool) => {
          pool.white = pool.white.filter((id) => id !== playerId);
          pool.black = pool.black.filter((id) => id !== playerId);
        });
      });
    },

    // ---- bookings ----
    setBooking(playerId, isIn) {
      this.update((s) => {
        s.bookings[playerId] = { in: isIn, respondedAt: new Date().toISOString() };
      });
    },
    bookingFor(playerId) {
      return state.bookings[playerId] || { in: false, respondedAt: null };
    },
    confirmedPlayerIds() {
      return Object.keys(state.bookings).filter((id) => state.bookings[id].in);
    },

    // ---- new-player / guest bookings ----
    addGuestBooking(guest) {
      const rec = Object.assign({ id: "guest-" + Date.now() }, guest);
      this.update((s) => s.guestBookings.push(rec));
      return rec;
    },

    // ---- bring a mate ----
    addInvite(friendName, contact) {
      const rec = { id: "inv-" + Date.now(), friendName, contact, sentAt: new Date().toISOString(), status: "sent" };
      this.update((s) => s.invites.push(rec));
      return rec;
    },
    markInviteRegistered(id) {
      this.update((s) => {
        const inv = s.invites.find((i) => i.id === id);
        if (inv) inv.status = "registered";
      });
    },

    // ---- profile ----
    updateProfile(playerId, patch) {
      this.update((s) => {
        s.profile[playerId] = Object.assign({}, s.profile[playerId], patch);
      });
    },
    profileFor(playerId) {
      return state.profile[playerId] || {};
    },

    // ---- organiser: team builder ----
    movePlayer(playerId, toPool, toCap) {
      this.update((s) => {
        Object.keys(s.gameBoard.pools).forEach((poolName) => {
          const pool = s.gameBoard.pools[poolName];
          pool.white = pool.white.filter((id) => id !== playerId);
          pool.black = pool.black.filter((id) => id !== playerId);
        });
        const pool = s.gameBoard.pools[toPool];
        if (toCap === "White") pool.white.push(playerId);
        else pool.black.push(playerId);
      });
    },
    setReferees(refs) {
      this.update((s) => (s.gameBoard.referees = refs));
    },
    setSocialPlan(text) {
      this.update((s) => (s.gameBoard.socialPlan = text));
    },
    setMatchTime(poolName, time) {
      this.update((s) => (s.gameBoard.pools[poolName].matchTime = time));
    },
    publishBoard(isPublished) {
      this.update((s) => (s.gameBoard.published = isPublished));
    },
    unassignedConfirmed() {
      const assigned = new Set();
      Object.values(state.gameBoard.pools).forEach((pool) => {
        pool.white.forEach((id) => assigned.add(id));
        pool.black.forEach((id) => assigned.add(id));
      });
      return this.confirmedPlayerIds().filter((id) => !assigned.has(id));
    },

    // ---- suggest balanced teams (lightweight heuristic, never destructive
    // until the organiser accepts — it just re-runs movePlayer for confirmed
    // players and returns a short explanation). ----
    suggestBalancedTeams() {
      const weight = { "A-grade": 3, "B-grade": 2, Junior: 1 };
      const self = this;
      const confirmed = this.confirmedPlayerIds()
        .map((id) => self.findPlayer(id))
        .filter(Boolean);

      // Sort strongest-first, then snake-draft across 4 buckets so grade and
      // position spread evenly, keeping last week's pool as a light tiebreaker.
      const sorted = confirmed.slice().sort((a, b) => weight[b.grade] - weight[a.grade]);
      const bucketNames = ["Pool A|White", "Pool A|Black", "Pool B|White", "Pool B|Black"];
      const buckets = { "Pool A|White": [], "Pool A|Black": [], "Pool B|White": [], "Pool B|Black": [] };
      let dir = 1, i = 0;
      sorted.forEach((p) => {
        buckets[bucketNames[i]].push(p.id);
        i += dir;
        if (i === bucketNames.length) { i = bucketNames.length - 1; dir = -1; }
        if (i === -1) { i = 0; dir = 1; }
      });

      this.update((s) => {
        s.gameBoard.pools["Pool A"].white = buckets["Pool A|White"];
        s.gameBoard.pools["Pool A"].black = buckets["Pool A|Black"];
        s.gameBoard.pools["Pool B"].white = buckets["Pool B|White"];
        s.gameBoard.pools["Pool B"].black = buckets["Pool B|Black"];
      });

      const gradeCounts = (ids) => {
        const c = { "A-grade": 0, "B-grade": 0, Junior: 0 };
        ids.forEach((id) => c[self.findPlayer(id).grade]++);
        return c;
      };
      return {
        explanation:
          "Snake-drafted by grade (A-grade first) so each of the four teams gets a similar mix of experience, then filled out to keep numbers even.",
        breakdown: bucketNames.map((k) => ({ team: k.replace("|", " / "), counts: gradeCounts(buckets[k]), total: buckets[k].length })),
      };
    },
  };

  GUWH.Store = Store;
})();
