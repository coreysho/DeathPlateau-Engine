// Horror from the Deep, round 2: the two lighthouses and the Dagannoth Mother.
// Usage: npx tsx tools/sim/horror2.ts
//
// The 377 cache has the lighthouse twice - m39_56, the real one (working mechanism, Jossik well
// upstairs, Larrissa outside), and m38_71, the same island ransacked (broken mechanism, blood, Larrissa
// inside). From the door opening until the Mother is dead the player is in the copy. Checked here:
// the doorway by stage, both directions; the stairs on every floor of both; the lighting puzzle on the
// copy's broken mechanism; the ladders down to the one basement and back up into the right copy;
// login in the wrong copy; and the Mother - her hitpoints out of the water and after a colour change,
// her stat block, the colour messages, wrong-element spells splashing, her drop.
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import SeqType from '#/cache/config/SeqType.js';
import { PlayerQueueType } from '#/engine/entity/PlayerQueueRequest.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

let bucket = 1;
function player(name: string, x: number, z: number, level = 0, vars: Record<string, number> = {}) {
    const p = H.makePlayer(name, x, z, bucket++);
    if (level) p.teleport(x, z, level);
    for (const [k, v] of Object.entries(vars)) H.setVar(p, k, v); // before the login script runs
    H.tick(1);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(1);
    return p;
}
const at = (p: Player) => [p.x, p.z, p.level];
const mesSince = (p: Player, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);
const lastMes = (p: Player) => mesSince(p, 0).slice(-1)[0] ?? '';
const locAt = (x: number, z: number, level: number, name: string) => World.getLoc(x, z, level, LocType.getId(name)) !== null;

function drive(p: Player, picks: number[] = [], guardTicks = 3): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 400 && idle < guardTicks; guard++) {
        const s = p.activeScript;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (!s && !p.delayed && [...p.queue.all()].length === 0 && !p.target) idle++;
            else idle = 0;
            H.tick(1);
            continue;
        }
        idle = 0;
        const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
        const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
        if (multi) {
            const pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + open);
            H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
        } else {
            p.executeScript(s, true, true);
        }
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}
function op(p: Player, x: number, z: number, locName: string, n = 1, picks: number[] = []) {
    H.opLoc(p, x, z, locName, n);
    return drive(p, picks);
}
function talkTo(p: Player, npc: Npc, picks: number[] = []) {
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
    return drive(p, picks);
}
function useOn(p: Player, x: number, z: number, locName: string, objName: string, picks: number[] = []) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    const obj = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    let slot = -1;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === obj) { slot = i; break; }
    if (slot === -1) throw new Error('not carrying ' + objName);
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.lastUseItem = obj;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p, picks);
}
function connected(level: number, x: number, z: number, tx: number, tz: number, radius = 40): boolean {
    const seen = new Set<string>([x + ',' + z]);
    const q = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        if (cx === tx && cz === tz) return true;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz, k = nx + ',' + nz;
            if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.add(k); q.push([nx, nz]); }
        }
    }
    return false;
}
/** Run a proc with an npc active and read back what it returned. */
function npcProc(npc: Npc, p: Player, name: string): number[] {
    const script = ScriptProvider.getByName(`[proc,${name}]`);
    if (!script) throw new Error('no proc ' + name);
    const state = ScriptRunner.init(script, npc, p, []);
    ScriptRunner.execute(state);
    return (state as any).intStack.slice(0, (state as any).isp);
}
const param = (npcName: string, name: string) => NpcType.get(NpcType.getId(npcName)).params.get(ParamType.getId(name));
const stats = (npcName: string) => [...NpcType.get(NpcType.getId(npcName)).stats];

// The copy is the real lighthouse moved by (-64, +960).
const CX = -64, CZ = 960;
const REAL = { door: [2509, 3636], cog: [2507, 3639], ladder: [2509, 3644], stairsBase: [2506, 3640], stairsTop: [2506, 3641] };
const copy = (xz: number[]) => [xz[0] + CX, xz[1] + CZ];
const COPY = { door: copy(REAL.door), cog: copy(REAL.cog), ladder: copy(REAL.ladder), stairsBase: copy(REAL.stairsBase), stairsTop: copy(REAL.stairsTop) };

console.log('THE TWO LIGHTHOUSES (cache)');
check('real lighthouse: the working mechanism on the top floor', [locAt(REAL.cog[0], REAL.cog[1], 2, 'horror_lighthouse_cog'), locAt(REAL.cog[0], REAL.cog[1], 2, 'horror_lighthouse_cog_broken')], [true, false]);
check('the copy: the broken one at the same tile', [locAt(COPY.cog[0], COPY.cog[1], 2, 'horror_lighthouse_cog_broken'), locAt(COPY.cog[0], COPY.cog[1], 2, 'horror_lighthouse_cog')], [true, false]);
const near = (n: Npc | null, x: number, z: number) => n !== null && Math.abs(n.x - x) <= 6 && Math.abs(n.z - z) <= 6;
check('Larrissa outside the real one, and inside the copy', [near(H.npcNear('horror_girlfriend_prequest', 2508, 3635, 0), 2508, 3635), near(H.npcNear('horror_girlfriend_postquest', 2445, 4599, 0), 2445, 4599)], [true, true]);
check('Jossik well upstairs in the real one only', [near(H.npcNear('horror_lighthousekeeeper_well', 2509, 3639, 1), 2509, 3639), near(H.npcNear('horror_lighthousekeeeper_well', 2445, 4599, 1), 2445, 4599)], [true, false]);

