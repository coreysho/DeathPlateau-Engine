-- CreateTable
-- How much of a session came from a person at a keyboard. One row as each session ends.
--
-- A bot driving the real client reports a cursor, clicks, camera turns and focus changes; a bot
-- speaking the protocol straight at the server reports none of them, because nothing is moving a
-- mouse to report. A high user_actions against a near-zero sum of the rest is the signal, and
-- neither half means anything alone - somebody standing in a bank moves no mouse either.
--
-- IF NOT EXISTS, as account_token's migration explains at length: the engine and a migration both
-- insisting on being first is what stopped a deploy dead with P3018.
CREATE TABLE IF NOT EXISTS "session_input" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_uuid" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "user_actions" INTEGER NOT NULL,
    "mouse_moves" INTEGER NOT NULL,
    "mouse_clicks" INTEGER NOT NULL,
    "camera_moves" INTEGER NOT NULL,
    "focus_changes" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "session_input_session_uuid_idx" ON "session_input"("session_uuid");
