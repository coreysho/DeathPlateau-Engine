// DOES APE ATOLL ATTACK YOU, AND DOES THE GREEGREE STOP IT?
//
// Every npc on the island and in Zooknock's tunnel was missing a huntmode, so nothing ever
// attacked anybody: the monkey guards watched the player walk past and the archers on the
// walkways never loosed an arrow. The fix is a hunt of the quest's own, shaped on the cache's
// aggressive pair with one addition borrowed from the God Wars dungeon -
// check_invparam=worn,mm_transmog_npc,<1 - so a player wearing a greegree is invisible to the
// monkeys and anyone else is not.
//
// That is two claims and this checks both, because getting only the first would turn the island
// hostile to the very disguise the quest exists to give you.
//
// A sim npc never hunts on its own: Npc.processNpc only calls huntAll when a real client is
// observing it, and a harness player observes nothing. So the hunt is driven by hand, the way
// questrun's `wakehunt` step does it.
//
//   npx tsx tools/sim/mmaggro.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import HuntType from '#/cache/config/HuntType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';

await H.boot();

/** The nearest live npc of this type to a tile. */
function near(name: string, x: number, z: number, level = 0, r = 24) {
    const id = NpcType.getId(name);
    let best: any = null;
    let bd = 1e9;
    for (const npc of World.npcs) {
        if (!npc || !npc.isActive || npc.type !== id || npc.level !== level) continue;
        const d = Math.max(Math.abs(npc.x - x), Math.abs(npc.z - z));
        if (d <= r && d < bd) {
            bd = d;
            best = npc;
        }
    }
    return best;
}

/** Drive the npc's own hunt by hand for a few ticks and say whether it took the player. */
function hunts(npc: any, p: any, ticks = 10): boolean {
    for (let t = 0; t < ticks; t++) {
        if (npc.huntMode !== -1 && npc.isValid()) {
            const hunt = HuntType.get(npc.huntMode);
            if (hunt) {
                npc.huntAll(hunt);
                npc.huntClock++;
            }
        }
        H.tick(1);
        const target = npc.target ?? null;
        if (target && target.username === p.username) return true;
    }
    return false;
}

// ---------------------------------------------------------------- the island's guards
console.log('\nAPE ATOLL, TO A HUMAN');
const guards: [string, number, number][] = [];
for (const name of ['mm_monkey_guard', 'mm_monkey_archer', 'mm_posted_archer', 'mm_ravine_archer',
                    'mm_religious_guard', 'mm_oipuis', 'mm_ouhai', 'mm_uodai', 'mm_uyoro',
                    'mm_zombie_monkey_small', 'mm_zombie_monkey_large', 'mm_skeleton']) {
    const id = NpcType.getId(name);
    let found: any = null;
    for (const npc of World.npcs) {
        if (npc && npc.isActive && npc.type === id) {
            found = npc;
            break;
        }
    }
    if (!found) {
        // NOT A FAILURE, A GAP THAT IS NAMED. Five of Marim's monkeys have no static spawn at all -
        // mm_monkey_guard and the four named ninja monkeys Oipuis, Ouhai, Uodai and Uyoro - so
        // there is nothing of them on the island to make aggressive. Their configs are complete
        // and their spawn coordinates are not in the cache; OSRS's are in the wiki's LocLine rows.
        // Printed rather than asserted so this suite stays green on what it can actually test.
        console.log(`  --   ${name.padEnd(28)} has no static spawn anywhere, so nothing to hunt with`);
        continue;
    }
    guards.push([name, found.x, found.z]);
    const type = NpcType.get(id);
    check(`${name.padEnd(28)} has a huntmode`, (type as unknown as { huntmode: number }).huntmode !== -1, true);
}

// ---------------------------------------------------------------- it attacks a human
console.log('\nAND IT COMES FOR A HUMAN WHO WALKS PAST');
for (const [name, x, z] of guards) {
    const npc = near(name, x, z, 0, 2);
    if (!npc) continue;
    // beside it, not inside it: a size-2 npc occupies x..x+1, so x+1 is its own square
    const sz = NpcType.get(npc.type).size ?? 1;
    const p: any = player('human_' + name.slice(3, 14), x + sz, z, npc.level);
    H.setVar(p, 'tutorial', 1000);
    H.tick(2);
    const took = hunts(npc, p, 12);
    check(`    ${name.padEnd(28)} attacks a human standing beside it`, took, true);
    H.despawn(p);
}

// ---------------------------------------------------------------- and ignores a monkey
console.log('\nAND LEAVES A MONKEY ALONE');
const greegree = 'mm_monkey_greegree_for_normal_monkey';
let worn = 0;
for (const [name, x, z] of guards) {
    if (!name.startsWith('mm_') || name.includes('zombie') || name.includes('skeleton')) continue;
    const npc = near(name, x, z, 0, 2);
    if (!npc) continue;
    const sz2 = NpcType.get(npc.type).size ?? 1;
    const p: any = player('monkey_' + name.slice(3, 13), x + sz2, z, npc.level);
    H.setVar(p, 'tutorial', 1000);
    H.equip(p, { rhand: greegree });    // the quest makes you wield it, and worn is what the hunt reads
    H.tick(2);
    const on = (() => {
        const inv = p.getInventory(InvType.WORN);
        if (!inv) return false;
        for (let i = 0; i < inv.capacity; i++) {
            const o = inv.get(i);
            if (o && ObjType.get(o.id).debugname === greegree) return true;
        }
        return false;
    })();
    if (!on) {
        check(`    ${name.padEnd(28)} (could not wield the greegree)`, false, true);
        H.despawn(p);
        continue;
    }
    worn++;
    const took = hunts(npc, p, 12);
    check(`    ${name.padEnd(28)} ignores a player wearing a greegree`, took, false);
    H.despawn(p);
}
check('the greegree was actually worn for those', worn > 0, true);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