console.log('The doorway, by stage:');
{
    const a = player('hftd2door', 2509, 3634, 0, { horror: 1 });
    H.give(a, 'horror_key');
    op(a, ...REAL.door as [number, number], 'horror_lighthouse_doorway');
    check('stage 1, key, bridge still broken: unlocked, but Larrissa keeps you out', [a.z < 3636, (H.getVar(a, 'horror_bridges') >> 2) & 1], [true, 1]);
    H.setVar(a, 'horror_bridges', 7);
    op(a, ...REAL.door as [number, number], 'horror_lighthouse_doorway');
    check('bridge mended: in through the door - into the attacked copy', at(a), [COPY.door[0], COPY.door[1], 0]);
    check('the copy\'s ground floor reaches the stairs and the iron ladder', [connected(0, a.x, a.z, 2441, 4601), connected(0, a.x, a.z, COPY.ladder[0], COPY.ladder[1] - 1)], [true, true]);
    check('Larrissa is in here with you', H.npcNear('horror_girlfriend_postquest', a.x, a.z, 0) !== null && Math.abs(H.npcNear('horror_girlfriend_postquest', a.x, a.z, 0)!.z - a.z) < 10, true);
    const words = talkTo(a, H.npcNear('horror_girlfriend_postquest', a.x, a.z, 0)!, [1]);
    check('she asks you to fix the light, and points you at the books', [words.some(w => w.includes('light')), words.some(w => w.includes('manual'))], [true, true]);
    a.teleport(COPY.door[0], COPY.door[1], 0);
    H.tick(1);
    op(a, ...COPY.door as [number, number], 'horror_lighthouse_doorway');
    check('out of the copy\'s doorway: onto the real causeway', at(a), [2509, 3635, 0]);

    for (const [stage, where] of [[2, 'copy'], [3, 'copy'], [4, 'real'], [5, 'real'], [6, 'real']] as [number, string][]) {
        H.setVar(a, 'horror', stage);
        a.teleport(2509, 3634, 0);
        H.tick(1);
        op(a, ...REAL.door as [number, number], 'horror_lighthouse_doorway');
        check(`stage ${stage}: in through the door lands in the ${where} lighthouse`, at(a), where === 'copy' ? [COPY.door[0], COPY.door[1], 0] : [REAL.door[0], REAL.door[1], 0]);
        op(a, a.x, a.z, 'horror_lighthouse_doorway');
        check(`stage ${stage}: and out again on the real causeway`, at(a), [2509, 3635, 0]);
    }
    const b = player('hftd2none', 2509, 3634, 0);
    op(b, ...REAL.door as [number, number], 'horror_lighthouse_doorway');
    check('not started: locked', [b.z < 3636, lastMes(b)], [true, 'The door is locked.']);
}

console.log('The spiral stairs, both lighthouses:');
for (const [name, base, top, off] of [['real', REAL.stairsBase, REAL.stairsTop, [0, 0]], ['copy', COPY.stairsBase, COPY.stairsTop, [CX, CZ]]] as [string, number[], number[], number[]][]) {
    const s = player('hftd2st' + name, 2508 + off[0], 3640 + off[1], 0, { horror: name === 'copy' ? 2 : 6 });
    op(s, base[0], base[1], 'horror_lighthouse_spiralstairs_base');
    check(`${name}: up from the ground floor`, at(s), [2505 + off[0], 3641 + off[1], 1]);
    op(s, base[0], base[1], 'horror_lighthouse_spiralstairs_middle', 2);
    check(`${name}: Climb-up to the lantern room`, at(s), [2505 + off[0], 3641 + off[1], 2]);
    op(s, top[0], top[1], 'horror_lighthouse_spiralstairs_top');
    check(`${name}: back down to the middle floor`, at(s), [2505 + off[0], 3641 + off[1], 1]);
    op(s, base[0], base[1], 'horror_lighthouse_spiralstairs_middle', 1, [1]);
    check(`${name}: Climb asks, and up goes up`, at(s), [2505 + off[0], 3641 + off[1], 2]);
    op(s, top[0], top[1], 'horror_lighthouse_spiralstairs_top');
    op(s, base[0], base[1], 'horror_lighthouse_spiralstairs_middle', 1, [2]);
    check(`${name}: Climb, down goes down`, at(s), [2508 + off[0], 3640 + off[1], 0]);
    op(s, base[0], base[1], 'horror_lighthouse_spiralstairs_base');
    op(s, base[0], base[1], 'horror_lighthouse_spiralstairs_middle', 3);
    check(`${name}: Climb-down to the ground floor`, at(s), [2508 + off[0], 3640 + off[1], 0]);
}

