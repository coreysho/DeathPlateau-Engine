-- CreateTable
-- A saved login on one computer. The client used to keep the player's own password on disk,
-- encrypted with a key any program on that machine could read; this is what it stores instead.
-- One row per computer, so one can be dropped without touching the rest, and deleting the row IS
-- the revocation.
--
-- IF NOT EXISTS, WHICH PRISMA DID NOT WRITE AND WHICH MATTERS. LoginToken.ensureTable creates this
-- same table at startup on the sqlite path - it had to, because until the deploy script learned to
-- run migrations a missing table meant every login failing at its first query. The two met on the
-- live world the first time the deploy did migrate: P3018, `table "account_token" already exists`,
-- and a deploy stopped dead. The engine's CREATE and this one are identical down to the index
-- names (tools/sim/logintokens.ts asserts they produce the same schema), so the only thing wrong
-- was that both insisted on being first. Either order works now.
CREATE TABLE IF NOT EXISTS "account_token" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires" DATETIME NOT NULL,
    "uid" INTEGER,
    "created_ip" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "account_token_token_hash_key" ON "account_token"("token_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "account_token_account_id_idx" ON "account_token"("account_id");
