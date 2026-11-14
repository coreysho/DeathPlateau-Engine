// ::helper - the Helper rank, from the command to the account row and back to the chat icon.
//
// THE PART WORTH TESTING IS THE ROUND TRIP, and it is the part nothing else checks. The command
// posts a message to the login worker, the worker writes the account table and posts a reply, and
// World turns the reply into a crown. Every hop is a string literal in an `any`-typed message, so
// the compiler is no help at all: one typo and the command says "granting..." for ever and nothing
// happens. This is a copy of veteranrank.ts for a rank built the same way, and it is a copy on
// purpose - the two flags share every hop, so a change that breaks one should fail twice.
//
// IT ALSO PINS THE ORDER. A helper who is also a veteran shows the helper's roundel: the icon that
// answers "who can I ask" is worth more to a player than the one that says how long somebody has
// been here. That is a decision rather than a fact, so it is asserted rather than left to whoever
// edits chatCrown next.
//
// It makes its own account rows, named so they cannot collide with anybody's, and deletes them at
// the end - including when an assertion fails, or a failed run would leave them behind.
//
//   npx tsx tools/sim/helperrank.ts
import { DatabaseSync } from 'node:sqlite';

import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import { chatCrown } from '#/engine/entity/ChatCrown.js';
import { toBase37, toSafeName } from '#/util/JString.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';

/** What ~broadcast_name returns for this player - the string a yell or a rare drop is built from. */
function broadcastName(p: Player): string {
    const script = ScriptProvider.getByName('[proc,broadcast_name]');
    if (!script) throw new Error('no [proc,broadcast_name] - is the content built?');
    const state = ScriptRunner.init(script, p, null, []);
    ScriptRunner.execute(state);
    const st = state as unknown as { stringStack: (string | null)[]; ssp: number };
    return st.stringStack[st.ssp - 1] ?? '';
}

/** The rank markers in a name: every icon marker except the three xp badges. */
function rankMarkers(name: string): string[] {
    let i = 0;
    while (/^@cr[1-9a]@/.test(name.slice(i))) i += 5;
    return (name.slice(0, i).match(/@cr[0-9a]@/g) ?? []).filter(m => m !== '@cr3@' && m !== '@cr4@' && m !== '@cr5@');
}

const TARGET = 'helpsim_tgt';
const MISSING = 'helpsim_none';
const db = new DatabaseSync('db.sqlite');

function cleanup() {
    db.prepare("DELETE FROM account WHERE username LIKE 'helpsim\\_%' ESCAPE '\\'").run();
}

function helperOf(username: string): number | null {
    const row = db.prepare('SELECT helper FROM account WHERE username = ?').get(toSafeName(username)) as { helper: number } | undefined;
    return row ? row.helper : null;
}

