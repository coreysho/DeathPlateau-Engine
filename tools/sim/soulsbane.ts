// A Soul's Bane, end to end against the real engine - run with `npx tsx tools/sim/soulsbane.ts`.
//
//   monsters     the four angry monsters have OSRS's 200 hitpoints and their own attack, block and
//                death animations; every room's monsters have real stats
//   weapons      an angry monster takes nothing from the wrong anger weapon (or any other), and ten
//                times the damage from its own; only that damage fills the rage bar
//   anger        the rage bar boils over: the room is cleared, 40 Attack experience, the fire goes out
//   exits        the Anger room's way on is shut until then and opens after; its Exit goes to the
//                surface (both did nothing before)
//   teleport     a normal teleport works from the rift (it said "above level 20 Wilderness"), and
//                still does not from level 54 of the real Wilderness
//   quest        Launa, the rope, the Fear holes, the Confusion illusions and doors, the three forms
//                of the Hopeless creatures, Tolna's three heads, and the reward on the surface
//   last room    the OSRS transcript's "Finding Tolna": Brana and Tolna have it out while the heads
//                hold off, then they hunt; Brana's lines before and after; Tolna himself on the narrow
//                path once all three heads are down, his talk with Brana, and the three of you taken
//                up - Tolna by the rift, Launa gone home; his account and the coins on the surface
//   leaving      an Exit asks "Do you wish to leave?", and "Yes" starts the room over
//   Launa        what she says at every stage, before and after each room is entered
import * as H from './harness.ts';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import SeqType from '#/cache/config/SeqType.js';
import ParamType from '#/cache/config/ParamType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import { findPathToLoc, canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();
H.loginOrder();

