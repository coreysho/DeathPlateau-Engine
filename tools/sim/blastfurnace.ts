// THE BLAST FURNACE, which the 377 cache ships as a finished machine with nobody able to work it:
// every station placed in m30_77, twenty-four varbits describing the whole of it, the player's own
// animations for the pedals and the pump, and four of its op labels sitting in silentops.py.
//
//   npx tsx tools/sim/blastfurnace.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import SeqType from '#/cache/config/SeqType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc } from '#/engine/GameMap.js';
import rsmod, { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

function settle(p: Player, picks: number[] = [], max = 60) {
    let idle = 0;
    for (let g = 0; g < max; g++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            idle = 0;
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
            const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
            if (multi) {
                const pick = picks.shift();
                if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
                H.choose(p, names.find((n: string) => n === `${open}:com_${pick}`) ?? names[pick]);
                continue;
            }
            p.executeScript(s, true, true);
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) {
            if (++idle >= 2) break;
        } else idle = 0;
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
}

// ------------------------------------------------------------------ the machine, station by station
const BELT: [number, number] = [1943, 4967];
const COKE: [number, number] = [1950, 4964];
const STOVE: [number, number] = [1948, 4963];
const PUMP: [number, number] = [1950, 4961];
const PEDALS: [number, number] = [1947, 4966];
const GAUGE: [number, number] = [1945, 4961];
const SINK: [number, number] = [1942, 4956];
const DISPENSER: [number, number] = [1940, 4963];

const standNear = (x: number, z: number): [number, number] => {
    for (let r = 1; r <= 4; r++) {
        for (let dx = -r; dx <= r; dx++)
            for (let dz = -r; dz <= r; dz++) {
                if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
                const tx = x + dx,
                    tz = z + dz;
                if (!rsmod.isZoneAllocated(tx, tz, 0)) continue;
                if (rsmod.isFlagged(tx, tz, 0, CollisionFlag.WALK_BLOCKED)) continue;
                if (rsmod.isFlagged(tx, tz, 0, CollisionFlag.FLOOR)) continue;
                return [tx, tz];
            }
    }
    throw new Error(`nowhere to stand near ${x},${z}`);
};
const locNameAt = (x: number, z: number): string => {
    for (const loc of World.gameMap.getZone(x, z, 0).getAllLocsSafe()) {
        if (loc.x === x && loc.z === z) return LocType.get(loc.type).debugname ?? String(loc.type);
    }
    return '(nothing)';
};
// What the dispenser DRAWS at a given index. A zone holds the multiloc parent; which child a player
// sees is resolved from the varbit, so this reads the table rather than the map.
const dispenserChild = (index: number): string => {
    const t: any = LocType.get(LocType.getId('blast_furnace_dispenser'));
    const kids: number[] = t.multiLoc ?? t.multiloc ?? [];
    return LocType.get(kids[index]).debugname ?? String(kids[index]);
};

const p: any = H.makePlayer('bf', 1944, 4960);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

const heard = (fn: () => void): string => {
    const mark = H.mesgs.length;
    const faces = H.ifaces.length;
    fn();
    return H.ifaces
        .slice(faces)
        .filter(i => i.kind === 'text' && i.text)
        .map(i => i.text!)
        .concat(H.mesgs.slice(mark).map(m => m.text))
        .join(' ');
};
const click = (at: [number, number], op = 1, picks: number[] = [], use?: string): string => {
    const name = locNameAt(at[0], at[1]);
    const loc = World.getLoc(at[0], at[1], 0, LocType.getId(name));
    if (!loc) throw new Error(`no loc at ${at}`);
    const t = LocType.get(loc.type);
    const [sx, sz] = standNear(at[0], at[1]);
    return heard(() => {
        p.teleport(sx, sz, 0);
        H.tick(1);
        p.clearPendingAction();
        if (use !== undefined) {
            p.lastUseItem = ObjType.getId(use);
            const inv = p.getInventory(93)!;
            for (let i = 0; i < inv.capacity; i++)
                if (inv.get(i)?.id === ObjType.getId(use)) {
                    p.lastUseSlot = i;
                    break;
                }
        }
        p.queueWaypoints(findPathToLoc(0, p.x, p.z, loc.x, loc.z, p.width, t.width, t.length, loc.angle, loc.shape, t.forceapproach));
        p.setInteraction(Interaction.ENGINE, loc, use === undefined ? ServerTriggerType.APLOC1 + (op - 1) : ServerTriggerType.APLOCU);
        p.opcalled = true;
        settle(p, picks);
    });
};
const ore = (n: string) => H.getVarBit(p, `blast_furnace_${n}`);
const bars = (n: string) => H.getVarBit(p, `blast_furnace_${n}`);
const temp = () => H.getVarBit(p, 'blast_furnace_temperature_reading');
const hot = () => H.getVarBit(p, 'blast_furnace_bars_hot');
const smith = () => p.stats[13]; // 13 is Smithing

// ------------------------------------------------------------------ what the cache had
console.log('');
console.log('A MACHINE BUILT, PLACED, AND NEVER ONCE WORKED');
check(
    'every station is on the map where the config put it',
    [
        ['blast_furnace_conveyer_belt_clickable', BELT],
        ['blast_furnace_coke', COKE],
        ['blast_furnace_stove_low', STOVE],
        ['blast_furnace_pump', PUMP],
        ['blast_furnace_pedals', PEDALS],
        ['blast_furnace_gauge', GAUGE],
        ['blast_furnace_sink', SINK],
        ['blast_furnace_dispenser', DISPENSER]
    ].every(([n, at]) => World.getLoc((at as number[])[0], (at as number[])[1], 0, LocType.getId(n as string)) !== null),
    true
);
check(
    'and each one says what it is for',
    [
        ['blast_furnace_conveyer_belt_clickable', 'Put-ore-on'],
        ['blast_furnace_coke', 'Collect'],
        ['blast_furnace_stove_low', 'Refuel'],
        ['blast_furnace_pump', 'Operate'],
        ['blast_furnace_pedals', 'Pedal'],
        ['blast_furnace_gauge', 'Read'],
        ['blast_furnace_sink', 'Fill-bucket']
    ].map(([n]) => (LocType.get(LocType.getId(n as string)).op ?? [])[0]),
    ['Put-ore-on', 'Collect', 'Refuel', 'Operate', 'Pedal', 'Read', 'Fill-bucket']
);
check(
    'the dispenser is a multiloc whose hot state carries no Take op at all',
    [(LocType.get(LocType.getId('blast_furnace_ore_dispenser_full')).op ?? [])[0], (LocType.get(LocType.getId('blast_furnace_ore_dispenser_cooled')).op ?? [])[0], (LocType.get(LocType.getId('blast_furnace_ore_dispenser_empty')).op ?? [])[0]],
    [null, 'Take', 'Search']
);
check('the cache even has the player animations for the pedals and the pump', [SeqType.getId('blast_furnace_human_conveyer_cycle') !== -1, SeqType.getId('blast_furnace_human_air_pump') !== -1], [true, true]);
check(
    'the Foreman is standing there with nothing to say',
    (() => {
        const id = NpcType.getId('blast_furnace_instructor');
        for (const npc of World.npcs) if (npc && npc.isActive && npc.type === id) return NpcType.get(id).name;
        return 'missing';
    })(),
    'Blast Furnace Foreman'
);
check(
    'nineteen counters, and not one of them is a metal from after 2006',
    [
        'coal',
        'tin_ore',
        'copper_ore',
        'iron_ore',
        'mithril_ore',
        'adamantite_ore',
        'runite_ore',
        'gold_ore',
        'silver_ore',
        'perfect_gold_ore',
        'bronze_bars',
        'iron_bars',
        'steel_bars',
        'mithril_bars',
        'adamantite_bars',
        'runite_bars',
        'gold_bars',
        'silver_bars',
        'perfect_gold_bars'
    ].every(n => {
        try {
            H.getVarBit(p, `blast_furnace_${n}`);
            return true;
        } catch {
            return false;
        }
    }),
    true
);

// ------------------------------------------------------------------ the Foreman
console.log('');
console.log('THE FOREMAN, WHO WANTS 2,500 COINS UNLESS YOU HAVE 60 SMITHING');
const foreman = (() => {
    const id = NpcType.getId('blast_furnace_instructor');
    for (const npc of World.npcs) if (npc && npc.isActive && npc.type === id) return npc;
    throw new Error('no Foreman');
})();
const talk = (picks: number[] = []): string =>
    heard(() => {
        p.teleport(foreman.x, foreman.z - 1, 0);
        H.tick(1);
        p.clearPendingAction();
        H.opNpc(p, foreman, 1);
        settle(p, picks);
    });
p.setLevel(13, 50);
H.tick(1);
let said = talk([2]);
check('below 60 he asks for the fee', said.includes('2500 coins'), true);
said = talk([1]);
check('  and with no coins you are not getting on', [said.includes('do not have'), H.runProc(p, '[proc,bf_may_use]')[0]], [true, 0]);
H.give(p, 'coins', 3000);
talk([1]);
check('paying buys ten minutes of it', [H.invCount(p, 'coins'), H.runProc(p, '[proc,bf_may_use]')[0], H.queued(p, '[queue,bf_paid]').length], [500, 1, 1]);
p.setLevel(13, 60);
H.tick(1);
said = talk();
check('at 60 Smithing he does not ask at all', said.includes('as long as you like'), true);

// ------------------------------------------------------------------ loading the belt
console.log('');
console.log('ORE ONTO THE BELT, COKE INTO THE STOVE, AIR THROUGH THE POT');
H.clearInv(p);
for (const n of ['coal', 'tin_ore', 'copper_ore', 'iron_ore', 'mithril_ore', 'adamantite_ore', 'runite_ore', 'gold_ore', 'silver_ore', 'perfect_gold_ore']) H.setVarBit(p, `blast_furnace_${n}`, 0);
for (const n of ['bronze_bars', 'iron_bars', 'steel_bars', 'mithril_bars', 'adamantite_bars', 'runite_bars', 'gold_bars', 'silver_bars', 'perfect_gold_bars']) H.setVarBit(p, `blast_furnace_${n}`, 0);
H.setVarBit(p, 'blast_furnace_temperature_reading', 0);
H.setVarBit(p, 'blast_furnace_bars_hot', 0);
H.setVarBit(p, 'blast_furnace_broken_pipe_reading', 0);
H.setVarBit(p, 'blast_furnace_fuel_low_reading', 0);
said = click(BELT);
check('an empty pair of hands loads nothing', said.includes('nothing the furnace can smelt'), true);
H.give(p, 'iron_ore', 10);
H.give(p, 'coal', 10);
click(BELT);
check('ore on the belt goes into the machine and out of your bag', [ore('iron_ore'), ore('coal'), H.invCount(p, 'iron_ore'), H.invCount(p, 'coal')], [10, 10, 0, 0]);
said = click(GAUGE);
check('  and the gauge knows what the coal is owed to: one per steel bar, not two', said.includes('wants 10 coal'), true);

said = click(COKE);
check('the coke heap wants a spade', said.includes('need a spade'), true);
H.give(p, 'spade', 1);
click(COKE);
check('with one you get a spadeful', [H.invCount(p, 'blast_furnace_coke_spade'), H.invCount(p, 'spade')], [1, 0]);
click(STOVE);
check('which the stove takes, and the spade comes back', [locNameAt(STOVE[0], STOVE[1]), H.invCount(p, 'spade'), H.invCount(p, 'blast_furnace_coke_spade')], ['blast_furnace_stove_medium', 1, 0]);

said = click(PEDALS);
check('pedalling a cold pot melts nothing', [said.includes('not hot enough'), bars('steel_bars')], [true, 0]);
check('  but it still pays the Agility it has always paid', p.stats[16] > 0, true);
click(PUMP);
check('the pump puts heat into it', temp(), 60);

// ------------------------------------------------------------------ a potful
console.log('');
console.log('A POTFUL: STEEL BEFORE IRON, BECAUSE THE COAL IS THERE TO BE USED');
let xp = smith();
said = click(PEDALS);
check('iron and coal in the machine come out as steel, not as iron', [bars('steel_bars'), bars('iron_bars'), ore('iron_ore'), ore('coal')], [10, 0, 0, 0]);
check('  at 17.5 experience a bar, which is the furnace table its own', (smith() - xp) / 10, 175);
check('  and they come out glowing: index 2, the state with no Take op', [hot(), dispenserChild(2)], [2, 'blast_furnace_ore_dispenser_full']);
check('  the heat and the coke both went into it', [temp(), locNameAt(STOVE[0], STOVE[1])], [35, 'blast_furnace_stove_low']);

said = click(DISPENSER);
check('a glowing bar cannot be picked up', [said.includes('glowing hot'), H.invCount(p, 'steel_bar')], [true, 0]);
H.give(p, 'bucket_empty', 1);
click(SINK);
check('the sink fills a bucket', [H.invCount(p, 'bucket_water'), H.invCount(p, 'bucket_empty')], [1, 0]);
said = click(DISPENSER, 1, [], 'bucket_water');
check('and a bucket of water over the bars cools them to index 3', [hot(), dispenserChild(3), H.invCount(p, 'bucket_empty')], [3, 'blast_furnace_ore_dispenser_cooled', 1]);
click(DISPENSER);
check('then they can be taken, and the dispenser goes back to empty', [H.invCount(p, 'steel_bar'), hot(), bars('steel_bars')], [10, 0, 0]);

// ------------------------------------------------------------------ half the coal
console.log('');
console.log('HALF THE COAL, WHICH IS WHY ANYBODY WALKS DOWN HERE');
p.setLevel(13, 99);
H.tick(1);
const coalFor = (oreName: string, _barName: string, count: number): number => {
    for (const n of ['coal', 'iron_ore', 'mithril_ore', 'adamantite_ore', 'runite_ore']) H.setVarBit(p, `blast_furnace_${n}`, 0);
    for (const n of ['steel_bars', 'mithril_bars', 'adamantite_bars', 'runite_bars']) H.setVarBit(p, `blast_furnace_${n}`, 0);
    H.setVarBit(p, `blast_furnace_${oreName}`, count);
    H.setVarBit(p, 'blast_furnace_coal', 100);
    H.setVarBit(p, 'blast_furnace_temperature_reading', 200);
    H.setVarBit(p, 'blast_furnace_bars_hot', 0);
    H.runProc(p, '[proc,bf_stove_set]', [2], undefined, true);
    click(PEDALS);
    return 100 - ore('coal');
};
check('steel takes one coal where a furnace takes two', coalFor('iron_ore', 'steel_bars', 5) / 5, 1);
check('mithril takes two where a furnace takes four', coalFor('mithril_ore', 'mithril_bars', 5) / 5, 2);
check('adamantite takes three where a furnace takes six', coalFor('adamantite_ore', 'adamantite_bars', 5) / 5, 3);
check('runite takes four where a furnace takes eight', coalFor('runite_ore', 'runite_bars', 5) / 5, 4);

// iron on its own, which never fails here
console.log('');
console.log('AND THE THINGS THAT ARE DIFFERENT DOWN HERE');
for (const n of ['coal', 'iron_ore']) H.setVarBit(p, `blast_furnace_${n}`, 0);
for (const n of ['steel_bars', 'iron_bars']) H.setVarBit(p, `blast_furnace_${n}`, 0);
H.setVarBit(p, 'blast_furnace_iron_ore', 20);
H.setVarBit(p, 'blast_furnace_temperature_reading', 200);
H.setVarBit(p, 'blast_furnace_bars_hot', 0);
H.runProc(p, '[proc,bf_stove_set]', [2], undefined, true);
click(PEDALS);
check('twenty iron ore with no coal makes twenty iron bars, every one of them: the coke refines it', [bars('iron_bars'), ore('iron_ore')], [20, 0]);

// gold and the gauntlets
H.setVarBit(p, 'blast_furnace_gold_ore', 10);
H.setVarBit(p, 'blast_furnace_gold_bars', 0);
H.setVarBit(p, 'blast_furnace_temperature_reading', 200);
H.setVarBit(p, 'blast_furnace_bars_hot', 0);
H.runProc(p, '[proc,bf_stove_set]', [2], undefined, true);
H.equip(p, { hands: 'gauntlets_of_goldsmithing' });
H.tick(1);
xp = smith();
click(PEDALS);
check('the goldsmith gauntlets pay here as they pay anywhere: 56.2 a bar', [bars('gold_bars'), (smith() - xp) / 10 / 10], [10, 56.2]);

// ------------------------------------------------------------------ overheating
console.log('');
console.log('AND WHAT THE GAUGE IS THERE TO STOP');
H.setVarBit(p, 'blast_furnace_temperature_reading', 220);
H.setVarBit(p, 'blast_furnace_broken_pipe_reading', 0);
said = click(PUMP);
check('one pump too many splits the pipes and drops the pot cold', [H.getVarBit(p, 'blast_furnace_broken_pipe_reading'), temp(), said.includes('split')], [1, 0, true]);
said = click(PEDALS);
check('  and nothing melts until they are mended', said.includes('pipes are broken'), true);
said = click(GAUGE);
check('  which the gauge says in as many words', said.includes('pipes are split'), true);
p.setLevel(12, 29);
H.tick(1);
H.give(p, 'hammer', 1);
said = click(PUMP, 1, [], 'hammer');
check('29 Crafting is one short of mending them', [said.includes('level of 30'), H.getVarBit(p, 'blast_furnace_broken_pipe_reading')], [true, 1]);
p.setLevel(12, 30);
H.tick(1);
const cxp = p.stats[12];
click(PUMP, 1, [], 'hammer');
check('30 mends them, and pays its 40 Crafting for it', [H.getVarBit(p, 'blast_furnace_broken_pipe_reading'), p.stats[12] - cxp], [0, 400]);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
