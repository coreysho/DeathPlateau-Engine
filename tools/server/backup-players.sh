#!/bin/sh
# Rotating snapshots of data/players - the only copy of every character.
#
# The engine overwrites <username>.sav on every autosave and again at logout, so a
# character that dies, gets scammed or ends up corrupted has no earlier state anywhere
# on disk to go back to. account.ts writes a <username>.sav.bak-<timestamp> only when
# account.ts is itself the thing making the change, which is no help when the server is
# the one that wrote the state you want rid of. This fills that gap.
#
# Each run makes one snapshot directory named for the UTC time it was taken. A save
# whose contents match the previous snapshot is hardlinked to it rather than copied, so
# an idle character costs one directory entry and no data - three days of hourly
# snapshots of a few hundred accounts comes to a few megabytes.
#
# Nothing here is needed beyond coreutils: no rsync, no tar, no perl. A stock Debian or
# Alpine container runs it as-is.
#
# Install, hourly:
#   cp tools/server/backup-players.sh /etc/cron.hourly/dp-backup-players
#   chmod +x /etc/cron.hourly/dp-backup-players
#
# run-parts ignores any filename containing a dot, which is why the installed copy drops
# the .sh. Check it took with: run-parts --test /etc/cron.hourly
#
# Paths come from the environment, so this can be exercised against a scratch tree
# without going near the live one:
#   DP_PLAYERS_DIR   what to back up      default /opt/deathplateau/engine/data/players
#   DP_BACKUP_DIR    where to put it      default /var/backups/dp-players
#   DP_BACKUP_KEEP   snapshots to retain  default 72  (three days of hourly)
#
# To restore one character, with that player LOGGED OUT - the server holds the character
# in memory and rewrites the save at logout, so a restore under a live login is undone
# within the minute:
#   ls /var/backups/dp-players
#   cp /var/backups/dp-players/<snapshot>/main/<username>.sav \
#      /opt/deathplateau/engine/data/players/main/<username>.sav
#
# One caveat worth knowing: a save being written at the moment the snapshot runs can be
# captured half-written. The snapshot before it is still intact, which is why the
# retention is days and not hours.

set -eu

SRC="${DP_PLAYERS_DIR:-/opt/deathplateau/engine/data/players}"
DEST="${DP_BACKUP_DIR:-/var/backups/dp-players}"
KEEP="${DP_BACKUP_KEEP:-72}"

if [ ! -d "$SRC" ]; then
    echo "backup-players: no player directory at $SRC" >&2
    exit 1
fi

mkdir -p "$DEST"

snapshots() {
    # Our own directories only - never a stray file, and never an .incoming- left behind
    # by a run that was killed partway.
    ls -1 "$DEST" 2>/dev/null | grep -E '^[0-9]{8}T[0-9]{6}Z$' | sort
}

stamp=$(date -u +%Y%m%dT%H%M%SZ)
prev=$(snapshots | tail -n 1)
inc="$DEST/.incoming-$stamp"

rm -rf "$inc"
mkdir -p "$inc"

# Built up in an empty directory one file at a time, either as a hardlink to the
# previous snapshot or as a fresh copy. Nothing is ever written through an existing
# hardlink, so no snapshot can alter the one before it.
find "$SRC" -type f -print | while read -r src_file; do
    rel=${src_file#"$SRC"/}
    dst="$inc/$rel"

    dir=$(dirname "$dst")
    [ -d "$dir" ] || mkdir -p "$dir"

    if [ -n "$prev" ] && [ -f "$DEST/$prev/$rel" ] && cmp -s "$src_file" "$DEST/$prev/$rel"; then
        ln "$DEST/$prev/$rel" "$dst"
    else
        cp -p "$src_file" "$dst"
    fi
done

# Renamed only once the snapshot is complete, so a snapshot never appears under its
# final name half-built - which matters because the next run hardlinks against it.
mv "$inc" "$DEST/$stamp"

find "$DEST" -maxdepth 1 -type d -name '.incoming-*' -mmin +120 -exec rm -rf {} + 2>/dev/null || true

# Everything except the newest KEEP, oldest first. Counted and cut with sed rather than
# `head -n -KEEP`, which is a GNU extension BusyBox does not have.
total=$(snapshots | wc -l)
if [ "$total" -gt "$KEEP" ]; then
    snapshots | sed -n "1,$((total - KEEP))p" | while read -r old; do
        [ -n "$old" ] && rm -rf "${DEST:?}/$old"
    done
fi
