-- CreateTable
-- WHICH ITEMS A PLAYER HAS IN THEIR COLLECTION LOG, one row per item.
--
-- The log itself is a permanent inventory in the save (content collection_log.inv): one slot per
-- distinct item ever obtained, the slot's count being how many. The hiscore table already carries
-- how FAR along somebody is, as a single number, because that is a figure you can rank. Which
-- items is not a figure - it is a set 803 wide - so it goes here instead of being bit-packed into
-- a column or written as a blob nothing can query.
--
-- REWRITTEN WHOLE AT EACH LOGOUT, not merged. The inventory in the save is the truth and this is a
-- copy of it; working out a difference would mean trusting that nothing had ever written a row
-- this table should not have, which is exactly the kind of drift a copy cannot develop.
--
-- IF NOT EXISTS, following account_token's lesson: a deploy that migrates and an engine that
-- creates should not be able to deadlock over who was first.
CREATE TABLE IF NOT EXISTS "collection_log" (
    "profile" TEXT NOT NULL DEFAULT 'main',
    "account_id" INTEGER NOT NULL,
    "obj" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,

    PRIMARY KEY ("profile", "account_id", "obj")
);

-- CreateIndex
-- The only query the website makes: everything one account has, on one page.
CREATE INDEX IF NOT EXISTS "collection_log_account_idx" ON "collection_log"("profile", "account_id");
