// The rules around the commands every player has (::home, ::yell) and who gets the developer ones on a
// live world. Drives the real ClientCheatHandler against the real content.
// Usage: NODE_PRODUCTION=true npx tsx tools/sim/staffrules.ts
//
//   ::home      refused in combat (anything that stops a logout) and in the Wilderness; admins (3+) exempt
//   ::yell      once per 10 seconds; staff (2+) exempt
//   dev cmds    on a live world only the owners (5, 6); a developer (4) only on a dev server
import * as H from './harness.js';
import World from '#/engine/World.js';
import { MoveStrategy } from '#/engine/entity/MoveStrategy.js';
import Player from '#/engine/entity/Player.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import Environment from '#/util/Environment.js';

if (!Environment.NODE_PRODUCTION) {
    console.error('Run with NODE_PRODUCTION=true - the owner rules are about a live world.');
    process.exit(1);
}

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const cheat = new ClientCheatHandler();
const run = (p: Player, text: string) => cheat.handle(new ClientCheat(text), p);
const EDGEVILLE = [(48 << 6) + 14, (54 << 6) + 35];
const at = (p: Player) => [p.x, p.z];

const LUMBRIDGE = [3222, 3222];
const WILDERNESS = [3100, 3600];

const walker = H.makePlayer('walker', LUMBRIDGE[0], LUMBRIDGE[1], 1);
const fighter = H.makePlayer('fighter', LUMBRIDGE[0] + 2, LUMBRIDGE[1], 2);
const wildy = H.makePlayer('wildy', WILDERNESS[0], WILDERNESS[1], 3);
const admin = H.makePlayer('admin', WILDERNESS[0] + 2, WILDERNESS[1], 4);
const watcher = H.makePlayer('watcher', LUMBRIDGE[0], LUMBRIDGE[1] + 3, 5);
const mod = H.makePlayer('mod', LUMBRIDGE[0] + 1, LUMBRIDGE[1] + 3, 6);
const dev = H.makePlayer('dev', LUMBRIDGE[0] + 2, LUMBRIDGE[1] + 3, 7);
const owner = H.makePlayer('owner', LUMBRIDGE[0] + 3, LUMBRIDGE[1] + 3, 8);
const owner2 = H.makePlayer('owner2', LUMBRIDGE[0] + 4, LUMBRIDGE[1] + 3, 9);
H.tick(2);
// maxOut takes a new player off Tutorial Island; then everyone back to where they were put
for (const [p, x, z] of [
    [walker, LUMBRIDGE[0], LUMBRIDGE[1]],
    [fighter, LUMBRIDGE[0] + 2, LUMBRIDGE[1]],
    [wildy, WILDERNESS[0], WILDERNESS[1]],
    [admin, WILDERNESS[0] + 2, WILDERNESS[1]],
    [watcher, LUMBRIDGE[0], LUMBRIDGE[1] + 3],
    [mod, LUMBRIDGE[0] + 1, LUMBRIDGE[1] + 3],
    [dev, LUMBRIDGE[0] + 2, LUMBRIDGE[1] + 3],
    [owner, LUMBRIDGE[0] + 3, LUMBRIDGE[1] + 3],
    [owner2, LUMBRIDGE[0] + 4, LUMBRIDGE[1] + 3]
] as [Player, number, number][]) {
    H.maxOut(p);
    p.teleport(x, z, 0);
}
H.equip(fighter, { rhand: 'rune_scimitar' });
H.tick(2);
admin.staffModLevel = 3;
mod.staffModLevel = 2;
dev.staffModLevel = 4;
owner.staffModLevel = 5;
owner2.staffModLevel = 6;

console.log('::home');
run(walker, 'home');
H.tick(2);
check('out of combat, it teleports', at(walker), EDGEVILLE);

// real combat: a monster hits them, and the content's own p_preventlogout (npc_combat.rs2, on every
// hit landed on a player) is what stops the logout - not anything this sim sets
const giant = H.addNpcAt('giant', fighter.x + 1, fighter.z, 0);
H.setNpcMode(giant, 'OPPLAYER2', fighter);
let waited = 0;
while (World.currentTick >= fighter.preventLogoutUntil && waited++ < 30) {
    H.tick(1);
}
check('the giant hit them (a logout is prevented)', World.currentTick < fighter.preventLogoutUntil, true);
const before = at(fighter);
H.mesgs.length = 0;
run(fighter, 'home');
H.tick(1);
check(
    'in combat, it is refused',
    H.mesgs.some(m => m.who === 'fighter' && m.text.includes('end of combat')),
    true
);
check('... and they stay where they are (near the fight)', Math.abs(fighter.x - before[0]) + Math.abs(fighter.z - before[1]) < 10, true);
// the fight ends: the giant goes, and the 16 ticks run out
World.removeNpc(giant, -1);
fighter.clearInteraction();
while (World.currentTick < fighter.preventLogoutUntil) {
    H.tick(1);
}
fighter.clearInteraction();
run(fighter, 'home');
H.tick(2);
check('once combat is over, it works', at(fighter), EDGEVILLE);

H.mesgs.length = 0;
run(wildy, 'home');
H.tick(2);
check(
    'in the Wilderness, it is refused',
    H.mesgs.some(m => m.who === 'wildy' && m.text.includes('Wilderness')),
    true
);
check('... and they are still in the Wilderness', wildy.isInWilderness(), true);
run(admin, 'home');
H.tick(2);
check('an administrator is not held to it', at(admin), EDGEVILLE);

console.log('::yell');
const yells = () => H.mesgs.filter(m => m.who === 'watcher' && m.text.includes('[Yell]')).length;
H.mesgs.length = 0;
run(walker, 'yell first');
check('the first yell is heard', yells(), 1);
run(walker, 'yell second, straight after');
check('a second one straight after is not', yells(), 1);
check(
    '... and they are told why',
    H.mesgs.some(m => m.who === 'walker' && m.text.includes('once every 10 seconds')),
    true
);
H.tick(17);
run(walker, 'yell third, 10 seconds on');
check('10 seconds later it is heard again', yells(), 2);
run(mod, 'yell mod one');
run(mod, 'yell mod two');
check('a moderator is not held to it', yells(), 4);

console.log('developer commands on a live world');
for (const [p, want] of [
    [dev, false],
    [owner, true],
    [owner2, true]
] as [Player, boolean][]) {
    p.moveStrategy = MoveStrategy.SMART;
    run(p, 'fly');
    check(`::fly for level ${p.staffModLevel}`, (p.moveStrategy as MoveStrategy) === MoveStrategy.FLY, want);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad > 0 ? 1 : 0);