let ok = 0, bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const truthy = (what: string, pass: boolean, got: unknown) => {
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}`);
};

const SURFACE = [3310, 3455];
const RIFT = [3310, 3452];
const prog = (p: Player) => H.getVarBit(p, 'soulbane_prog');
const at = (p: Player) => [p.x, p.z, p.level];
const pack = (level: number, x: number, z: number) => CoordGrid.packCoord(level, x, z);
const npcParam = (npc: string, param: string) => NpcType.get(NpcType.getId(npc)).params.get(ParamType.getId(param));
const seq = (name: string) => SeqType.getId(name);

/** Click through whatever dialogue is open, taking `picks` at menus in order. */
function drain(p: Player, picks: number[] = []) {
    for (let guard = 0; guard < 300; guard++) {
        const s = p.activeScript;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (!s && guard > 2) break;
            H.tick(1);
            continue;
        }
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
    }
    H.tick(2);
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
}

/** Click a loc op and wait for the walk and the script. */
function useLoc(p: Player, x: number, z: number, loc: string, op = 1, ticks = 12, picks: number[] = []) {
    H.opLoc(p, x, z, loc, op);
    H.tick(ticks);
    drain(p, picks);
}

/** What OpLocUHandler does: an inventory item used on a loc. */
function itemOnLoc(p: Player, objName: string, x: number, z: number, locName: string) {
    const obj = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    let slot = -1;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === obj) { slot = i; break; }
    if (slot === -1) throw new Error('not carrying ' + objName);
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, p.level, id)!;
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.lastUseItem = obj;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    H.tick(10);
    drain(p);
}

function talkTo(p: Player, npc: Npc, picks: number[] = []) {
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(1);
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
    drain(p, picks);
}
/** Everything the chatbox showed the player since `from` (an H.ifaces index), as one string. */
const shown = (p: Player, from: number) => H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && !!i.text && i.text.length > 1).map(i => i.text!).join(' ');
function talkText(p: Player, npc: Npc, picks: number[] = []) {
    const from = H.ifaces.length;
    talkTo(p, npc, picks);
    return shown(p, from);
}
const saidBy = (p: Player) => H.says.filter(x => x.who === p.username).map(x => x.text);

const liveNpcs = (name: string, x: number, z: number, level: number, range = 30): Npc[] => {
    const id = NpcType.getId(name);
    const out: Npc[] = [];
    for (const n of World.npcs) {
        if (n && n.isActive && n.type === id && n.level === level && Math.max(Math.abs(n.x - x), Math.abs(n.z - z)) <= range) out.push(n);
    }
    return out;
};
const remove = (n: Npc) => World.removeNpc(n, -1);

/** Attack an npc until it is gone or the ticks run out. Returns the ticks it took. */
function fight(p: Player, npc: Npc, maxTicks = 80): number {
    for (let t = 0; t < maxTicks; t++) {
        if (!npc.isActive) return t;
        // the Attack click, with the route a client sends along with it
        if (t % 4 === 0 && (!p.target || p.target !== npc)) H.opNpc(p, npc, 2);
        H.tick(1);
        if (p.activeScript && p.activeScript.execution === ScriptState.PAUSEBUTTON) drain(p);
    }
    return maxTicks;
}
const heal = (p: Player) => p.setLevel(PlayerStat.HITPOINTS, 99);
/** Is (tx,tz) reachable on foot from (x,z)? A flood over the real collision map. */
function walkable(level: number, x: number, z: number, tx: number, tz: number): boolean {
    const seen = new Set<string>([`${x},${z}`]);
    const q: [number, number][] = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.shift()!;
        if (cx === tx && cz === tz) return true;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = `${cx + dx},${cz + dz}`;
            if (!seen.has(k) && Math.abs(cx + dx - x) < 40 && Math.abs(cz + dz - z) < 40 && canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([cx + dx, cz + dz]);
            }
        }
    }
    return false;
}

// =============================================================================================
console.log('MONSTERS');
for (const [npc, anims] of [
    ['soulbane_anger_bear', ['bear_attack', 'bear_block', 'bear_death']],
    ['soulbane_anger_unicorn', ['unicorn_attack', 'unicorn_block', 'unicorn_death']],
    ['soulbane_anger_rat', ['giantrat_attack', 'giantrat_block', 'giantrat_death']],
    ['soulbane_anger_goblin', ['goblin_attack_unarmed', 'goblin_block', 'goblin_death']]
] as [string, string[]][]) {
    const t = NpcType.get(NpcType.getId(npc));
    check(`${npc} hitpoints / attack / strength / defence`, [t.stats[3], t.stats[0], t.stats[2], t.stats[1]], [200, 37, 38, 38]);
    check(`  its attack, block and death animations`, [npcParam(npc, 'attack_anim'), npcParam(npc, 'defend_anim'), npcParam(npc, 'death_anim')], anims.map(seq));
}
for (const [npc, hp] of [['soulbane_fear_reaper', 25], ['soulbane_confu_creeper', 28], ['soulbane_confu_creeper_fake1', 28], ['soulbane_hope_monst3', 25], ['soulbane_hope_monst1', 25], ['soulbane_final_tolna1', 37], ['soulbane_final_tolna3', 37]] as [string, number][]) {
    check(`${npc} hitpoints`, NpcType.get(NpcType.getId(npc)).stats[3], hp);
}

// =============================================================================================
console.log('START');
const a = H.makePlayer('soulbane_a', SURFACE[0], SURFACE[1], 71);
const b = H.makePlayer('soulbane_b', SURFACE[0] + 1, SURFACE[1], 72);
H.tick(2);
for (const p of [a, b]) {
    H.maxOut(p);
    H.clearInv(p);
}
useLoc(a, RIFT[0], RIFT[1], 'soulbane_falloff2_rope_multi');
truthy('the rift before Launa: still on the surface', a.z < 4000, at(a));
check('  and not started', prog(a), 0);
const launa = H.npcNear('soulbane_launa_multi', 3309, 3453)!;
const launaStart = talkText(a, launa, [1]);
check('Launa asks for help: stage 1', prog(a), 1);
truthy('  in the transcript\'s words (25 years; "just attach it at the edge")', launaStart.includes('25 years') && launaStart.includes('attach it at the edge'), launaStart.slice(0, 120));
a.teleport(SURFACE[0], SURFACE[1], 0);
H.tick(1);
useLoc(a, RIFT[0], RIFT[1], 'soulbane_falloff2_rope_multi');
truthy('no rope yet: the rift will not take you', a.z < 4000 && prog(a) === 1, at(a));
truthy('  and says why', H.ifaces.some(i => i.who === a.username && !!i.text?.includes('tie a rope')), 'tie a rope');
H.give(a, 'rope');
itemOnLoc(a, 'rope', RIFT[0], RIFT[1], 'soulbane_falloff2_rope_multi');
check('the rope goes on the rift', [H.getVarBit(a, 'soulbane_riftrope_pres'), H.invCount(a, 'rope')], [1, 0]);
useLoc(a, RIFT[0], RIFT[1], 'soulbane_falloff2_rope_multi', 1, 14);
check('down the rope: the Anger room, stage 2', [at(a), prog(a)], [[3015, 5241, 0], 2]);
for (const n of ['soulbane_anger_bear', 'soulbane_anger_unicorn', 'soulbane_anger_rat', 'soulbane_anger_goblin']) {
    const live = liveNpcs(n, 3020, 5232, 0);
    check(`  ${n} in the room, at full health`, live.map(x => x.levels[3]), [200]);
}

// =============================================================================================
console.log('TELEPORT');
check('wilderness level in the Anger room', H.runProc(a, '[proc,wilderness_level]', [pack(0, 3015, 5241)])[0], 0);
check('wilderness level in Tolna\'s room', H.runProc(a, '[proc,wilderness_level]', [pack(1, 2970, 5212)])[0], 0);
check('wilderness level at 3100,3950 (real Wilderness)', H.runProc(a, '[proc,wilderness_level]', [pack(0, 3100, 3950)])[0], 54);
check('wilderness level at the Edgeville dungeon\'s Wilderness end', H.runProc(a, '[proc,wilderness_level]', [pack(0, 3100, 9950)])[0] > 0, true);
check('wilderness level in the Abyss (untouched)', H.runProc(a, '[proc,wilderness_level]', [pack(0, 3040, 4830)])[0] > 20, true);
const tele = (p: Player) => {
    H.give(p, 'lawrune', 1);
    H.give(p, 'airrune', 3);
    H.give(p, 'firerune', 1);
    const from = H.mesgs.length;
    H.ifButton(p, 'magic:varrock_teleport');
    H.tick(8);
    return H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);
};
b.teleport(3015, 5240, 0);
H.tick(2);
const bm = tele(b);
truthy('Varrock teleport from the Anger room works', Math.abs(b.x - 3213) < 20 && Math.abs(b.z - 3424) < 20, { at: at(b), mes: bm });
b.teleport(3100, 3950, 0);
H.tick(2);
const wm = tele(b);
truthy('  and is still blocked at level 54 Wilderness', b.x === 3100 && b.z === 3950 && wm.some(m => m.includes('level 20 wilderness')), { at: at(b), mes: wm });
H.clearInv(b);

// =============================================================================================
console.log('EXITS');
b.teleport(3015, 5242, 0);
H.setVarBit(b, 'soulbane_prog', 2);
H.tick(1);
useLoc(b, 3015, 5245, 'soul_bane_awall_void_small', 1, 12, [2]);
truthy('the Anger room\'s Exit asks first: "No, I\'ll finish this room first." stays', b.z > 5000, at(b));
useLoc(b, 3015, 5245, 'soul_bane_awall_void_small', 1, 12, [1]);
check('  "Yes, I don\'t mind starting this room again." goes back up', at(b), [SURFACE[0], SURFACE[1], 0]);
a.teleport(3036, 5228, 0);
H.tick(1);
useLoc(a, 3038, 5228, 'soul_bane_awall_void_exit');
truthy('the way on is shut while the fire burns (still in the Anger room)', a.x >= 3010 && a.x <= 3038 && a.z >= 5218 && prog(a) === 2, at(a));

// =============================================================================================
console.log('WEAPONS');
a.teleport(3013, 5241, 0);
H.tick(1);
H.opLoc(a, 3012, 5243, 'soulbane_rack_multi', 1);
H.tick(6);
drain(a, [1]); // the sword
check('the rack gives the anger sword', H.invCount(a, 'soulbane_anger_swordq'), 1);
H.opLoc(a, 3012, 5243, 'soulbane_rack_multi', 1);
H.tick(6);
drain(a);
check('  and no second weapon while you hold one', H.invCount(a, 'soulbane_anger_spearq'), 0);
H.opheld(a, 'soulbane_anger_swordq', 2);
H.tick(2);
check('  wielded', a.getInventory(InvType.WORN)!.get(3)?.id, ObjType.getId('soulbane_anger_swordq'));

// one monster at a time: the others would join in and single-combat would stop the next swing
const only = (keep: string) => {
    for (const n of ['soulbane_anger_bear', 'soulbane_anger_unicorn', 'soulbane_anger_rat', 'soulbane_anger_goblin']) {
        if (n !== keep) for (const x of liveNpcs(n, 3020, 5232, 0)) remove(x);
    }
};
only('soulbane_anger_bear');
const bear = liveNpcs('soulbane_anger_bear', 3020, 5232, 0)[0];
a.teleport(bear.x - 1, bear.z, 0);
H.tick(1);
H.npcHits.length = 0;
fight(a, bear, 40);
const bearHits = H.npcHitsFor('soulbane_anger_bear').map(h => h.damage);
truthy('the sword on the bear: every swing lands for 0', bearHits.length >= 5 && bearHits.every(d => d === 0), bearHits);
check('  the bear is untouched and the rage bar empty', [bear.levels[3], H.getVarBit(a, 'soulbane_anger_damagedealt')], [200, 0]);
// the same with an ordinary weapon
H.give(a, 'rune_scimitar');
H.opheld(a, 'rune_scimitar', 2);
H.tick(2);
H.npcHits.length = 0;
fight(a, bear, 30);
const scimHits = H.npcHitsFor('soulbane_anger_bear').map(h => h.damage);
truthy('a rune scimitar on the bear: 0 too', scimHits.length >= 4 && scimHits.every(d => d === 0), scimHits);
H.opheld(a, 'soulbane_anger_swordq', 2);
H.tick(2);
remove(bear);
a.clearInteraction?.();
H.tick(12); // out of combat
H.runProc(a, '[proc,soulbane_stock_anger]');
check('the room restocks', ['soulbane_anger_bear', 'soulbane_anger_unicorn', 'soulbane_anger_rat', 'soulbane_anger_goblin'].map(n => liveNpcs(n, 3020, 5232, 0).length), [1, 1, 1, 1]);

// the sword on the unicorn, until the rage bar boils over
H.npcHits.length = 0;
const xpBefore = a.stats[PlayerStat.ATTACK];
let kills = 0;
for (let round = 0; round < 25 && prog(a) === 2; round++) {
    only('soulbane_anger_unicorn');
    const u = liveNpcs('soulbane_anger_unicorn', 3020, 5232, 0)[0];
    if (!u) {
        H.tick(2);
        continue;
    }
    heal(a);
    a.teleport(u.x - 1, u.z, 0);
    H.tick(1);
    fight(a, u, 80);
    if (!u.isActive) kills++;
    H.tick(6);
}
const uHits = H.npcHitsFor('soulbane_anger_unicorn').map(h => h.damage).filter(d => d > 0);
truthy('the sword on the unicorn hits for ten times a normal swing', uHits.length > 0 && Math.max(...uHits) > 25, { max: Math.max(...uHits), hits: uHits.length });
truthy(`  a new unicorn comes after each (${kills} killed)`, kills >= 5, kills);
check('the rage bar boils over: stage 3 (Fear)', prog(a), 3);
check('  exactly 40 Attack experience, nothing for the kills', a.stats[PlayerStat.ATTACK] - xpBefore, 400);
check('  the fire is out', H.getVarBit(a, 'soulbane_anger_flamepres'), 1);
check('  no angry monster left in the room', ['soulbane_anger_bear', 'soulbane_anger_unicorn', 'soulbane_anger_rat', 'soulbane_anger_goblin'].map(n => liveNpcs(n, 3020, 5232, 0).length), [0, 0, 0, 0]);
a.teleport(3036, 5228, 0);
H.tick(2);
useLoc(a, 3038, 5228, 'soul_bane_awall_void_exit');
check('now the way on leads into the Fear room', at(a), [3048, 5235, 0]);
check('  and the anger sword stays behind', [H.invCount(a, 'soulbane_anger_swordq'), a.getInventory(InvType.WORN)!.get(3)?.id ?? -1], [0, -1]);

// =============================================================================================
console.log('FEAR');
H.setVar(a, 'debug_onehit', 1);
const HOLES: [string, number, number][] = [
    ['soul_bane_fwall_void', 3065, 5245],
    ['soul_bane_fwall_void2', 3068, 5227],
    ['soul_bane_fwall_void3', 3063, 5219],
    ['soul_bane_fwall_void4', 3052, 5219],
    ['soul_bane_fwall_void5', 3046, 5229],
    ['soul_bane_fwall_void6', 3046, 5239]
];
const wrongHole = (H.getVarBit(a, 'soulbane_fear_enemydoor') % 6);
useLoc(a, HOLES[wrongHole][1], HOLES[wrongHole][2], HOLES[wrongHole][0]);
check('an empty hole: no reaper', liveNpcs('soulbane_fear_reaper', 3056, 5232, 0).length, 0);
const seenHoles = new Set<number>();
for (let i = 0; i < 12 && prog(a) === 3; i++) {
    const door = H.getVarBit(a, 'soulbane_fear_enemydoor');
    seenHoles.add(door);
    const [loc, x, z] = HOLES[door - 1];
    a.teleport(3056, 5232, 0); // the middle of the room; from there every hole is a short walk
    H.tick(1);
    useLoc(a, x, z, loc, 1, 25);
    // it comes straight at you, and auto-retaliate may well have finished it already
    const r = liveNpcs('soulbane_fear_reaper', 3056, 5232, 0)[0];
    heal(a);
    if (r) fight(a, r, 40);
    H.tick(3);
}
truthy('  the player talks himself out of it, kill by kill (overheads)', ["I don't like looking in these holes but I must!", "I don't feel quite so afraid now.", "These holes aren't that spooky.", "This isn't so scary after all!"].every(t => saidBy(a).includes(t)), saidBy(a));
check('five reapers: stage 4 (Confusion), the black hole lit', [prog(a), H.getVarBit(a, 'soulbane_fear_killedtally'), H.getVarBit(a, 'soulbane_fear_exitlit')], [4, 5, 1]);
truthy('  the reaper moved holes between kills', seenHoles.size >= 2, [...seenHoles]);
a.teleport(3047, 5235, 0);
H.tick(1);
useLoc(a, 3046, 5235, 'soulbane_fwall_exit_multi');
check('through the black hole: the Confusion room', at(a), [3056, 5208, 0]);

// =============================================================================================
console.log('CONFUSION');
const fakes = ['soulbane_confu_creeper_fake1', 'soulbane_confu_creeper_fake2', 'soulbane_confu_creeper_fake3', 'soulbane_confu_creeper_fake4'];
check('five beasts, one real', ['soulbane_confu_creeper', ...fakes].map(n => liveNpcs(n, 3056, 5200, 0).length), [1, 1, 1, 1, 1]);
H.setVar(a, 'debug_onehit', 0);
const fake = liveNpcs('soulbane_confu_creeper_fake1', 3056, 5200, 0)[0];
H.npcHits.length = 0;
heal(a);
a.teleport(fake.x - 1, fake.z, 0);
H.tick(1);
fight(a, fake, 80);
const fakeHits = H.npcHitsFor('soulbane_confu_creeper_fake1').map(h => h.damage);
check('an illusion takes nothing and fades after eight hits', [fakeHits.every(d => d === 0), fakeHits.length, fake.isActive], [true, 8, false]);
H.setVar(a, 'debug_onehit', 1);
for (let i = 0; i < 8 && prog(a) === 4; i++) {
    const real = liveNpcs('soulbane_confu_creeper', 3056, 5200, 0)[0];
    if (!real) {
        H.tick(3);
        continue;
    }
    heal(a);
    a.teleport(real.x - 1, real.z, 0);
    H.tick(1);
    fight(a, real, 40);
    H.tick(4);
}
check('five real ones: five doors gone, the sixth open, stage 5', [1, 2, 3, 4, 5].map(n => H.getVarBit(a, `soulbane_confu_door${n}pres`)).concat([H.getVarBit(a, 'soulbane_confu_door6open'), prog(a)]), [1, 1, 1, 1, 1, 1, 5]);
a.teleport(3050, 5200, 0);
H.tick(1);
useLoc(a, 3051, 5200, 'soulbane_door_multi6');
check('through the last door: the Hopelessness room', at(a), [3021, 5208, 0]);

// =============================================================================================
console.log('HOPELESSNESS');
check('five hopeless creatures', liveNpcs('soulbane_hope_monst3', 3021, 5200, 0).length, 5);
a.teleport(3020, 5189, 0);
H.tick(1);
useLoc(a, 3020, 5188, 'soul_bane_hwall_void_exit');
check('the way on does nothing before the bridge', [a.x, a.z], [3020, 5189]);
let shrank = false;
for (let i = 0; i < 40 && prog(a) === 5; i++) {
    const n = ['soulbane_hope_monst3', 'soulbane_hope_monst2', 'soulbane_hope_monst1'].flatMap(t => liveNpcs(t, 3021, 5200, 0))[0];
    if (!n) {
        H.tick(2);
        continue;
    }
    heal(a);
    a.teleport(n.x - 1, n.z, 0);
    H.tick(1);
    fight(a, n, 40);
    H.tick(2);
    if (liveNpcs('soulbane_hope_monst2', 3021, 5200, 0).length) shrank = true;
}
truthy('a creature comes back smaller when it falls', shrank, shrank);
check('fifteen falls: the bridge, stage 6', [H.getVarBit(a, 'soulbane_hope_killedtally'), H.getVarBit(a, 'soulbane_hope_bridgepres'), prog(a)], [15, 1, 6]);
truthy('  one remark per creature gone for good, as in the transcript', ['Is there any end to killing these monsters?', 'This is hard work!', "I've almost killed them all now!", 'Maybe if I kill one more?'].every(t => saidBy(a).includes(t)), saidBy(a).slice(-4));
a.teleport(3020, 5189, 0);
H.tick(1);
// Through the exit beyond the bridge: the scene with Brana plays before anything attacks.
const cutFrom = H.ifaces.length;
H.opLoc(a, 3020, 5188, 'soul_bane_hwall_void_exit', 1);
for (let t = 0; t < 20 && !(a.level === 1 && a.activeScript && a.activeScript.execution === ScriptState.PAUSEBUTTON); t++) H.tick(1);
check('over the bridge: Tolna\'s room', at(a), [2970, 5212, 1]);
check('  which is multicombat', H.runProc(a, '[proc,wilderness_level]', [pack(1, 2970, 5212)])[0] === 0 && World.gameMap.isMulti(pack(1, 2975, 5212)), true);

// =============================================================================================
console.log('TOLNA');
const heads = ['soulbane_final_tolna1', 'soulbane_final_tolna2', 'soulbane_final_tolna3'];
check('three heads and Brana', heads.concat(['soulbane_brana']).map(n => liveNpcs(n, 2976, 5212, 1).length), [1, 1, 1, 1]);
check('  the heads hold off while Brana talks to his son (huntrange 0)', heads.map(h => liveNpcs(h, 2976, 5212, 1).map(n => n.huntrange)[0]), [0, 0, 0]);
drain(a);
const cut = shown(a, cutFrom);
truthy('"Finding Tolna", word for word: Brana pleads, Tolna rejects him, then turns on you', ['Son! Is that you?', 'no longer the boy you once knew', 'Something evil in this dungeon has morphed my body and mind.', 'You had your chance to help me', 'Lies!', 'Ah, we have a visitor!', 'Your father isn\'t lying.', 'then you shall both die!'].every(t => cut.includes(t)), cut.slice(0, 240));
check('  the scene is marked seen', H.getVarBit(a, 'soulbane_final_seencut'), 1);
check('  and the heads hunt again (their own huntrange, 12)', heads.map(h => liveNpcs(h, 2976, 5212, 1).map(n => n.huntrange)[0]), [12, 12, 12]);
const brana = liveNpcs('soulbane_brana', 2976, 5212, 1)[0];
const branaBefore = talkText(a, brana);
truthy('Brana: "Now you must do what I cannot, conquer the physical dilemma!"', branaBefore.includes('conquer the physical dilemma!'), branaBefore.slice(0, 160));

a.teleport(2976, 5212, 1); // in the open, where all three can see you
H.tick(1);
// A sim player has no client, so no npc "observes" it and aggressive hunts never fire here
// (World: rsbuf.getNpcObservers). Put the heads onto the player the way their hunt would.
H.hits.length = 0;
for (const h of heads) for (const n of liveNpcs(h, 2976, 5212, 1)) H.setNpcMode(n, 'APPLAYER2', a);
H.tick(15);
const headPos = heads.map(h => liveNpcs(h, 2976, 5212, 1).map(n => [n.x, n.z])[0]);
truthy('  the heads attack at once, in multicombat, without moving (hits in 15 ticks)', H.hitsFor(a.username).length >= 4, H.hitsFor(a.username).map(h => h.damage));
check('  still where they were put', headPos, [[2973, 5205], [2981, 5213], [2973, 5220]]);
for (const h of heads) {
    const n = liveNpcs(h, 2976, 5212, 1)[0];
    if (!n) continue;
    heal(a);
    const m0 = H.mesgs.length;
    fight(a, n, 40);
    if (process.env.SB_DEBUG) console.log('   ', h, 'at', n.x, n.z, 'active', n.isActive, 'hp', n.levels[3], 'me', at(a), H.mesgs.slice(m0).filter(m => m.who === a.username).map(m => m.text));
    H.tick(2);
}
H.tick(4);
drain(a);
check('all three heads down', [1, 2, 3].map(n => H.getVarBit(a, `soulbane_final_tol${n}dead`)), [1, 1, 1]);
const tolna = liveNpcs('soulbane_tolna_top', 2976, 5212, 1)[0];
truthy('  and Tolna is himself again, on the narrow path into the chasm (2982-2985,5212)', !!tolna && tolna.z === 5212 && tolna.level === 1 && tolna.x >= 2982 && tolna.x <= 2985, tolna ? [tolna.x, tolna.z, tolna.level] : null);
truthy('  which is a walk from the way in', walkable(1, 2970, 5212, 2982, 5212), 'flood 2970,5212 -> 2982,5212');
const branaAfter = talkText(a, brana);
truthy('Brana, after: "Please talk to him, make sure he\'s OK!"', branaAfter.includes('make sure he'), branaAfter);
const tolnaTalk = tolna ? talkText(a, tolna) : '';
truthy('Tolna: the legacy of a civilisation, and Brana forgives him', tolnaTalk.includes('legacy of a civilisation') && tolnaTalk.includes('She misses you dearly!') && tolnaTalk.includes('never gave up hope'), tolnaTalk.slice(0, 200));
check('then the three of you are back up: Tolna by the rift, Launa gone home', [at(a), H.getVarBit(a, 'soulbane_tolna_pres'), H.getVarBit(a, 'soulbane_launa_pres')], [[SURFACE[0], SURFACE[1], 0], 1, 1]);
H.setVar(a, 'debug_onehit', 0);
const defBefore = a.stats[PlayerStat.DEFENCE];
const hpBefore = a.stats[PlayerStat.HITPOINTS];
const coinsBefore = H.invCount(a, 'coins');
const surfaceTalk = talkText(a, H.npcNear('soulbane_tolna_multi', 3308, 3452)!);
truthy('Tolna on the grass: what happened to him, and "just a few coins"', surfaceTalk.includes('ground swallowed me whole') && surfaceTalk.includes('just a few coins'), surfaceTalk.slice(0, 200));
check('  which completes the quest', prog(a), 7);
check('  500 Defence and 500 Hitpoints experience, 500 coins', [a.stats[PlayerStat.DEFENCE] - defBefore, a.stats[PlayerStat.HITPOINTS] - hpBefore, H.invCount(a, 'coins') - coinsBefore], [5000, 5000, 500]);
a.teleport(SURFACE[0], SURFACE[1], 0);
H.tick(1);
useLoc(a, RIFT[0], RIFT[1], 'soulbane_falloff2_rope_multi', 1, 14);
check('after the quest the rift leads to Tolna\'s rift', at(a), [3297, 9824, 0]);
useLoc(a, 3297, 9823, 'soulbane_rope_up');
check('  and its rope back up', at(a), [SURFACE[0], SURFACE[1], 0]);

// =============================================================================================
console.log('LEAVING');
H.setVarBit(b, 'soulbane_prog', 6);
H.setVarBit(b, 'soulbane_final_seencut', 1);
H.setVarBit(b, 'soulbane_final_tol1dead', 1);
b.teleport(2970, 5212, 1);
H.tick(1);
useLoc(b, 2967, 5212, 'soul_bane_tolna_void_small', 1, 12, [2]);
truthy('Tolna\'s room Exit, "No, I\'ll finish this room first.": still there, the head still down', b.level === 1 && H.getVarBit(b, 'soulbane_final_tol1dead') === 1, [at(b), H.getVarBit(b, 'soulbane_final_tol1dead')]);
useLoc(b, 2967, 5212, 'soul_bane_tolna_void_small', 1, 12, [1]);
check('  "Yes, I don\'t mind starting this room again.": up, and the room starts over', [at(b), H.getVarBit(b, 'soulbane_final_tol1dead')], [[SURFACE[0], SURFACE[1], 0], 0]);

// =============================================================================================
console.log('LAUNA');
const launaAt = (stage: number, bits: Record<string, number>) => {
    H.setVarBit(b, 'soulbane_prog', stage);
    for (const [k, v] of Object.entries(bits)) H.setVarBit(b, k, v);
    return talkText(b, H.npcNear('soulbane_launa_multi', 3309, 3453)!);
};
for (const [stage, bits, want] of [
    [1, {}, 'Go into the rift beside me and find my husband and son!'],
    [2, { soulbane_room_entered: 1 }, 'Feel my ANGER!'],
    [3, { soulbane_room_entered: 0 }, 'I managed to defeat the monsters in the room!'],
    [3, { soulbane_room_entered: 1 }, 'Help him get over his fear!'],
    [4, { soulbane_room_entered: 0 }, 'an exit has been illuminated.'],
    [4, { soulbane_room_entered: 1 }, 'overcome his confusion!'],
    [5, { soulbane_room_entered: 0 }, 'I have prevailed over a third room.'],
    [5, { soulbane_room_entered: 1 }, 'You must fight to give him back his hope!'],
    [6, { soulbane_final_seencut: 0 }, 'I have endured against hopelessness'],
    [6, { soulbane_final_seencut: 1, soulbane_final_tol1dead: 0 }, 'no longer physically what he once was.'],
    [6, { soulbane_final_seencut: 1, soulbane_final_tol1dead: 1, soulbane_final_tol2dead: 1, soulbane_final_tol3dead: 1 }, 'I have returned your son to his normal state!']
] as [number, Record<string, number>, string][]) {
    const said = launaAt(stage, bits);
    truthy(`Launa at stage ${stage} ${JSON.stringify(bits)}: "${want}"`, said.includes(want), said.slice(0, 120));
}

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
