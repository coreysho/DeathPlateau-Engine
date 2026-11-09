// A SPOTANIM'S HEIGHT IS A LIFT, AND WHICH LIFT IS RIGHT IS A PROPERTY OF ITS MODEL.
//
//   npx tsx tools/sim/spotground.ts
//
// "ancients teleport animations are wrong plane", and after the animation was fixed, "spell doesn't
// touch the ground". The second one was a different bug in the same line.
//
// ClientPlayer.java draws a spotanim by translating its model (0, 0, -height) before adding it to
// the player's model, so the height is how far off the floor to lift it. Most effect models are
// authored ABOVE the origin and want that lift: spot_teleport_casting occupies y -34..-16, a small
// shape that 92 raises to chest height. But a few are authored as COLUMNS, with their base at
// exactly y=0, meant to stand on the floor - and lifting one of those by 92 leaves a 224-unit
// pillar hanging a foot and a half in the air with nothing under it.
//
// Four spotanims in the build were ground-anchored and drawn at 92 or 96, across seven call sites:
// zaros_teleport (the ancients), teleport_other_impact (teleother, the obelisks, the Abyss
// miniquest) and barrows_guthan_effect. So the rule is checked here rather than the four names:
// read every spotanim_pl/npc/map call out of the content, find its model, and ask the model where
// its base is.
//
// spot_lunar_enchant_dragonstone is the one exemption and it is listed by name below: every one of
// its vertices is at y=0, a flat sheet rather than a column, so "the base is at ground level" says
// nothing about where it belongs and the 96 it is drawn at may well be deliberate.
import * as H from './harness.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import Environment from '#/util/Environment.js';
import fs from 'fs';
import path from 'path';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

/**
 * The vertical extent of a model, straight out of its .ob2. The format puts an 18-byte footer at
 * the end naming the section lengths, and the vertices are delta-encoded behind a flags byte each.
 * y is negative upwards, so a model standing on the floor has its MAXIMUM y at 0.
 */
function modelY(file: string): { top: number; base: number } | null {
    const d = fs.readFileSync(file);
    if (d.length < 18) return null;

    let p = d.length - 18;
    const g1 = () => d[p++];
    const g2 = () => ((d[p++] << 8) | d[p++]) >>> 0;

    const vertexCount = g2();
    const faceCount = g2();
    const texturedCount = g1();
    const hasInfo = g1();
    const priority = g1();
    const hasAlpha = g1();
    const hasFaceSkins = g1();
    const hasVertexSkins = g1();
    const xLen = g2();
    g2(); // yLen, and below zLen: read to keep the footer in step, never needed - the y section's
    g2(); //       offset is what this wants, and nothing after it is read.
    const faceVertexLen = g2();

    let o = 0;
    const vertexFlag = o;
    o += vertexCount;
    o += faceCount;
    if (priority === 255) o += faceCount;
    if (hasFaceSkins === 1) o += faceCount;
    if (hasInfo === 1) o += faceCount;
    if (hasVertexSkins === 1) o += vertexCount;
    if (hasAlpha === 1) o += faceCount;
    o += faceVertexLen;
    o += faceCount * 2;
    o += texturedCount * 6;
    o += xLen;
    const yo = o;

    let fp = vertexFlag;
    let yp = yo;
    const smart = (): number => {
        const b = d[yp];
        if (b < 128) {
            yp++;
            return b - 64;
        }
        const v = ((d[yp] << 8) | d[yp + 1]) - 49152;
        yp += 2;
        return v;
    };

    let y = 0;
    let min = 0;
    let max = 0;
    for (let i = 0; i < vertexCount; i++) {
        const flags = d[fp++];
        if (flags & 2) y += smart();
        if (i === 0) {
            min = max = y;
        } else {
            if (y < min) min = y;
            if (y > max) max = y;
        }
    }
    return { top: min, base: max };
}

// Spotanims whose base sits at y=0 only because they are flat - every vertex at 0 - so the rule
// below has nothing to say about them.
const FLAT_EXEMPT = new Set(['spot_lunar_enchant_dragonstone']);

const SRC = Environment.BUILD_SRC_DIR;

// Every spotanim_pl / spotanim_npc / spotanim_map call in the content, with the height it passes.
const calls: { spot: string; height: number; where: string }[] = [];
const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.rs2')) {
            const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                const code = lines[i].split('//')[0];
                for (const m of code.matchAll(/spotanim_(?:pl|npc|map)\(\s*([a-z_0-9]+)\s*,\s*(-?\d+)/g)) {
                    calls.push({ spot: m[1], height: Number(m[2]), where: `${path.relative(SRC, full)}:${i + 1}` });
                }
            }
        }
    }
};
walk(path.join(SRC, 'scripts'));

// SpotanimType keeps the model id; pack/model.pack is what names it, and the name is how the
// .ob2 on disk is found.
const modelNames = new Map<number, string>();
for (const line of fs.readFileSync(path.join(SRC, 'pack', 'model.pack'), 'utf8').split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq > 0) modelNames.set(Number(line.slice(0, eq)), line.slice(eq + 1));
}

console.log(`\n================ SPOTANIM HEIGHTS (${calls.length} calls in the content)`);
check('the sweep found the calls at all', calls.length > 50, true);

let grounded = 0;
let lifted = 0;
const wrong: string[] = [];

for (const call of calls) {
    const id = SpotanimType.getId(call.spot);
    if (id === -1) continue;
    const model = SpotanimType.get(id).model;
    const name = modelNames.get(model);
    if (!name) continue;
    const file = path.join(SRC, 'models', 'spot', `${name}.ob2`);
    if (!fs.existsSync(file)) continue;

    const y = modelY(file);
    if (!y) continue;

    if (y.base !== 0) {
        lifted++;
        continue;
    }
    if (FLAT_EXEMPT.has(name) || y.top === y.base) continue;

    grounded++;
    if (call.height !== 0) {
        wrong.push(`${call.spot} (${name}, ${-y.top} tall) drawn at ${call.height} in ${call.where}`);
    }
}

console.log(`\n  ${grounded} call(s) draw a model whose base is already on the floor`);
console.log(`  ${lifted} call(s) draw a model authored above the origin, which the height is for`);
check('no ground-anchored model is lifted off the ground', wrong, []);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
