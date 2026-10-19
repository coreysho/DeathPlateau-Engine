// TAI BWO WANNAI CLEANUP, which the 377 cache ships whole: seventy-seven patches of jungle and
// sixty-two sections of rotten fence placed around the village, every one advertising an op that
// nothing answered, plus the Hardwood Grove doors with the price written into the op label itself
// ("Quick-Pay(100)"). tools/silentops.py had "Hack 12" on a line of its own.
//
//   npx tsx tools/sim/tbwcleanup.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import Component from '#/cache/config/Component.js';
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

// ------------------------------------------------------------------ finding the village
/** Every placement of a loc, anywhere around Tai Bwo Wannai. */
const placements = (name: string, level = 0): { x: number; z: number }[] => {
    const id = LocType.getId(name);
    if (id === -1) throw new Error('no such loc: ' + name);
    const out: { x: number; z: number }[] = [];
    for (let zx = 2744; zx < 2896; zx += 8)
        for (let zz = 3032; zz < 3184; zz += 8) {
            const zone = World.gameMap.getZone(zx, zz, level);
            if (!zone) continue;
            for (const loc of zone.getAllLocsUnsafe()) if (loc.type === id) out.push({ x: loc.x, z: loc.z });
        }
    return out;
};
/** A tile a player can stand on within two squares of a loc. */
const standNear = (x: number, z: number, level = 0): [number, number] => {
    for (let r = 1; r <= 3; r++) {
        for (let dx = -r; dx <= r; dx++)
            for (let dz = -r; dz <= r; dz++) {
                if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
                const tx = x + dx,
                    tz = z + dz;
                if (!rsmod.isZoneAllocated(tx, tz, level)) continue;
                if (rsmod.isFlagged(tx, tz, level, CollisionFlag.WALK_BLOCKED)) continue;
                if (rsmod.isFlagged(tx, tz, level, CollisionFlag.FLOOR)) continue;
                return [tx, tz];
            }
    }
    throw new Error(`nowhere to stand near ${x},${z}`);
};

const JUNGLE = {
    light: placements('tai_bwo_jungle_vegetation_easy_1')[0],
    med: placements('tai_bwo_jungle_vegetation_med_1')[0],
    dense: placements('tai_bwo_jungle_vegetation_hard_1')[0]
};
const FENCE = placements('village_fence_rotten')[0];
const DOOR = placements('tbwcu_bamboo_door_l')[0];

const p: any = H.makePlayer('tbwcu', JUNGLE.light.x, JUNGLE.light.z + 2);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();
// Old School puts the cleanup behind Jungle Potion. The gate is tested below; everything else in
// here is played as somebody who has finished it.
const JUNGLE_POTION_DONE = 13;

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
const locAt = (x: number, z: number, name: string, level = 0) => {
    const loc = World.getLoc(x, z, level, LocType.getId(name));
    if (!loc) throw new Error(`no ${name} at ${x},${z}`);
    return loc;
};
/** What the loc at this tile is now, whatever it has been changed to. */
const locNameAt = (x: number, z: number, level = 0): string => {
    const zone = World.gameMap.getZone(x, z, level);
    for (const loc of zone.getAllLocsSafe()) {
        if (loc.x === x && loc.z === z) return LocType.get(loc.type).debugname ?? String(loc.type);
    }
    return '(nothing)';
};
const clickLoc = (x: number, z: number, name: string, op: number, picks: number[] = [], from?: [number, number]): string => {
    const loc = locAt(x, z, name);
    const t = LocType.get(loc.type);
    const [sx, sz] = from ?? standNear(x, z);
    return heard(() => {
        p.teleport(sx, sz, 0);
        H.tick(1);
        p.clearPendingAction();
        p.queueWaypoints(findPathToLoc(0, p.x, p.z, loc.x, loc.z, p.width, t.width, t.length, loc.angle, loc.shape, t.forceapproach));
        p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOC1 + (op - 1));
        p.opcalled = true;
        settle(p, picks);
    });
};
const favour = () => H.getVarBit(p, 'vill_comm_points');
const setFavour = (v: number) => H.setVarBit(p, 'vill_comm_points', v);
const wood = () => p.stats[8]; // 8 is Woodcutting
const sparCount = () => ['thatching_spar_light', 'thatching_spar_med', 'thatching_spar_dense'].reduce((n, s) => n + H.invCount(p, s), 0);

