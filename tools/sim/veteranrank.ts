// ::veteran - the Veteran rank, from the command to the account row and back to the chat icon.
//
// THE PART WORTH TESTING IS THE ROUND TRIP, and it is the part nothing else checks. The command
// posts a message to the login worker, the worker writes the account table and posts a reply, and
// World turns the reply into a crown. Every hop is a string literal in an `any`-typed message, so
// the compiler is no help at all: one typo and the command says "granting..." for ever and nothing
// happens. So this runs the real worker against the real database rather than stubbing either.
//
// It makes its own account rows, named so they cannot collide with anybody's, and deletes them at
// the end - including when an assertion fails, or a failed run would leave them behind.
//
//   npx tsx tools/sim/veteranrank.ts
import { DatabaseSync } from 'node:sqlite';

import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import { chatCrown } from '#/engine/entity/ChatCrown.js';
import { toSafeName } from '#/util/JString.js';

const TARGET = 'vetsim_tgt';
const MISSING = 'vetsim_none';
const db = new DatabaseSync('db.sqlite');

function cleanup() {
    db.prepare("DELETE FROM account WHERE username LIKE 'vetsim\\_%' ESCAPE '\\'").run();
}

function veteranOf(username: string): number | null {
    const row = db.prepare('SELECT veteran FROM account WHERE username = ?').get(toSafeName(username)) as { veteran: number } | undefined;
    return row ? row.veteran : null;
}

/** Wait for the login worker's reply, which World clears the request on. */
async function settled(username: string, ticks = 200): Promise<boolean> {
    const safe = toSafeName(username);
    for (let i = 0; i < ticks; i++) {
        if (!World.veteranRequests.has(safe)) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    return false;
}

cleanup();
await H.boot();

const handler = new ClientCheatHandler();
const run = (p: Player, text: string) => {
    H.clearLogs();
    handler.handle(new ClientCheat(text), p);
    return H.mesgs.filter(m => m.who === p.username).map(m => m.text);
};
const since = (p: Player) => H.mesgs.filter(m => m.who === p.username).map(m => m.text);

try {
    // ---------------------------------------------------------------- the crown itself
    console.log('\nTHE CROWN, WITHOUT ANY OF THE PLUMBING');
    check('  a plain player has no icon', chatCrown(0, false), 0);
    check('  a veteran has crown 7', chatCrown(0, true), 7);
    // The one that is easy to get backwards. A veteran who is also a moderator is a moderator:
    // the rank that carries powers is the one worth seeing.
    check('  staff beats veteran, not the other way round', chatCrown(2, true), 2);
    check('  and the owner too', chatCrown(5, true), 5);
    check('  a veteran is NOT 6, which is the second owner', chatCrown(0, true) === 6, false);

    // ---------------------------------------------------------------- the appearance byte
    console.log('\nTHE BYTE EVERYONE ELSE IS SENT');
    const solo = player('vetsim_byte', 3222, 3222);
    solo.veteran = true;
    check('  crown 7 in the low nibble', solo.chatIcons() & 0xf, 7);
    // The badge shares the byte; a veteran on Realism must not come out as some other crown.
    check('  the badge is still in the high nibble', (solo.chatIcons() >> 4) & 0xf, 1);
    solo.veteran = false;
    check('  and nothing when the flag is off', solo.chatIcons() & 0xf, 0);
    H.despawn(solo);

    // ---------------------------------------------------------------- the round trip
    console.log('\n::veteran, THROUGH THE REAL LOGIN WORKER');
    db.prepare("INSERT INTO account (username, password, veteran) VALUES (?, '-', 0)").run(TARGET);
    check('  the test account starts without it', veteranOf(TARGET), 0);

    const admin = player('vetsim_admin', 3222, 3222);
    admin.staffModLevel = 3;
    const target = player(TARGET, 3224, 3222);
    // As it would be after login, so the live refresh has something to rebuild.
    target.buildAppearance(0);

    const said = run(admin, `veteran ${TARGET}`);
    check(
        '  the administrator is told it is in flight',
        said.some(m => m.includes('granting')),
        true
    );
    check('  it settled', await settled(TARGET), true);

    check('  the account row is set', veteranOf(TARGET), 1);
    check('  the player has it without relogging', target.veteran, true);
    check('  and their appearance now carries crown 7', target.chatIcons() & 0xf, 7);
    check(
        '  the administrator is told who',
        since(admin).some(m => m.includes('Vetsim Tgt') && m.includes('now has the Veteran rank')),
        true
    );
    check(
        '  and the player is told',
        since(target).some(m => m.includes('You have been given the Veteran rank')),
        true
    );

    // ---------------------------------------------------------------- taking it back
    console.log('\n::veteran <name> off');
    run(admin, `veteran ${TARGET} off`);
    check('  it settled', await settled(TARGET), true);
    check('  the account row is cleared', veteranOf(TARGET), 0);
    check('  the player loses it at once', target.veteran, false);
    check('  and the crown with it', target.chatIcons() & 0xf, 0);
    check(
        '  the administrator is told',
        since(admin).some(m => m.includes('no longer has the Veteran rank')),
        true
    );

    // ---------------------------------------------------------------- the ways it can go wrong
    console.log('\nWHAT IT SAYS WHEN IT CANNOT');
    const usage = run(admin, 'veteran');
    check(
        '  no name at all gets the usage line',
        usage.some(m => m.startsWith('Usage: ::veteran')),
        true
    );

    run(admin, `veteran ${MISSING}`);
    check('  it settled', await settled(MISSING), true);
    check(
        '  an account that does not exist says so',
        since(admin).some(m => m.includes('there is no account called Vetsim None')),
        true
    );

    // A DISPLAY NAME WITH A SPACE IN IT, which the handler has already split in two by the time
    // the command sees it. This is the one ::ban gets wrong - it reads args[0] and acts on
    // "Vetsim", a name nobody has - so it is worth holding this command to a higher standard than
    // the ones beside it.
    db.prepare("INSERT INTO account (username, password, veteran) VALUES ('vetsim_spcd', '-', 0)").run();
    run(admin, 'veteran Vetsim Spcd');
    check('  it settled', await settled('vetsim_spcd'), true);
    check('  "Vetsim Spcd" finds vetsim_spcd', veteranOf('vetsim_spcd'), 1);

    // And the same name with the flag after it, which is where joining the arguments could easily
    // have swallowed the "off".
    run(admin, 'veteran Vetsim Spcd off');
    check('  it settled', await settled('vetsim_spcd'), true);
    check('  "Vetsim Spcd off" takes it back', veteranOf('vetsim_spcd'), 0);

    // "off" on its own is not a name.
    const offOnly = run(admin, 'veteran off');
    check(
        '  ::veteran off alone gets the usage line',
        offOnly.some(m => m.startsWith('Usage: ::veteran')),
        true
    );

    // ---------------------------------------------------------------- a player below the rank
    console.log('\nWHO MAY RUN IT');
    const mod = player('vetsim_mod', 3226, 3222);
    mod.staffModLevel = 2;
    const refused = run(mod, `veteran ${TARGET}`);
    check(
        '  a moderator cannot',
        refused.some(m => m.includes('granting')),
        false
    );
    check('  and the row is untouched', veteranOf(TARGET), 0);

    H.despawn(admin, target, mod);
} finally {
    cleanup();
    db.close();
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
