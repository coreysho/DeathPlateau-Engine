-- AlterTable
-- custom (2026-11-11) - the Helper rank: a player who answers other players' questions. A flag of
-- its own for the same reason the veteran column is one - every rank check in the engine and
-- content reads "at least", so a helper sharing staffmodlevel would quietly pass the
-- player-moderator checks and be handed the mute option.
--
-- A helper has NO powers at all. That is the point of the rank rather than a limitation of it: it
-- can be given out freely and taken back without consequence, and there is nothing to misuse.
ALTER TABLE `account` ADD COLUMN `helper` INTEGER NOT NULL DEFAULT 0;