// ------------------------------------------------------------------ what the cache had
console.log('');
console.log('A MINIGAME ALREADY ON THE MAP, WITH NOTHING BEHIND A SINGLE OP');
check(
    'seventy-seven patches of jungle are placed: light, medium and dense',
    [placements('tai_bwo_jungle_vegetation_easy_1').length, placements('tai_bwo_jungle_vegetation_med_1').length, placements('tai_bwo_jungle_vegetation_hard_1').length],
    [34, 34, 9]
);
check('and sixty-two sections of rotten fence', placements('village_fence_rotten').length, 62);
check(
    'Hack is op 4 and the repeat is the hidden op 3, as woodcutting numbers them',
    [(LocType.get(LocType.getId('tai_bwo_jungle_vegetation_easy_1')).op ?? [])[3], (LocType.get(LocType.getId('tai_bwo_jungle_vegetation_easy_1')).op ?? [])[2], (LocType.get(LocType.getId('tai_bwo_jungle_vegetation_easy_5')).op ?? [])[3]],
    ['Hack', 'Hidden', null]
);
check(
    'the fence repairs through four stages to one that can only be reinforced',
    ['village_fence_rotten', 'village_fence_fixed1', 'village_fence_fixed2', 'village_fence_fixed3', 'village_fence_fixedcomplete'].map(n => (LocType.get(LocType.getId(n)).op ?? [])[0]),
    ['Repair', 'Repair', 'Repair', 'Repair', 'Reinforce']
);
check('the grove doors carry their own price', (LocType.get(LocType.getId('tbwcu_bamboo_door_l')).op ?? [])[1], 'Quick-Pay(100)');
check(
    'every event monster the table needs is in the cache',
    [
        'tbwcu_jungle_spider',
        'tbwcu_tribesman_instant',
        'tbwcu_snakejungle_appear',
        'tbwcu_mosquito_single',
        'tbwcu_mosquito_swarm3',
        'tbwcu_mosquito_swarm5',
        'tbwcu_broodoo_combat_instant',
        'tbwcu_broodoo_poison_instant',
        'tbwcu_broodoo_disease_instant'
    ].every(n => NpcType.getId(n) !== -1),
    true
);
check(
    'and the clicks have triggers now',
    [
        ScriptProvider.getByTrigger(ServerTriggerType.OPLOC4, LocType.getId('tai_bwo_jungle_vegetation_easy_1'), -1) !== null,
        ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1, LocType.getId('village_fence_rotten'), -1) !== null,
        ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1, LocType.getId('village_fence_fixedcomplete'), -1) !== null,
        ScriptProvider.getByTrigger(ServerTriggerType.OPLOC2, LocType.getId('tbwcu_bamboo_door_l'), -1) !== null
    ],
    [true, true, true, true]
);

// ------------------------------------------------------------------ the event table
console.log('');
console.log("OLD SCHOOL'S EVENT TABLE, OUT OF NINETY-NINE, READ BACK ROLL BY ROLL");
const byName = (roll: number): string => {
    const id = H.runProc(p, '[proc,tbwcu_event_npc]', [roll])[0];
    return id === -1 || id === null ? 'gem rock' : (NpcType.get(id).debugname ?? String(id));
};
const tally: Record<string, number> = {};
for (let roll = 0; roll < 99; roll++) {
    const n = byName(roll);
    tally[n] = (tally[n] ?? 0) + 1;
}
check('jungle spider 22, tribesman 21, bush snake 21', [tally['tbwcu_jungle_spider'], tally['tbwcu_tribesman_instant'], tally['tbwcu_snakejungle_appear']], [22, 21, 21]);
check('mosquitoes 8, 7 and 6', [tally['tbwcu_mosquito_single'], tally['tbwcu_mosquito_swarm3'], tally['tbwcu_mosquito_swarm5']], [8, 7, 6]);
check('gem rock 5, and the three broodoo victims 4, 3 and 2', [tally['gem rock'], tally['tbwcu_broodoo_combat_instant'], tally['tbwcu_broodoo_poison_instant'], tally['tbwcu_broodoo_disease_instant']], [5, 4, 3, 2]);

