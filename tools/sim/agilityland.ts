// EVERY TILE THE AGILITY SCRIPTS PUT A PLAYER ON, tested for being a tile at all.
//
// courseland.ts asks this of the seven rooftop courses and the two before them, because those have
// a landing constant per obstacle and a table to read. The older courses do not: the gnome course
// walks you with ~agility_force_move, and the Barbarian Outpost and Wilderness courses carry their
// destinations inline as coordinate literals. Nothing has ever checked those.
//
// So this sweeps the lot. Every coordinate literal in content/scripts/skill_agility - in the
// scripts and in the constant files - is resolved and asked the one question the engine cannot:
// does the mapsquare draw a floor there, or is there at least a loc to be standing on. See
// mapfloor.ts for why that is three answers rather than two.
//
// A literal that is a REGION or an area corner rather than a destination will show up here too;
// that is fine, because a corner of an area is still somewhere the content expects to be real.
//
//   npx tsx tools/sim/agilityland.ts
import { readFileSync, readdirSync } from 'fs';

import * as H from './harness.ts';
import { drawn, onLoc, thinAir } from './mapfloor.ts';

await H.boot();

const DIR = '../content/scripts/skill_agility';

type Hit = { file: string; line: number; name: string; note: string; x: number; z: number; level: number };
const hits: Hit[] = [];

function sweep(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
            sweep(path);
            continue;
        }
        if (!/\.(rs2|constant)$/.test(entry.name)) continue;
        const text = readFileSync(path, 'utf8');
        text.split(/\r?\n/).forEach((line, i) => {
            const bare = line.split('//')[0];
            // the line's own comment, which is usually the answer: the one thin-air coordinate on
            // Ape Atoll is commented "the west end, which has no floor to stand on", and it is a
            // waypoint the forcemove passes through rather than a tile anybody stands on.
            const note = line.includes('//') ? line.slice(line.indexOf('//') + 2).trim() : '';
            // a coordinate literal: level_mapsquareX_mapsquareZ_localX_localZ
            const re = /\b(\d)_(\d{1,2})_(\d{1,3})_(\d{1,2})_(\d{1,2})\b/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(bare)) !== null) {
                const level = Number(m[1]);
                const x = Number(m[2]) * 64 + Number(m[4]);
                const z = Number(m[3]) * 64 + Number(m[5]);
                if (Number(m[4]) > 63 || Number(m[5]) > 63) continue;
                const named = /\^(\w+)\s*=/.exec(bare);
                hits.push({ file: entry.name, line: i + 1, name: named ? named[1] : bare.trim().slice(0, 44), note, x, z, level });
            }
        });
    }
}

sweep(DIR);

let air = 0;
let loc = 0;
let ok = 0;
const bad: Hit[] = [];
for (const h of hits) {
    if (thinAir(h.x, h.z, h.level)) {
        air++;
        bad.push(h);
    } else if (!drawn(h.x, h.z, h.level) && onLoc(h.x, h.z, h.level)) {
        loc++;
    } else {
        ok++;
    }
}

console.log('');
console.log(`${hits.length} coordinate literals in ${DIR}`);
console.log(`  ${ok} on drawn floor`);
console.log(`  ${loc} on a loc, with nothing drawn - standing on the obstacle, which is the design`);
console.log(`  ${air} in THIN AIR`);
console.log('(a literal can be a waypoint a forced move passes through rather than a tile anybody');
console.log(' stands on, so each one below is printed with whatever its own line says about it)');
if (bad.length) {
    console.log('');
    for (const h of bad) {
        console.log(`  ${h.file}:${h.line}  ${h.x},${h.z} L${h.level}   ${h.name}`);
        if (h.note) console.log(`      // ${h.note}`);
    }
}
process.exit(0);
