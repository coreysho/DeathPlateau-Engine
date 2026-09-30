// Mining audit, against the BUILT cache and the real engine.
//
//   npx tsx tools/sim/mining.ts sweep          every loc placed on the map that offers "Mine",
//                                              and whether the content can actually mine it
//   npx tsx tools/sim/mining.ts mine <x> <z> <locname> [level]
//                                              stand a 99-mining player at that rock and click it
//   npx tsx tools/sim/mining.ts mineall <name> every placement of that loc, mined in turn
//
// The sweep asks the engine the same three questions mining.rs2 asks at runtime: is there an
// [oploc1] for this loc (by id or by category), does mining_table have a row keyed on it, and
// does param=next_loc_stage_mining name a loc that is itself a spent rock. A rock that fails the
// first is inert, the second says "Nothing interesting happens", and the third mines exactly once
// and then leaves scenery behind that never respawns.
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import ParamType from '#/cache/config/ParamType.js';
import DbTableType from '#/cache/config/DbTableType.js';
import DbTableIndex from '#/cache/config/DbTableIndex.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';


await H.boot();

const MINING_TABLE = DbTableType.getId('mining_table');
const ROCK_COLUMN_PACKED = (MINING_TABLE << 12) | (0 << 4); // mining_table:rock
const P_NEXT = ParamType.getId('next_loc_stage_mining');
const P_EMPTY = ParamType.getId('mining_rock_empty');

const nameOf = (id: number) => (id < 0 ? 'null' : (LocType.get(id).debugname ?? String(id)));
const catOf = (t: LocType) => (t.category === -1 ? '-' : (CategoryType.get(t.category)?.debugname ?? String(t.category)));

function hasMineOp(t: LocType): boolean {
    return (t.op ?? []).some(o => o === 'Mine');
}
function handler(id: number): string | null {
    const t = LocType.get(id);
    if (ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPLOC1, id, -1)) return 'own [oploc1]';
    if (ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1, id, t.category)) return 'category ' + catOf(t);
    return null;
}
function inTable(id: number): boolean {
    return DbTableIndex.find(id, ROCK_COLUMN_PACKED).length > 0;
}
function paramInt(t: LocType, p: number): number | undefined {
    const v = t.params?.get(p);
    return typeof v === 'number' ? v : undefined;
}
function isSpentRock(id: number): boolean {
    if (id < 0) return false;
    return paramInt(LocType.get(id), P_EMPTY) === 1;
}

/** Every static loc the built map places, as loc id -> coords. */
function placements(): Map<number, { level: number; x: number; z: number }[]> {
    const out = new Map<number, { level: number; x: number; z: number }[]>();
    const zones = (World.gameMap as any).zonemap.zones as Map<number, any>;
    for (const zone of zones.values()) {
        for (const loc of zone.getAllLocsUnsafe()) {
            const list = out.get(loc.type) ?? [];
            list.push({ level: loc.level, x: loc.x, z: loc.z });
            out.set(loc.type, list);
        }
    }
    return out;
}

function verdict(id: number): { ok: boolean; why: string } {
    const t = LocType.get(id);
    if (paramInt(t, P_EMPTY) === 1) return { ok: true, why: 'spent-rock variant (no ore by design)' };
    const h = handler(id);
    if (!h) return { ok: false, why: 'DEAD: no [oploc1] for it, by id or by category' };
    if (h === 'own [oploc1]') return { ok: true, why: 'own [oploc1] script' };
    if (!inTable(id)) return { ok: false, why: 'DEAD: no mining_table row -> "Nothing interesting happens"' };
    const next = paramInt(t, P_NEXT);
    if (next === undefined || next < 0) return { ok: false, why: 'ONCE: no next_loc_stage_mining' };
    if (!isSpentRock(next)) return { ok: false, why: `ONCE: next_loc_stage_mining=${nameOf(next)}, which is not a spent rock` };
    return { ok: true, why: 'mines and respawns' };
}

const mode = process.argv[2] ?? 'sweep';

