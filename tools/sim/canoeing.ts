// CANOEING ON THE RIVER LUM, which the 377 cache ships whole and nothing had ever answered.
//
// tools/silentops.py: Make-Canoe on four locs, Shape-Canoe on one, Float Log, Float Canoe on
// three, Paddle Log and Paddle Canoe on seven - all silent, and all of it one feature. Each
// station is a 5x2 multiloc whose fifteen indices ARE the state machine, with its own eight-bit
// varbit, and the cache even has the eight carving animations, one per axe.
//
//   npx tsx tools/sim/canoeing.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import SeqType from '#/cache/config/SeqType.js';
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

function settle(p: Player, picks: number[] = [], max = 150) {
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
                const byName = names.find((n: string) => n === `${open}:com_${pick}`);
                H.choose(p, byName ?? names[pick]);
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
}

// the four stations, in river order, with the loc and a tile its forceapproach allows
const STATIONS: [string, string, number, number, number, number][] = [
    ['Lumbridge', 'canoeing_canoestation_lumbridge', 3241, 3235, 3243, 3236],
    ["Champions' Guild", 'canoeing_canoestation_championsguild', 3200, 3341, 3203, 3343],
    ['Barbarian Village', 'canoeing_canoestation_barbarianvillage', 3110, 3409, 3112, 3410],
    ['Edgeville', 'canoeing_canoestation_edgeville', 3130, 3508, 3132, 3510]
];
const VARBITS = ['canoestation_state_lumbridge', 'canoestation_state_championsguild',
    'canoestation_state_barbarianvillage', 'canoestation_state_edgeville'];
const LAND: [number, number][] = [[3243, 3236], [3203, 3343], [3112, 3410], [3132, 3510]];
const POND: [number, number] = [3144, 3792];

const p: any = H.makePlayer('canoe', 3243, 3236);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

const heard = (fn: () => void): string => {
    const mark = H.mesgs.length;
    const faces = H.ifaces.length;
    fn();
    return H.ifaces.slice(faces).filter(i => i.kind === 'text' && i.text).map(i => i.text!)
        .concat(H.mesgs.slice(mark).map(m => m.text)).join(' ');
};
const click = (station: number, picks: number[] = []): string => {
    const [, name, lx, lz, sx, sz] = STATIONS[station];
    const loc = World.getLoc(lx, lz, 0, LocType.getId(name));
    if (!loc) throw new Error('no station at ' + lx + ',' + lz);
    const t = LocType.get(loc.type);
    return heard(() => {
        p.teleport(sx, sz, 0);
        H.tick(1);
        p.clearPendingAction();
        p.queueWaypoints(findPathToLoc(0, p.x, p.z, loc.x, loc.z, p.width, t.width, t.length,
            loc.angle, loc.shape, t.forceapproach));
        p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOC1);
        settle(p, picks);
    });
};
const press = (comName: string): string =>
    heard(() => {
        H.ifButton(p, comName);
        settle(p);
    });
const state = (station: number) => H.getVarBit(p, VARBITS[station]);
const setState = (station: number, v: number) => H.setVarBit(p, VARBITS[station], v);

// ------------------------------------------------------------------ what the cache had
console.log('');
console.log('ONE MULTILOC PER STATION, AND FIFTEEN INDICES OF STATE MACHINE');
for (let i = 0; i < 4; i++) {
    const [who, name, lx, lz] = STATIONS[i];
    const loc = World.getLoc(lx, lz, 0, LocType.getId(name));
    check(`${who} station is placed at ${lx},${lz} with Make-Canoe`,
        [loc !== null, (LocType.get(LocType.getId(name)).op ?? [])[0]], [true, 'Make-Canoe']);
}
check('the four experts are placed, with Talk-to',
    ['canoeing_bill', 'canoeing_tarquin', 'canoeing_sigurd', 'canoeing_hari'].every(n => {
        const id = NpcType.getId(n);
        if (id === -1) return false;
        for (const npc of World.npcs) if (npc && npc.isActive && npc.type === id) return true;
        return false;
    }), true);
