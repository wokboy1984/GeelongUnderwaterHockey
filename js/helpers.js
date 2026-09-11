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