// ------------------------------------------------------------------ the way in
console.log('');
console.log('THE VILLAGE, WHICH HAS BEEN STANDING EMPTY BECAUSE INDEX 0 DRAWS NOBODY');
const CAST: [string, string][] = [
    ['gabooty', 'chat_gabooty'],
    ['murcaily', 'chat_murc'],
    ['rionasta', 'chat_rion'],
    ['sharimika', 'chat_sharimika'],
    ['layleen', 'chat_layleen'],
    ['karaday', 'chat_karaday'],
    ['safta_doc', 'chat_safta'],
    ['fanellaman', 'chat_fanellaman'],
    ['jagbakoba', 'chat_jag'],
    ['mamma_bufetta', 'chat_mamma']
];
const spawned = (name: string): Npc | null => {
    const id = NpcType.getId(name);
    for (const npc of World.npcs) if (npc && npc.type === id) return npc;
    return null;
};
check(
    'all ten villagers are placed, as multinpcs of three',
    CAST.every(([who]) => spawned(`tbwcu_${who}_multinpc`) !== null),
    true
);
check(
    '  and index 0 of every one of those draws nothing at all, which is why the village was empty',
    CAST.every(([who]) => {
        const t: any = NpcType.get(NpcType.getId(`tbwcu_${who}_multinpc`));
        const kids: number[] = t.multiNpc ?? t.multinpc ?? [];
        return kids[0] === -1 && kids[1] === NpcType.getId(`tbwcu_${who}`) && kids[2] === NpcType.getId(`tbwcu_${who}_nosticks`);
    }),
    true
);

setFavour(0);
H.setVarBit(p, 'villagers_visible', 0);
H.tick(1);
H.runProc(p, '[proc,tbwcu_login]', [], undefined, true);
check('logging in puts the village on its feet, every one of them holding nothing yet', [H.getVarBit(p, 'villagers_visible'), CAST.map(([, bit]) => H.getVarBit(p, bit))], [1, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]]);
H.setVar(p, 'junglepotion', 0);
H.tick(1);
const murcaily = spawned('tbwcu_murcaily_multinpc')!;
const talkTo = (npc: Npc, picks: number[] = [], side = 0): string =>
    heard(() => {
        const sides: [number, number][] = [
            [0, 1],
            [1, 0],
            [-1, 0],
            [0, -1]
        ];
        const [dx, dz] = sides[side % sides.length];
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        p.clearPendingAction();
        H.opNpc(p, npc, 1);
        settle(p, picks);
    });
let said2 = talkTo(murcaily);
check('Murcaily turns away anybody who has not finished Jungle Potion', said2.includes('Trufitus'), true);
H.setVar(p, 'junglepotion', JUNGLE_POTION_DONE);
H.tick(1);
said2 = talkTo(murcaily);
check('and tells anybody who has what the cleanup is', [said2.includes('thatching spars'), said2.includes('trading')], [true, true]);

// ------------------------------------------------------------------ hacking
console.log('');
console.log('HACKING THE JUNGLE');
setFavour(0);
p.setLevel(8, 60);
H.setVar(p, 'junglepotion', 0);
H.tick(1);
let said = clickLoc(JUNGLE.light.x, JUNGLE.light.z, 'tai_bwo_jungle_vegetation_easy_1', 4);
check('the jungle will not be touched without Jungle Potion behind it', said.includes('Trufitus'), true);
H.setVar(p, 'junglepotion', JUNGLE_POTION_DONE);
H.tick(1);
said = clickLoc(JUNGLE.light.x, JUNGLE.light.z, 'tai_bwo_jungle_vegetation_easy_1', 4);
check('with no machete at all it says so', said.includes('need a machete'), true);
p.setLevel(8, 9);
H.tick(1);
H.give(p, 'machette', 1);
said = clickLoc(JUNGLE.light.x, JUNGLE.light.z, 'tai_bwo_jungle_vegetation_easy_1', 4);
check('9 Woodcutting is one short of light jungle', [said.includes('level of 10'), sparCount()], [true, 0]);
p.setLevel(8, 20);
H.tick(1);
said = clickLoc(JUNGLE.dense.x, JUNGLE.dense.z, 'tai_bwo_jungle_vegetation_hard_1', 4);
check('  and 20 is a long way short of dense jungle', said.includes('level of 35'), true);

