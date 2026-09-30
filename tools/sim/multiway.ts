// What is multi-way, what should be, and the csv lines to make it so.
//
//   npx tsx tools/sim/multiway.ts audit            known multi areas vs maps/multiway.csv
//   npx tsx tools/sim/multiway.ts npc <name>...    the zones those npcs spawn in, as csv lines
//
// maps/multiway.csv is a list of ZONES - 8x8 tiles - and GameMap.isMulti looks a tile up by the
// zone it falls in. Nothing in the 377 cache says which areas Old School treats as multi-way, so
// the audit half is checked against a written-down list rather than derived, and that list is only
// as good as what is in it. The npc half is derived: it reads where the npcs actually stand on the
// built map, which is the half that cannot be got wrong.
import World from '#/engine/World.js';
import * as H from './harness.ts';
import NpcType from '#/cache/config/NpcType.js';
import fs from 'fs';

await H.boot();

const CSV = '../content/maps/multiway.csv';
const zoneKey = (level: number, x: number, z: number) => `${level}_${x >> 6}_${z >> 6}_${(x >> 3 << 3) & 63}_${(z >> 3 << 3) & 63}`;

/** Every zone maps/multiway.csv already covers. */
function current(): Set<string> {
    const out = new Set<string>();
    for (const line of fs.readFileSync(CSV, 'utf8').split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('//')) continue;
        out.add(t);
    }
    return out;
}

const mode = process.argv[2] ?? 'audit';
const have = current();

if (mode === 'npc') {
    const names = process.argv.slice(3);
    if (!names.length) throw new Error('name at least one npc');
    const ids = new Map<number, string>();
    for (const n of names) {
        const id = NpcType.getId(n);
        if (id === -1) throw new Error('no such npc: ' + n);
        ids.set(id, n);
    }
    const zones = new Map<string, { who: Set<string>; n: number }>();
    for (const npc of World.npcs) {
        const who = ids.get(npc.type);
        if (!who) continue;
        const k = zoneKey(npc.level, npc.x, npc.z);
        const e = zones.get(k) ?? { who: new Set<string>(), n: 0 };
        e.who.add(who); e.n++;
        zones.set(k, e);
    }
    const missing = [...zones.keys()].filter(k => !have.has(k)).sort();
    console.log(`${names.join(', ')}: ${[...zones.values()].reduce((s, e) => s + e.n, 0)} spawns over ${zones.size} zones`);
    console.log(`${zones.size - missing.length} already multi, ${missing.length} not\n`);
    for (const k of missing) console.log(k);
    process.exit(0);
}

// ---------------------------------------------------------------------------- the audit
// Written down, not derived. Each entry is a box of tiles Old School treats as multi-way, and the
// audit only says whether this build agrees - it cannot tell you the box is right.
type Area = { name: string; level: number; x1: number; z1: number; x2: number; z2: number };
const KNOWN: Area[] = [
    { name: 'God Wars Dungeon, main', level: 0, x1: 2816, z1: 5248, x2: 2943, z2: 5375 },
    { name: 'Kalphite Queen lair', level: 2, x1: 3456, z1: 9472, x2: 3519, z2: 9535 },
    { name: 'Dagannoth Kings (Waterbirth)', level: 0, x1: 2880, z1: 4352, x2: 2943, z2: 4415 },
    { name: 'Corporeal Beast lair', level: 2, x1: 2496, z1: 4352, x2: 2559, z2: 4415 },
    { name: "Zulrah's shrine", level: 0, x1: 2256, z1: 3064, x2: 2280, z2: 3080 },
    { name: 'Fight Caves', level: 0, x1: 2368, z1: 5056, x2: 2431, z2: 5119 },
    { name: 'Barrows tunnels', level: 3, x1: 3520, z1: 9664, x2: 3583, z2: 9727 },
    { name: 'Slayer Tower, top floor', level: 2, x1: 3408, z1: 3536, x2: 3456, z2: 3584 },
];

console.log(`maps/multiway.csv covers ${have.size} zones\n`);
console.log('AREAS THIS BUILD IS MEANT TO TREAT AS MULTI-WAY');
let gaps = 0;
for (const a of KNOWN) {
    const want: string[] = [];
    for (let x = a.x1; x <= a.x2; x += 8)
        for (let z = a.z1; z <= a.z2; z += 8)
            want.push(zoneKey(a.level, x, z));
    const uniq = [...new Set(want)];
    const missing = uniq.filter(k => !have.has(k));
    const state = missing.length === 0 ? 'all multi'
        : missing.length === uniq.length ? 'NONE OF IT IS MULTI'
            : `${uniq.length - missing.length}/${uniq.length} zones multi`;
    if (missing.length) gaps++;
    console.log(`  ${a.name.padEnd(30)} ${state}`);
}
console.log(`\n${gaps} of ${KNOWN.length} areas are not fully covered.`);
console.log('This list is written down rather than read out of the cache - a place that is not in it');
console.log('is not checked at all, so a clean run here does not mean the build has no gaps.');
process.exit(0);
