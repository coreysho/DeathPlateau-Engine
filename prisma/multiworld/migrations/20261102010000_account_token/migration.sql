-- CreateTable
-- A saved login on one computer. The client used to keep the player's own password on disk,
-- encrypted with a key any program on that machine could read; this is what it stores instead.
-- One row per computer, so one can be dropped without touching the rest, and deleting the row IS
-- the revocation.
CREATE TABLE `account_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `account_id` INTEGER NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_used` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires` DATETIME(3) NOT NULL,
    `uid` INTEGER NULL,
    `created_ip` VARCHAR(191) NULL,

    UNIQUE INDEX `account_token_token_hash_key`(`token_hash`),
    INDEX `account_token_account_id_idx`(`account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
