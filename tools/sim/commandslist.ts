// ::commands - the list a player is shown, against the dispatch it claims to describe.
//
// The handler is the authority on what runs. ClientCheatCommands.ts is the authority on what is
// SAID about it, and the two drift apart the moment somebody adds a command and not a line - at
// which point ::commands is worse than nothing, because a missing command is exactly the thing it
// exists to explain. So the first half of this reads the handler's own "cmd === '...'" dispatch out
// of the source and fails if the table and the source disagree in either direction, over the set of
// commands, the rank each one sits under, or which ones carry the STAFF_WORLD flag.
//
// The second half boots the engine and reads what a player of each rank is actually told.
//
// Run it under both worlds, because STAFF_WORLD is read from the environment once, at import:
//
//   NODE_PRODUCTION=false NODE_MIN_STAFF_LEVEL=3 npx tsx tools/sim/commandslist.ts   the dev world
//   NODE_PRODUCTION=false NODE_MIN_STAFF_LEVEL=0 npx tsx tools/sim/commandslist.ts   an open one
import fs from 'fs';

import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import { CHEATS, STAFF_WORLD, debugprocNames } from '#/network/game/client/handler/ClientCheatCommands.js';
import Environment from '#/util/Environment.js';
import Player from '#/engine/entity/Player.js';

const HANDLER = 'src/network/game/client/handler/ClientCheatHandler.ts';

type Dispatched = { name: string; rank: number; devRank?: number; staffWorld: boolean };

