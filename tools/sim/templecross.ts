// THE CROSSINGS, AND THE CRYSTAL THAT SPLITS A BEAM. Ten tiles in the Temple of Light are where two
// corridors cross with no pillar on them, and their varbits are the only ones in the building that
// are not a plain colour: 28 states, in four blocks of seven - a north-south beam, an east-west
// beam, a vertical beam, and a crossed beam, each in the seven colours. Nothing wrote them, so ten
// tiles in the middle of lit corridors stayed dark.
//
// AND A CROSSED BEAM IS WHERE MAGENTA COMES FROM, which is the thing the first two stages could not
// explain: a crystal is a filter, no filter can put a colour back, and three doors in this building
// are magenta. Two beams crossing add. A second beam has to come from somewhere, and that is what
// "a fractured crystal, one of the edges is clear" is for.
//
//   npx tsx tools/sim/templecross.ts
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
                continue;
            }
            p.executeScript(s, true, true);
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

const p: any = H.makePlayer('templecross', ...T(60, 31));
H.tick(1);
p.teleport(...T(60, 31), 0);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();
set(p, 'mourning_quest', 20);
set(p, 'mourning_quest_main', 30);

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
const useOn = (obj: string, x: number, z: number, name: string, picks: number[] = []) => {
    const loc = World.getLoc(x, z, p.level, LocType.getId(name));
    if (!loc) throw new Error(`no ${name} at ${x},${z},${p.level}`);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(obj);
    p.lastUseSlot = slotOf(obj);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    settle(p, picks);
};
const seg = (n: string) => v(p, 'mourning_light_temple_' + n);
const cross = (n: string) => v(p, 'mourning_pillar_light_cross_' + n);
const proc = (name: string, args: number[] = []) => H.runProc(p, name, args, undefined, true);

// ------------------------------------------------------------------ the arithmetic of a crossing
console.log('');
console.log('WHAT HAPPENS WHERE TWO BEAMS CROSS');
// 0 dark, 1-7 north-south, 8-14 east-west, 15-21 vertical, 22-28 crossed - and the colour inside
// each block is the cache's own numbering, 1 red to 7 white.
proc('[proc,m2_dark]');
check('a crossing starts dark', cross('3_14'), 0);
proc('[proc,m2_cross_3_14]', [0, 1]);              // north-south, red
check('a red beam north to south: state 1', cross('3_14'), 1);
const out = proc('[proc,m2_cross_3_14]', [7, 5]);   // east-west, blue
check('a blue beam east to west across it: CROSSED, and 21 + magenta is 27', cross('3_14'), 27);
check('  and the beam carries magenta out of the crossing', out[0], 6);
proc('[proc,m2_dark]');
proc('[proc,m2_cross_3_14]', [0, 2]);
proc('[proc,m2_cross_3_14]', [0, 5]);
check('two beams on the SAME axis add without crossing: yellow and blue is white', cross('3_14'), 7);
proc('[proc,m2_dark]');
check('and m2_dark clears the crossings too, which it never used to', cross('3_14'), 0);

// ------------------------------------------------------------------ a crossing on a real route
console.log('');
console.log('A CROSSING ON A REAL ROUTE');
H.give(p, 'mourning_mirror', 8);
const putMirror = (lx: number, lz: number, lvl: number, name: string, turns: number) => {
    p.teleport(...T(lx, lz + 1), lvl);
    H.tick(1);
    useOn('mourning_mirror', ...T(lx, lz), name);
    for (let i = 0; i < turns; i++) useOn('mourning_mirror', ...T(lx, lz), name);
};
putMirror(59, 5, 2, 'mourning_temple_pillar_3_16', 0);     // south -> west, along the top floor
check('the top-floor corridor is lit white', seg('3_15_16'), 7);
putMirror(4, 5, 2, 'mourning_temple_pillar_3_13', 1);      // west -> north
check('and the corridor from room 15 to room 13 runs over the crossing at room 14', seg('3_13_15'), 7);
check('  which now draws an east-west beam in white: 7 + 7 is 14', cross('3_14'), 14);

// ------------------------------------------------------------------ the crystal that splits
console.log('');
console.log('THE FRACTURED CRYSTAL');
H.give(p, 'mourning_fractured_crystal_1', 1);
p.teleport(...T(42, 6), 2);
H.tick(1);
// room 15's socket is the one the route goes straight through, so the splitter goes there: the
// beam carries on west and a copy leaves north
useOn('mourning_fractured_crystal_1', ...T(42, 5), 'mourning_temple_pillar_3_15', [1]);
check('the fractured crystal goes in, clear edge north', H.invCount(p, 'mourning_fractured_crystal_1'), 0);
check('the beam still runs west to room 13', seg('3_13_15'), 7);
check('AND a second beam leaves north towards room 11', seg('3_11_15'), 7);
opLoc(...T(42, 5), 'mourning_temple_pillar_3_15');
check('taking it back out puts the second beam out', [seg('3_11_15'), H.invCount(p, 'mourning_fractured_crystal_1')], [0, 1]);

// ------------------------------------------------------------------ and the chests pay for them
console.log('');
console.log('WHERE THE TWO FRACTURED CRYSTALS COME FROM');
H.clearInv(p);
p.teleport(...T(60, 5), 1);
H.tick(1);
opLoc(...T(61, 5), 'mourning_temple_light_parts_2_closed');
opLoc(...T(61, 5), 'mourning_temple_light_parts_2_open');
check('the chest behind the blue door: the red crystal AND the first fractured one',
    [H.invCount(p, 'mourning_crystal_red'), H.invCount(p, 'mourning_fractured_crystal_1')], [1, 1]);
p.teleport(...T(60, 57), 1);
H.tick(1);
opLoc(...T(61, 57), 'mourning_temple_light_parts_3_closed');
opLoc(...T(61, 57), 'mourning_temple_light_parts_3_open');
check('the chest behind the magenta door: the second fractured crystal',
    H.invCount(p, 'mourning_fractured_crystal_2'), 1);

// ------------------------------------------------------------------ and magenta opens its door
console.log('');
console.log('AND MAGENTA OPENS A MAGENTA DOOR');
set(p, 'mourning_light_temple_1_14_east', 6);
proc('[proc,m2_doors]');
check('magenta light in the floor 1 room 16 west doorway opens it', v(p, 'mourning_door_1_16_west'), 1);
set(p, 'mourning_light_temple_1_14_east', 5);
proc('[proc,m2_doors]');
check('  and blue light does not', v(p, 'mourning_door_1_16_west'), 0);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
