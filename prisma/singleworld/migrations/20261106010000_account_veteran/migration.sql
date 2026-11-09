-- AlterTable
-- custom (2026-11-06) - the Veteran rank, for the players who tested before launch. A flag of its
-- own rather than a staffmodlevel: every rank check in the engine and content reads "at least", so
-- a veteran sharing that column would quietly pass the player-moderator checks.
--
-- It is on the account and not in the character save because the launch wipe moves saves away and
-- keeps accounts. A perm varp would have been less work and would have deleted every veteran at
-- launch.
ALTER TABLE "account" ADD COLUMN "veteran" INTEGER NOT NULL DEFAULT 0;
