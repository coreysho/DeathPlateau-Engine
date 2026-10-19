// The way into the God Wars Dungeon, and the killcount that should not survive the way out.
//
// Both bugs here were the same shape: a coordinate pointing at a plane that was never built.
// m45_82 plane 3 carries 2,061 locs and NOT ONE TILE OF TERRAIN - the graft brought the furniture
// and left the floor - so the hole dropped players onto undrawn black, and the only rope out led
// back to it. Nothing errors; you just stand on nothing.
//
//   npx tsx tools/sim/gwdentrance.ts
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { World, LocType } from './a1lib.ts';

await H.boot();

// ---------------------------------------------------------------- what is actually built
// Read off the map rather than asserted here: a plane is somewhere you can be only if its tiles
// are drawn, and "drawn" means an overlay or an underlay. Heights alone are not a floor.
function planes(region: string) {
    const lines = readFileSync(`../content/maps/m${region}.jm2`, 'utf8').split(/\r?\n/);
    const end = lines.indexOf('==== LOC ====');
    const drawn: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < end; i++) {
        const m = /^([0-3]) (\d+) (\d+): (.*)$/.exec(lines[i]);
        if (m && /(^| )(o|u)\d+/.test(m[4])) drawn[Number(m[1])]++;
    }
    return drawn;
}
console.log('WHICH PLANES OF THE DUNGEON SQUARE HAVE A FLOOR');
const d = planes('45_82');
for (const p of [0, 1, 2, 3]) console.log(`  plane ${p}: ${d[p]} drawn tiles`);
check('  plane 2 is built', d[2] > 500, true);
check('  plane 3 is not, which is the whole bug', d[3], 0);

// ---------------------------------------------------------------- so nothing may send you there
const consts = readFileSync('../content/scripts/bosses/godwars/configs/gwd.constant', 'utf8');
const coordOf = (name: string) => {
    const m = new RegExp(`^\\^${name} = (\\d+)_(\\d+)_(\\d+)_(\\d+)_(\\d+)`, 'm').exec(consts);
    if (!m) throw new Error('no ^' + name);
    const [, lvl, mx, mz, lx, lz] = m.map(Number);
    return { level: lvl, x: mx * 64 + lx, z: mz * 64 + lz };
};
console.log('\nNOTHING DROPS YOU ONTO AN UNBUILT PLANE');
for (const name of ['gwd_entrance_inside', 'gwd_rope_bottom', 'gwd_rope_topside', 'gwd_hole_side']) {
    const c = coordOf(name);
    const built = c.x >= 2880 && c.x < 2944 && c.z >= 5248 && c.z < 5312 ? d[c.level] > 0 : true;
    check(`  ^${name.padEnd(20)} -> ${c.level},${c.x},${c.z}`, built, true);
}
check('  the hole lands in the chamber, not the void', coordOf('gwd_entrance_inside').level, 2);
check('  and the rope out reaches the surface', coordOf('gwd_rope_topside').level, 0);

// ---------------------------------------------------------------- the killcount
console.log('\nTHE KILLCOUNT GOES WHEN YOU LEAVE - AND ONLY THEN');
{
    const kc = (p: any, g: string) => p.getVar(VarPlayerType.getByName(`gwd_kc_${g}`)!.id);
    const setkc = (p: any, n: number) => {
        for (const g of ['armadyl', 'bandos', 'saradomin', 'zamorak']) p.setVar(VarPlayerType.getByName(`gwd_kc_${g}`)!.id, n);
    };
    const inside = coordOf('gwd_entrance_inside');

    // walking from one dungeon square to the next fires mapzoneexit for the one behind. If the
    // reset ran on that, crossing 2880 or 5312 - a line through the middle of the chamber - would
    // wipe the count. This is the check that says it does not.
    const p: any = player('gwdkc', inside.x, inside.z, inside.level);
    setkc(p, 20);
    A.runProcProtected(p, '[label,gwd_left_a_square]');
    H.tick(3);
    check('  crossing between dungeon squares keeps it', kc(p, 'armadyl'), 20);

    // and actually leaving
    p.teleport(3200, 3200, 0);
    A.runProcProtected(p, '[label,gwd_left_a_square]');
    H.tick(3);
    check('  leaving the dungeon wipes all four', [kc(p, 'armadyl'), kc(p, 'bandos'), kc(p, 'saradomin'), kc(p, 'zamorak')], [0, 0, 0, 0]);
    check('  and says so', A.lastMes(p).includes('killcount with it'), true);
    H.despawn(p);
}

// ---------------------------------------------------------------- nothing else is up here
console.log('\nAND THE MOUNTAIN CARRIES NOTHING BUT THE MOUNTAIN');
// Reported from the game: "al kharid rooftop agility course showing up at gwd - clicking on an
// obstacle takes you to al kharid". A whole stray copy of the Al Kharid rooftop course had been
// grafted onto the God Wars surface - twenty-two placements, tightropes and zip lines and a
// tropical tree on a snowy mountain - and eight of them were clickable, each one running the
// course's own handler, which teleports you to Al Kharid because that is what it is for.
//
// A loc's ops belong to its TYPE, not to its placement, so the same type standing in two places
// behaves the same in both: there is nothing a handler can do about it and nothing an op list can
// say. The fix was deleting the placements, and this is what notices if a graft puts them back -
// by name, because what makes this a bug is which script the click reaches.
{
    const want = [
        ['gwd_boulder', 'Move=[oploc1,gwd_boulder]'],
        ['gwd_crack', 'Crawl-through=[oploc1,gwd_crack]'],
        ['gwd_hole_untied', 'Climb-down=[oploc1,gwd_hole_untied]'],
        // the surface's own three, which were dead when this check was written and are not any
        // more: the two Rocky handholds are the 60 Agility climb onto the plateau and the Old fire
        // pit says why you cannot light it (bosses/godwars/scripts/gwd_surface.rs2, and
        // tools/sim/gwdsurface.ts is what checks what they do rather than that they exist)
        ['osrsloc_26400', 'Climb=[oploc1,osrsloc_26400]'],
        ['osrsloc_26402', 'Climb=[oploc1,osrsloc_26402]'],
        ['osrsloc_33317', 'Build=[oploc1,osrsloc_33317]']
    ];
    const seen = new Map<string, string>();
    for (let lvl = 0; lvl < 4; lvl++)
        for (let x = 2890; x <= 2940; x++)
            for (let z = 3700; z <= 3770; z++)
                for (const loc of World.gameMap.getZone(x, z, lvl).getAllLocsUnsafe()) {
                    if (loc.x !== x || loc.z !== z || loc.level !== lvl) continue;
                    const t = LocType.get(loc.type);
                    if (!(t.op ?? []).filter(Boolean).length) continue;
                    const info: string[] = [];
                    for (let op = 1; op <= 5; op++) {
                        if (!t.op?.[op - 1]) continue;
                        const sc = ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1 + (op - 1), loc.type, t.category);
                        info.push(`${t.op[op - 1]}=${sc ? sc.info.scriptName : 'NOTHING'}`);
                    }
                    const dbg = t.debugname ?? `loc_${loc.type}`;
                    if (!seen.has(dbg)) seen.set(dbg, info.join('  '));
                }
    for (const [n, ops] of want) {
        check(`  ${n.padEnd(18)} is up here, and this is what clicking it runs`, seen.get(n) ?? 'MISSING', ops);
    }
    check('  and nothing else on the mountain can be clicked at all', [...seen.keys()].filter(n => !want.some(w => w[0] === n)).sort(), []);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
