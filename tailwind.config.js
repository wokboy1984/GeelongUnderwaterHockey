// Tailwind build for the live site (27 Oct 2026). Replaces the in-browser
// Play CDN: the CSS is compiled once, committed as tailwind.css, and served
// as a plain stylesheet, so there's still no build step on Netlify.
//
// After changing any Tailwind classes in index.html or js/, run
// `npm run build:css` and commit tailwind.css. CI fails if it's stale.
module.exports = {
  content: ["./index.html", "./js/**/*.js"],
  theme: { extend: {} },
  plugins: [],
};