// a hack pays a spar, the experience and the favour, and the bush comes apart
p.setLevel(8, 60);
H.tick(1);
let xp = wood();
let swings = 0;
while (sparCount() === 0 && swings < 40) {
    clickLoc(JUNGLE.light.x, JUNGLE.light.z, 'tai_bwo_jungle_vegetation_easy_1', 4);
    H.tick(4);
    swings++;
}
check('a light patch gives a light thatching spar', H.invCount(p, 'thatching_spar_light') > 0, true);
check('  32 experience for the swing that worked (and 1 for any that did not)', [wood() - xp >= 320, (wood() - xp) % 10, favour() >= 3], [true, 0, true]);
check('  and the patch is a chopped-away one until it grows back', locNameAt(JUNGLE.light.x, JUNGLE.light.z), 'tai_bwo_jungle_vegetation_easy_5');

// favour is kept in tenths of a per cent, and says so when a whole one goes by
console.log('');
console.log('FAVOUR, IN TENTHS OF A PER CENT BECAUSE TEN BITS SAYS SO');
setFavour(0);
H.setVarBit(p, 'vill_comm_max', 0);
said = heard(() => {
    H.runProc(p, '[proc,tbwcu_favour_add]', [9], undefined, true);
});
check('nine tenths is not a whole per cent yet', [favour(), said], [9, '']);
said = heard(() => {
    H.runProc(p, '[proc,tbwcu_favour_add]', [1], undefined, true);
});
check('the tenth one is', [favour(), said.includes('now 1%')], [10, true]);
check('  and the save says what full means', H.getVarBit(p, 'vill_comm_max'), 1000);
H.runProc(p, '[proc,tbwcu_favour_add]', [2000], undefined, true);
check('favour stops at 100%', [favour(), H.getVarBit(p, 'favour_percentage')], [1000, 1000]);

// ------------------------------------------------------------------ the fence
console.log('');
console.log('THE FENCE, FOUR STAGES AND A SPAR AT A TIME');
setFavour(0);
H.clearInv(p);
H.give(p, 'machette', 1);
said = clickLoc(FENCE.x, FENCE.z, 'village_fence_rotten', 1);
check('no spars, no repair', said.includes('thatching spars'), true);
xp = wood();
const stages: string[] = [];
for (let i = 0; i < 4; i++) {
    H.give(p, 'thatching_spar_dense', 1);
    const name = locNameAt(FENCE.x, FENCE.z);
    clickLoc(FENCE.x, FENCE.z, name, 1);
    H.tick(4);
    stages.push(locNameAt(FENCE.x, FENCE.z));
}
check('a dense spar at a time walks a rotten section up through every stage', stages, ['village_fence_fixed1', 'village_fence_fixed2', 'village_fence_fixed3', 'village_fence_fixedcomplete']);
check('  at 65.1 experience and 0.5% favour a spar', [(wood() - xp) / 10, favour()], [260.4, 20]);
check('  and the spars are gone', H.invCount(p, 'thatching_spar_dense'), 0);

H.give(p, 'thatching_spar_dense', 1);
xp = wood();
setFavour(0);
said = clickLoc(FENCE.x, FENCE.z, 'village_fence_fixedcomplete', 1);
check('a whole section can still be reinforced, for the same spar', [(wood() - xp) / 10, favour(), H.invCount(p, 'thatching_spar_dense'), said.includes('reinforce')], [65.1, 5, 0, true]);

// A light spar is seldom enough on its own: about one in three. Measured on a second section, since
// the first one is whole now and takes half an hour to rot back.
const FENCE2 = placements('village_fence_rotten')[20];
H.clearInv(p);
H.give(p, 'machette', 1);
H.give(p, 'thatching_spar_light', 60);
// Spars do not stack, so what actually went in is a bagful - not the sixty asked for.
const sparsAtStart = H.invCount(p, 'thatching_spar_light');
setFavour(0);
xp = wood();
let advances = 0;
let before = locNameAt(FENCE2.x, FENCE2.z);
for (let i = 0; i < sparsAtStart && H.invCount(p, 'thatching_spar_light') > 0; i++) {
    const name = locNameAt(FENCE2.x, FENCE2.z);
    if (name === 'village_fence_fixedcomplete') break;
    clickLoc(FENCE2.x, FENCE2.z, name, 1);
    H.tick(4);
    if (locNameAt(FENCE2.x, FENCE2.z) !== name) advances++;
}
const spent = sparsAtStart - H.invCount(p, 'thatching_spar_light');
console.log(`  (${spent} light spars moved the section on ${advances} times, from ${before})`);
check('a light spar is enough about one time in three', [advances > 0, spent >= advances * 2], [true, true]);
check('  and every spar paid its 28.1 experience and 0.1% favour either way', [wood() - xp, favour()], [spent * 281, spent]);

