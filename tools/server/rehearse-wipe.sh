#!/bin/sh
# Run the launch wipe against a COPY of the live data, and check what it did.
#
#   cd /opt/deathplateau/engine && sh tools/server/rehearse-wipe.sh
#
# WHY A REHEARSAL AT ALL. A wipe is the one thing this server does that cannot be undone, it is
# done once, and it is done on the day the most people are watching. Writing it is not the same as
# knowing it works: the first run of tools/server/wipe.ts against real-shaped data found two faults
# in it, one of which would have reported a collection log as cleared without clearing it.
#
# IT TOUCHES NOTHING LIVE. Everything is copied into a temporary directory and the wipe is run with
# that as its working directory, so every relative path it opens - db.sqlite, data/players,
# data/vote - is the copy. data/pack and data/config are symlinked rather than copied, because they
# are large and the wipe only reads them. The live server can stay up while this runs.
#
# THE COPY IS TAKEN WITH VACUUM INTO where sqlite3 exists, which is safe against a database being
# written to. A plain cp of a live sqlite file can catch it mid-write; the script says so and
# carries on, because a slightly torn copy still rehearses the wipe perfectly well.
#
# WHAT TO LOOK FOR at the end: accounts still there, hiscore and collection_log at zero, the
# trading post's board empty with only staff left holding a collection box, and the vote ledger
# owing people what they had. If the numbers are not what you expect, you have found
# out today rather than on launch day.
set -eu

ROOT=$(pwd)
PROFILE=${PROFILE:-main}

if [ ! -f "$ROOT/tools/server/wipe.ts" ]; then
    echo "rehearse: run this from the engine checkout (no tools/server/wipe.ts here)" >&2
    exit 1
fi
if [ ! -f "$ROOT/db.sqlite" ]; then
    echo "rehearse: no db.sqlite in $ROOT" >&2
    exit 1
fi

SANDBOX=$(mktemp -d /tmp/wipe-rehearsal.XXXXXX)
echo "==> rehearsing in $SANDBOX"

# A rehearsal that stops early is a rehearsal that did its job, so say so plainly rather than
# leaving a bare non-zero exit and a temporary directory nobody knows about. `set -e` means any
# step can be the last one.
on_exit() {
    status=$?
    if [ "$status" -ne 0 ]; then
        echo ""
        echo "==> stopped (exit $status). NOTHING LIVE WAS TOUCHED."
        echo "    the half-finished rehearsal is in $SANDBOX"
    fi
}
trap on_exit EXIT
mkdir -p "$SANDBOX/data/players/$PROFILE" "$SANDBOX/data/vote"

# ---------------------------------------------------------------- the copies
copy_db() {
    # $1 source, $2 destination
    if command -v sqlite3 > /dev/null 2>&1; then
        sqlite3 "$1" "VACUUM INTO '$2'"
    else
        echo "    (no sqlite3 - plain copy, which can catch a live database mid-write)"
        cp "$1" "$2"
    fi
}

echo "==> copying the database"
copy_db "$ROOT/db.sqlite" "$SANDBOX/db.sqlite"

if [ -f "$ROOT/data/vote/$PROFILE.sqlite" ]; then
    echo "==> copying the vote ledger"
    copy_db "$ROOT/data/vote/$PROFILE.sqlite" "$SANDBOX/data/vote/$PROFILE.sqlite"
else
    echo "==> no vote ledger to copy (tickets carried over will be 0)"
fi

# The trading post is its own database and the wipe clears it, so a rehearsal that leaves it out
# rehearses the wipe this script was written before.
if [ -f "$ROOT/data/tradingpost/$PROFILE.sqlite" ]; then
    echo "==> copying the trading post"
    mkdir -p "$SANDBOX/data/tradingpost"
    copy_db "$ROOT/data/tradingpost/$PROFILE.sqlite" "$SANDBOX/data/tradingpost/$PROFILE.sqlite"
else
    echo "==> no trading post database to copy (nothing has been listed on this world)"
fi