if (mode === 'sweep') {
    const placed = placements();
    const rows: { id: number; n: number; v: { ok: boolean; why: string }; sample: string }[] = [];
    let mineables = 0;
    for (let id = 0; id < LocType.count; id++) {
        const t = LocType.get(id);
        if (!t || !hasMineOp(t)) continue;
        const p = placed.get(id) ?? [];
        if (p.length === 0) continue; // a loc nobody can walk up to cannot be a reported bug
        mineables++;
        const v = verdict(id);
        rows.push({ id, n: p.length, v, sample: `${p[0].x},${p[0].z},${p[0].level}` });
    }
    const bad = rows.filter(r => !r.v.ok).sort((a, b) => b.n - a.n);
    const good = rows.filter(r => r.v.ok).sort((a, b) => b.n - a.n);
    console.log(`locs on the built map offering "Mine": ${mineables}   working: ${good.length}   broken: ${bad.length}`);
    console.log(`broken placements: ${bad.reduce((s, r) => s + r.n, 0)} of ${rows.reduce((s, r) => s + r.n, 0)}`);
    console.log('\n--- BROKEN ---');
    for (const r of bad) console.log(`  ${nameOf(r.id).padEnd(26)} id=${String(r.id).padEnd(6)} x${String(r.n).padEnd(4)} cat=${catOf(LocType.get(r.id)).padEnd(20)} e.g.(${r.sample})  ${r.v.why}`);
    console.log('\n--- WORKING ---');
    for (const r of good) console.log(`  ${nameOf(r.id).padEnd(26)} id=${String(r.id).padEnd(6)} x${String(r.n).padEnd(4)} cat=${catOf(LocType.get(r.id)).padEnd(20)} e.g.(${r.sample})  ${r.v.why}`);
    process.exit(0);
}

let bucket = 1;
function miner(x: number, z: number, level: number) {
    const p = H.makePlayer('miner' + bucket, x, z, bucket++);
    H.tick(1);
    if (level) p.teleport(x, z, level);
    H.maxOut(p);
    H.clearInv(p);
    H.give(p, 'rune_pickaxe', 1);
    H.tick(1);
    return p;
}

/** Stand next to the rock and click Mine; report what the player ends up with. */
function mineOne(x: number, z: number, locName: string, level: number) {
    const id = LocType.getId(locName);
    if (id === -1) throw new Error('no such loc: ' + locName);
    if (!World.getLoc(x, z, level, id)) {
        console.log(`  ${locName} @(${x},${z},${level}): NOT ON THE MAP HERE`);
        return;
    }
    // Try each neighbouring tile in turn. Several of these rocks sit in a row or against a wall,
    // so the first tile picked is often one the player cannot stand on or cannot reach from.
    let last = '';
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const p = miner(x + dx, z + dz, level);
        const from = H.mesgs.length;
        const before = Object.fromEntries(inv(p));
        H.opLoc(p, x, z, locName, 1);
        // long enough for a few swings even on a 1-in-18 runite roll
        for (let i = 0; i < 400; i++) {
            H.tick(1);
            if (!World.getLoc(x, z, level, id)) break;
        }
        const gained = inv(p).filter(([o, c]) => (before[o] ?? 0) !== c);
        const gone = !World.getLoc(x, z, level, id);
        const msgs = H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text).filter((s, i, a) => a.indexOf(s) === i);
        H.despawn(p);
        H.tick(1);
        if (gained.length || gone) {
            console.log(`  ${locName} @(${x},${z},${level}): gained [${gained.map(([o, c]) => `${o} x${c - (before[o] ?? 0)}`).join(', ') || 'NOTHING'}]  rock: ${gone ? `became ${whatIsAt(x, z, level)}` : 'STILL THE LIVE ROCK'}`);
            if (msgs.length) console.log(`      said: ${msgs.join(' | ')}`);
            return;
        }
        last = msgs.join(' | ');
    }
    console.log(`  ${locName} @(${x},${z},${level}): NOTHING from any of the four sides - said: ${last}`);
}

function inv(p: any): [string, number][] {
    const bag = p.getInventory(InvType.INV)!;
    const m = new Map<string, number>();
    for (let i = 0; i < bag.capacity; i++) {
        const s = bag.get(i);
        if (s) m.set(ObjType.get(s.id).debugname ?? String(s.id), (m.get(ObjType.get(s.id).debugname ?? String(s.id)) ?? 0) + s.count);
    }
    return [...m.entries()];
}

function whatIsAt(x: number, z: number, level: number): string {
    const out: string[] = [];
    for (const loc of World.gameMap.getZone(x, z, level).getAllLocsUnsafe()) {
        if (loc.x === x && loc.z === z) out.push(`${nameOf(loc.type)}${isSpentRock(loc.type) ? '(spent rock)' : ''}`);
    }
    return out.join('+') || 'nothing';
}

if (mode === 'mine') {
    mineOne(parseInt(process.argv[3]), parseInt(process.argv[4]), process.argv[5], parseInt(process.argv[6] ?? '0'));
    process.exit(0);
}

if (mode === 'mineall') {
    const names = process.argv.slice(3);
    const placed = placements();
    for (const n of names) {
        const id = LocType.getId(n);
        if (id === -1) {
            console.log(`  ${n}: no such loc`);
            continue;
        }
        const v = verdict(id);
        console.log(`${n} (id ${id}) - ${v.why}`);
        for (const c of placed.get(id) ?? []) mineOne(c.x, c.z, n, c.level);
    }
    process.exit(0);
}

console.log('modes: sweep | mine <x> <z> <loc> [level] | mineall <loc>...');
process.exit(1);
