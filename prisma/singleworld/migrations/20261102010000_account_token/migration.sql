-- CreateTable
-- A saved login on one computer. The client used to keep the player's own password on disk,
-- encrypted with a key any program on that machine could read; this is what it stores instead.
-- One row per computer, so one can be dropped without touching the rest, and deleting the row IS
-- the revocation.
CREATE TABLE "account_token" (
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
CREATE UNIQUE INDEX "account_token_token_hash_key" ON "account_token"("token_hash");

-- CreateIndex
CREATE INDEX "account_token_account_id_idx" ON "account_token"("account_id");
