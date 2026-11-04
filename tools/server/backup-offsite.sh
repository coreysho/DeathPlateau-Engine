#!/bin/bash
# Everything that cannot be rebuilt, in one archive, on another machine.
#
# WHAT WAS ALREADY COVERED AND WHAT WAS NOT. backup-players.sh takes hourly hardlinked snapshots of
# data/players, and a cron job copied db.sqlite once a night. Between them that is the characters
# and the accounts - and nothing else, on the disk it is protecting:
#
#   data/tradingpost/main.sqlite   ITEMS PLAYERS HAVE LISTED. Player property, no backup at all.
#   data/clans/main.sqlite         clan membership. No backup at all.
#   data/vote/main.sqlite          the vote ledger. No backup at all.
#   data/config/login-rsa.pem      the login key. Its modulus is baked into every released
#                                  client, so losing it does not just lose a key - nobody can
#                                  log in until a new client ships.
#
# A lost character can come back from an hourly snapshot. A lost trading post cannot come back
# from anything.
#
# VACUUM INTO, NOT cp. Three of the four databases run in WAL mode, where the .sqlite file alone
# can be missing transactions that are committed and still sitting in the -wal beside it - so a cp
# of a live one is a backup that restores to the wrong state and says nothing about it. VACUUM INTO
# asks sqlite for a consistent copy instead, works on a read-only connection, and never touches the
# original. db.sqlite is journal_mode=delete rather than WAL and a cp of it is less dangerous, but
# still not atomic, so it goes the same way as the rest.
#
# node, because there is no sqlite3 binary on the game box and the engine's own runtime is already
# there. Nothing else is needed beyond coreutils, tar, and either rsync or scp - whichever the box
# happens to have, because it turned out to have only the second.
#
# THE ARCHIVE HOLDS A PRIVATE KEY, so it is written 0600 and the directory at each end is 0700.
# Treat a copy of it the way you would treat the key.
#
# Install, nightly, REPLACING the old db-only job:
#   crontab -e      # remove the /root/deathplateau-backup.sh line
#   cp tools/server/backup-offsite.sh /usr/local/bin/dp-backup-offsite
#   chmod +x /usr/local/bin/dp-backup-offsite
#   # 0 4 * * * /usr/local/bin/dp-backup-offsite >> /var/log/dp-backup.log 2>&1
#
# NOT >/dev/null 2>&1, which is what the job it replaces used. A backup that fails silently is
# worse than no backup, because you believe you have one. This exits non-zero and says why; the
# log is how you find out without watching.
#
# The off-site leg needs the game box to be able to ssh to the relay, once:
#   ssh-keygen -t ed25519 -N '' -f /root/.ssh/id_ed25519      # if there is no key yet
#   ssh-copy-id -i /root/.ssh/id_ed25519 root@10.8.0.1        # over the wireguard link
#   ssh root@10.8.0.1 'mkdir -p /var/backups/deathplateau && chmod 700 /var/backups/deathplateau'
#
# Paths and the destination come from the environment, so this can be exercised against a scratch
# tree and a scratch target without going near either live one:
#   DP_ROOT         the install            default /opt/deathplateau
#   DP_LOCAL_DIR    where archives land    default /var/backups/dp-offsite
#   DP_OFFSITE      rsync destination      default root@10.8.0.1:/var/backups/deathplateau
#   DP_KEEP         archives to retain     default 14, at both ends
#   DP_SKIP_OFFSITE set it to keep the archive local, for a dry run
#
# TO RESTORE, and this has been done rather than only written down. Stop the world first: the
# engine holds every character in memory and rewrites the saves at logout, so a restore under a
# running server is undone within the minute.
#
#   systemctl stop deathplateau
#   mkdir /tmp/r && tar xzf dp-<stamp>.tar.gz -C /tmp/r
#
#   # check what you are about to trust, BEFORE overwriting anything
#   for db in accounts tradingpost clans vote; do
#       node --disable-warning=ExperimentalWarning -e "
#           const {DatabaseSync}=require('node:sqlite');
#           const d=new DatabaseSync('/tmp/r/'+process.argv[1]+'.sqlite',{readOnly:true});
#           console.log(process.argv[1], Object.values(d.prepare('pragma integrity_check').get())[0]);
#       " $db
#   done
#
#   cp /tmp/r/accounts.sqlite    /opt/deathplateau/engine/db.sqlite
#   cp /tmp/r/tradingpost.sqlite /opt/deathplateau/engine/data/tradingpost/main.sqlite
#   cp /tmp/r/clans.sqlite       /opt/deathplateau/engine/data/clans/main.sqlite
#   cp /tmp/r/vote.sqlite        /opt/deathplateau/engine/data/vote/main.sqlite
#   rm -f /opt/deathplateau/engine/data/{tradingpost,clans,vote}/main.sqlite-wal \
#         /opt/deathplateau/engine/data/{tradingpost,clans,vote}/main.sqlite-shm
#   cp -a /tmp/r/players/. /opt/deathplateau/engine/data/players/
#   chown -R lostcity:lostcity /opt/deathplateau/engine/data
#   systemctl start deathplateau
#
# THE -wal AND -shm GO. A snapshot is already whole, and leaving the old write-ahead log beside a
# restored database is how you get the one state nobody has ever tested: half of yesterday on top
# of a file from last week.
#
# For ONE character, prefer backup-players.sh's hourly snapshots - they are finer grained and need
# no archive. This is for the day the machine is gone.
set -euo pipefail

