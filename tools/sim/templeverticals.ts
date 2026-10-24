// THE THIRD DIMENSION. The Temple of Light is three floors of sixteen rooms and the cache always
// said so: 43 mourning_light_temple_<floor>_<room>_up varbits, three bits each, and ten crossing
// tiles whose 28-state enums include a VERTICAL beam in every colour. The trace only ever walked
// four directions and dropped down one hardcoded shaft.
//
// Two things are checked here. First, that a tilted mirror does what the walkthrough says: sends the
// beam travelling one way up through the ceiling, or down through the floor, and that the beam comes
// out of the pillar above (or below) and carries on. Second - and this is the question stage one
// could not answer - whether the light can now REACH the doorways that gate the five chests, which
// means asking the graph, not the player.
//
//   npx tsx tools/sim/templeverticals.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc } from '#/engine/GameMap.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const v = (p: Player, n: string) => (VarBitType.getByName(n) ? H.getVarBit(p, n) : H.getVar(p, n));
const set = (p: Player, n: string, val: number) => (VarBitType.getByName(n) ? H.setVarBit(p, n, val) : H.setVar(p, n, val));
const B = [29 * 64, 72 * 64];
const T = (x: number, z: number) => [B[0] + x, B[1] + z] as [number, number];

function settle(p: Player, picks: number[] = [], max = 200) {
    let idle = 0;
    for (let g = 0; g < max; g++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            idle = 0;
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : Component.get(p.modalChat).comName ?? '';
            const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
            if (multi) {
                const pick = picks.shift();
                if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
                H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
            } else {
                p.executeScript(s, true, true);
            }
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    p.closeModal();
}

const p: any = H.makePlayer('templevert', ...T(60, 31));
H.tick(1);
p.teleport(...T(60, 31), 0);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();
set(p, 'mourning_quest', 20);
set(p, 'mourning_quest_main', 20);

const opLoc = (x: number, z: number, name: string, op = 1, picks: number[] = []) => {
    H.opLoc(p, x, z, name, op);
    settle(p, picks);
};
function slotOf(objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}
const useOn = (obj: string, x: number, z: number, name: string) => {
    const loc = World.getLoc(x, z, p.level, LocType.getId(name));
    if (!loc) throw new Error(`no ${name} at ${x},${z},${p.level}`);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(obj);
    p.lastUseSlot = slotOf(obj);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    settle(p);
};
const seg = (n: string) => v(p, 'mourning_light_temple_' + n);

// ------------------------------------------------------------------ a mirror that tilts
console.log('');
console.log('A MIRROR THAT TILTS');
H.give(p, 'mourning_mirror', 6);
// the entry pillar is floor 3 room 16 and the light comes in travelling south, which is why the
// first mirror has to be there at all - room 16 has no southern corridor
p.teleport(...T(59, 6), 2);
H.tick(1);
useOn('mourning_mirror', ...T(59, 5), 'mourning_temple_pillar_3_16');
check('flat in the entry pillar, and the beam goes west along the top floor',
    [seg('3_15_16'), H.invCount(p, 'mourning_mirror')], [7, 5]);
// Search it: the menu offers a quarter turn, a tilt up, a tilt down, or taking it out
opLoc(...T(59, 5), 'mourning_temple_pillar_3_16', 1, [3, 3]);   // tilt it: the beam travelling south goes down
check('tilted so the beam travelling south goes DOWN: the top-floor corridor goes dark',
    seg('3_15_16'), 0);
check('  and the vertical beam under room 16 is lit instead', v(p, 'mourning_light_temple_3_16_up'), 7);
check('  which is the floor 2 pillar, two rooms down the same shaft', v(p, 'mourning_light_temple_2_16_up'), 7);
check('  and it carries on into floor 1 room 16', v(p, 'mourning_light_temple_1_16_up'), 7);

// ------------------------------------------------------------------ down a floor and along it
console.log('');
console.log('AND OUT ALONG THE BOTTOM FLOOR');
// A FLAT MIRROR CANNOT TURN A FALLING BEAM. Flat settings swap one corridor for the corridor
// beside it; a beam coming straight down the shaft has to be caught by a mirror that is itself
// tilted - which is the same setting read the other way round, because a mirror is reversible.
// Tilt one so "the beam travelling east goes up" and a beam falling into it leaves west.
p.teleport(...T(59, 6), 0);
H.tick(1);
useOn('mourning_mirror', ...T(59, 5), 'mourning_temple_pillar_1_16');
check('a mirror into the pillar at the bottom of the shaft', H.invCount(p, 'mourning_mirror'), 4);
opLoc(...T(59, 5), 'mourning_temple_pillar_1_16', 1, [1]);
check('  flat, it does nothing with a beam from above: the bottom corridor stays dark',
    [seg('1_16_west'), seg('1_14_east')], [0, 0]);
opLoc(...T(59, 5), 'mourning_temple_pillar_1_16', 1, [2, 2]);   // tilt up, the beam travelling east
check('  tilted, the falling beam leaves west along the bottom floor',
    [seg('1_16_west'), seg('1_14_east')], [7, 7]);
check('  and that is three floors of one puzzle: entry on floor 3, out along floor 1',
    [v(p, 'mourning_light_temple_3_16_up'), v(p, 'mourning_light_temple_1_16_up'), seg('1_16_west')], [7, 7, 7]);

// ------------------------------------------------------------------ the reachability question
console.log('');
console.log('CAN THE LIGHT REACH THE DOORS THAT GATE THE CHESTS?');
// THIS ASKS THE GRAPH, NOT THE PLAYER. Every pillar can send the beam down any edge it has, given a
// mirror for the corner, so the pillars reachable from the entry are a fixed point of the edge
// table - and a doorway is reachable if some edge in that set lights the segment it stands in, in
// the colour the door shows. It does NOT say the chest chain is solvable with the mirrors you
// actually have; it says the beam can be got there at all, which in stage one - four directions and
// one hardcoded shaft - it could not, for any door on the bottom floor.
const dark = () => {
    H.runProc(p, '[proc,m2_dark]', [], undefined, true);
    H.runProc(p, '[proc,m2_pillars_dark]', [], undefined, true);
};
const edge = (pid: number, d: number, colour: number) =>
    H.runProc(p, '[proc,m2_edge]', [pid, d, colour], undefined, true)[0];

const reachedPillars = new Set<number>([35]);
const walked: [number, number][] = [];
const stack = [35];
while (stack.length) {
    const pid = stack.pop()!;
    for (const d of [1, 2, 3, 4, 5, 6]) {
        dark();
        const next = edge(pid, d, 7);
        walked.push([pid, d]);
        if (next > 0 && !reachedPillars.has(next)) {
            reachedPillars.add(next);
            stack.push(next);
        }
    }
}
dark();
console.log('  ' + reachedPillars.size + ' of 35 pillars can be reached from the entry, over ' + walked.length + ' edges');

const DOORS: [string, string, number][] = [
    ['mourning_door_1_16_north', 'floor 1 room 16, yellow - a chest behind it', 2],
    ['mourning_door_1_1_south', 'floor 1 room 1, yellow - a chest behind it', 2],
    ['mourning_door_1_13_east', 'floor 1 room 13, cyan - a chest behind it', 4],
    ['mourning_door_2_16_north', 'floor 2 room 16, blue - a chest behind it', 5],
    ['mourning_door_2_4_west', 'floor 2 room 4, magenta - a chest behind it', 6],
    ['mourning_door_1_c', 'the black door to the Death Altar', 7],
    // AND THE REST OF THEM. Five of the fourteen doorways were left out of this list, and one of
    // them is the one that matters most: mourning_door_1_b is the only way a player on foot can
    // get from the bottom of the west circle staircase into the 175-tile west corridor, and the
    // west corridor is the only way to mourning_door_1_c, Thorgel and the Death Altar
    // (tools/sim/templewalk.ts walks that route). A chest nobody can open is a loss; this one
    // would be half a quest.
    ['mourning_door_1_b', 'the cyan door into the west corridor - the ONLY way to the Death Altar', 4],
    ['mourning_door_1_13_north', 'floor 1 room 13 from the north, cyan', 4],
    ['mourning_door_1_1_east', 'floor 1 room 1 from the east, yellow', 2],
    ['mourning_door_1_16_west', 'floor 1 room 16 from the west, magenta', 6],
    ['mourning_door_2_16_west', 'floor 2 room 16 from the west, blue', 5]
];
for (const [door, what, colour] of DOORS) {
    let opened = false;
    for (const [pid, d] of walked) {
        dark();
        edge(pid, d, colour);
        H.runProc(p, '[proc,m2_doors]', [], undefined, true);
        if (v(p, door) === 1) {
            opened = true;
            break;
        }
    }
    check('the beam can be routed to ' + what, opened, true);
}
dark();
H.runProc(p, '[proc,m2_doors]', [], undefined, true);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