/** Every command the handler dispatches, and the rank block it sits in, read off the source. */
function dispatched(): Dispatched[] {
    const found: Dispatched[] = [];
    let rank = 0;
    let devRank: number | undefined;

    for (const raw of fs.readFileSync(HANDLER, 'utf8').split('\n')) {
        const line = raw.replace(/\r$/, '');

        // The owner block is "5, or 4 on a development world" - matched first, because it also
        // contains a plain ">= 4" that the single-rank pattern below would take.
        if (/if \(player\.staffModLevel >= 5 \|\| \(!Environment\.NODE_PRODUCTION && player\.staffModLevel >= 4\)\)/.test(line)) {
            rank = 5;
            devRank = 4;
            continue;
        }
        const gate = line.match(/^ {8}if \(player\.staffModLevel >= (\d)\) \{$/);
        if (gate) {
            rank = parseInt(gate[1], 10);
            devRank = undefined;
            continue;
        }

        for (const m of line.matchAll(/cmd === '([a-z]+)'/g)) {
            found.push({ name: m[1], rank, devRank, staffWorld: line.includes('&& STAFF_WORLD') });
        }
    }
    return found;
}

console.log('THE TABLE AGAINST THE DISPATCH');
{
    const source = dispatched();
    check('  the handler dispatches commands at all', source.length > 40, true);

    const inSource = [...new Set(source.map(d => d.name))].sort();
    const inTable = CHEATS.map(c => c.name).sort();
    check(
        '  nothing the handler runs is missing from ::commands',
        inSource.filter(n => !inTable.includes(n)),
        []
    );
    check(
        '  nothing ::commands lists is absent from the handler',
        inTable.filter(n => !inSource.includes(n)),
        []
    );

    // Rank and world flag, command by command. A command dispatched twice (::bots and ::bot share a
    // line) has to agree with itself as well.
    const wrongRank: string[] = [];
    const wrongWorld: string[] = [];
    for (const d of source) {
        const cheat = CHEATS.find(c => c.name === d.name);
        if (!cheat) continue;
        if (cheat.rank !== d.rank || (cheat.devRank ?? -1) !== (d.devRank ?? -1)) {
            wrongRank.push(`${d.name} (table ${cheat.rank}/${cheat.devRank ?? '-'}, handler ${d.rank}/${d.devRank ?? '-'})`);
        }
        if ((cheat.staffWorld === true) !== d.staffWorld) {
            wrongWorld.push(`${d.name} (table ${cheat.staffWorld === true}, handler ${d.staffWorld})`);
        }
    }
    check('  every command sits at the rank the table gives it', wrongRank, []);
    check('  every STAFF_WORLD command is flagged, and only those', wrongWorld, []);
}

await H.boot();

const handler = new ClientCheatHandler();
const run = (p: Player, text: string) => {
    H.clearLogs();
    handler.handle(new ClientCheat(text), p);
    return H.mesgs.filter(m => m.who === p.username).map(m => m.text);
};
// The names under one "Administrator (3): ::bank, ::bot, ..." heading - CONTINUATION LINES AND ALL.
// An administrator's list is twenty-six commands long and the chatbox wraps at 456 pixels, so the
// names run on over several messages; a reader sees them, and a test that only read the first line
// would quietly stop checking two thirds of the list.
const CONTINUES = /^(Everyone|[A-Z][a-z]+ \(\d\)|Content|Off on|\d+ more|::commands|\()/;
const group = (lines: string[], label: string) => {
    const start = lines.findIndex(l => l.startsWith(`${label}: `));
    if (start === -1) return [];
    let text = lines[start].slice(label.length + 2);
    for (let i = start + 1; i < lines.length && !CONTINUES.test(lines[i]); i++) {
        text += ' ' + lines[i];
    }
    return text
        .split(/,? /)
        .map(n => n.replace(/,$/, ''))
        .filter(n => n.startsWith('::'))
        .sort();
};

const shape = Environment.NODE_PRODUCTION ? 'live' : STAFF_WORLD ? 'a staff-only development world' : 'an OPEN development world';
console.log(`\nTHIS WORLD IS ${shape} (NODE_PRODUCTION=${Environment.NODE_PRODUCTION}, NODE_MIN_STAFF_LEVEL=${Environment.NODE_MIN_STAFF_LEVEL})`);
const expected = Environment.NODE_PRODUCTION || STAFF_WORLD;

const at = (name: string, rank: number) => {
    const p: any = player(name, 3200, 3200);
    p.staffModLevel = rank;
    H.tick(1);
    return p as Player;
};

console.log('\nWHAT A PLAYER WITH NO RIGHTS IS TOLD');
{
    const p = at('plainsim', 0);
    const said = run(p, 'commands');
    check('  it answers at all', said.length > 0, true);
    check('  and says what they are, in one line', said[0].startsWith('Commands for player (rights 0) on '), true);
    check(
        '  the everyone group is the six rank-0 commands',
        group(said, 'Everyone'),
        CHEATS.filter(c => c.rank === 0)
            .map(c => `::${c.name}`)
            .sort()
    );
    check(
        '  no staff command is named anywhere in it',
        said.some(l => l.includes('::ban') || l.includes('::teleto') || l.includes('::give')),
        false
    );
    check(
        '  and they are not told how many they are missing',
        said.some(l => l.includes('at a higher rank')),
        false
    );
    check(
        '  every line fits one MESSAGE_GAME (byte length)',
        said.filter(l => l.length > 250),
        []
    );
    H.despawn(p);
}

console.log('\nAND A MODERATOR, WHICH IS WHERE THE WORLD STARTS TO MATTER');
{
    const p = at('modlistsim', 2);
    const said = run(p, 'commands');
    const mine = group(said, 'Moderator (2)');
    check('  ::getcoord is theirs on any world', mine.includes('::getcoord'), true);
    check('  ::teleto is listed only where it exists', mine.includes('::teleto'), expected);
    check('  ::ban is listed only where it exists', mine.includes('::ban'), expected);
    check(
        '  what the world is holding back is named, where it is holding anything back',
        said.some(l => l.startsWith('Off on an open development world')),
        !expected
    );
    check(
        '  and the higher ranks are counted',
        said.some(l => /^\d+ more at a higher rank\.$/.test(l)),
        true
    );

    // The detail view has to tell the two reasons apart: a rank you have not got, and a world that
    // does not have the command at all. "::teleto wasn't working earlier either" was the second.
    const detail = run(p, 'commands teleto');
    check('  ::commands teleto gives the usage', detail[0].startsWith('::teleto <username> - '), true);
    check(
        '  then why they can or cannot run it',
        detail.slice(1).join(' '),
        expected ? 'Needs moderator (2) - you have it.' : `Not on this world: NODE_MIN_STAFF_LEVEL is ${Environment.NODE_MIN_STAFF_LEVEL}. Every login here is promoted, so this would belong to anyone.`
    );
    check('  a rank above them says so', run(p, 'commands givemany')[1], 'Needs administrator (3) - you are moderator (2).');
    check('  :: and ~ in front of the name are forgiven', run(p, 'commands ::tele')[0], run(p, 'commands tele')[0]);
    check('  a command that does not exist is not pretended about', run(p, 'commands nosuchthing')[0], 'There is no ::nosuchthing. ::commands for what you have.');
    H.despawn(p);
}

console.log('\nAN ADMINISTRATOR, WHOSE LIST IS LONG ENOUGH TO WRAP');
{
    const p = at('adminlistsim', 3);
    const said = run(p, 'commands');
    const mine = group(said, 'Administrator (3)');
    const want = CHEATS.filter(c => c.rank === 3 && (c.staffWorld !== true || expected))
        .map(c => `::${c.name}`)
        .sort();
    check('  every administrator command reaches them, over as many lines as it takes', mine, want);
    // And it really does wrap: the names carry on past the heading's own message, which is the
    // case the reassembly above is for.
    const head = said.findIndex(l => l.startsWith('Administrator (3): '));
    let spans = 1;
    while (head + spans < said.length && !CONTINUES.test(said[head + spans])) spans++;
    check('  over more than one of them', spans > 1, true);
    check('  the moderator commands are still there under it', group(said, 'Moderator (2)').includes('::getcoord'), true);
    check(
        '  and ::godmode, a rank up, is nowhere in it',
        said.some(l => l.includes('::godmode')),
        false
    );
    check(
        '  every line fits one MESSAGE_GAME (byte length)',
        said.filter(l => l.length > 250),
        []
    );
    H.despawn(p);
}

console.log('\nTHE DEBUGPROCS, WHICH ARE CONTENT AND NOT IN THE TABLE AT ALL');
{
    const owner = at('ownerlistsim', 5);
    const said = run(owner, 'commands');
    const procs = debugprocNames();
    check('  the build has debugprocs to talk about', procs.length > 50, true);
    check(
        '  the owner is told they have them, and how many',
        said.some(l => l.includes(`::commands debug lists all ${procs.length}`)),
        true
    );
    check(
        '  ::commands debug lists them',
        run(owner, 'commands debug').some(l => l.includes('random_event')),
        true
    );
    check('  ::speed is theirs', group(said, 'Owner (5)').includes('::speed') || group(said, 'Developer (4)').includes('::speed'), true);

    // ::random against ::~random_event: a debugproc asked about by name says what it is and that the
    // tilde is the difference, instead of "there is no such command".
    const detail = run(owner, 'commands random_event');
    check('  a debugproc asked about by name is found', detail[0].startsWith('::~random_event is a content debugproc.'), true);
    check('  and ::random, which is NOT it, says which one spawns anything', run(owner, 'commands random').join(' ').includes('::~random_event'), true);

    const plain = at('plainproc', 0);
    check('  a player asking for the debug list is told the rank, not nothing', run(plain, 'commands debug')[0].startsWith('Debugprocs need owner (5)'), true);
    H.despawn(owner, plain);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