console.log('The iron ladder before the light is fixed, and the lighting mechanism:');
{
    const c = player('hftd2light', COPY.ladder[0], COPY.ladder[1] - 1, 0, { horror: 1, horror_bridges: 7 });
    op(c, ...COPY.ladder as [number, number], 'horror_ladder_top');
    check('light still out: Larrissa will not let you go down', [c.level, c.z < 4610], [0, true]);
    c.teleport(2441, 4601, 2);
    H.tick(1);
    check('the broken mechanism can be walked up to from the stairs', connected(2, 2441, 4601, COPY.cog[0] - 1, COPY.cog[1]), true);
    H.give(c, 'molten_glass');
    H.give(c, 'swamp_tar');
    H.give(c, 'tinderbox');
    H.give(c, 'bronze_sword');
    const m0 = H.mesgs.length;
    useOn(c, ...COPY.cog as [number, number], 'horror_lighthouse_cog_broken', 'bronze_sword');
    check('a sword does nothing', [H.getVar(c, 'horror_lighting'), H.invCount(c, 'bronze_sword')], [0, 1]);
    useOn(c, ...COPY.cog as [number, number], 'horror_lighthouse_cog_broken', 'molten_glass');
    useOn(c, ...COPY.cog as [number, number], 'horror_lighthouse_cog_broken', 'swamp_tar');
    check('glass and tar: two bits, both used up, still broken', [H.getVar(c, 'horror_lighting'), H.invCount(c, 'molten_glass'), H.invCount(c, 'swamp_tar'), locAt(COPY.cog[0], COPY.cog[1], 2, 'horror_lighthouse_cog_broken')], [5, 0, 0, true]);
    useOn(c, ...COPY.cog as [number, number], 'horror_lighthouse_cog_broken', 'tinderbox');
    const ms = mesSince(c, m0);
    check('the tinderbox lights it: all three bits, the tinderbox kept', [H.getVar(c, 'horror_lighting'), H.invCount(c, 'tinderbox')], [7, 1]);
    check('the transcript\'s messages', [ms.includes('You use the molten glass to repair the lens.'), ms.includes('You use the swamp tar to make the torch flammable again.'), ms.includes('You light the torch with your tinderbox.'), ms.includes('You have managed to repair the lighthouse torch!')], [true, true, true, true]);
    check('the copy\'s mechanism is turning now', [locAt(COPY.cog[0], COPY.cog[1], 2, 'horror_lighthouse_cog'), locAt(COPY.cog[0], COPY.cog[1], 2, 'horror_lighthouse_cog_broken')], [true, false]);
    // another player mid-repair can still use items on it while it shows lit
    const d = player('hftd2light2', 2441, 4601, 2, { horror: 1, horror_bridges: 7 });
    H.give(d, 'molten_glass');
    useOn(d, ...COPY.cog as [number, number], 'horror_lighthouse_cog', 'molten_glass');
    check('someone else can still repair their own while it shows lit', H.getVar(d, 'horror_lighting'), 4);
    H.tick(205);
    check('and the broken mechanism is back for the next player', locAt(COPY.cog[0], COPY.cog[1], 2, 'horror_lighthouse_cog_broken'), true);
    const r = player('hftd2real', 2505, 3641, 2, { horror: 6 });
    H.give(r, 'molten_glass');
    useOn(r, ...REAL.cog as [number, number], 'horror_lighthouse_cog', 'molten_glass');
    check('glass on the real lighthouse\'s working mechanism does nothing', [H.invCount(r, 'molten_glass'), H.getVar(r, 'horror_lighting')], [1, 0]);

    console.log('Ladders, both ways, by stage:');
    c.teleport(COPY.ladder[0], COPY.ladder[1] - 1, 0);
    H.tick(1);
    op(c, ...COPY.ladder as [number, number], 'horror_ladder_top');
    check('lit: the copy\'s iron ladder goes down to the basement', at(c), [2519, 4619, 1]);
    op(c, 2519, 4618, 'horror_ladder_base');
    check('and the basement ladder comes back up into the copy', at(c), [2510 + CX, 3644 + CZ, 0]);
    H.setVar(c, 'horror', 4);
    op(c, ...COPY.ladder as [number, number], 'horror_ladder_top');
    op(c, 2519, 4618, 'horror_ladder_base');
    check('Mother dead: the basement ladder comes up into the real lighthouse', at(c), [2510, 3644, 0]);
    check('where Jossik is well upstairs', near(H.npcNear('horror_lighthousekeeeper_well', c.x, c.z, 1), 2509, 3639), true);
    op(c, ...REAL.ladder as [number, number], 'horror_ladder_top');
    check('the real lighthouse\'s ladder goes down to the same basement', at(c), [2519, 4619, 1]);
}

