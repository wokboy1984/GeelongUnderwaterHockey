# Shared Codex and Claude Code workflow

Read CLAUDE.md before working on this project; it contains the site architecture and deployment instructions.

- Preserve existing uncommitted work. Inspect git status and relevant diffs before editing.
- Use one agent at a time in this checkout. For simultaneous work, use separate Git worktrees and coordinate changes before merging.
- Test changes locally before committing or pushing. Verify installed tools rather than relying on older environment notes; Node and npm were available on 12 September 2026.
- For significant completed changes, commit and push the intended changes, then verify the Netlify deployment, following the user's requested workflow. Do not include unrelated pending work.
- Before deployment, check netlify.toml against CLAUDE.md, including the production SPA redirect.
- End each work session with a handoff: what changed, tests run and their results, remaining issues, and whether anything was committed, pushed, or deployed.