ROOT=${DP_ROOT:-/opt/deathplateau}
ENGINE=$ROOT/engine
LOCAL=${DP_LOCAL_DIR:-/var/backups/dp-offsite}
OFFSITE=${DP_OFFSITE:-root@10.8.0.1:/var/backups/deathplateau}
KEEP=${DP_KEEP:-14}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

say() { printf '%s  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { say "FAILED: $*"; exit 1; }

[ -d "$ENGINE" ] || die "no engine at $ENGINE"

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$LOCAL"
chmod 700 "$LOCAL"

# ---- the databases, each as a consistent snapshot
snapshot() {
    src=$1
    name=$2
    [ -f "$src" ] || { say "skipping $name: $src is not there"; return 0; }

    # SINGLE quotes round the path, doubled inside. sqlite reads a double-quoted token as an
    # IDENTIFIER first, so JSON.stringify here asked it to vacuum into a column named after the
    # file and it said so: 'no such column - should this be a string literal in single-quotes?'
    # And stderr is not thrown away, because that is how this went unexplained the first time.
    node --disable-warning=ExperimentalWarning -e '
        const { DatabaseSync } = require("node:sqlite");
        const [src, out] = process.argv.slice(1);
        // read-only: a backup must not be able to change the thing it is backing up
        const db = new DatabaseSync(src, { readOnly: true });
        db.exec("vacuum into '"'"'" + out.replace(/'"'"'/g, "'"'"''"'"'") + "'"'"'");
        db.close();
    ' "$src" "$STAGE/$name" || die "could not snapshot $name from $src"

    say "snapshot $name ($(du -h "$STAGE/$name" | cut -f1))"
}

snapshot "$ENGINE/db.sqlite" accounts.sqlite
snapshot "$ENGINE/data/tradingpost/main.sqlite" tradingpost.sqlite
snapshot "$ENGINE/data/clans/main.sqlite" clans.sqlite
snapshot "$ENGINE/data/vote/main.sqlite" vote.sqlite

# ---- the characters, and the key without which no client can log in
if [ -d "$ENGINE/data/players" ]; then
    cp -a "$ENGINE/data/players" "$STAGE/players"
    say "players ($(find "$STAGE/players" -name '*.sav' | wc -l) saves)"
else
    die "no $ENGINE/data/players - refusing to write a backup without the characters in it"
fi

if [ -f "$ENGINE/data/config/login-rsa.pem" ]; then
    cp -a "$ENGINE/data/config/login-rsa.pem" "$STAGE/login-rsa.pem"
    say "login key included - this archive is a secret"
else
    say "WARNING: no login-rsa.pem to include"
fi

# ---- one archive, readable only by root
ARCHIVE=$LOCAL/dp-$STAMP.tar.gz
tar czf "$ARCHIVE" -C "$STAGE" . || die "could not write $ARCHIVE"
chmod 600 "$ARCHIVE"
say "wrote $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# ---- and off the machine, which is the whole point
if [ -n "${DP_SKIP_OFFSITE:-}" ]; then
    say "DP_SKIP_OFFSITE set - the archive stays here"
else
    # EITHER TOOL, because the game box had neither rsync nor a reason to: openssh is already
    # there for the tunnel's sake and scp -p carries the 0600 across, which is the only thing
    # rsync was being asked for on a single 500K file. The first run of this died on
    # 'rsync: command not found' with the archive written and nothing sent.
    if command -v rsync >/dev/null 2>&1; then
        rsync -q --chmod=F600 "$ARCHIVE" "$OFFSITE/" || die "the archive is written locally but did NOT reach $OFFSITE"
    elif command -v scp >/dev/null 2>&1; then
        scp -q -p "$ARCHIVE" "$OFFSITE/" || die "the archive is written locally but did NOT reach $OFFSITE"
    else
        die "neither rsync nor scp is installed - the archive is written locally and went nowhere"
    fi
    say "sent to $OFFSITE"

    # retention at the far end, where nothing else is going to do it
    remote_host=${OFFSITE%%:*}
    remote_dir=${OFFSITE#*:}
    ssh "$remote_host" "cd '$remote_dir' && ls -t dp-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --" \
        || say "WARNING: could not prune old archives on $remote_host"
fi

# ---- and here
cd "$LOCAL" && ls -t dp-*.tar.gz | tail -n +$((KEEP + 1)) | xargs -r rm --
say "done, keeping $KEEP archive(s) at each end"