echo "==> copying the character saves"
if [ -d "$ROOT/data/players/$PROFILE" ]; then
    # A dot-glob-safe copy of the directory's contents, and quiet about an empty one.
    cp -r "$ROOT/data/players/$PROFILE/." "$SANDBOX/data/players/$PROFILE/" 2> /dev/null || true
fi
echo "    $(find "$SANDBOX/data/players/$PROFILE" -name '*.sav' | wc -l) saves"

# Read-only and large: linked, not copied.
ln -s "$ROOT/data/pack" "$SANDBOX/data/pack"
ln -s "$ROOT/data/config" "$SANDBOX/data/config"

# NOBODY IS LOGGED INTO A COPY. The wipe refuses while any account is online - rightly, because on
# the real thing the server would rewrite that player's save at logout and undo it. The copy has no
# server attached, so the flags it inherited are about the live world and are meaningless here.
# Clearing them is what lets this be rehearsed without taking the game down first.
echo "==> clearing inherited login flags in the copy"
(cd "$SANDBOX" && node -e '
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("db.sqlite");
const online = db.prepare("select count(*) n from account_login where logged_in != 0").get().n;
db.prepare("update account_login set logged_in = 0").run();
db.close();
console.log(`    ${online} were online on the live world`);
')

# ---------------------------------------------------------------- the rehearsal
# The sandbox has no node_modules, so the engine's own tsx is named outright. Node resolves the
# tool's "#/..." imports from the package.json next to the script, which is the engine's, so the
# tool loads exactly as it would in place - only its working directory differs.
echo "==> dry run"
(cd "$SANDBOX" && "$ROOT/node_modules/.bin/tsx" "$ROOT/tools/server/wipe.ts" --profile "$PROFILE" "$@")

echo ""
echo "==> the real thing, against the copy"
(cd "$SANDBOX" && "$ROOT/node_modules/.bin/tsx" "$ROOT/tools/server/wipe.ts" --profile "$PROFILE" --confirm "$@")

# ---------------------------------------------------------------- what it actually did
echo ""
echo "==> checking the result"
(cd "$SANDBOX" && node -e '
const { DatabaseSync } = require("node:sqlite");
const profile = process.argv[1];
const count = (db, table) => {
    try {
        return db.prepare(`select count(*) n from ${table}`).get().n;
    } catch {
        return "no table";
    }
};

const db = new DatabaseSync("db.sqlite");
const accounts = db.prepare("select count(*) n from account").get().n;
const staff = db.prepare("select count(*) n from account where staffmodlevel > 0").get().n;
console.log(`    accounts still there   ${accounts} (${staff} staff)`);
for (const table of ["hiscore", "hiscore_large", "collection_log", "friendlist", "ignorelist"]) {
    console.log(`    ${table.padEnd(22)} ${count(db, table)}`);
}
db.close();

const fs = require("fs");
const left = fs.existsSync(`data/players/${profile}`) ? fs.readdirSync(`data/players/${profile}`).filter(f => f.endsWith(".sav")).length : 0;
console.log(`    saves left in place    ${left}`);

const marketFile = `data/tradingpost/${profile}.sqlite`;
if (fs.existsSync(marketFile)) {
    const m = new DatabaseSync(marketFile);
    console.log(`    listings left          ${count(m, "listing")}`);
    console.log(`    offers left            ${count(m, "offer")}`);
    console.log(`    collection box rows    ${count(m, "collect")} (staff keep theirs)`);
    m.close();
}

const ledgerFile = `data/vote/${profile}.sqlite`;
if (fs.existsSync(ledgerFile)) {
    const v = new DatabaseSync(ledgerFile);
    let rows = [];
    try {
        rows = v.prepare("select username, tickets from owed order by tickets desc").all();
    } catch {
        rows = [];
    }
    console.log(`    players owed tickets   ${rows.length}`);
    for (const row of rows.slice(0, 10)) {
        console.log(`        ${row.username}: ${row.tickets}`);
    }
    v.close();
}
' "$PROFILE")

echo ""
echo "==> nothing live was touched. The rehearsal is in:"
echo "    $SANDBOX"
echo "    look round it, then: rm -rf $SANDBOX"
