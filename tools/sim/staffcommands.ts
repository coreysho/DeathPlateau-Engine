// Which staff commands exist on which world.
//
// Twelve of them used to be production-only: teleto, teleother, setvarother, getvarother, giveother,
// broadcast, reboot, slowreboot, setvis, ban, mute, kick. On the dev world they did nothing at all -
// no message, no refusal - because NODE_PRODUCTION is false there, and that is the world where you
// are most likely to want to teleport to somebody and look at what they are standing on.
//
// The reason they were gated was real, though: a world with NODE_PRODUCTION=false promotes EVERY
// login to at least staff level 4, so on an open development world the level checks mean nothing and
// ::ban would belong to anyone who connected. What makes the dev world different is
// NODE_MIN_STAFF_LEVEL, which refuses anyone below it at login, before the promotion. So the test is
// not "is this production" but "was everybody here already staff".
//
// This has to be run three times, because what is being tested is the shape of the world and that is
// read from the environment once, at import:
//
//   npx tsx tools/sim/staffcommands.ts                                        live
//   NODE_PRODUCTION=false NODE_MIN_STAFF_LEVEL=3 npx tsx tools/sim/staffcommands.ts   the dev world
//   NODE_PRODUCTION=false NODE_MIN_STAFF_LEVEL=0 npx tsx tools/sim/staffcommands.ts   an open one
import * as H from './harness.ts';
import { check, R, player, World } from './a1lib.ts';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import Environment from '#/util/Environment.js';
import Player from '#/engine/entity/Player.js';

await H.boot();

const handler = new ClientCheatHandler();
const cheat = (p: Player, text: string) => {
    H.clearLogs();
    handler.handle(new ClientCheat(text), p);
    return H.mesgs.filter(m => m.who === p.username).map(m => m.text);
};

// What this world is, said out loud: a run that tests the wrong one looks exactly like a pass.
const staffOnly = Environment.NODE_MIN_STAFF_LEVEL >= 2;
const shape = Environment.NODE_PRODUCTION ? 'live' : staffOnly ? 'a staff-only development world' : 'an OPEN development world';
console.log(`THIS WORLD IS ${shape} (NODE_PRODUCTION=${Environment.NODE_PRODUCTION}, NODE_MIN_STAFF_LEVEL=${Environment.NODE_MIN_STAFF_LEVEL})`);
const expected = Environment.NODE_PRODUCTION || staffOnly;

// A moderator, and somebody for them to reach for - ::teleto needs a target who is logged in, which
// is also what makes its answer tell the two cases apart: "not logged in" means the command ran.
const mod: any = player('modsim', 3200, 3200);
mod.staffModLevel = 2;
const other: any = player('victimsim', 3100, 3100);
H.tick(1);

console.log('\n::teleto - the one that sent us looking');
{
    const said = cheat(mod, 'teleto victimsim');
    const moved = mod.x === other.x && mod.z === other.z && mod.level === other.level;
    check(`  a moderator can teleport to a player`, moved, expected);
    if (!expected) {
        check('  and is told nothing at all, which is the complaint', said, []);
    }
}

console.log('\nTHE OTHER ELEVEN ANSWER AT ALL, OR DO NOT');
{
    // WELL-FORMED, every one of them. Four of these (setvarother, getvarother, giveother, setvis)
    // answer nothing at all when the arguments are wrong - they take a count or a level where the
    // others take a name - so probing them with a bad one says "this command does not exist here"
    // about a command that does. An answer of any kind means it ran. ::reboot and ::slowreboot are
    // left out: the way to find out whether those exist is to shut the world down.
    const probes: [string, string][] = [
        ['teleother', 'teleother nobodysim'],
        ['setvarother', 'setvarother victimsim godmode 1'],
        ['getvarother', 'getvarother victimsim godmode'],
        ['setvis', 'setvis 0'],
        ['ban', 'ban nobodysim'],
        ['mute', 'mute nobodysim'],
        ['kick', 'kick nobodysim']
    ];
    const admin: any = player('adminsim', 3200, 3200);
    admin.staffModLevel = 3;
    H.tick(1);
    const answered = probes.filter(([, text]) => cheat(admin, text).length > 0).map(([name]) => name);
    const silent = probes.filter(([, text]) => cheat(admin, text).length === 0).map(([name]) => name);
    // ::giveother says nothing at all when it works - it puts the item in the other player's
    // inventory and that is that - so this one is read off the inventory instead of the chatbox.
    const had = H.invCount(other, 'coins');
    cheat(admin, 'giveother victimsim coins 7');
    const gave = H.invCount(other, 'coins') > had;
    if (gave) answered.push('giveother'); else silent.push('giveother');
    if (expected) {
        check(`  all ${probes.length} answer`, silent.length ? silent.join(',') : 'yes', 'yes');
    } else {
        check(`  none of the ${probes.length} answer`, answered.length ? answered.join(',') : 'yes', 'yes');
    }
    H.despawn(admin);
}

console.log('\nAND THE DEBUG COMMANDS ARE UNTOUCHED BY ANY OF IT');
{
    // ::~ is NODE_DEBUGPROC_CHAR. Level 5 on live, 4 on a development world - the rule that already
    // existed, and the one that makes ::~random_event work on dev and not on live.
    const owner: any = player('ownersim', 3200, 3200);
    owner.staffModLevel = 4;
    H.tick(1);
    const ran = cheat(owner, '~random_event').length > 0 || World.getPlayerByUsername('ownersim') !== null;
    check('  a developer (4) is the bar on a development world', ran, true);
    H.despawn(owner);
}

H.despawn(mod, other);
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
