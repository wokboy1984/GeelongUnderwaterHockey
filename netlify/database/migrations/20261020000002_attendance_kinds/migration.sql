-- What someone is coming for (20 Oct 2026).
--
-- Not everyone who turns up on a Wednesday is playing: some lane swim
-- ($10 flat), some volunteer (free, and may referee). Until now there was
-- one idea of attendance, so swimmers were charged a full game fee,
-- volunteers were charged for nothing, and both landed in the Game
-- Coordinator's team builder.
--
-- Recorded in two places on purpose. `bookings` is what the member said
-- they'd do; `session_attendance` is what the coordinator ticked on the
-- night, and that is what fees are computed from. A kind held only
-- against the booking would be lost the moment the roll was taken, and
-- people do turn up and do something other than what they said.
--
-- Defaulting to 'player' means every row that predates this keeps exactly
-- the meaning it had, and any code path that forgets to set a kind books
-- someone in to play rather than quietly making them free.
alter table bookings add column if not exists kind text not null default 'player';
alter table session_attendance add column if not exists kind text not null default 'player';
