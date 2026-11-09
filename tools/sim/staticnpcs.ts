// NPCS THAT WERE AUTHORED TO STAND STILL AND WANDER ANYWAY.
//
//   npx tsx tools/sim/staticnpcs.ts
//
// "drunken ali shouldn't be moving - he should be a static npc."
//
// NpcType.wanderrange defaults to 5, so an npc wanders unless its config says otherwise, and
// nothing in feud_drunken_ali's config said otherwise. He is posed with readyanim
// viking_drinking_ready and has no walkanim at all, so wandering slid a man frozen mid-drink
// around the Pollnivneach street.
//
// THE SIGNAL, which is what makes this checkable rather than a list of names somebody eyeballed:
// an npc with a readyanim but NO walkanim has been given a pose and no way to move in it. The
// author made that choice. An npc with neither is a different thing - it falls back to the
// standard human animations and walks perfectly well (feud_villager_1_1, tbwcu_gabooty) - and an
// npc with both is simply mobile.
//
// ONE KIND OF FALSE POSITIVE, handled rather than hand-waved: MoveRestrict.NOMOVE npcs already
// cannot move whatever their wanderrange says, so they are not faults (32 of them).
// Npc.wanderMode and Npc.updateMovement both check it.
//
// AND ONE THAT LOOKS LIKE A SECOND AND IS NOT. A multinpc shell is DRAWN as whichever npc its varp
// resolves to, so it is tempting to ask the resolved form about the walkanim - and asking the
// wrong one gives 44 false alarms, the Feud and Tai Bwo Wannai villagers among them. The client
// settles it: Client.java copies readyanim and walkanim off the SHELL at npc creation (opcodes 13
// and 14/17, field1424 and field1448) and the resolved type is only consulted later, in
// NpcType.method475, for the MODEL. So the shell's own animations are what plays, and the rule
// below is the same for a shell as for anything else. feud_villager_multi_1 carries
// human_walk_f/b/l/r and walks perfectly well; its resolved forms carry nothing and never needed
// to.
//
// EXEMPTIONS are named, not guessed - see EXEMPT below.
import * as H from './harness.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import SeqType from '#/cache/config/SeqType.js';
import { MoveRestrict } from '#/engine/entity/MoveRestrict.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

/** Posed, no walkanim, and still meant to move. Each one needs a reason. */
const EXEMPT = new Map<string, string>([
    ['impling_spawner_low', 'an invisible spawn point that roams on purpose (wanderrange 32)'],
    ['impling_spawner_mid', 'as impling_spawner_low'],
    ['impling_spawner_high', 'as impling_spawner_low'],
    ['impling_spawner_world_low', 'as impling_spawner_low, over the whole world (wanderrange 100)'],
    ['impling_spawner_world_mid', 'as impling_spawner_world_low'],
    ['impling_spawner_world_high', 'as impling_spawner_world_low'],
    ['elid_genie', 'its readyanim is human_geni_walkandready - one sequence serving both, so it does walk']
]);

console.log('\n================ POSED NPCS THAT CAN STILL WANDER');

const spawned = new Map<number, number>();
for (const npc of World.npcs) {
    if (!npc) continue;
    spawned.set(npc.type, (spawned.get(npc.type) ?? 0) + 1);
}
check('the world has its static npcs', spawned.size > 2000, true);

const loose: string[] = [];
let exempted = 0;
let pinned = 0;

for (const [type, count] of spawned) {
    const t = NpcType.get(type);
    const name = t.debugname ?? String(type);

    if (t.moverestrict === MoveRestrict.NOMOVE) continue;
    if (t.walkanim !== -1) continue;

    if (EXEMPT.has(name)) {
        exempted++;
        continue;
    }
    if (t.wanderrange === 0) {
        pinned++;
        continue;
    }
    const ready = t.readyanim === -1 ? '(no readyanim either)' : (SeqType.get(t.readyanim)?.debugname ?? String(t.readyanim));
    loose.push(`${name} x${count} (ready=${ready}) wanderrange=${t.wanderrange}`);
}

console.log(`\n  ${pinned} type(s) pinned with wanderrange=0, ${exempted} exempt by name`);
check('nothing posed is left free to wander', loose.sort(), []);

// THE EXEMPTIONS HAVE TO STILL BE REAL. An exemption for an npc that no longer matches the rule
// is dead weight that hides the next one, so say so.
const stale: string[] = [];
for (const name of EXEMPT.keys()) {
    const id = NpcType.getId(name);
    if (id === -1) {
        stale.push(`${name} is not an npc any more`);
        continue;
    }
    const t = NpcType.get(id);
    if (t.walkanim !== -1 || t.wanderrange === 0 || t.moverestrict === MoveRestrict.NOMOVE) {
        stale.push(`${name} no longer needs an exemption`);
    }
}
check('no exemption has gone stale', stale, []);

// ---- AND DRUNKEN ALI HIMSELF, because a config value is a claim about behaviour. ----
console.log('\n================ HE STAYS WHERE HE IS');

const ALI = H.npcNear('feud_drunken_ali', 3360, 2957);
check('Drunken Ali is in Pollnivneach', ALI !== null, true);

if (ALI) {
    const from = `${ALI.startX},${ALI.startZ}`;
    // wanderMode rolls a 1/8 chance every tick, so 400 ticks is ~50 attempted moves. Before the
    // fix he was several tiles away long before this.
    let furthest = 0;
    for (let i = 0; i < 400; i++) {
        H.tick(1);
        const d = Math.max(Math.abs(ALI.x - ALI.startX), Math.abs(ALI.z - ALI.startZ));
        if (d > furthest) furthest = d;
    }
    check(`after 400 ticks he is still on ${from}`, `${ALI.x},${ALI.z}`, from);
    check('and never left it at any point', furthest, 0);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
