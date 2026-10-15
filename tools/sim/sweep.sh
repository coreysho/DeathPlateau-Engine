#!/bin/bash
# Run every sim in tools/sim and classify what happened, one sim per process.
#
#   tools/sim/sweep.sh                 # the whole list, resuming if a previous run was interrupted
#   OUT=/tmp/mysweep tools/sim/sweep.sh
#   LIMIT=600 tools/sim/sweep.sh       # a shorter per-sim cap, for a quick pass
#
# Writes results.tsv (verdict, name, exit code, seconds, summary) and logs/<name>.log under $OUT.
#
# SEQUENTIALLY, AND THAT IS NOT NEGOTIABLE. The world is stateful - tools/sim/run.ts says so at the
# top of itself - and the sims also share data/ on disk (tradingpost, clans, config). The first
# version of this ran three at a time and reported five sims as aborting that passed perfectly well
# alone, which cost an afternoon of chasing failures that were the sweep's own fault.
#
# RESUMABLE: anything already in results.tsv is skipped, so a long sweep can be stopped for an
# urgent run and picked up again. Delete the row (or the file) to re-run a sim.
#
# AND A PASS IS ONE SAMPLE. Several of these sims depend on where a wandering npc happens to be, or
# on a click reaching far enough to need a walk, and they pass alone and fail here twenty minutes
# later. A sim that matters is worth running twice before it is called fixed.
#
# Verdicts:
#   PASS    a summary line with no failures
#   FAIL    a summary line with failures
#   ABORT   exited without ever printing a summary (an uncaught throw, or a silent death)
#   TIMEOUT killed at $LIMIT
#   NOSUM   a clean exit with no tally at all - the sims that print a report rather than checks
#           (multiway, the room dumps, the questrun playthroughs). Not a failure; listed so the
#           distinction stays visible.
set -u
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 1

OUT="${OUT:-/tmp/simsweep}"
# 3600 because audit1 reports 336 ok and takes about fifty minutes to do it: at 2400 it was killed
# mid-run and filed as a TIMEOUT with a clean tally sitting in its log.
LIMIT="${LIMIT:-3600}"
LOGS="$OUT/logs"
RESULTS="$OUT/results.tsv"
mkdir -p "$LOGS"
touch "$RESULTS"

# Libraries, and the three tools that take arguments or an env var. Run bare, each of those exits
# non-zero with a usage message - which is correct of them, and which the sweep can only read as an
# ABORT, so they are not sims as far as this is concerned:
#   run.ts <name>                           a scenario dispatcher
#   standable.ts <x>,<z>[,<level>]          a coordinate query
#   NODE_PRODUCTION=true staffrules.ts      the owner rules are about a live world
SKIP='^(a1lib|harness|ifunpack|questrun|scrollbars|run|standable|staffrules)\.ts$'

ls tools/sim/*.ts | xargs -n1 basename | grep -vE "$SKIP" | sort > "$OUT/simlist.txt"
echo "$(wc -l < "$OUT/simlist.txt") sims, cap ${LIMIT}s, into $OUT"

while read -r f; do
    name="${f%.ts}"
    if cut -f2 "$RESULTS" | grep -qxF "$name"; then continue; fi
    log="$LOGS/$name.log"
    start=$(date +%s)
    timeout -k 10 "$LIMIT" npx tsx "tools/sim/$f" > "$log" 2>&1
    rc=$?
    secs=$(( $(date +%s) - start ))
    # the summary each sim prints at the end, in any of the shapes used across the tree
    line=$(grep -oE "[0-9]+ (ok|passed|OK), [0-9]+ (FAIL|failed|fail)" "$log" | tail -1)
    [ -z "$line" ] && line=$(grep -oE "(PJTIMER +)?[0-9]+ ok, [0-9]+ failed" "$log" | tail -1)
    if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
        verdict=TIMEOUT
    elif [ -z "$line" ] && [ "$rc" -ne 0 ]; then
        verdict=ABORT
        line=$(grep -oE "^[A-Za-z]*Error:? .*" "$log" | head -1)
        [ -z "$line" ] && line=$(tail -3 "$log" | tr '\n' ' ')
    elif [ -z "$line" ]; then
        verdict=NOSUM
    else
        fails=$(echo "$line" | grep -oE "[0-9]+ (FAIL|failed|fail)" | grep -oE "^[0-9]+")
        if [ "${fails:-0}" -gt 0 ]; then verdict=FAIL; else verdict=PASS; fi
    fi
    printf "%s\t%s\t%s\t%s\t%s\n" "$verdict" "$name" "$rc" "${secs}s" "${line:-—}" >> "$RESULTS"
    printf "%-8s %-28s %-6s %s\n" "$verdict" "$name" "${secs}s" "${line:-no summary}"
done < "$OUT/simlist.txt"

echo
echo "=== TOTALS ==="
for v in PASS FAIL ABORT TIMEOUT NOSUM; do printf "%-8s %s\n" "$v" "$(grep -c "^$v	" "$RESULTS")"; done
echo
grep -vE "^(PASS|NOSUM)	" "$RESULTS" | cut -f1,2,4,5 || true