check('and both interfaces are in the pack',
    [Component.getId('canoeing:com_25') !== -1, Component.getId('canoe_map:com_37') !== -1], [true, true]);
check('with one carving animation per axe, eight of them',
    ['bronze', 'iron', 'steel', 'black', 'mithril', 'adamant', 'rune', 'dragon']
        .every(m => SeqType.getId(`human_canoeing_carve_${m}_axe`) !== -1), true);

// ------------------------------------------------------------------ chopping and shaping
console.log('');
console.log('CHOP, SHAPE, FLOAT, PADDLE');
for (let i = 0; i < 4; i++) setState(i, 0);
p.setLevel(8, 11);                       // 8 is Woodcutting
H.tick(1);
let said = click(0);
check('with no axe at all it says so', said.includes('need an axe'), true);
H.give(p, 'bronze_axe', 1);
said = click(0);
check('11 Woodcutting is not enough for a canoe', [said.includes('level of 12'), state(0)], [true, 0]);
p.setLevel(8, 12);
H.tick(1);
click(0);
check('12 is, and one click brings the tree down', state(0), 10);     // ^canoe_state_fallen

said = click(0);
check('  and then the fallen tree opens the build panel', p.modalMain, Component.getId('canoeing'));
p.closeModal();
H.tick(1);
said = press('canoeing:com_28');
check('a waka wants 57 Woodcutting', [said.includes('level of 57'), state(0)], [true, 10]);
let xp = p.stats[8];
said = press('canoeing:com_25');
check('a log canoe at 12: 30 Woodcutting experience, and the station is a log',
    [state(0), (p.stats[8] - xp) / 10], [1, 30]);

said = click(0);
check('push it in and it floats', state(0), 5);           // ^canoe_state_log_water

// ------------------------------------------------------------------ the map
console.log('');
console.log('THE MAP, AND HOW FAR EACH CANOE GOES');
click(0);
check('paddling opens the destination map', p.modalMain, Component.getId('canoe_map'));
p.closeModal();
H.tick(1);
said = press('canoe_map:com_36');
check('a log will not reach the Barbarian Village, two stops away',
    [said.includes('1 stops'), p.x], [true, 3243]);
said = press('canoe_map:com_37');
check('  and nothing but a waka goes into the Wilderness', said.includes('Only a waka'), true);
said = press('canoe_map:com_35');
check("one stop to the Champions' Guild, and the canoe sinks behind you",
    [[p.x, p.z], state(0), H.getVarBit(p, 'canoe_type')], [LAND[1], 0, 0]);

// a waka from Lumbridge to the pond
p.setLevel(8, 57);
H.tick(1);
setState(0, 10);
p.teleport(3243, 3236, 0);
H.tick(1);
xp = p.stats[8];
press('canoeing:com_28');
check('a waka at 57: 150 experience', [state(0), (p.stats[8] - xp) / 10], [4, 150]);
click(0);
check('  floated', state(0), 8);
click(0);
p.closeModal();
H.tick(1);
said = press('canoe_map:com_37');
check('and a waka will take you to the Wilderness pond',
    [[p.x, p.z], said.includes('no canoe trees up here')], [POND, true]);

// ------------------------------------------------------------------ one canoe at a time
console.log('');
console.log('ONE CANOE AT A TIME');
setState(0, 2);
setState(2, 10);
p.teleport(3112, 3410, 0);
H.tick(1);
press('canoeing:com_25');
check('making one at another station clears the one you left', [state(2), state(0)], [1, 0]);

console.log('');
console.log('AND THE MEN WHO EXPLAIN IT');
const bill = (() => {
    const id = NpcType.getId('canoeing_bill');
    for (const npc of World.npcs) if (npc && npc.isActive && npc.type === id) return npc;
    throw new Error('Barfy Bill is not spawned');
})();
said = heard(() => {
    p.teleport(bill.x + 1, bill.z, bill.level);
    H.tick(1);
    p.clearPendingAction();
    H.opNpc(p, bill, 1);
    settle(p, [1]);
});
check('Barfy Bill explains the four canoes and the one place nobody paddles to',
    [said.includes('A log will take you one stop'), said.includes('Wilderness')], [true, true]);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