console.log('Logging in in the wrong lighthouse:');
{
    const e = player('hftd2login1', 2509, 3640, 0, { horror: 2 });
    check('stage 2, logged out in the real lighthouse: moved to the same tile of the copy', at(e), [2509 + CX, 3640 + CZ, 0]);
    const f = player('hftd2login2', 2510, 3641, 1, { horror: 3 });
    check('the same upstairs', at(f), [2510 + CX, 3641 + CZ, 1]);
    const g = player('hftd2login3', 2509 + CX, 3640 + CZ, 0, { horror: 6 });
    check('quest done, logged out in the copy: back in the real lighthouse', at(g), [2509, 3640, 0]);
    const h = player('hftd2login4', 2509, 3634, 0, { horror: 2 });
    check('outside on the causeway mid-quest: left alone', at(h), [2509, 3634, 0]);
    const i = player('hftd2login5', 2509, 3640, 0, { horror: 0 });
    check('not started, inside the real lighthouse: left alone', at(i), [2509, 3640, 0]);
    const j = player('hftd2login6', 2505, 3641, 2, { horror: 1 });
    check('the lantern room too', at(j), [2505 + CX, 3641 + CZ, 2]);
}

console.log('THE DAGANNOTH MOTHER');
{
    for (const f of ['air', 'water', 'fire', 'earth', 'ranged', 'melee']) {
        const n = 'horror_dagganoth_' + f;
        check(`${f}: level 100, stats att/def/str/hp/rng/mag`, [NpcType.get(NpcType.getId(n)).vislevel, stats(n)], [100, [78, 81, 78, 120, 50, 1]]);
        check(`${f}: bonuses +0 attack, +150 stab/slash/crush, +50 magic/ranged defence, 4-tick attacks`, ['attackbonus', 'strengthbonus', 'rangeattack', 'rangebonus', 'stabdefence', 'slashdefence', 'crushdefence', 'magicdefence', 'rangedefence', 'attackrate'].map(k => param(n, k) ?? 0), [0, 0, 0, 0, 150, 150, 150, 50, 50, 4]);
    }
    check('the level-100 Dagannoth: same levels, every bonus +0', [NpcType.get(NpcType.getId('horror_dagannoth_jr4')).vislevel, stats('horror_dagannoth_jr4'), ['attackbonus', 'strengthbonus', 'stabdefence', 'slashdefence', 'crushdefence', 'magicdefence', 'rangedefence', 'attackrate'].map(k => param('horror_dagannoth_jr4', k) ?? 0)], [100, [78, 81, 78, 120, 50, 1], [0, 0, 0, 0, 0, 0, 0, 4]]);

    const p = player('hftd2mother', 2521, 4640, 0, { horror: 3 });
    H.runProc(p, '[proc,horror_spawn_mother]');
    H.tick(1);
    const em = H.npcNear('horror_dagganoth_aira', 2523, 4645, 0);
    check('she surfaces as the first emergence stage', em !== null, true);
    for (let t = 0; t < 8; t++) { H.tick(1); p.levels[3] = 99; }
    const m = [...World.npcs].find(n => n && n.isActive && NpcType.get(n.type).name === 'Dagannoth mother' && n.z > 4630 && n.z < 4660 && n.x > 2500 && n.x < 2540) as Npc;
    check('out of the water: white (air), with her full 120 hitpoints', [NpcType.get(m.type).debugname, m.levels[3], m.baseLevels[3]], ['horror_dagganoth_air', 120, 120]);
    check('with her full stat block', [...m.levels], [78, 81, 78, 120, 50, 1]);
    check('she comes for the player straight away', m.target === p, true);
    const maxhit = npcProc(m, p, 'npc_melee_maxhit')[0];
    check('melee max hit 9, ranged 12 (twice)', [maxhit, npcProc(m, p, 'dagmother_range_maxhit')[0]], [9, 12]);
    m.levels[3] = 90; // she has taken 30
    const m0 = H.mesgs.length;
    let t = 0;
    for (; t < 40 && NpcType.get(m.type).debugname === 'horror_dagganoth_air'; t++) { H.tick(1); p.levels[3] = 99; }
    check('the colour changes within 30 ticks, to blue (water)', [t <= 31, NpcType.get(m.type).debugname], [true, 'horror_dagganoth_water']);
    check('the damage stays with her through the change', [m.levels[3], m.baseLevels[3]], [90, 120]);
    check('the chat box says so', mesSince(p, m0).includes('The Dagannoth changes to blue...'), true);
    for (t = 0; t < 32 && NpcType.get(m.type).debugname === 'horror_dagganoth_water'; t++) { H.tick(1); p.levels[3] = 99; }
    check('then orange (melee), 30 ticks later', [t <= 31, NpcType.get(m.type).debugname, m.levels[3]], [true, 'horror_dagganoth_melee', 90]);

    console.log('Wrong-element spells splash:');
    // Pin her to blue for the magic test: her pending colour change is taken off her queue.
    for (const r of [...(m as any).queue.all()]) if (r.queueId === ServerTriggerType.AI_QUEUE5) r.unlink();
    H.setNpcVar(m, 'npc_dagmother_cycling', 1);
    m.changeType(NpcType.getId('horror_dagganoth_water'), 1000, false);
    H.setVar(p, 'aggressive_npc', m.uid);
    const splashes = (spell: number) => {
        H.equip(p, { rhand: 'staff_of_air' });
        for (const r of ['airrune', 'waterrune', 'earthrune', 'firerune', 'deathrune', 'chaosrune', 'bloodrune']) H.give(p, r, 500);
        H.setVarBit(p, 'autocast_set', 1);
        H.setVarBit(p, 'autocast_spell', spell);
        const s0 = H.sounds.length, h0 = H.npcHits.length;
        H.attackNpc(p, m);
        for (let i = 0; i < 26; i++) {
            H.tick(1);
            p.levels[3] = 99;
            p.levels[6] = 99;
            m.levels[3] = 90;
            if (!p.target && !p.delayed && i % 2 === 1) H.attackNpc(p, m);
        }
        const fails = H.sounds.slice(s0).filter(s => s.who === p.username && s.synth === 'spellfail').length;
        const casts = H.sounds.slice(s0).filter(s => s.who === p.username && s.synth.endsWith('_cast_and_fire')).length;
        p.clearPendingAction();
        H.tick(2);
        return { casts, fails, hits: H.npcHits.slice(h0).filter(h => h.damage > 0).length };
    };
    const wrong = splashes(12); // Wind Wave at blue
    check('Wind Wave at her blue form: every cast splashes, nothing lands', [wrong.casts > 2, wrong.casts === wrong.fails, wrong.hits], [true, true, 0]);
    const right = splashes(13); // Water Wave at blue
    check('Water Wave at her blue form: it lands', [right.casts > 2, right.hits > 0], [true, true]);

    console.log('Her death:');
    m.changeType(NpcType.getId('horror_dagganoth_fire'), 1000, false);
    H.setVar(p, 'aggressive_npc', m.uid);
    (m as any).heroPoints.addHero(p.hash64, 10);
    H.setNpcVar(m, 'npc_aggressive_player', (p as any).uid);
    const spot = [m.x, m.z];
    m.enqueueScript(ServerTriggerType.AI_QUEUE2, 0, 200);
    for (let i = 0; i < 12; i++) H.tick(1);
    const bones = World.getObj(spot[0], spot[1], 0, ObjType.getId('bones'), p.hash64) ?? World.getObj(spot[0], spot[1], 0, ObjType.getId('bones'), -1n);
    const big = World.getObj(spot[0], spot[1], 0, ObjType.getId('big_bones'), p.hash64) ?? World.getObj(spot[0], spot[1], 0, ObjType.getId('big_bones'), -1n);
    check('dead in whatever colour: the quest completes (stage 6), the casket, and plain bones (not big bones)', [H.getVar(p, 'horror'), H.invCount(p, 'horror_casket'), bones !== null, big !== null], [6, 1, true, false]);
}