/** Wait for the login worker's reply, which World clears the request on. */
async function settled(username: string, ticks = 200): Promise<boolean> {
    const safe = toSafeName(username);
    for (let i = 0; i < ticks; i++) {
        if (!World.helperRequests.has(safe)) {
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
    check('  a helper has crown 8', chatCrown(0, false, true), 8);
    // The one that is easy to get backwards. A helper who is also a moderator is a moderator:
    // the rank that carries powers is the one worth seeing.
    check('  staff beats helper, not the other way round', chatCrown(2, false, true), 2);
    check('  and the owner too', chatCrown(5, false, true), 5);
    check('  a helper is NOT 6, which is the second owner', chatCrown(0, false, true) === 6, false);
    check('  a veteran is still 7', chatCrown(0, true, false), 7);
    check('  a helper who is also a veteran shows the helper', chatCrown(0, true, true), 8);
    check('  staff beats both', chatCrown(2, true, true), 2);

    // ---------------------------------------------------------------- the appearance byte
    console.log('\nTHE BYTE EVERYONE ELSE IS SENT');
    const solo = player('helpsim_byte', 3222, 3222);
    solo.helper = true;
    check('  crown 8 in the low nibble', solo.chatIcons() & 0xf, 8);
    // The badge shares the byte; a helper on Realism must not come out as some other crown.
    check('  the badge is still in the high nibble', (solo.chatIcons() >> 4) & 0xf, 1);
    solo.helper = false;
    check('  and nothing when the flag is off', solo.chatIcons() & 0xf, 0);

    // ---------------------------------------------------------------- and the lines it is drawn on
    // THE SAME GAP THE VETERAN EMBLEM HAD. ~broadcast_name built its icons from staffmodlevel,
    // which cannot reach this rank - Helper is a flag on the account, not a staff level - so the
    // roundel showed over the head and on public chat (both come from the appearance byte above)
    // and vanished the moment a helper yelled, which is the one line where "ask me" is the point.
    // It reads the chatcrown op now. @cra@ is what the client's ChatIcons.forPlayer draws crown 8
    // as, and it is the tenth marker - the one the engine's own tag rule used to stop short of.
    console.log('\nAND THE LINES IT IS DRAWN ON');
    solo.helper = true;
    check('  a helper yells with the roundel', broadcastName(solo).includes('@cra@'), true);
    check('    and carries exactly one rank marker', rankMarkers(broadcastName(solo)).length, 1);
    // Staff still wins, exactly as in the byte.
    solo.staffModLevel = 2;
    check('  a moderator who helps out yells as a moderator', broadcastName(solo).includes('@cr2@'), true);
    check('    and not as a helper', broadcastName(solo).includes('@cra@'), false);
    solo.staffModLevel = 0;

    // And a private message, which carries the icon in its own field so that staffLvl keeps
    // meaning staff level on the friend server - see ChatCrown.ts.
    const sent: Record<string, unknown>[] = [];
    const ft = (World as unknown as { friendThread: { postMessage: (m: Record<string, unknown>) => void } }).friendThread;
    const realPost = ft.postMessage.bind(ft);
    ft.postMessage = (m: Record<string, unknown>) => void sent.push(m);
    try {
        World.sendPrivateMessage(solo, toBase37('helpsim_pm2'), 'hello');
        check('  a helper sends crown 8 on a private message', sent[sent.length - 1]?.crown, 8);
        check('    with their staff level still 0 beside it', sent[sent.length - 1]?.staffLvl, 0);
    } finally {
        ft.postMessage = realPost;
    }
    solo.helper = false;
    H.despawn(solo);

    // ---------------------------------------------------------------- the round trip
    console.log('\n::helper, THROUGH THE REAL LOGIN WORKER');
    db.prepare("INSERT INTO account (username, password, helper) VALUES (?, '-', 0)").run(TARGET);
    check('  the test account starts without it', helperOf(TARGET), 0);

    const admin = player('helpsim_admin', 3222, 3222);
    admin.staffModLevel = 3;
    const target = player(TARGET, 3224, 3222);
    // As it would be after login, so the live refresh has something to rebuild.
    target.buildAppearance(0);

    const said = run(admin, `helper ${TARGET}`);
    check(
        '  the administrator is told it is in flight',
        said.some(m => m.includes('granting')),
        true
    );
    check('  it settled', await settled(TARGET), true);

    check('  the account row is set', helperOf(TARGET), 1);
    check('  the player has it without relogging', target.helper, true);
    check('  and their appearance now carries crown 8', target.chatIcons() & 0xf, 8);
    check(
        '  the administrator is told who',
        since(admin).some(m => m.includes('Helpsim Tgt') && m.includes('is now a Helper')),
        true
    );
    check(
        '  and the player is told',
        since(target).some(m => m.includes('You are now a Helper')),
        true
    );

    // ---------------------------------------------------------------- taking it back
    console.log('\n::helper <name> off');
    run(admin, `helper ${TARGET} off`);
    check('  it settled', await settled(TARGET), true);
    check('  the account row is cleared', helperOf(TARGET), 0);
    check('  the player loses it at once', target.helper, false);
    check('  and the crown with it', target.chatIcons() & 0xf, 0);
    check(
        '  the administrator is told',
        since(admin).some(m => m.includes('is no longer a Helper')),
        true
    );

    // ---------------------------------------------------------------- the ways it can go wrong
    console.log('\nWHAT IT SAYS WHEN IT CANNOT');
    const usage = run(admin, 'helper');
    check(
        '  no name at all gets the usage line',
        usage.some(m => m.startsWith('Usage: ::helper')),
        true
    );

    run(admin, `helper ${MISSING}`);
    check('  it settled', await settled(MISSING), true);
    check(
        '  an account that does not exist says so',
        since(admin).some(m => m.includes('there is no account called Helpsim None')),
        true
    );

    // A DISPLAY NAME WITH A SPACE IN IT, which the handler has already split in two by the time
    // the command sees it. This is the one ::ban gets wrong - it reads args[0] and acts on
    // "Helpsim", a name nobody has - so it is worth holding this command to a higher standard than
    // the ones beside it.
    db.prepare("INSERT INTO account (username, password, helper) VALUES ('helpsim_spcd', '-', 0)").run();
    run(admin, 'helper Helpsim Spcd');
    check('  it settled', await settled('helpsim_spcd'), true);
    check('  "Helpsim Spcd" finds helpsim_spcd', helperOf('helpsim_spcd'), 1);

    // And the same name with the flag after it, which is where joining the arguments could easily
    // have swallowed the "off".
    run(admin, 'helper Helpsim Spcd off');
    check('  it settled', await settled('helpsim_spcd'), true);
    check('  "Helpsim Spcd off" takes it back', helperOf('helpsim_spcd'), 0);

    // "off" on its own is not a name.
    const offOnly = run(admin, 'helper off');
    check(
        '  ::helper off alone gets the usage line',
        offOnly.some(m => m.startsWith('Usage: ::helper')),
        true
    );

    // ---------------------------------------------------------------- a player below the rank
    console.log('\nWHO MAY RUN IT');
    const mod = player('helpsim_mod', 3226, 3222);
    mod.staffModLevel = 2;
    const refused = run(mod, `helper ${TARGET}`);
    check(
        '  a moderator cannot',
        refused.some(m => m.includes('granting')),
        false
    );
    check('  and the row is untouched', helperOf(TARGET), 0);

    H.despawn(admin, target, mod);
} finally {
    cleanup();
    db.close();
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
