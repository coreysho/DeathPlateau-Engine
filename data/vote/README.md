# Switching vote claiming on

Nothing in this folder exists until you want it to. With no `sites.json`, the game has no voting
sites: the Vote clerk says so, `vote_claim` answers `^vote_claim_nosites`, and no part of it
pretends to check. Everything else - the ledger, the tickets, the one-way redeem, the shop - is
built and works today.

## What to do when you have picked a site

1. **Copy `sites.example.json` to `sites.json`** and fill in one entry per site. Every field is
   documented in the example. The `id` goes into the callback URL and into the ledger *for ever*:
   renaming it later starts that site's cooldowns and duplicate checks again from nothing.

2. **Put the secrets in the environment, not in the file.** Write `"env:VOTE_TOPG_KEY"` and set
   `VOTE_TOPG_KEY` where the world is started. A literal still works and the server will tell you
   off for it on every boot.

3. **Give the site whichever half it supports.** Most toplists do one, some do both:

   - **It calls us.** Give it `https://<your server>/vote/<id>/callback` as its callback,
     postback, or "vote check URL". Read its docs for what it names the secret, the player and the
     vote id, and put those names in `callback.secretParam`, `userParam` and `refParam`. GET or
     POST, query string or form body or JSON - all four work.
   - **We call it.** Fill in `check.url` with `{user}` and `{key}` where they go, and
     `check.success` with how to read a yes out of the answer. The player then claims by asking the
     Vote clerk.

4. **Restart the world.** The site list is read at boot. `Vote sites: topg, runelocus` in the log
   means it loaded; anything wrong with an entry is printed line by line and that entry is skipped.

## The reminder

A player who *could* vote right now and has not is told so in the chatbox, five minutes after
logging in and every half hour after that. A player who has voted is told nothing - which is the
point of doing it this way rather than broadcasting every vote: the message only ever goes to
somebody it is useful to. "Could vote right now" is read off the ledger, so it means at least one
site whose cooldown has run out for them.

With no sites configured the timer is never armed, so an unlisted server has no reminder at all.
The Vote clerk can turn it off and on again for a player, at the end of "Where can I vote?". Both
intervals are constants in `content/scripts/vote/configs/vote.constant`.

## Checking it without waiting for a real vote

`::vote` prints what the ledger knows about you - how many sites are configured, what you are owed,
and your last five credited votes. `::vote <username> [count]` credits a vote as the site `staff`,
which goes through the ledger like any other: it is in the audit trail, it is delivered the same
way, and it cannot be claimed twice.

`npx tsx tools/sim/voteclaim.ts` runs the whole thing against a toplist it starts on localhost, so
it exercises a real HTTP round trip with no site in the world.

## What is in here

- `sites.example.json` - the shape, with every field explained. Tracked.
- `sites.json` - yours. Not tracked.
- `<profile>.sqlite` - the ledger: every credited vote, and what each player is still owed. Not
  tracked, and not part of a player's save, because a vote can be credited while they are offline.
  Set `VOTE_LEDGER` to put it somewhere else entirely.

## If the ledger will not open

**Run `npm run vote:doctor` on the machine the world runs on.** It does what the engine does, in
the same order, and says what happened at each step: where it is running from, what it resolves the
ledger path to, what every directory on the way there is, whether a file can be made in that
directory at all, and then open / WAL / write / read. The first FAIL is the cause. It leaves the
ledger exactly as it found it.

The log says `vote: vote ledger <full path>: <what is wrong with it>`, and then that voting is off
until it is fixed. **Nothing else is affected**: logins, the clerk and the shop all carry on, a
player is told nothing is owed rather than being shown a script error, and a site's callback gets a
503 so it retries the vote rather than losing it.

SQLite reports a missing directory, a directory that is really a file, and a directory it may not
write in as one sentence - "unable to open database file" - so the line above works out which and
says so. The usual causes are the world running from a different directory than you think, and the
account the world runs as not being able to write under `data/`. WAL needs to create `<profile>
.sqlite-wal` and `-shm` beside the database, so read access to the file alone is not enough.

It is tried once per boot. Fix the path or the permissions - or point `VOTE_LEDGER` at somewhere
writable - and restart the world.

## Where the code is

- `src/engine/vote/VoteBook.ts` - the ledger, and why it is its own database
- `tools/vote/doctor.ts` - `npm run vote:doctor`, for when it will not open
- `src/engine/vote/VoteSites.ts` - this file's format, and what every field means
- `src/engine/vote/VoteService.ts` - both ways a vote arrives, and how it is handed over
- `src/engine/script/handlers/VoteOps.ts` - what content can ask
- `src/web.ts` - the callback route
- content `scripts/vote/` - the tickets, the points, the clerk, and `~vote_grant_tickets`, which is
  the only door for being given one