// ============================================================ round 2b: the rest of the 2006 quest
/** Stand next to the npc first (they wander), then talk. */
function talkNear(p: Player, npc: Npc, picks: number[] = []) {
    for (const [dx, dz] of [[0, -1], [1, 0], [-1, 0], [0, 1], [1, 1], [-1, -1], [2, 0], [0, 2]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, 1);
        for (let t = 0; t < 6 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks);
}
console.log('LARRISSA AND GUNNJORN (the transcript\'s branches)');
{
    const larrissa = () => H.npcNear('horror_girlfriend_prequest', 2508, 3635, 0)!;
    const a = player('hftd2start', 2509, 3633, 0, { barcrawl: 2 });
    talkNear(a, larrissa(), [2]);
    check('"Sorry, just passing through": not started', H.getVar(a, 'horror'), 0);
    talkNear(a, larrissa(), [1, 2]);
    check('"With what?", then passing through: still not started', H.getVar(a, 'horror'), 0);
    talkNear(a, larrissa(), [1, 1, 2]);
    check('told the story, but "No." to starting: still not started', H.getVar(a, 'horror'), 0);
    const words = talkNear(a, larrissa(), [1, 1, 1, 1, 2, 3]);
    check('"Yes.": started, then her cousin, the bridge, and "I\'ll see what I can do"', [H.getVar(a, 'horror'), words.some(w => w.includes('Gunnjorn')), words.some(w => w.includes('thirty steel nails'))], [1, true, true]);
    const hello = talkNear(a, larrissa(), [3]);
    check('talking again: "please find my darling" and the same three options', [hello.some(w => w.includes('please find my darling')), hello.includes('Where is your cousin?')], [true, true]);

    const gunnjorn = () => H.npcNear('gunnjorn', 2540, 3548, 0)!;
    H.fillInv(a);
    talkNear(a, gunnjorn());
    check('Gunnjorn with a full pack: no key, and he remembers nothing', [H.invCount(a, 'horror_key'), (H.getVar(a, 'horror_bridges') >> 4) & 1], [0, 0]);
    H.clearInv(a);
    const g1 = talkNear(a, gunnjorn());
    check('first meeting: you ask for Larrissa\'s key, and get it', [H.invCount(a, 'horror_key'), (H.getVar(a, 'horror_bridges') >> 4) & 1, g1.some(w => w.includes('Larrissa'))], [1, 1, true]);
    const k = talkNear(a, larrissa());
    check('key, no bridge: Larrissa is still stuck on the causeway', k.some(w => w.includes('bridge')), true);
    H.clearInv(a);
    const joke = talkNear(a, larrissa(), [1]);
    check('lost the key and asked where her cousin is: "Is your memory going?"', joke.some(w => w.includes('memory')), true);
    const g2 = talkNear(a, gunnjorn());
    check('back to Gunnjorn: "lost that key", and another', [H.invCount(a, 'horror_key'), g2.some(w => w.includes('lost'))], [1, true]);
    H.setVar(a, 'horror_bridges', H.getVar(a, 'horror_bridges') | 3);
    a.teleport(2509, 3634, 0);
    H.tick(1);
    op(a, REAL.door[0], REAL.door[1], 'horror_lighthouse_doorway');
    check('the key goes into the lock (RS transcript): used up, the door stays open', [H.invCount(a, 'horror_key'), (H.getVar(a, 'horror_bridges') >> 2) & 1, a.z > 4000], [0, 1, true]);
    const g3 = talkNear(a, gunnjorn());
    check('Gunnjorn has nothing more to give once the door is open', [H.invCount(a, 'horror_key'), g3.some(w => w.includes('clockwise'))], [0, true]);
}

console.log('The bookcase and its three books:');
{
    const b = player('hftd2books', 2508 + CX, 3643 + CZ, 1, { horror: 1 });
    op(b, 2508 + CX, 3644 + CZ, 'horror_bookcase', 1, [4]);
    check('"Take all three books": the manual, the diary and the journal', ['horror_diary3', 'horror_diary2', 'horror_diary1'].map(o => H.invCount(b, o)), [1, 1, 1]);
    H.fillInv(b);
    op(b, 2508 + CX, 3644 + CZ, 'horror_bookcase', 1, [1]);
    check('no room: "You do not have enough room to take that."', lastMes(b), 'You do not have enough room to take that.');
    H.clearInv(b);
    op(b, 2508 + CX, 3644 + CZ, 'horror_bookcase', 1, [2]);
    check('the ancient diary on its own', H.invCount(b, 'horror_diary2'), 1);
    const f0 = H.ifaces.length;
    H.opheld(b, 'horror_diary2', 1);
    drive(b);
    const text = H.ifaces.slice(f0).filter(i => i.who === b.username && i.kind === 'text').map(i => i.text ?? '').join(' ');
    check('Silas\'s diary gives the key to the strange wall', [text.includes('sword'), text.includes('arrow'), text.includes('fire')], [true, true, true]);
}

console.log('Jossik\'s cave: the Dagannoth comes when he sees it, and the quest ends on the Mother:');
{
    const jrId = NpcType.getId('horror_dagannoth_jr4');
    const jrs = () => [...World.npcs].filter(n => n && n.isActive && n.type === jrId);
    for (const n of jrs()) World.removeNpc(n, -1);
    const j = player('hftd2jossik', 2515, 4629, 1, { horror: 2 });
    op(j, 2515, 4630, 'horror_ladder_top2');
    check('down into the cave: nothing comes out of the water yet', [j.level, jrs().length], [0, 0]);
    const jossik = H.npcNear('horror_lighthousekeeeper_injured', j.x, j.z, 0)!;
    const w = talkNear(j, jossik);
    check('Jossik tells his story, and the Dagannoth comes out after you', [w.some(x => x.includes('Silas')), jrs().length, jrs()[0]?.target === j], [true, 1, true]);
    const m0 = H.mesgs.length;
    talkNear(j, jossik);
    check('while it is out: "You are too busy to talk to Jossik."', mesSince(j, m0).includes('You are too busy to talk to Jossik.'), true);
    for (const n of jrs()) World.removeNpc(n, -1);
    H.fillInv(j);
    H.setVar(j, 'horror', 3);
    const s0 = H.ifaces.length;
    j.enqueueScript(ScriptProvider.getByName('[queue,horror_boss_slain]')!, PlayerQueueType.NORMAL, 0, [2]);
    drive(j);
    H.tick(3);
    drive(j);
    const said = H.ifaces.slice(s0).filter(i => i.who === j.username && i.kind === 'text').map(i => i.text ?? '');
    check('the Mother dies: quest complete, put in front of the strange wall, a full pack so no casket', [H.getVar(j, 'horror'), at(j), H.invCount(j, 'horror_casket'), (H.getVar(j, 'horror_bridges') >> 3) & 1], [6, [2519, 4619, 1], 0, 1]);
    check('and Jossik tells you to bring the casket to his library', said.some(x => x.includes('library')), true);
    for (const n of [...World.npcs]) if (n && n.isActive && /^horror_dag+anoth_(air|water|fire|earth|ranged|melee|aira|airb|airc)$/.test(NpcType.get(n.type).debugname ?? '')) World.removeNpc(n, -1);

    j.teleport(2510, 3640, 1);
    H.tick(1);
    const well = H.npcNear('horror_lighthousekeeeper_well', j.x, j.z, 1)!;
    talkNear(j, well, [1]);
    check('upstairs, still no room: he will not open it yet, and it is still owed', [(H.getVar(j, 'horror_bridges') >> 3) & 1, H.invCount(j, 'unfinished_saradominbook')], [1, 0]);
    H.clearInv(j);
    const c = talkNear(j, well, [1, 2, 2]);
    check('no casket on you - he picked it up; Saradomin, then Zamorak twice: a damaged book of Zamorak', [c.some(x => x.includes('picked it up')), H.invCount(j, 'unfinished_zamorakbook'), H.invCount(j, 'unfinished_saradominbook'), (H.getVar(j, 'horror_bridges') >> 3) & 1], [true, 1, 0, 0]);
    const again = talkNear(j, well, [3]);
    check('opened once only: after that he is the shopkeeper', [again.some(x => x.includes('casket')), H.invCount(j, 'unfinished_zamorakbook')], [false, 1]);
    const old = player('hftd2legacy', 2510, 3640, 1, { horror: 5 });
    H.give(old, 'horror_casket');
    talkNear(old, H.npcNear('horror_lighthousekeeeper_well', old.x, old.z, 1)!, [3, 3]);
    H.tick(3);
    check('a save left at the old stage 5: completed by Jossik, and the casket opened', [H.getVar(old, 'horror'), H.invCount(old, 'horror_casket'), H.invCount(old, 'unfinished_guthixbook')], [6, 0, 1]);
}

console.log('The Mother reads your prayers:');
{
    const ranged = SeqType.getId('horror_dagannoth_rangeattack'), melee = SeqType.getId('horror_dagannoth_attack');
    const nanims: { who: Npc; seq: number }[] = [];
    const orig = (Npc.prototype as any).playAnimation;
    (Npc.prototype as any).playAnimation = function (seq: number, delay: number) {
        nanims.push({ who: this, seq });
        return orig.call(this, seq, delay);
    };
    const q = player('hftd2prayer', 2524, 4644, 0, { horror: 3 });
    H.runProc(q, '[proc,horror_spawn_mother]');
    for (let t = 0; t < 8; t++) { H.tick(1); q.levels[3] = 99; }
    const m = [...World.npcs].find(n => n && n.isActive && NpcType.get(n.type).name === 'Dagannoth mother' && n.target === q) as Npc;
    check('she is out and after the player', m !== undefined, true);
    let spot = [q.x, q.z]; // the player stands still: auto-retaliate would walk them onto her
    const watch = (ticks: number) => {
        const from = nanims.length;
        for (let t = 0; t < ticks; t++) { H.tick(1); q.levels[3] = 99; q.levels[5] = 99; q.clearInteraction(); q.teleport(spot[0], spot[1], 0); }
        const mine = nanims.slice(from).filter(a => a.who === m);
        return { ranged: mine.filter(a => a.seq === ranged).length, melee: mine.filter(a => a.seq === melee).length };
    };
    const plain = watch(12);
    check('standing on her, no prayer: she claws', [plain.melee > 0, plain.ranged], [true, 0]);
    H.setVar(q, 'prayer14', 1);
    const pm = watch(12);
    check('Protect from Melee while touching her: she shoots you point-blank instead', [pm.ranged > 0, pm.melee], [true, 0]);
    H.setVar(q, 'prayer14', 0);
    spot = [2524, 4639];
    watch(4);
    const far = watch(12);
    check('at a distance, no prayer: she shoots', [far.ranged > 0, far.melee], [true, 0]);
    H.setVar(q, 'prayer13', 1);
    const d0 = Math.abs(m.z - q.z);
    const pr = watch(16);
    check('Protect from Missiles at a distance: she comes in and claws you', [Math.abs(m.z - q.z) < d0, pr.melee > 0], [true, true]);
    (Npc.prototype as any).playAnimation = orig;
}

// ============================================================ round 2c: requirement, wall, books
console.log('Starting needs Alfred Grimhand\'s Barcrawl (not 35 Agility):');
{
    const larrissa = () => H.npcNear('horror_girlfriend_prequest', 2508, 3635, 0)!;
    const n = player('hftd2nobar', 2509, 3633, 0);
    const w = talkNear(n, larrissa(), [1, 1, 1]);
    check('no Barcrawl: "You do not meet the requirements", not started', [H.getVar(n, 'horror'), w.some(x => x.includes('requirements'))], [0, true]);
    H.setVar(n, 'barcrawl', 2);
    (n as any).levels[16] = 1; (n as any).baseLevels[16] = 1;
    talkNear(n, larrissa(), [1, 1, 1, 3]);
    check('Barcrawl done, Agility 1: started', H.getVar(n, 'horror'), 1);
}

console.log('The strange wall:');
{
    const wl = player('hftd2wall', 2514, 4626, 1, { horror: 1 });
    H.give(wl, 'airrune', 5);
    H.give(wl, 'bronze_sword');
    const m0 = H.mesgs.length;
    const said = useOn(wl, 2514, 4627, 'horror_mid_left_door', 'airrune', [2]);
    check('an air rune: "I won\'t get that back" and "Really place it?" - No keeps it', [said.some(x => x.includes('get that back')), said.some(x => x.includes('Really place the rune into the door?')), H.invCount(wl, 'airrune'), H.getVar(wl, 'horror_wall')], [true, true, 5, 0]);
    useOn(wl, 2514, 4627, 'horror_mid_left_door', 'airrune', [1]);
    check('Yes: one rune (not the stack) into its slot', [H.invCount(wl, 'airrune'), H.getVar(wl, 'horror_wall'), mesSince(wl, m0).includes('You place an air rune into the slot in the wall.')], [4, 2, true]);
    useOn(wl, 2514, 4627, 'horror_mid_left_door', 'airrune');
    check('a second air rune: "There is no space"', [lastMes(wl), H.invCount(wl, 'airrune')], ['There is no space to put an air rune into the wall.', 4]);
    const w2 = useOn(wl, 2514, 4627, 'horror_mid_left_door', 'bronze_sword', [1]);
    check('a sword asks about "the weapon"', [w2.some(x => x.includes('Really place the weapon into the door?')), lastMes(wl)], [true, 'You place a sword into the slot in the wall.']);
    op(wl, 2516, 4627, 'horror_far_right_door');
    check('the hinged panel, unsolved: "You cannot see any way to move this part of the wall...."', lastMes(wl), 'You cannot see any way to move this part of the wall....');
    const back = player('hftd2back', 2514, 4629, 1, { horror: 2 });
    op(back, 2514, 4627, 'horror_mid_left_door');
    check('studied from the cave side', lastMes(back), 'You cannot see anything unusual about the wall from this side.');
}

console.log('Jossik\'s prayer books:');
{
    const pb = player('hftd2books2', 2510, 3640, 1, { horror: 6, horror_bridges: 7 | (1 << 5) });
    const jossik = () => H.npcNear('horror_lighthousekeeeper_well', pb.x, pb.z, 1)!;
    talkNear(pb, jossik(), [2]);
    check('lost your Saradomin book: he gives it back for nothing', [H.invCount(pb, 'unfinished_saradominbook'), H.invCount(pb, 'coins')], [1, 0]);
    const w = talkNear(pb, jossik(), [2]);
    check('book not yet completed: nothing new for sale', [w.some(x => x.includes('Nope')), H.invCount(pb, 'unfinished_zamorakbook')], [true, 0]);
    H.clearInv(pb);
    H.give(pb, 'saradominbook_complete');
    H.give(pb, 'coins', 6000);
    const s1 = talkNear(pb, jossik(), [2, 1, 1]);
    check('completed: he offers another god\'s for 5,000 - but not the one you have', [s1.some(x => x.includes('5,000')), H.invCount(pb, 'coins'), H.invCount(pb, 'unfinished_saradominbook')], [true, 6000, 0]);
    talkNear(pb, jossik(), [2, 1, 3]);
    check('Guthix for 5,000 coins', [H.invCount(pb, 'coins'), H.invCount(pb, 'unfinished_guthixbook'), (H.getVar(pb, 'horror_bridges') >> 7) & 1], [1000, 1, 1]);
    const old = player('hftd2oldbook', 2510, 3640, 1, { horror: 6, horror_bridges: 7 });
    talkNear(old, H.npcNear('horror_lighthousekeeeper_well', old.x, old.z, 1)!, [2, 2]);
    check('an old save with its book lost and nothing on record: picks it back, free', [H.invCount(old, 'unfinished_zamorakbook'), (H.getVar(old, 'horror_bridges') >> 6) & 1], [1, 1]);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
