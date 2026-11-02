// NEW PLAYERS START IN THE HELP CHANNEL, AND LEAVING IT STICKS.
// Usage: npx tsx tools/sim/helpclan.ts   (exit code is the verdict)
//
// The two halves pull against each other. An explicit leave DELETES the last_channel row, so "no
// row" means both "never joined anything" and "left on purpose" - and an auto-join that keys on
// that alone puts a leaver straight back in at their next login, which is the one thing this must
// not do. help_seeded is the separate mark that tells the two apart, so both halves are asserted
// here: the first login joins, and every login after a leave does not.
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import ClanChat from '#/engine/clan/ClanChat.js';
import Environment from '#/util/Environment.js';
import { DatabaseSync } from 'node:sqlite';

await H.boot();

// Names nobody will have: the db rows these make are removed at the end.
const tag = 'hcsim' + (Date.now() % 100000);
const made: string[] = [];
const fresh = (suffix: string) => {
    const name = tag + suffix;
    made.push(name);
    return H.makePlayer(name, 3222, 3218) as unknown as { username: string; clanOwner: string | null };
};
const owner = (p: { clanOwner: string | null }) => p.clanOwner ?? 'none';

console.log('== a brand new player lands in Help');
const a = fresh('a');
ClanChat.onLogin(a as never);
check('first login puts them in the help channel', owner(a), 'help');

console.log('\n== and leaving it sticks across logins');
{
    ClanChat.leave(a as never, true, true); // forget: an explicit leave, the Leave Chat button
    check('they are out', owner(a), 'none');
    ClanChat.onLogin(a as never);
    check('a relog does NOT put them back', owner(a), 'none');
    ClanChat.onLogin(a as never);
    check('and neither does the one after that', owner(a), 'none');
}

console.log('\n== but they can walk back in themselves');
{
    ClanChat.join(a as never, 'help');
    check('typing the name works', owner(a), 'help');
    ClanChat.onLogin(a as never);
    check('and now a relog keeps them there, like any channel', owner(a), 'help');
}

console.log("\n== a player who is in someone else's channel is not dragged into Help");
{
    const b = fresh('b');
    ClanChat.onLogin(b as never);
    check('b starts in Help like everyone', owner(b), 'help');
    // Give b a channel of their own and join it: last_channel now points there.
    ClanChat.setName(b as never, 'Bees');
    ClanChat.join(b as never, b.username);
    check('b moves to their own channel', owner(b), b.username);
    ClanChat.onLogin(b as never);
    check('and a relog returns them to it, not to Help', owner(b), b.username);
}

console.log('\n== the channel is open to anyone and owned by nobody');
{
    const c = fresh('c');
    ClanChat.onLogin(c as never);
    check('c gets in with no rank at all', owner(c), 'help');
    check('  and is not its owner', c.username === 'help', false);
}

// Leave the clan database as it was found. Done here with SQL rather than through a test-only
// method on ClanChat: a sim should not add surface to the thing it is testing.
{
    const db = new DatabaseSync(`data/clans/${Environment.NODE_PROFILE}.sqlite`);
    for (const name of made) {
        db.prepare('DELETE FROM last_channel WHERE player = ?').run(name);
        db.prepare('DELETE FROM help_seeded WHERE player = ?').run(name);
        db.prepare('DELETE FROM channel WHERE owner = ?').run(name);
    }
    db.close();
    console.log(`cleaned up ${made.length} test players`);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
