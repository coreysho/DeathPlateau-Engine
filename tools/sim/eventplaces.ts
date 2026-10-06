// WHERE THE RANDOM EVENT ROOMS ARE, if they are anywhere.
//
//   npx tsx tools/sim/eventplaces.ts
//
// Eleven of 2006scape's forty randoms are still missing, and the audit in
// content/tools/randomevents.py can only say "the character exists". That is not the question for
// these: Evil Bob needs an island, the Mime needs a stage, Prison Pete needs a cell. This boots the
// world once and asks, for every marker that would have to be somewhere, whether it is placed - and
// then prints what else stands in the same map square, which is how a room gets identified when
// nothing in it is named after the event.
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

type Place = { level: number; x: number; z: number };
const sq = (p: Place) => `${p.x >> 6}_${p.z >> 6}`;

// ------------------------------------------------------------------ every loc placement, once
const locsByName = new Map<string, Place[]>();
const locsBySquare = new Map<string, Map<string, number>>();
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        const name = LocType.get(loc.type).debugname ?? `loc_${loc.type}`;
        const p: Place = { level: loc.level, x: loc.x, z: loc.z };
        (locsByName.get(name) ?? locsByName.set(name, []).get(name)!).push(p);
        const key = sq(p);
        const bag = locsBySquare.get(key) ?? locsBySquare.set(key, new Map()).get(key)!;
        bag.set(name, (bag.get(name) ?? 0) + 1);
    }
}

const npcsByName = new Map<string, Place[]>();
for (const npc of World.npcs) {
    if (!npc) continue;
    const name = NpcType.get(npc.type).debugname ?? `npc_${npc.type}`;
    (npcsByName.get(name) ?? npcsByName.set(name, []).get(name)!).push({ level: npc.level, x: npc.x, z: npc.z });
}

const where = (names: string[], from: Map<string, Place[]>) => {
    const out: string[] = [];
    for (const n of names) {
        const hits = from.get(n);
        if (!hits?.length) continue;
        out.push(`${n} x${hits.length} @ ${hits[0].level},${hits[0].x},${hits[0].z}`);
    }
    return out;
};

// ------------------------------------------------------------------ the eleven, and their markers
const EVENTS: { who: string; npcs: string[]; locs: string[]; objs: string[] }[] = [
    { who: 'Mime', npcs: ['macro_mime'], locs: ['macro_theatre_floor', 'macro_spotlight', 'macro_theatrewall', 'macro_theatre_curtains_left', 'macro_theatre_chair'], objs: ['macro_mime_mask'] },
    { who: 'Prison Pete', npcs: ['prisonpete_pete'], locs: ['prisonpete_lever', 'prisonpete_energybarrier', 'prisonpete_door_1', 'balloon_red'], objs: ['laderhosen_top'] },
    { who: 'Evil Bob', npcs: ['macro_evil_bob_outside'], locs: [], objs: ['evil_bob_net', 'evil_bob_amulet_of_manspeak'] },
    { who: 'Gravedigger', npcs: ['macro_gravedigger'], locs: [], objs: ['macro_digger_coffin_object_1', 'macro_digger_shirt'] },
    { who: 'Freaky forester', npcs: ['macro_forester_m'], locs: [], objs: ['raw_macro_pheasant_good'] },
    { who: 'Quiz master', npcs: ['macro_magneson'], locs: [], objs: ['macro_quiz_mystery_box'] },
    { who: 'Drill Demon', npcs: ['macro_drilldemon'], locs: ['sandpit'], objs: [] },
    { who: 'Pillory', npcs: ['macro_pillory_guard'], locs: ['stocks'], objs: [] },
    { who: 'Kiss the frog', npcs: ['macro_frog_prince'], locs: [], objs: ['macro_frog_token', 'macro_frog_mask'] },
    { who: "Cap'n Arnav", npcs: ['macro_combilock_pirate'], locs: [], objs: [] },
    { who: 'Jekyll and Hyde', npcs: ['macro_jekyll'], locs: [], objs: [] }
];

for (const e of EVENTS) {
    console.log(`\n== ${e.who}`);
    const n = where(e.npcs, npcsByName);
    console.log(`   npc placed : ${n.length ? n.join(', ') : 'NOT PLACED (event spawn only)'}`);
    if (e.locs.length) {
        const l = where(e.locs, locsByName);
        console.log(`   locs placed: ${l.length ? l.join(', ') : 'NONE of ' + e.locs.join('/')}`);
    }
    const objs = e.objs.filter(o => ObjType.getId(o) !== -1);
    console.log(`   objs in build: ${objs.length}/${e.objs.length}${objs.length ? ' (' + objs.join(', ') + ')' : ''}`);
}

// ------------------------------------------------------------------ what is out in the off-world band
// Random event rooms live north of the real map, in the same band as the instanced minigames. A
// square out there with locs in it is a room somebody built; naming the three commonest locs is
// usually enough to recognise which one.
console.log('\n== off-world squares with scenery in them (z >= 4096), three commonest locs each');
const rows = [...locsBySquare.entries()]
    .filter(([k]) => Number(k.split('_')[1]) >= 64)
    .sort((a, b) => a[0].localeCompare(b[0]));
for (const [key, bag] of rows) {
    const top = [...bag].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} x${c}`);
    const [sx, sz] = key.split('_').map(Number);
    console.log(`   ${key} (${sx * 64}-${sx * 64 + 63}, ${sz * 64}-${sz * 64 + 63})  ${[...bag.values()].reduce((a, b) => a + b, 0)} locs: ${top.join(', ')}`);
}

process.exit(0);
