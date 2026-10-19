// ---------------------------------------------------------------------------
// GUWH concept — shared helpers available to every later script.
// `h` and `cx` are declared once here as top-level const/let bindings; classic
// (non-module) <script> tags share one lexical scope, so later scripts can
// reference them directly without importing anything.
// ---------------------------------------------------------------------------
const h = React.createElement;

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function initials(firstName, lastName) {
  return firstName + " " + (lastName ? lastName[0] + "." : "");
}

function playerPhotoEmoji(playerId) {
  const overrides = { p31: "🧑‍🦱" };
  const profile = (window.GUWH && GUWH.Store) ? GUWH.Store.profileFor(playerId) : {};
  return profile.photoEmoji || overrides[playerId] || "🏊";
}

// Local (not UTC) YYYY-MM-DD, suitable for <input type="date"> values.
// date.toISOString().slice(0,10) is wrong here: it converts to UTC first,
// which silently shifts the date back a day in any UTC+ timezone.
function toLocalDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function formatMoney(n) {
  return "$" + n.toFixed(2).replace(/\.00$/, "");
}

// Simple Web Share API wrapper with clipboard fallback. Returns a promise
// resolving to "shared" | "copied" | "failed".
async function shareOrCopy({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (e) {
      // user cancelled or share failed — fall through to copy
    }
  }
  try {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    return "copied";
  } catch (e) {
    return "failed";
  }
}

// ---------------------------------------------------------------------------
// "Which team am I on, and which sticks am I playing?" (20 Oct 2026)
// Derived from a /api/game-board payload rather than asked for separately,
// so the Dashboard, Profile and This Week's Game all agree. Works the same
// on a published board and an unpublished draft — the caller decides how to
// label it, these two only read what's there.
// ---------------------------------------------------------------------------

// The member's team for that board, or null if they haven't been assigned.
function myTeamFor(board, memberId) {
  if (!board || !memberId || !Array.isArray(board.teams)) return null;
  return board.teams.find((t) => (t.players || []).some((p) => p.id === memberId)) || null;
}

// Every game that team plays, with the stick colour they wear for it.
// Returns [{ pool, colour: "black" | "white", colourLabel, startMin }].
// Teams can switch colour between games, so this is per game, never per
// night. A game the team isn't in simply doesn't appear.
function myGameColours(board, team) {
  if (!board || !team || !Array.isArray(board.rows)) return [];
  const out = [];
  board.rows.forEach((row) => {
    if (!row || !row.isGame) return;
    (row.poolGames || []).forEach((pg) => {
      const colour = pg.blackTeamName === team.name ? "black" : pg.whiteTeamName === team.name ? "white" : null;
      if (!colour) return;
      out.push({
        pool: pg.pool,
        colour,
        colourLabel: colour === "black" ? "Black sticks" : "White sticks",
        startMin: row.startMin,
      });
    });
  });
  return out;
}