// ------------------------------------------------------------------ the payout
console.log('');
console.log('TEN VILLAGERS, A HUNDRED STICKS EACH, AND THAT IS THE WHOLE OF FULL FAVOUR');
H.clearInv(p);
setFavour(1000);
H.runProc(p, '[proc,tbwcu_villagers_show]', [1], undefined, true);
let sticks = 0;
let claims = 0;
for (const [who] of CAST) {
    const before = H.invCount(p, 'village_trade_sticks');
    for (let attempt = 0; attempt < 4; attempt++) {
        const npc = spawned(`tbwcu_${who}_multinpc`);
        if (npc === null) break;
        talkTo(npc, [], attempt);
        if (H.invCount(p, 'village_trade_sticks') > before) break;
        H.tick(2);
    }
    if (H.invCount(p, 'village_trade_sticks') > before) claims++;
    sticks = H.invCount(p, 'village_trade_sticks');
}
check('a hundred full favour pays a hundred sticks from each of the ten of them', [claims, sticks, favour()], [10, 1000, 0]);
check(
    '  and every one of them is a _nosticks villager afterwards',
    CAST.map(([, bit]) => H.getVarBit(p, bit)),
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
);
said = talkTo(spawned('tbwcu_gabooty_multinpc')!);
check('asking again with nothing earned gets you nothing', [said.includes('nothing for you'), H.invCount(p, 'village_trade_sticks')], [true, 1000]);

// a single tenth of favour is one stick, and it is gone after the first villager
H.clearInv(p);
setFavour(1);
H.runProc(p, '[proc,tbwcu_villagers_show]', [1], undefined, true);
talkTo(spawned('tbwcu_gabooty_multinpc')!);
const afterFirst = H.invCount(p, 'village_trade_sticks');
said = talkTo(spawned('tbwcu_rionasta_multinpc')!);
check('one tenth of a per cent is one stick, and the other nine have nothing to give', [afterFirst, favour(), H.invCount(p, 'village_trade_sticks')], [1, 0, 1]);

// ------------------------------------------------------------------ the two counters
console.log('');
console.log("GABOOTY'S TWO SHELVES, WHICH WERE IN THE PACK WITH NOTHING POINTING AT THEM");
const shopOf = (op: number): { inv: number; currency: string; title: string } => {
    const npc = spawned('tbwcu_gabooty_multinpc')!;
    for (let attempt = 0; attempt < 4; attempt++) {
        p.closeModal();
        H.tick(1);
        const sides: [number, number][] = [
            [0, 1],
            [1, 0],
            [-1, 0],
            [0, -1]
        ];
        const [dx, dz] = sides[attempt];
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        p.clearPendingAction();
        H.opNpc(p, npc, op);
        settle(p);
        if (H.getVar(p, 'shop') !== -1) break;
    }
    return {
        inv: H.getVar(p, 'shop'),
        currency: ObjType.get(H.getVar(p, 'shop_currency')).debugname ?? '?',
        title: (() => {
            const com = Component.getId('shop_template:com_76');
            for (let i = H.ifaces.length - 1; i >= 0; i--) {
                const f = H.ifaces[i];
                if (f.kind === 'text' && f.com === com && f.text) return f.text;
            }
            return '';
        })()
    };
};
const coop = shopOf(3);
check('Trade-Co-op opens the cooperative, and it takes trading sticks', [coop.inv === InvType.getId('tai_bwo_wannai_cooperative'), coop.currency, coop.title], [true, 'village_trade_sticks', "Gabooty's Tai Bwo Wannai Cooperative"]);
const priceOf = (name: string, stock: number): number => H.runProc(p, '[proc,adjusted_item_cost_buying]', [ObjType.getId(name), stock])[0];
check('  with the published prices, read straight off the costs in the cache', [priceOf('tbw_villager_hat_cream', 50), priceOf('tbw_villager_shirt_cream', 50), priceOf('machette_redtopaz', 50)], [240, 360, 2400]);
p.closeModal();
H.tick(1);
const drinks = shopOf(4);
check('Trade-Drinks opens the Drinky Store, which no param could have named', [drinks.inv === InvType.getId('tai_bwo_wannai_drinksies'), drinks.currency, drinks.title], [true, 'village_trade_sticks', "Gabooty's Drinky Store"]);
check('  and a cocktail is thirty sticks, which is its own cost and no multiplier at all', priceOf('fruit_blast', 0), 30);
p.closeModal();
H.tick(1);

