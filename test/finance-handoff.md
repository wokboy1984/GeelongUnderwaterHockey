# Finance handoff — 12 September 2026

Implemented a dedicated /api/finance endpoint and replaced the Finance placeholder with monthly per-player balances, CSV export, account setup, attendance charges, explicit joining/annual fees, and full/partial receipts. Permission checks use manage_finances on the server. All entries retain the recording actor and timestamp. Account classification is explicit, not inferred from members.is_new.

Local migrations 20260912000009_finance and 20260912000010_actual_attendance have been applied. Arithmetic, permissions and isolated PGlite tests passed (Melbourne date, allowed attendance roles, three free trial sessions, normal fees, partial receipts, retry deduplication). JavaScript/TypeScript syntax checks passed. Both APIs return 401 when unauthenticated. Authenticated browser testing confirmed that the Attendance list and Treasurer report load successfully; no attendance or payment data was changed during testing.

Integration still needed: the Try Underwater Hockey form currently saves demo data, so the Treasurer records enrolment evidence manually. Game fees are now derived automatically from actual check-ins on the separate Game Coordination Attendance tab; bookings are never charged. Monthly reports are in-app/CSV; no automatic email delivery exists. No correction/reversal interface or account reclassification interface yet; do not use for production money records until those controls are complete.

No commit, push, or deployment performed. Existing coordinator/app/netlify.toml changes were preserved. Keep finance changes separate from that work. Production SPA redirect remains commented out by the pre-existing local setup.
