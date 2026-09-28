// Map npc spawns against the real engine - `npx tsx tools/sim/npcspawns.ts`
// (content maps/*.jm2 NPC sections; the audit is scratchpad feat/npcaudit/npc_audit.md):
//
//   the cow field  Lumbridge's east cow field holds cows, calves and Gillie (Gee's second spawn is gone) -
//                  no Elf warrior (a stray line in the upstream spawn dump, m50_50 59 57)
//   by region      elves only in Tirannwn (and the Regicide/Mourning instances), Nardah's people only
//                  in the desert and the Elid's cave, jackals only in the desert
//   Falador        the nine wall guards (the OSRS wiki's "Guard - Falador Walls", level 1) are Guards
//                  again, not Nardah villagers; the two ground guards by the west bank and the
//                  Rising Sun are back; the longbow guards shoot rather than walk up to you
//   one each       one Old crone, at her house east of the Slayer Tower; the ghoul pack north of
//                  Canifis has no Leech in it
//   standing room  no map npc that walks stands where no player can reach it - in the sea, in a
//                  rock - except the ones that belong there (fishing spots, birds, stage extras);
//                  Lokar Searunner on Rellekka's pier, Ignatius Vulcan out of his tree
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import { canTravel, isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';

await H.boot();
H.loginOrder();
const { check } = A;

// Every npc a map square spawned (static respawners), with its debugname.
const spawns: { npc: Npc; name: string; disp: string }[] = [];
for (const n of World.npcs) {
    if (!n || n.lifecycle !== EntityLifeCycle.RESPAWN) continue;
    const t = NpcType.get(n.type);
    spawns.push({ npc: n, name: t.debugname ?? String(n.type), disp: t.name ?? '' });
}
const at = (x: number, z: number, level: number) => spawns.filter(s => s.npc.startX === x && s.npc.startZ === z && s.npc.level === level).map(s => s.name);
const where = (s: { npc: Npc }) => `${s.npc.startX},${s.npc.startZ},${s.npc.level}`;
const inBox = (s: { npc: Npc }, x1: number, z1: number, x2: number, z2: number) => s.npc.startX >= x1 && s.npc.startX <= x2 && s.npc.startZ >= z1 && s.npc.startZ <= z2;
check('the maps spawn their npcs', spawns.length > 12000, true);

console.log('THE COW FIELD');
const field = spawns.filter(s => s.npc.level === 0 && inBox(s, 3240, 3255, 3266, 3300)).map(s => s.name);
check('no Elf warrior in Lumbridge\'s cow field', field.filter(n => n.includes('elf')), []);
check('the field is cows, calves and Gillie', [...new Set(field)].filter(n => !/^(cow|cow2|cow3|cow2_calf|cow3_calf|calf|gillie_the_milkmaid)$/.test(n)), []);

console.log('BY REGION');
const overworld = (s: { npc: Npc }) => s.npc.startZ < 4400;
const elves = spawns.filter(s => /^(regicide_|mourning_|elf_|roving_)/.test(s.name) && overworld(s));
check('every elf-kind spawn on the surface is in Tirannwn', elves.filter(s => !inBox(s, 2150, 3050, 2420, 3450)).map(s => `${s.name}@${where(s)}`), []);
const elid = spawns.filter(s => s.name.startsWith('elid_'));
check('Nardah\'s people are in Nardah or the Elid\'s cave', elid.filter(s => !inBox(s, 3380, 2860, 3470, 2960) && !inBox(s, 3330, 9280, 3420, 9620)).map(s => `${s.name}@${where(s)}`), []);
const jackals = spawns.filter(s => s.disp === 'Jackal' && overworld(s));
check('jackals only in the desert', jackals.filter(s => s.npc.startZ > 3150).map(s => `${s.name}@${where(s)}`), []);
check('no Pyrefiend in Etceteria', spawns.filter(s => s.name.startsWith('slayer_pyrefiend') && inBox(s, 2500, 3840, 2640, 3910)).map(where), []);
check('no Mime (random event) outside his stage', spawns.filter(s => s.name === 'macro_mime' && !inBox(s, 1990, 4740, 2030, 4780)).map(where), []);

console.log('FALADOR');
// OSRS wiki, Guard: "Falador Walls", plane 1 - the same nine tiles the maps use.
const walls: [number, number][] = [[3031, 3389], [3039, 3388], [3049, 3389], [3056, 3389], [3064, 3384], [3028, 3329], [3038, 3329], [3051, 3329], [3059, 3330]];
check('the nine wall posts are wall guards (fai_falador_guard5/6)', walls.map(([x, z]) => at(x, z, 1).join('+')).filter(n => !/^fai_falador_guard[56]$/.test(n)), []);
check('no Nardah villager on the walls', spawns.filter(s => s.name.startsWith('elid_') && inBox(s, 2930, 3300, 3080, 3420)).length, 0);
check('the ground guard by the west bank', at(2950, 3379, 0), ['fai_falador_guard4']);
check('the ground guard by the Rising Sun', at(2968, 3379, 0), ['fai_falador_guard4']);
for (const g of ['fai_falador_guard4', 'fai_falador_guard5', 'fai_falador_guard6']) {
    const id = NpcType.getId(g);
    check(`${g} shoots (ai_applayer2 and ai_opplayer2 triggers)`, !!ScriptProvider.getByTriggerSpecific(ServerTriggerType.AI_APPLAYER2, id, -1) && !!ScriptProvider.getByTriggerSpecific(ServerTriggerType.AI_OPPLAYER2, id, -1), true);
}
// A player on the south wall four tiles from a guard (wherever its wander has taken it): the guard
// shoots from where it stands.
const guard = spawns.find(s => s.name.startsWith('fai_falador_guard') && s.npc.startX === 3051 && s.npc.startZ === 3329)!.npc;
const archer = A.player('wallwalker', guard.x - 4, guard.z, 1);
if (Math.abs(guard.x - archer.x) < 4) archer.teleport(guard.x - 4, guard.z, 1);
H.clearLogs();
H.setNpcMode(guard, 'APPLAYER2', archer);
// Tick until the first arrow lands; the distance then is the guard's range, before the player's
// auto-retaliate walks it up to the guard.
let firstHitGap = -1;
for (let t = 0; t < 12 && firstHitGap < 0; t++) {
    H.tick(1);
    if (process.env.DBG) console.log('t', t, 'guard', guard.x, guard.z, guard.level, 'player', archer.x, archer.z, archer.level, 'hits', H.hits.filter(h => h.who === archer.username).length);
    if (H.hits.some(h => h.who === archer.username)) firstHitGap = Math.max(Math.abs(guard.x - archer.x), Math.abs(guard.z - archer.z));
}
check('the wall guard hits a player four tiles off', firstHitGap >= 0, true);
check('  from range - the first arrow lands with the player still out of reach', firstHitGap > 1, true);
check('  and stayed on the wall', guard.level, 1);
H.despawn(archer);

console.log('ONE EACH');
check('one Old crone in the world', spawns.filter(s => s.name === 'ahoy_crone').map(where), ['3461,3558,0']);
check('the ghouls north of Canifis have no Leech among them', at(3413, 3514, 0), ['ghoul']);

console.log('STANDING ROOM');
// Tiles a player can reach next to the npc: a walkable neighbour, grown four steps.
function reach(n: Npc): number {
    const size = NpcType.get(n.type).size;
    const seen = new Set<number>();
    const q: [number, number][] = [];
    for (let dx = -1; dx <= size; dx++) for (let dz = -1; dz <= size; dz++) {
        const x = n.startX + dx, z = n.startZ + dz;
        if (!isFlagged(x, z, n.level, CollisionFlag.WALK_BLOCKED)) { seen.add(x * 65536 + z); q.push([x, z]); }
    }
    while (q.length && seen.size < 30) {
        const [cx, cz] = q.shift()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = (cx + dx) * 65536 + cz + dz;
            if (!seen.has(k) && canTravel(n.level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.add(k); q.push([cx + dx, cz + dz]); }
        }
    }
    return seen.size;
}
// What stands in the sea, a swamp or a rock on purpose: water and sky creatures, spots, stage extras.
const belongs = new Set(['Fishing spot', 'Duck', 'Duckling', 'Swan', 'Gull', 'Seagull', 'Ghast', "Will o' the wisp", 'Giant bat', 'Spinolyp', 'Suspicious water',
    'Light creature', 'Storm Cloud', 'Shark', 'Whirlpool', 'Butterfly', 'Bald Headed Eagle', 'Eagle', 'Crocodile', 'Strange watcher', 'Mime', 'Quiz Master', '']);
const stage = new Set(['zogre_drummer1', 'zogre_drummer2', 'mm_caranock_cutscene', 'mm_foreman_cutscene', 'gnomeknight']);
const stranded = spawns.filter(s => !belongs.has(s.disp) && !stage.has(s.name) && reach(s.npc) === 0);
check('no map npc stranded where no player can reach it', stranded.map(s => `${s.name}@${where(s)}`), []);
const lokar = spawns.find(s => s.name === 'lokar_searunner' && s.npc.startZ < 3800)!;
check('Lokar Searunner stands on Rellekka\'s pier', !isFlagged(lokar.npc.startX, lokar.npc.startZ, 0, CollisionFlag.WALK_BLOCKED) && reach(lokar.npc) >= 10, true);
const ign = spawns.find(s => s.name === 'skillcape_ignatius')!;
check('Ignatius Vulcan is not inside a tree', isFlagged(ign.npc.startX, ign.npc.startZ, 0, CollisionFlag.WALK_BLOCKED), false);

console.log(`\n${A.R.ok} ok, ${A.R.bad} failed`);
process.exit(A.R.bad ? 1 : 0);