// ------------------------------------------------------------------ the gem rock
console.log('');
console.log('THE GEM ROCK THE JUNGLE WAS HIDING, FIVE TIMES IN NINETY-NINE');
H.clearInv(p);
H.give(p, 'machette_redtopaz', 1);
H.give(p, 'rune_pickaxe', 1);
p.setLevel(8, 99);
p.setLevel(14, 99); // 14 is Mining
H.tick(1);
let rockAt: { x: number; z: number } | null = null;
const patches = placements('tai_bwo_jungle_vegetation_easy_1').slice(0, 12);
for (let round = 0; round < 40 && rockAt === null; round++) {
    for (const patch of patches) {
        const name = locNameAt(patch.x, patch.z);
        if (name.startsWith('village_gem_rock')) {
            rockAt = patch;
            break;
        }
        if (name !== 'tai_bwo_jungle_vegetation_easy_1') continue;
        if (H.invCount(p, 'thatching_spar_light') > 20) (H.clearInv(p), H.give(p, 'machette_redtopaz', 1), H.give(p, 'rune_pickaxe', 1));
        clickLoc(patch.x, patch.z, name, 4);
        H.tick(3);
        if (locNameAt(patch.x, patch.z).startsWith('village_gem_rock')) {
            rockAt = patch;
            break;
        }
    }
}
if (rockAt === null) {
    check('a gem rock turned up in the jungle', 'never in 40 rounds', 'a rock');
} else {
    const rock = locNameAt(rockAt.x, rockAt.z);
    const gems = ['uncut_opal', 'uncut_jade', 'uncut_red_topaz', 'uncut_sapphire', 'uncut_emerald', 'uncut_ruby', 'uncut_diamond'];
    const held = () => gems.reduce((n, g) => n + H.invCount(p, g), 0);
    p.setLevel(14, 39);
    H.tick(1);
    said = clickLoc(rockAt.x, rockAt.z, rock, 1);
    check('39 Mining is one short of the rock', [said.includes('level of 40'), held()], [true, 0]);
    p.setLevel(14, 99);
    H.tick(1);
    const mxp = p.stats[14];
    said = clickLoc(rockAt.x, rockAt.z, rock, 1);
    check('40 is enough, and the rock pays three gems and 65 Mining experience', [held(), (p.stats[14] - mxp) / 10], [3, 65]);
    check('  and the jungle comes back where the rock was', locNameAt(rockAt.x, rockAt.z) !== rock, true);
}

// ------------------------------------------------------------------ the grove
console.log('');
console.log('THE HARDWOOD GROVE DOORS, AT THE PRICE WRITTEN ON THEM');
H.clearInv(p);
said = clickLoc(DOOR.x, DOOR.z, 'tbwcu_bamboo_door_l', 2);
check('a hundred trading sticks, and you have none', said.includes('100 trading sticks'), true);
H.give(p, 'village_trade_sticks', 150);
said = clickLoc(DOOR.x, DOOR.z, 'tbwcu_bamboo_door_l', 2);
check('Quick-Pay takes exactly a hundred of them', [H.invCount(p, 'village_trade_sticks'), H.getVarBit(p, 'hardwood_grove_paid')], [50, 1]);
check('  and both halves of the gate are out of the way', [locNameAt(DOOR.x, DOOR.z), locNameAt(DOOR.x, DOOR.z + 1)], ['(nothing)', '(nothing)']);
H.tick(12);
check('  until they swing back', locNameAt(DOOR.x, DOOR.z), 'tbwcu_bamboo_door_l');
// walking back out is free, and it clears the bit
said = clickLoc(DOOR.x, DOOR.z, 'tbwcu_bamboo_door_l', 1, [], [DOOR.x + 1, DOOR.z]);
check('leaving the grove costs nothing and the next visit is paid for again', [H.invCount(p, 'village_trade_sticks'), H.getVarBit(p, 'hardwood_grove_paid')], [50, 0]);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
