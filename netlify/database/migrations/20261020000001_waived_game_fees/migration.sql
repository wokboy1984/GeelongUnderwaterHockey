-- Waiving an automatic game fee (20 Oct 2026).
--
-- Game fees aren't stored records: they're derived from session_attendance,
-- so there was nothing to delete and the only way to clear one was to
-- untick the player's attendance. That made the roll lie about who turned
-- up in order to fix a billing decision.
--
-- This separates the two. Attendance keeps saying she was there; a row
-- here says the club decided not to charge her for it. The fee then
-- renders at $0 marked "fee waived", and deleting the row restores it.
--
-- Keyed on the member who ATTENDED (not the payer), because that's what
-- identifies the attendance row. A child's fee bills to their parent, but
-- the waiver belongs to the child's attendance.
create table if not exists finance_waived_games (
  member_id text not null references members(id) on delete cascade,
  session_date date not null,
  reason text,
  waived_by text references members(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (member_id, session_date)
);
