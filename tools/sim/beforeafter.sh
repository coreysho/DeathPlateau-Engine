#!/bin/bash
# Run one or more scenarios against the content at HEAD~1 and then at HEAD, rebuilding in between,
# so a fix can be shown rather than asserted.
#
#   CONTENT=../content tools/sim/beforeafter.sh drink drinkmove
set -e
CONTENT="${CONTENT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/../content}"
ENGINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCENARIOS="$*"

if [ ! -d "$CONTENT/scripts" ]; then
  echo "no content at $CONTENT - set CONTENT=/path/to/content" >&2
  exit 1
fi

# This script checks the content tree back and forth with `git checkout HEAD -- .`, which throws
# away anything uncommitted. Refuse rather than eat someone's work.
if [ -n "$(git -C "$CONTENT" status --porcelain)" ]; then
  echo "content tree at $CONTENT has uncommitted changes - commit or stash them first," >&2
  echo "this script checks it back and forth and would discard them." >&2
  exit 1
fi

build() { (cd "$ENGINE" && BUILD_VERIFY=false BUILD_SRC_DIR="$CONTENT" npx tsx tools/pack/Build.ts > /dev/null 2>&1); }
run() {
  for s in $SCENARIOS; do
    BUILD_SRC_DIR="$CONTENT" timeout 900 npx tsx "$ENGINE/tools/sim/run.ts" "$s" 2>&1 \
      | grep -v "INFO\|DEBUG\|Experimental\|trace-warnings\|^$" || true
  done
}

restore() { git -C "$CONTENT" checkout -q HEAD -- .; }
trap restore EXIT

echo "########## BEFORE (content at HEAD~1) ##########"
git -C "$CONTENT" checkout -q HEAD~1 -- .
build
run
echo
echo "########## AFTER (content at HEAD) ##########"
restore
build
run
