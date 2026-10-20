// IN SEARCH OF THE MYREQUE - everything the real walkthrough needs a coord for.
//
//   npx tsx tools/sim/myreque1.ts
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

// ---- every loc with an op in The Hollows and the north swamp, any plane
console.log('=== clickable locs, 3456..3519 x 3370..3460');
const rows: string[] = [];
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (loc.x < 3456 || loc.x > 3519 || loc.z < 3370 || loc.z > 3460) continue;
        const t = LocType.get(loc.type);
        const ops = (t.op ?? []).filter(Boolean);
        if (!ops.length) continue;
        rows.push(`L${loc.level} ${loc.x},${loc.z} s${loc.shape}a${loc.angle}  ${t.debugname ?? loc.type}  [${ops.join('/')}]  "${t.name}"`);
    }
}
rows.sort();
for (const r of rows) console.log('  ' + r);

// ---- and in the cave system, any plane
console.log('');
console.log('=== clickable locs, 3456..3519 x 9792..9855');
const rows2: string[] = [];
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (loc.x < 3456 || loc.x > 3519 || loc.z < 9792 || loc.z > 9855) continue;
        const t = LocType.get(loc.type);
        const ops = (t.op ?? []).filter(Boolean);
        if (!ops.length) continue;
        rows2.push(`L${loc.level} ${loc.x},${loc.z} s${loc.shape}a${loc.angle}  ${t.debugname ?? loc.type}  [${ops.join('/')}]  "${t.name}"`);
    }
}
rows2.sort();
for (const r of rows2) console.log('  ' + r);

// ---- where every one of the cast actually stands
console.log('');
console.log('=== the cast');
for (const n of World.npcs) {
    const t = NpcType.get(n.type);
    const nm = t.debugname ?? String(n.type);
    if (!nm.startsWith('route_') && nm !== 'multi_vanstrom_stranger_entity' && nm !== 'skeleton_hellhound') continue;
    console.log(`  ${nm.padEnd(38)} id ${String(n.type).padStart(5)}  L${n.level} ${n.x},${n.z}  size ${t.size}  lvl ${t.vislevel}`);
}
for (const nm of ['route_cyreg_paddlehorn', 'route_curpile_fyod', 'route_veliaf_hurtz', 'route_sani_piliu',
    'route_harold_evans', 'route_radigad_ponfit', 'route_polmafi_ferdygris', 'route_ivan_strom',
    'route_vanstrom_klause_sitting', 'route_vanstrom_klause_normal', 'route_vanstrom_klause_vamp',
    'route_vanstrom_klause_vamp_misty', 'route_vanstrom_klause_vamp_wingsgrow', 'canafis_stranger',
    'multi_vanstrom_stranger_entity', 'skeleton_hellhound']) {
    try { console.log(`  type ${nm.padEnd(40)} = ${NpcType.getId(nm)}`); } catch (e) { console.log(`  type ${nm} MISSING`); }
}

// ---- the hideout, plane by plane
const open = (l: number, x: number, z: number) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => canTravel(l, x, z, dx, dz, 1, 0, CollisionType.NORMAL));
for (const l of [0, 1, 2, 3]) {
    console.log('');
    console.log(`=== cave plane ${l}, 3490..3519 x 9826..9855`);
    for (let z = 9855; z >= 9826; z--) {
        let row = String(z).padStart(5) + ' ';
        for (let x = 3490; x <= 3519; x++) row += open(l, x, z) ? '.' : '#';
        console.log(row);
    }
    console.log('      3490 -> 3519');
}
